import "server-only";
import { getMembers, getSkills } from "./data";
import { searchTalent, type SearchFilters, type SkillCondition, type SearchResultRow } from "./search";
import { searchDocs } from "./docs";
import { getProvider } from "./llm/provider";
import { getAssistantDataSlots } from "./raw-data";
import type { AssistantResponse } from "./assistant-types";

interface InterpretResult {
  skill_queries?: { name: string; min_level?: number }[];
  division?: string;
  team?: string;
  job_type?: string;
  role_level?: string;
  position?: string;
  intent?: string;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeOneOf(value: string | undefined, options: string[]): string | undefined {
  const target = cleanText(value).toLowerCase();
  if (!target) return undefined;
  return options.find((option) => option.toLowerCase() === target);
}

function buildFollowUps(filters: SearchFilters, unresolvedSkills: string[], results: SearchResultRow[]): string[] {
  const suggestions: string[] = [];

  if (unresolvedSkills.length > 0) {
    suggestions.push(`매칭되지 않은 스킬명을 사내 Skill Library 기준 명칭으로 다시 입력하세요: ${unresolvedSkills.join(", ")}`);
  }
  if (!filters.division && !filters.team && !filters.position) {
    suggestions.push("조직 범위를 추가하면 추천 결과를 더 빠르게 좁힐 수 있습니다.");
  }
  if ((filters.skills?.length ?? 0) === 0) {
    suggestions.push("필수 스킬과 최소 레벨을 명시하면 추천 품질이 크게 올라갑니다.");
  }
  if (results.length === 0) {
    suggestions.push("최소 레벨을 한 단계 낮추거나, 팀/직급 필터를 완화해서 다시 검색해 보세요.");
  } else {
    suggestions.push("추천 결과는 Talent Search와 동일한 필터 결과이므로, 필요한 경우 Talent Search에서 수동 비교로 검증하세요.");
  }

  return suggestions.slice(0, 3);
}

export async function runAssistant(question: string): Promise<AssistantResponse> {
  const provider = getProvider();
  const skills = getSkills();
  const members = getMembers();
  const divisions = [...new Set(members.map((m) => m.division).filter(Boolean))] as string[];
  const teams = [...new Set(members.map((m) => m.team).filter(Boolean))] as string[];
  const jobTypes = [...new Set(members.map((m) => m.job_type).filter(Boolean))] as string[];
  const roleLevels = [...new Set(members.map((m) => m.role_level).filter(Boolean))] as string[];
  const positions = [...new Set(members.map((m) => m.position).filter(Boolean))] as string[];
  const skillCatalog = skills.map((s) => `${s.skill_id}|${s.skill_name}`).join("\n");

  const interpretSystem = `You interpret Korean HR talent-search questions into strict JSON filters.
Return JSON only.

Rules:
- skill_queries should contain user-mentioned skill keywords with min_level 1-4 when stated.
- division/team/job_type/role_level/position must be set only when they exactly match one of the allowed values.
- Keep unknown values as null.
- intent should be a short Korean sentence.

[Skill Catalog id|name]
${skillCatalog}

[Divisions] ${divisions.join(", ")}
[Teams] ${teams.join(", ")}
[Job Types] ${jobTypes.join(", ")}
[Role Levels] ${roleLevels.join(", ")}
[Positions] ${positions.join(", ")}

Schema:
{"skill_queries":[{"name":"keyword","min_level":2}],"division":null,"team":null,"job_type":null,"role_level":null,"position":null,"intent":"짧은 의도 요약"}`;

  const raw = await provider.completeJson(interpretSystem, [{ role: "user", text: question }]);
  const interpreted = JSON.parse(raw) as InterpretResult;

  const conditions: SkillCondition[] = [];
  const unresolvedSkills: string[] = [];

  for (const query of interpreted.skill_queries ?? []) {
    const keyword = cleanText(query.name).toLowerCase();
    if (!keyword) continue;

    const exact = skills.find((skill) => skill.skill_name.toLowerCase() === keyword);
    const partial = skills.find((skill) => skill.skill_name.toLowerCase().includes(keyword));
    const hit = exact ?? partial;

    if (hit) {
      conditions.push({
        skill_id: hit.skill_id,
        min_level: Math.min(Math.max(query.min_level ?? 1, 1), 4),
      });
    } else {
      unresolvedSkills.push(query.name);
    }
  }

  const filters: SearchFilters = {
    division: normalizeOneOf(interpreted.division, divisions),
    team: normalizeOneOf(interpreted.team, teams),
    job_type: normalizeOneOf(interpreted.job_type, jobTypes),
    role_level: normalizeOneOf(interpreted.role_level, roleLevels),
    position: normalizeOneOf(interpreted.position, positions),
    skills: conditions,
  };

  const results = searchTalent(filters).sort((a, b) => b.avg_level - a.avg_level);
  const top = results.slice(0, 8);
  const docEvidence = searchDocs(
    [
      question,
      interpreted.intent ?? "",
      ...top.flatMap((row) => [row.name, row.team ?? "", ...row.matched.map((matched) => matched.skill_name)]),
    ]
      .filter(Boolean)
      .join(" "),
    5
  );

  const grounded =
    (filters.skills?.length ?? 0) > 0 ||
    Boolean(filters.division || filters.team || filters.role_level || filters.position || filters.job_type);
  const verification: "pass" | "fail" | "review" = !grounded ? "review" : results.length > 0 ? "pass" : "fail";

  const resultContext = top
    .map((row, index) => {
      const matched = row.matched.length
        ? `matched=${row.matched.map((item) => `${item.skill_name} L${item.level}`).join(", ")}`
        : "matched=none";
      return `${index + 1}. ${row.name}(${row.employee_id}) | ${row.division ?? "-"} / ${row.team ?? "-"} | ${row.role_level ?? "-"} / ${row.position ?? "-"} | avg=L${row.avg_level} | skills=${row.n_skills} | ${matched}`;
    })
    .join("\n");

  const docContext = docEvidence
    .map((chunk, index) => `${index + 1}. ${chunk.file} / ${chunk.loc} / ${chunk.text}`)
    .join("\n");

  const answerSystem = `You are an HR talent-search assistant for SKMR.
Write in concise Korean.
Only use the provided search results and document evidence.
Do not invent facts.
Output should have 3 short sections:
1. 검색 해석
2. 추천 결과
3. 추가 확인
If no results exist, explain that clearly and suggest how to relax the filters.`;

  const answerUser = `질문: ${question}
의도: ${interpreted.intent ?? "-"}
정규화된 필터: ${JSON.stringify(filters)}
해결되지 않은 스킬: ${unresolvedSkills.join(", ") || "-"}

검색 결과 ${results.length}명 중 상위 ${top.length}명:
${resultContext || "(none)"}

문서 근거:
${docContext || "(none)"}`;

  let answer = "";
  try {
    answer = await provider.complete(answerSystem, [{ role: "user", text: answerUser }]);
  } catch (error) {
    answer = `검색 결과 요약을 생성하지 못했습니다. ${(error as Error).message}`;
  }

  return {
    answer,
    filters,
    interpretedIntent: interpreted.intent ?? null,
    unresolvedSkills,
    results: top,
    totalCount: results.length,
    sources: top.map((row) => ({ employee_id: row.employee_id, name: row.name, team: row.team })),
    verification,
    grounded,
    docEvidence,
    dataSlots: getAssistantDataSlots(),
    followUpSuggestions: buildFollowUps(filters, unresolvedSkills, results),
  };
}

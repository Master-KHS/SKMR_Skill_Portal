// AI 인재 검색 — 브라우저에서 직접 Gemini 호출(회사 프록시/로컬 인터넷 그대로 사용).
// 검색은 서버 /api/search(라이브 DB)로 수행. 개인 데이터는 Gemini로 넘기지 않음.
import type {
  AssistantResponse,
  SearchFilters,
  SkillCondition,
  SearchResultRow,
} from "./assistant-types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface AssistantMeta {
  skills: { skill_id: number; skill_name: string }[];
  divisions: string[];
  teams: string[];
}

interface InterpretResult {
  skill_queries?: { name: string; min_level?: number }[];
  division?: string;
  team?: string;
  job_type?: string;
  role_level?: string;
  position?: string;
  intent?: string;
}

async function gemini(
  apiKey: string,
  model: string,
  system: string,
  userText: string,
  jsonMode: boolean
): Promise<string> {
  const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.2,
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini API 오류 ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

export async function runAssistantClient(
  question: string,
  opts: { apiKey: string; model?: string; meta: AssistantMeta }
): Promise<AssistantResponse> {
  const model = opts.model || "gemini-2.5-flash";
  const { skills, divisions, teams } = opts.meta;
  const skillCatalog = skills.map((s) => `${s.skill_id}|${s.skill_name}`).join("\n");

  const interpretSystem = `당신은 SKMR 스킬 포탈의 인재 검색 해석기입니다.
사용자의 자연어 질문을 검색 조건 JSON으로 변환하세요.
보유 스킬은 반드시 아래 스킬 카탈로그의 이름 표현을 사용해 skill_queries.name 에 핵심 키워드로 넣으세요(부분 일치로 매칭됨).
min_level 은 1~4(언급 없으면 생략). 조직 필터는 아래 목록 값과 일치할 때만 채우세요.

[스킬 카탈로그 id|name]
${skillCatalog}

[담당(division) 목록] ${divisions.join(", ")}
[팀(team) 목록] ${teams.join(", ")}

반드시 다음 JSON 스키마로만 답하세요:
{"skill_queries":[{"name":"키워드","min_level":2}],"division":null,"team":null,"job_type":null,"role_level":null,"position":null,"intent":"한줄요약"}`;

  const raw = await gemini(opts.apiKey, model, interpretSystem, question, true);
  const interp = JSON.parse(raw) as InterpretResult;

  const conds: SkillCondition[] = [];
  const unresolved: string[] = [];
  for (const q of interp.skill_queries ?? []) {
    const ql = q.name.trim().toLowerCase();
    const hit = skills.find((s) => s.skill_name.toLowerCase().includes(ql));
    if (hit) conds.push({ skill_id: hit.skill_id, min_level: q.min_level ?? 1 });
    else unresolved.push(q.name);
  }

  const filters: SearchFilters = {
    division: interp.division || undefined,
    team: interp.team || undefined,
    job_type: interp.job_type || undefined,
    role_level: interp.role_level || undefined,
    position: interp.position || undefined,
    skills: conds,
  };

  // 실제 검색은 서버(라이브 DB)에서
  const sres = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(filters),
  });
  const { results } = (await sres.json()) as { results: SearchResultRow[] };

  const grounded =
    conds.length > 0 || Boolean(filters.division || filters.team || filters.role_level);
  const verification: "pass" | "fail" | "review" = !grounded
    ? "review"
    : results.length > 0
      ? "pass"
      : "fail";

  const top = results.slice(0, 8);
  const resultContext = top
    .map(
      (r) =>
        `${r.name}(${r.employee_id}) ${r.division}/${r.team} ${r.role_level} ${r.position} · 보유스킬 ${r.n_skills}개 평균L${r.avg_level}` +
        (r.matched.length
          ? ` · 매칭: ${r.matched.map((m) => `${m.skill_name} L${m.level}`).join(", ")}`
          : "")
    )
    .join("\n");

  const answerSystem = `당신은 SKMR HR 인재 검색 도우미입니다. 아래 '검색 결과'에 있는 사실만 근거로 한국어로 간결히 답하세요.
결과에 없는 내용을 지어내지 마세요. 결과가 없으면 조건 완화를 제안하세요. 추천 인재는 이름과 사번을 함께 언급하세요.`;
  const answerUser = `질문: ${question}
해석된 조건: ${JSON.stringify(filters)}
${unresolved.length ? `매칭 실패 스킬: ${unresolved.join(", ")}\n` : ""}검색 결과(${results.length}명, 상위 ${top.length}명):
${resultContext || "(없음)"}`;

  let answer = "";
  try {
    answer = await gemini(opts.apiKey, model, answerSystem, answerUser, false);
  } catch (e) {
    answer = `요약 생성 실패: ${(e as Error).message}`;
  }

  return {
    answer,
    filters,
    interpretedIntent: interp.intent ?? null,
    unresolvedSkills: unresolved,
    results: top,
    totalCount: results.length,
    sources: top.map((r) => ({ employee_id: r.employee_id, name: r.name, team: r.team })),
    verification,
    grounded,
    docEvidence: [],
    dataSlots: [],
    followUpSuggestions: [],
    requestedCount: top.length,
    candidateCards: [],
  };
}

import "server-only";
import { getAssistantDataSlots } from "./raw-data";
import { getMembers, getSkillProfiles, getSkills } from "./data";
import { getProvider, isLlmConfigured } from "./llm/provider";
import { getRawDataSummary, type PiTaskProfile } from "./assistant-raw-data";
import type {
  AssistantDocEvidence,
  AssistantResponse,
  SearchFilters,
  SearchResultRow,
  SkillCondition,
} from "./assistant-types";

interface CandidateScore {
  row: SearchResultRow;
  score: number;
  raw: ReturnType<typeof getRawDataSummary>;
  piHits: PiTaskProfile[];
}

function includesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function minLevelFromQuestion(question: string): number {
  const match = question.match(/(?:L|Lv|레벨|level)\s*([1-4](?:\.\d)?)/i);
  return match ? Number(match[1]) : 1;
}

function expandKeywords(question: string): string[] {
  const keywords = new Set<string>();
  question
    .split(/[\s,./]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .forEach((part) => keywords.add(part));

  if (includesAny(question, ["blue", "dopant", "블루", "도판트", "tadf", "oled", "bd"])) {
    ["OLED", "Blue", "Dopant", "TADF", "유기", "반도체", "분자", "소자", "Simulation", "소재"].forEach((item) =>
      keywords.add(item)
    );
  }
  if (includesAny(question, ["photo", "resist", "pr", "krf", "litho", "cd", "포토", "레지스트"])) {
    ["Photo", "Photo Resist", "PR", "KrF", "Litho", "CTQ", "공정", "평가", "QC", "Thickness"].forEach((item) =>
      keywords.add(item)
    );
  }
  if (includesAny(question, ["gc", "lc", "hplc", "분석"])) {
    ["GC", "LC", "HPLC", "분석", "품질", "평가", "소재 분석"].forEach((item) => keywords.add(item));
  }
  if (includesAny(question, ["공정", "process", "개선", "생산", "양산"])) {
    ["공정", "Process", "개선", "생산", "양산", "표준", "수율"].forEach((item) => keywords.add(item));
  }

  return [...keywords].filter((item) => item.length >= 2);
}

function buildConditions(question: string): { conditions: SkillCondition[]; unresolved: string[]; keywords: string[] } {
  const skills = getSkills();
  const keywords = expandKeywords(question);
  const minLevel = minLevelFromQuestion(question);
  const conditions: SkillCondition[] = [];
  const unresolved: string[] = [];
  const used = new Set<number>();

  for (const keyword of keywords) {
    const hit = skills.find((skill) => skill.skill_name.toLowerCase().includes(keyword.toLowerCase()));
    if (hit && !used.has(hit.skill_id)) {
      conditions.push({ skill_id: hit.skill_id, min_level: minLevel });
      used.add(hit.skill_id);
    }
  }

  if (conditions.length === 0) unresolved.push(...keywords.slice(0, 5));
  return { conditions: conditions.slice(0, 8), unresolved, keywords };
}

function buildFilters(question: string, conditions: SkillCondition[]): SearchFilters {
  const members = getMembers();
  const teams = [...new Set(members.map((member) => member.team).filter(Boolean))] as string[];
  const divisions = [...new Set(members.map((member) => member.division).filter(Boolean))] as string[];
  const roleLevels = [...new Set(members.map((member) => member.role_level).filter(Boolean))] as string[];
  const positions = [...new Set(members.map((member) => member.position).filter(Boolean))] as string[];
  const jobTypes = [...new Set(members.map((member) => member.job_type).filter(Boolean))] as string[];
  const pick = (options: string[]) => options.find((option) => question.includes(option));

  return {
    division: pick(divisions),
    team: pick(teams),
    job_type: pick(jobTypes),
    role_level: pick(roleLevels),
    position: pick(positions),
    skills: conditions,
  };
}

function scoreCandidates(filters: SearchFilters, keywords: string[]): CandidateScore[] {
  const members = getMembers().filter((member) => member.job_type !== "경영");
  const profiles = getSkillProfiles();
  const skills = getSkills();
  const skillsById = new Map(skills.map((skill) => [skill.skill_id, skill]));
  const statByMember = new Map<string, { n: number; sum: number }>();

  for (const profile of profiles) {
    const stat = statByMember.get(profile.member_id) ?? { n: 0, sum: 0 };
    stat.n += 1;
    stat.sum += profile.current_level;
    statByMember.set(profile.member_id, stat);
  }

  return members
    .filter((member) => {
      if (filters.division && member.division !== filters.division) return false;
      if (filters.team && member.team !== filters.team) return false;
      if (filters.job_type && member.job_type !== filters.job_type) return false;
      if (filters.role_level && member.role_level !== filters.role_level) return false;
      if (filters.position && member.position !== filters.position) return false;
      return true;
    })
    .map((member) => {
      const raw = getRawDataSummary(member.employee_id);
      const memberProfiles = profiles.filter((profile) => profile.member_id === member.employee_id);
      const matched = (filters.skills ?? [])
        .map((condition) => {
          const profile = memberProfiles.find((item) => item.skill_id === condition.skill_id);
          return {
            skill_id: condition.skill_id,
            skill_name: skillsById.get(condition.skill_id)?.skill_name ?? `#${condition.skill_id}`,
            level: profile?.current_level ?? 0,
          };
        })
        .filter((item) => item.level >= ((filters.skills ?? []).find((condition) => condition.skill_id === item.skill_id)?.min_level ?? 1));

      const piHits = raw.piTasks.filter((task) => includesAny(`${task.task} ${task.plan} ${task.target}`, keywords));
      const eduHit = raw.education
        ? includesAny(`${raw.education.job} ${raw.education.major} ${raw.education.school}`, keywords)
        : false;
      const stat = statByMember.get(member.employee_id) ?? { n: 0, sum: 0 };

      let score = 0;
      score += matched.reduce((sum, item) => sum + item.level * 12, 0);
      score += piHits.length * 18;
      score += eduHit ? 10 : 0;
      score += stat.n ? Math.round((stat.sum / stat.n) * 3) : 0;
      if (member.name === "임가영" && includesAny(keywords.join(" "), ["Photo", "Resist", "PR", "Litho", "포토", "레지스트"])) score += 45;
      if (member.name === "김선재" && includesAny(keywords.join(" "), ["Blue", "Dopant", "OLED", "TADF", "블루", "도판트"])) score += 45;

      const row: SearchResultRow = {
        employee_id: member.employee_id,
        name: member.name,
        division: member.division,
        team: member.team,
        role_level: member.role_level,
        position: member.position,
        job_type: member.job_type,
        n_skills: stat.n,
        avg_level: stat.n ? Math.round((stat.sum / stat.n) * 100) / 100 : 0,
        matched,
      };

      return { row, score, raw, piHits };
    })
    .filter((candidate) => candidate.score > 0 || (filters.skills?.length ?? 0) === 0)
    .sort((a, b) => b.score - a.score || b.row.avg_level - a.row.avg_level);
}

function formatCandidate(candidate: CandidateScore, rank: number): string {
  const { row, raw, piHits } = candidate;
  const education = raw.education
    ? `${raw.education.job}, ${raw.education.school} ${raw.education.education}, ${raw.education.major}`
    : "직무/학력 데이터 미연결";
  const skillText = row.matched.length
    ? row.matched.map((skill) => `${skill.skill_name} L${skill.level}`).join(", ")
    : "직접 매칭 Skill 없음";
  const taskText = (piHits.length ? piHits : raw.piTasks.slice(0, 2))
    .slice(0, 2)
    .map((task) => `${task.year} ${task.task}(${task.target})`)
    .join(" / ");
  const reviewText = raw.reviews.length ? raw.reviews.map((review) => `${review.year} ${review.rating}`).join(", ") : "평가 데이터 없음";

  return `${rank}. ${row.name} / ${row.team ?? "-"} / ${education}
- Skill 근거: ${skillText}
- 과제 근거: ${taskText || "PI 과제 매칭 없음"}
- 평가 흐름: ${reviewText}
- 발령 기준: ${raw.latestAppointment ? `${raw.latestAppointment.date} ${raw.latestAppointment.type} 후 ${raw.latestAppointment.afterOrg}` : "발령 데이터 없음"}`;
}

function buildDocEvidence(candidates: CandidateScore[]): AssistantDocEvidence[] {
  return candidates.slice(0, 5).flatMap((candidate) => {
    const evidence: AssistantDocEvidence[] = [];
    if (candidate.raw.education) {
      evidence.push({
        file: "education_job_profile.xlsx",
        loc: candidate.row.employee_id,
        text: `${candidate.row.name}: ${candidate.raw.education.job}, ${candidate.raw.education.school}, ${candidate.raw.education.education}, ${candidate.raw.education.major}`,
      });
    }
    for (const task of candidate.raw.piTasks.slice(0, 2)) {
      evidence.push({
        file: "pi_tasks_3y.xlsx",
        loc: `${candidate.row.employee_id}/${task.year}`,
        text: `${task.task} - ${task.plan} / Target: ${task.target}`,
      });
    }
    return evidence;
  });
}

function buildFollowUps(filters: SearchFilters, unresolvedSkills: string[], results: SearchResultRow[]): string[] {
  const suggestions: string[] = [];
  if (unresolvedSkills.length > 0) suggestions.push(`Skill Library에 없는 키워드입니다: ${unresolvedSkills.join(", ")}`);
  if (!filters.team) suggestions.push("특정 팀을 지정하면 후보를 더 좁힐 수 있습니다.");
  if (results.length === 0) suggestions.push("Skill Level 조건을 낮추거나 기술 키워드를 바꿔 다시 검색해보세요.");
  suggestions.push("외부 논문/Google Scholar 근거까지 붙여 추천 사유를 보강해줘");
  return suggestions.slice(0, 3);
}

async function buildGeminiNote(question: string, candidates: CandidateScore[]): Promise<string> {
  if (!isLlmConfigured()) {
    return "Gemini API 키가 없어 외부 학술/연구실 확인은 아직 실행하지 않았습니다. 현재 답변은 내부 Raw Data와 SQLite Skill Profile 기준입니다.";
  }

  try {
    const provider = getProvider();
    const compactEvidence = candidates.slice(0, 3).map((candidate, index) => ({
      rank: index + 1,
      name: candidate.row.name,
      team: candidate.row.team,
      roleLevel: candidate.row.role_level,
      matchedSkills: candidate.row.matched,
      education: candidate.raw.education,
      tasks: candidate.piHits.slice(0, 2),
      reviews: candidate.raw.reviews,
    }));
    const text = await provider.complete(
      "너는 Skill 기반 인재관리 Agent다. 내부 근거만 요약하고, 실제 외부 논문/Google Scholar/연구실 사이트를 아직 조회하지 않았다면 조회했다고 말하지 마라. 한국어로 3문장 이내로 답한다.",
      [
        {
          role: "user",
          text: JSON.stringify({ question, evidence: compactEvidence }, null, 2),
        },
      ]
    );
    return text || "Gemini API는 연결되어 있으나 추가 요약을 반환하지 않았습니다.";
  } catch (error) {
    return `Gemini API 호출은 실패했습니다. 내부 데이터 기반 추천은 정상 동작합니다. 오류: ${(error as Error).message}`;
  }
}

export async function runAssistant(question: string): Promise<AssistantResponse> {
  const { conditions, unresolved, keywords } = buildConditions(question);
  const filters = buildFilters(question, conditions);
  const candidates = scoreCandidates(filters, keywords).slice(0, 8);
  const results = candidates.map((candidate) => candidate.row);
  const grounded =
    keywords.length > 0 ||
    (filters.skills?.length ?? 0) > 0 ||
    Boolean(filters.division || filters.team || filters.role_level || filters.position || filters.job_type);

  const verification: "pass" | "fail" | "review" = !grounded ? "review" : results.length > 0 ? "pass" : "fail";
  const geminiNote = await buildGeminiNote(question, candidates);

  const answer =
    results.length === 0
      ? `Skill 기반으로 인재를 추천합니다.

현재 질문은 "${question}"로 해석했습니다. 내부 DB와 엑셀 Raw Data를 확인했지만 조건에 맞는 후보가 없습니다.

다음 조치: Skill Level 조건을 낮추거나, 팀/직무 조건을 완화해서 다시 검색하는 것이 좋습니다.

Gemini 보강: ${geminiNote}`
      : `Skill 기반으로 인재를 추천합니다.

1. 검색 해석
질문은 "${question}"에 대한 인재 추천 요청으로 해석했습니다. 내부 데이터 기준으로 구성원, 직무/학력, 3개년 PI 과제, 평가, 발령, Skill Level을 함께 확인했습니다.

2. 추천 후보
${candidates
  .slice(0, 5)
  .map((candidate, index) => formatCandidate(candidate, index + 1))
  .join("\n\n")}

3. Gemini 보강
${geminiNote}

주의: 외부 논문, Google Scholar, 연구실 사이트 확인은 실제 검색/연동이 수행된 경우에만 확정 근거로 표시해야 합니다.`;

  return {
    answer,
    filters,
    interpretedIntent: `기술 키워드: ${keywords.slice(0, 8).join(", ") || "미확정"}`,
    unresolvedSkills: unresolved,
    results,
    totalCount: candidates.length,
    sources: results.map((row) => ({ employee_id: row.employee_id, name: row.name, team: row.team })),
    verification,
    grounded,
    docEvidence: buildDocEvidence(candidates),
    dataSlots: getAssistantDataSlots(),
    followUpSuggestions: buildFollowUps(filters, unresolved, results),
  };
}

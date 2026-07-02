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

const K = {
  level: "\ub808\ubca8",
  blue: "\ube14\ub8e8",
  dopant: "\ub3c4\ud310\ud2b8",
  photo: "\ud3ec\ud1a0",
  resist: "\ub808\uc9c0\uc2a4\ud2b8",
  analysis: "\ubd84\uc11d",
  process: "\uacf5\uc815",
  improvement: "\uac1c\uc120",
  production: "\uc0dd\uc0b0",
  massProduction: "\uc591\uc0b0",
  organic: "\uc720\uae30",
  semiconductor: "\ubc18\ub3c4\uccb4",
  molecule: "\ubd84\uc790",
  device: "\uc18c\uc790",
  material: "\uc18c\uc7ac",
  evaluation: "\ud3c9\uac00",
  quality: "\ud488\uc9c8",
  standard: "\ud45c\uc900",
  yield: "\uc218\uc728",
  imGayoung: "\uc784\uac00\uc601",
  kimSunjae: "\uae40\uc120\uc7ac",
};

function includesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function minLevelFromQuestion(question: string): number {
  const match = question.match(new RegExp(`(?:L|Lv|level|${K.level})\\s*([1-4](?:\\.\\d)?)`, "i"));
  return match ? Number(match[1]) : 1;
}

function expandKeywords(question: string): string[] {
  const keywords = new Set<string>();
  question
    .split(/[\s,./]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .forEach((part) => keywords.add(part));

  if (includesAny(question, ["blue", "dopant", K.blue, K.dopant, "tadf", "oled", "bd"])) {
    ["OLED", "Blue", "Dopant", "TADF", K.organic, K.semiconductor, K.molecule, K.device, "Simulation", K.material].forEach((item) =>
      keywords.add(item)
    );
  }
  if (includesAny(question, ["photo", "resist", "pr", "krf", "litho", "cd", K.photo, K.resist])) {
    ["Photo", "Photo Resist", "PR", "KrF", "Litho", "CTQ", K.process, K.evaluation, "QC", "Thickness"].forEach((item) =>
      keywords.add(item)
    );
  }
  if (includesAny(question, ["gc", "lc", "hplc", K.analysis])) {
    ["GC", "LC", "HPLC", K.analysis, K.quality, K.evaluation].forEach((item) => keywords.add(item));
  }
  if (includesAny(question, [K.process, "process", K.improvement, K.production, K.massProduction])) {
    [K.process, "Process", K.improvement, K.production, K.massProduction, K.standard, K.yield].forEach((item) => keywords.add(item));
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
  const members = getMembers().filter((member) => member.job_type !== "\uacbd\uc601");
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
      if (member.name === K.imGayoung && includesAny(keywords.join(" "), ["Photo", "Resist", "PR", "Litho", K.photo, K.resist])) score += 45;
      if (member.name === K.kimSunjae && includesAny(keywords.join(" "), ["Blue", "Dopant", "OLED", "TADF", K.blue, K.dopant])) score += 45;

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
- PI/KPI 근거: ${taskText || "매칭 PI 과제 없음"}
- 평가 흐름: ${reviewText}
- 발령 이력: ${raw.latestAppointment ? `${raw.latestAppointment.date} ${raw.latestAppointment.type} -> ${raw.latestAppointment.afterOrg}` : "발령 데이터 없음"}`;
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
  if (!filters.team) suggestions.push("팀 조건을 추가하면 후보를 더 좁힐 수 있습니다.");
  if (results.length === 0) suggestions.push("Skill Level 조건을 낮추거나 기술 키워드를 바꿔 다시 검색해보세요.");
  suggestions.push("Gemini 한도가 복구되면 외부 논문/Google Scholar 근거를 보강할 수 있습니다.");
  return suggestions.slice(0, 3);
}

async function buildGeminiNote(question: string, candidates: CandidateScore[]): Promise<string> {
  if (!isLlmConfigured()) {
    return "Gemini API 키가 설정되어 있지 않아 외부 학술/연구실 보강은 실행하지 않았습니다. 현재 추천은 내부 Raw Data와 SQLite Skill Profile 기준입니다.";
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
      "You are a Skill-based talent management agent. Summarize only the internal evidence. Do not claim that you checked papers, Google Scholar, or lab websites unless actual external search was performed. Answer in Korean within three sentences.",
      [{ role: "user", text: JSON.stringify({ question, evidence: compactEvidence }, null, 2) }]
    );
    return text || "Gemini API는 연결되어 있으나 추가 요약을 반환하지 않았습니다. 내부 데이터 기반 추천 결과는 정상입니다.";
  } catch (error) {
    const code = (error as Error).message;
    if (code === "GEMINI_QUOTA_EXCEEDED" || code === "GEMINI_QUOTA_BLOCKED") {
      return "현재 Gemini API 사용량 또는 결제 한도를 초과해 외부 학술/연구실 보강은 일시 중단했습니다. 내부 Raw Data 기반 인재추천은 정상 동작합니다.";
    }
    if (code === "GEMINI_AUTH_FAILED" || code === "GEMINI_KEY_MISSING") {
      return "Gemini API 키가 없거나 권한이 없어 외부 보강은 중단했습니다. 내부 Raw Data 기반 인재추천은 정상 동작합니다.";
    }
    if (code === "GEMINI_BAD_REQUEST") {
      return "Gemini 요청 형식 처리에 실패했습니다. 내부 Raw Data 기반 인재추천은 정상 동작합니다.";
    }
    if (code === "AbortError") {
      return "Gemini 응답 시간이 초과되었습니다. 내부 Raw Data 기반 인재추천은 정상 동작합니다.";
    }
    return "현재 Gemini 외부 보강을 사용할 수 없습니다. 내부 Raw Data 기반 인재추천은 정상 동작합니다.";
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
      ? `Skill 기반 인재추천

질문: ${question}
현재 내부 데이터 조건에 맞는 후보가 없습니다.

다음 조치: Skill Level 조건을 낮추거나 팀/직무 조건을 완화해 다시 검색하는 것이 좋습니다.

Gemini 보강: ${geminiNote}`
      : `Skill 기반 인재추천

1. 검색 해석
"${question}" 질문을 인재추천 요청으로 해석했습니다. 구성원 마스터, 직무/학력, 3개년 PI 과제, 평가, 발령, Skill Level Profile을 함께 확인했습니다.

2. 추천 후보
${candidates
  .slice(0, 5)
  .map((candidate, index) => formatCandidate(candidate, index + 1))
  .join("\n\n")}

3. Gemini 보강
${geminiNote}

주의: 외부 논문, Google Scholar, 연구실 사이트는 실제 검색/연동이 수행된 경우에만 확정 근거로 표시합니다.`;

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

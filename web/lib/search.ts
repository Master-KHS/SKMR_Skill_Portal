// 인재 검색 엔진 — Talent Search 화면과 Gemini 챗봇이 공유.
import { getMembers, getSkillProfiles, skillById, memberById } from "./data";
import type { Member } from "./types";

export interface SkillCondition {
  skill_id: number;
  min_level: number;
}

export interface SearchFilters {
  division?: string;
  team?: string;
  job_type?: string;
  role_level?: string;
  position?: string;
  skills?: SkillCondition[]; // AND 결합 — 모두 만족
}

export interface SearchResultRow {
  employee_id: string;
  name: string;
  division: string | null;
  team: string | null;
  role_level: string | null;
  position: string | null;
  job_type: string | null;
  n_skills: number;
  avg_level: number;
  matched: { skill_id: number; skill_name: string; level: number }[];
}

export function searchTalent(filters: SearchFilters): SearchResultRow[] {
  const members = getMembers().filter((m) =>
    ["사무직", "기술직", "연구직"].includes(m.job_type ?? "")
  );
  const profiles = getSkillProfiles();
  const sById = skillById();

  // 조직 필터
  let pool: Member[] = members.filter((m) => {
    if (filters.division && m.division !== filters.division) return false;
    if (filters.team && m.team !== filters.team) return false;
    if (filters.job_type && m.job_type !== filters.job_type) return false;
    if (filters.role_level && m.role_level !== filters.role_level) return false;
    if (filters.position && m.position !== filters.position) return false;
    return true;
  });

  // 스킬 조건(AND)
  const conds = (filters.skills ?? []).filter((c) => c.skill_id != null);
  if (conds.length > 0) {
    pool = pool.filter((m) =>
      conds.every((c) =>
        profiles.some(
          (p) =>
            p.member_id === m.employee_id &&
            p.skill_id === c.skill_id &&
            p.current_level >= c.min_level
        )
      )
    );
  }

  // 통계 + 매칭 스킬
  const statByMember = new Map<string, { n: number; sum: number }>();
  for (const p of profiles) {
    const s = statByMember.get(p.member_id) ?? { n: 0, sum: 0 };
    s.n += 1;
    s.sum += p.current_level;
    statByMember.set(p.member_id, s);
  }

  return pool.map((m) => {
    const stat = statByMember.get(m.employee_id) ?? { n: 0, sum: 0 };
    const matched = conds.map((c) => {
      const p = profiles.find(
        (x) => x.member_id === m.employee_id && x.skill_id === c.skill_id
      );
      return {
        skill_id: c.skill_id,
        skill_name: sById.get(c.skill_id)?.skill_name ?? `#${c.skill_id}`,
        level: p?.current_level ?? 0,
      };
    });
    return {
      employee_id: m.employee_id,
      name: m.name,
      division: m.division,
      team: m.team,
      role_level: m.role_level,
      position: m.position,
      job_type: m.job_type,
      n_skills: stat.n,
      avg_level: stat.n ? Math.round((stat.sum / stat.n) * 100) / 100 : 0,
      matched,
    };
  });
}

// 한 사람의 보유 스킬 전체 (챗봇 설명용)
export function memberSkillSummary(employee_id: string) {
  const sById = skillById();
  return getSkillProfiles()
    .filter((p) => p.member_id === employee_id)
    .map((p) => ({
      skill_name: sById.get(p.skill_id)?.skill_name ?? `#${p.skill_id}`,
      level: p.current_level,
    }))
    .sort((a, b) => b.level - a.level);
}

export { memberById };

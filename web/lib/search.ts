// 인재 검색 엔진 (서버 전용) — Talent Search API와 Gemini 챗봇이 공유.
import "server-only";
import { getMembers, getSkillProfiles, getSkills } from "./data";
import type { Member, Skill } from "./types";
import type { SearchFilters, SearchResultRow } from "./assistant-types";

export type { SkillCondition, SearchFilters, SearchResultRow } from "./assistant-types";

function skillMap(): Map<number, Skill> {
  return new Map(getSkills().map((s) => [s.skill_id, s]));
}

export function searchTalent(filters: SearchFilters): SearchResultRow[] {
  const members = getMembers().filter((m) =>
    ["사무직", "기술직", "연구직"].includes(m.job_type ?? "")
  );
  const profiles = getSkillProfiles();
  const sById = skillMap();

  let pool: Member[] = members.filter((m) => {
    if (filters.division && m.division !== filters.division) return false;
    if (filters.team && m.team !== filters.team) return false;
    if (filters.job_type && m.job_type !== filters.job_type) return false;
    if (filters.role_level && m.role_level !== filters.role_level) return false;
    if (filters.position && m.position !== filters.position) return false;
    return true;
  });

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

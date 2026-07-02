import "server-only";
import { getMembers, getSkillProfiles, getSkills } from "./data";
import type { SearchFilters, SearchResultRow } from "./assistant-types";
import type { Member, Skill } from "./types";

export type { SkillCondition, SearchFilters, SearchResultRow } from "./assistant-types";

function skillMap(): Map<number, Skill> {
  return new Map(getSkills().map((skill) => [skill.skill_id, skill]));
}

export function searchTalent(filters: SearchFilters): SearchResultRow[] {
  const members = getMembers().filter((member) =>
    ["사무직", "기술직", "연구직"].includes(member.job_type ?? "")
  );
  const profiles = getSkillProfiles();
  const skillsById = skillMap();

  let pool: Member[] = members.filter((member) => {
    if (filters.division && member.division !== filters.division) return false;
    if (filters.team && member.team !== filters.team) return false;
    if (filters.job_type && member.job_type !== filters.job_type) return false;
    if (filters.role_level && member.role_level !== filters.role_level) return false;
    if (filters.position && member.position !== filters.position) return false;
    return true;
  });

  const conditions = (filters.skills ?? []).filter((condition) => condition.skill_id != null);
  if (conditions.length > 0) {
    pool = pool.filter((member) =>
      conditions.every((condition) =>
        profiles.some(
          (profile) =>
            profile.member_id === member.employee_id &&
            profile.skill_id === condition.skill_id &&
            profile.current_level >= condition.min_level
        )
      )
    );
  }

  const statByMember = new Map<string, { n: number; sum: number }>();
  for (const profile of profiles) {
    const stat = statByMember.get(profile.member_id) ?? { n: 0, sum: 0 };
    stat.n += 1;
    stat.sum += profile.current_level;
    statByMember.set(profile.member_id, stat);
  }

  return pool.map((member) => {
    const stat = statByMember.get(member.employee_id) ?? { n: 0, sum: 0 };
    const matched = conditions.map((condition) => {
      const profile = profiles.find(
        (item) => item.member_id === member.employee_id && item.skill_id === condition.skill_id
      );
      return {
        skill_id: condition.skill_id,
        skill_name: skillsById.get(condition.skill_id)?.skill_name ?? `#${condition.skill_id}`,
        level: profile?.current_level ?? 0,
      };
    });

    return {
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
  });
}

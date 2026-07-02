import { getMembers, getSkills } from "@/lib/data";
import { TalentSearchClient } from "./client";

export default function TalentSearchPage() {
  const members = getMembers().filter((member) =>
    ["사무직", "기술직", "연구직"].includes(member.job_type ?? "")
  );

  const facets = {
    divisions: [...new Set(members.map((member) => member.division).filter(Boolean))] as string[],
    teams: [...new Set(members.map((member) => member.team).filter(Boolean))] as string[],
    jobTypes: ["사무직", "기술직", "연구직"],
    roleLevels: [...new Set(members.map((member) => member.role_level).filter(Boolean))].sort() as string[],
    positions: [...new Set(members.map((member) => member.position).filter(Boolean))] as string[],
    skills: getSkills().map((skill) => ({ id: skill.skill_id, name: skill.skill_name })),
  };

  return <TalentSearchClient facets={facets} />;
}

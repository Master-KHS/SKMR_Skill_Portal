import { getMembers, getSkills } from "@/lib/data";
import { TalentSearchClient } from "./client";

export default function TalentSearchPage() {
  const members = getMembers();
  const facets = {
    divisions: [...new Set(members.map((m) => m.division).filter(Boolean))] as string[],
    teams: [...new Set(members.map((m) => m.team).filter(Boolean))] as string[],
    jobTypes: ["사무직", "기술직", "연구직"],
    roleLevels: [...new Set(members.map((m) => m.role_level).filter(Boolean))].sort() as string[],
    positions: [...new Set(members.map((m) => m.position).filter(Boolean))] as string[],
    skills: getSkills().map((s) => ({ id: s.skill_id, name: s.skill_name })),
  };
  return <TalentSearchClient facets={facets} />;
}

import { getMembers, getSkills } from "@/lib/data";
import { AssistantClient } from "./client";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  const skills = getSkills().map((skill) => ({ skill_id: skill.skill_id, skill_name: skill.skill_name }));
  const members = getMembers();
  const divisions = [...new Set(members.map((member) => member.division).filter(Boolean))] as string[];
  const teams = [...new Set(members.map((member) => member.team).filter(Boolean))] as string[];

  return <AssistantClient meta={{ skills, divisions, teams }} />;
}

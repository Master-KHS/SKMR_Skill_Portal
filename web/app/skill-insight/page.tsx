import { getMembers, getSkillProfiles, getSkills } from "@/lib/data";
import { SkillInsightClient } from "./client";

export const dynamic = "force-dynamic";

export default function SkillInsightPage() {
  const members = getMembers().filter((member) => member.job_type !== "경영");
  const skills = getSkills();
  const profiles = getSkillProfiles();

  return (
    <SkillInsightClient
      members={members.map((member) => ({
        employee_id: member.employee_id,
        name: member.name,
        division: member.division,
        team: member.team,
        role_level: member.role_level,
        position: member.position,
        job_type: member.job_type,
      }))}
      skills={skills.map((skill) => ({
        skill_id: skill.skill_id,
        skill_name: skill.skill_name,
        sub_family_id: skill.sub_family_id,
        is_critical: skill.is_critical,
      }))}
      profiles={profiles.map((profile) => ({
        member_id: profile.member_id,
        skill_id: profile.skill_id,
        current_level: profile.current_level,
        target_level: profile.target_level,
      }))}
    />
  );
}

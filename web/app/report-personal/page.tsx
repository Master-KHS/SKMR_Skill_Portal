import { evaluableMemberOptions } from "@/lib/member-options";
import { SkillProfileClient } from "../skill-profile/client";

export const dynamic = "force-dynamic";

export default function PersonalReportPage() {
  return <SkillProfileClient members={evaluableMemberOptions()} />;
}

import { evaluableMemberOptions } from "@/lib/member-options";
import { SkillProfileClient } from "./client";

export const dynamic = "force-dynamic";

export default function SkillProfilePage() {
  return <SkillProfileClient members={evaluableMemberOptions()} />;
}

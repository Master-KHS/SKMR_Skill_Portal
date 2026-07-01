import { getSkills, getSubFamilies, getFamilies } from "@/lib/data";
import { SkillMasterClient } from "./client";

export const dynamic = "force-dynamic";

export default function SkillMasterPage() {
  return (
    <SkillMasterClient
      skills={getSkills()}
      subs={getSubFamilies()}
      families={getFamilies()}
    />
  );
}

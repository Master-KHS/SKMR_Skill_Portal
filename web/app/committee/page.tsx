import { StageAssess } from "@/components/StageAssess";
import { evaluableMemberOptions } from "@/lib/member-options";

export const dynamic = "force-dynamic";

export default function CommitteePage() {
  return (
    <StageAssess
      title="Committee"
      desc="Skill Committee 최종 심의 — 확정 시 최종 결과(skill_profile)에 반영됩니다"
      stage="committee"
      members={evaluableMemberOptions()}
      confirmLabel="Committee 최종 확정"
      scope="none"
    />
  );
}

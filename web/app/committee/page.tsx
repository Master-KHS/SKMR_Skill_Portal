import { StageAssess } from "@/components/StageAssess";
import { evaluableMemberOptions } from "@/lib/member-options";

export const dynamic = "force-dynamic";

export default function CommitteePage() {
  return (
    <StageAssess
      title="Committee"
      desc="최종 심의 결과를 확정하고 Skill Profile에 반영합니다."
      stage="committee"
      members={evaluableMemberOptions()}
      confirmLabel="Committee 최종 확정"
      scope="none"
    />
  );
}

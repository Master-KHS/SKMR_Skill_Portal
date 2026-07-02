import { StageCompareBoard } from "@/components/StageCompareBoard";
import { evaluableMemberOptions } from "@/lib/member-options";

export const dynamic = "force-dynamic";

export default function CommitteePage() {
  return (
    <StageCompareBoard
      title="Committee"
      desc="Calibration에서 Lv4로 상정된 건만 대상으로 최종 확정합니다. 확정 결과는 Skill Profile current_level에 즉시 반영됩니다."
      stage="committee"
      members={evaluableMemberOptions()}
      confirmLabel="Committee 최종 확정"
    />
  );
}

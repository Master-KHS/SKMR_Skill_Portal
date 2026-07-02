import { StageCompareBoard } from "@/components/StageCompareBoard";
import { evaluableMemberOptions } from "@/lib/member-options";

export const dynamic = "force-dynamic";

export default function CalibrationPage() {
  return (
    <StageCompareBoard
      title="Calibration"
      desc="Leader 제출 건만 대상으로 검토합니다. Lv3는 Calibration에서 확정되고, Lv4만 Committee 후보로 상정됩니다."
      stage="calibration"
      members={evaluableMemberOptions()}
      confirmLabel="Calibration 처리 저장"
    />
  );
}

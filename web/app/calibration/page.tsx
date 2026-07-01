import { StageAssess } from "@/components/StageAssess";
import { evaluableMemberOptions } from "@/lib/member-options";

export const dynamic = "force-dynamic";

export default function CalibrationPage() {
  return (
    <StageAssess
      title="Calibration"
      desc="리더 진단 결과를 비교하고 조직 기준에 맞게 보정합니다."
      stage="calibration"
      members={evaluableMemberOptions()}
      confirmLabel="Calibration 확정"
      scope="division"
    />
  );
}

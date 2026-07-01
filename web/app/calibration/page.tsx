import { StageAssess } from "@/components/StageAssess";
import { evaluableMemberOptions } from "@/lib/member-options";

export const dynamic = "force-dynamic";

export default function CalibrationPage() {
  return (
    <StageAssess
      title="Calibration"
      desc="리더 진단 결과를 조직 간 눈높이로 보정하여 확정합니다 (DB 영구 저장)"
      stage="calibration"
      members={evaluableMemberOptions()}
      confirmLabel="Calibration 확정"
      scope="division"
    />
  );
}

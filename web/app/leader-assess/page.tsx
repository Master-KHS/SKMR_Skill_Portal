import { StageAssess } from "@/components/StageAssess";
import { evaluableMemberOptions } from "@/lib/member-options";

export const dynamic = "force-dynamic";

export default function LeaderAssessPage() {
  return (
    <StageAssess
      title="리더 진단"
      desc="Self 제출 건만 대상으로 검토합니다. Lv1-Lv2는 리더 단계에서 확정되고, Lv3-Lv4는 Calibration 안건으로 넘어갑니다."
      stage="leader"
      members={evaluableMemberOptions()}
      confirmLabel="리더 처리 저장"
      scope="team"
    />
  );
}

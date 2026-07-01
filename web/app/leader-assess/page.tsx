import { StageAssess } from "@/components/StageAssess";
import { evaluableMemberOptions } from "@/lib/member-options";

export const dynamic = "force-dynamic";

export default function LeaderAssessPage() {
  return (
    <StageAssess
      title="리더 진단"
      desc="팀원의 자가 진단을 검토하여 리더가 레벨을 확정합니다 (DB 영구 저장)"
      stage="leader"
      members={evaluableMemberOptions()}
      confirmLabel="리더 확정"
    />
  );
}

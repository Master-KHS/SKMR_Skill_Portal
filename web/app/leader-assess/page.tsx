import { StageAssess } from "@/components/StageAssess";
import { evaluableMemberOptions } from "@/lib/member-options";

export const dynamic = "force-dynamic";

export default function LeaderAssessPage() {
  return (
    <StageAssess
      title="리더 진단"
      desc="팀원의 자가 진단 결과를 검토하고 리더 레벨을 확정합니다."
      stage="leader"
      members={evaluableMemberOptions()}
      confirmLabel="리더 확정"
      scope="team"
    />
  );
}

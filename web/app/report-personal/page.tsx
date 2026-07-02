import { evaluableMemberOptions } from "@/lib/member-options";
import { SkillProfileClient } from "../skill-profile/client";

export const dynamic = "force-dynamic";

export default function PersonalReportPage() {
  return (
    <SkillProfileClient
      members={evaluableMemberOptions()}
      title="인별 리포트"
      desc="구성원별 Skill 보유 현황, Radar, Gap, 평가 이력을 확인합니다."
    />
  );
}

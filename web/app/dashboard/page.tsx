import { getSeed } from "@/lib/data";
import { PageHeader, Card, Stat, Badge } from "@/components/ui";

export default function DashboardPage() {
  const d = getSeed();
  const evaluable = d.member.filter((m) =>
    ["사무직", "기술직", "연구직"].includes(m.job_type ?? "")
  );
  const critical = d.skill.filter((s) => s.is_critical).length;

  // 팀별 인원
  const byTeam = new Map<string, number>();
  for (const m of evaluable) {
    const t = m.team ?? "-";
    byTeam.set(t, (byTeam.get(t) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader title="진단 결과 확인" desc="Skill 보유 현황 요약 대시보드" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Stat label="구성원" value={`${d.member.length}명`} />
        <Stat label="Skill 정의" value={`${d.skill.length}개`} />
        <Stat label="Skill Profile" value={`${d.skill_profile.length}건`} />
        <Stat label="Evidence" value={`${d.evidence.length}건`} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="팀별 평가대상 인원">
          <table className="w-full text-sm">
            <tbody>
              {[...byTeam.entries()].map(([team, n]) => (
                <tr key={team} className="border-b border-border-soft last:border-0">
                  <td className="py-2">{team}</td>
                  <td className="py-2 text-right font-medium">{n}명</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Skill 체계">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Skill Family</span>
              <span className="font-medium">{d.skill_family.length}개</span>
            </div>
            <div className="flex justify-between">
              <span>Sub Family</span>
              <span className="font-medium">{d.sub_skill_family.length}개</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Critical Skill</span>
              <Badge tone="danger" label={`필수 ${critical}개`} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

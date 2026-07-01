import { getMembers } from "@/lib/data";
import { PageHeader, Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function EvalLinesPage() {
  const members = getMembers();
  // 팀별 리더(직책='팀장') 도출 → 팀원의 1차 평가자 매핑
  const leaderByTeam = new Map<string, string>();
  for (const m of members) {
    if (m.position === "팀장" && m.team) leaderByTeam.set(m.team, m.name);
  }
  const evaluable = members.filter((m) => ["사무직", "기술직", "연구직"].includes(m.job_type ?? ""));

  return (
    <div>
      <PageHeader title="Assessment 라인 관리" desc="구성원별 1차 평가자(리더) 매핑 — 자가 → 리더 → Calibration → Committee" />
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border-soft text-left text-text-muted">
              <th className="py-2 pr-3">구성원</th>
              <th className="py-2 pr-3">팀</th>
              <th className="py-2 pr-3">직책</th>
              <th className="py-2">1차 평가자(리더)</th>
            </tr>
          </thead>
          <tbody>
            {evaluable.map((m) => {
              const leader = m.team ? leaderByTeam.get(m.team) : undefined;
              const isLeaderSelf = m.position === "팀장";
              return (
                <tr key={m.employee_id} className="border-b border-border-soft">
                  <td className="py-2 pr-3 font-medium">{m.name}</td>
                  <td className="py-2 pr-3">{m.team}</td>
                  <td className="py-2 pr-3">{m.position}</td>
                  <td className="py-2">
                    {isLeaderSelf ? (
                      <Badge tone="info" label="상위 조직에서 평가" />
                    ) : leader ? (
                      leader
                    ) : (
                      <Badge tone="warning" label="미지정" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

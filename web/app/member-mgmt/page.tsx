import { getMembers } from "@/lib/data";
import { PageHeader, Card, Badge } from "@/components/ui";
import { PERSONA_LABELS } from "@/lib/nav";
import type { PersonaCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function MemberMgmtPage() {
  const members = getMembers();
  return (
    <div>
      <PageHeader title="구성원 Master Data" desc={`전체 구성원 ${members.length}명`} />
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border-soft text-left text-text-muted">
              <th className="py-2 pr-3">사번</th>
              <th className="py-2 pr-3">이름</th>
              <th className="py-2 pr-3">담당</th>
              <th className="py-2 pr-3">팀</th>
              <th className="py-2 pr-3">R/L</th>
              <th className="py-2 pr-3">직책</th>
              <th className="py-2 pr-3">직종</th>
              <th className="py-2">권한(페르소나)</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.employee_id} className="border-b border-border-soft">
                <td className="py-2 pr-3 font-mono text-xs">{m.employee_id}</td>
                <td className="py-2 pr-3 font-medium">{m.name}</td>
                <td className="py-2 pr-3">{m.division}</td>
                <td className="py-2 pr-3">{m.team}</td>
                <td className="py-2 pr-3">{m.role_level}</td>
                <td className="py-2 pr-3">{m.position}</td>
                <td className="py-2 pr-3">{m.job_type}</td>
                <td className="py-2">
                  <Badge
                    tone="info"
                    label={PERSONA_LABELS[m.persona_role as PersonaCode] ?? m.persona_role ?? "-"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

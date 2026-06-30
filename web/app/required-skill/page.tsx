import { getRequiredSkills, getSkills } from "@/lib/data";
import { PageHeader, Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const SCOPE_LABEL: Record<string, string> = {
  company: "전사",
  department: "부서",
  individual: "개인",
};

export default function RequiredSkillPage() {
  const reqs = getRequiredSkills();
  const skillById = new Map(getSkills().map((s) => [s.skill_id, s]));

  const grouped = new Map<string, typeof reqs>();
  for (const r of reqs) {
    (grouped.get(r.org_or_individual) ?? grouped.set(r.org_or_individual, []).get(r.org_or_individual)!).push(r);
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="필요 Skill 정의" desc={`전사·조직·개인 단위 요구 Skill — 총 ${reqs.length}건`} />
      {[...grouped.entries()].map(([scope, items]) => (
        <Card key={scope} title={`${SCOPE_LABEL[scope] ?? scope} 단위 (${items.length}건)`} className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-soft text-left text-text-muted">
                <th className="py-2 pr-3">대상</th>
                <th className="py-2 pr-3">Skill</th>
                <th className="py-2 pr-3 w-20">목표 Lv</th>
                <th className="py-2 pr-3 w-20">핵심</th>
                <th className="py-2 w-24">상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => (
                <tr key={i} className="border-b border-border-soft">
                  <td className="py-2 pr-3 text-text-muted">{r.target_id}</td>
                  <td className="py-2 pr-3">{skillById.get(r.skill_id)?.skill_name ?? `#${r.skill_id}`}</td>
                  <td className="py-2 pr-3 font-medium">L{r.target_level}</td>
                  <td className="py-2 pr-3">{r.is_core ? <Badge tone="danger" label="핵심" /> : "-"}</td>
                  <td className="py-2">
                    {r.status === "approved" ? (
                      <Badge tone="success" label="승인됨" />
                    ) : (
                      <Badge tone="warning" label="승인 대기" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

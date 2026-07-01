import { getLevelCriteria, getSubFamilies } from "@/lib/data";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const LEVEL_NAMES: Record<number, string> = {
  1: "L1 Youngling",
  2: "L2 Padawan",
  3: "L3 Jedi Knight",
  4: "L4 Jedi Master",
};

export default function PolicyPage() {
  const criteria = getLevelCriteria();
  const subs = new Map(getSubFamilies().map((s) => [s.sub_family_id, s.sub_family_name]));

  const bySub = new Map<string, typeof criteria>();
  for (const c of criteria) {
    (bySub.get(c.sub_family_id) ?? bySub.set(c.sub_family_id, []).get(c.sub_family_id)!).push(c);
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="운영 정책 관리" desc="Sub-family별 Level 판정 기준 (전문성·영향력 2축)" />
      {[...bySub.entries()].map(([subId, items]) => (
        <Card key={subId} title={subs.get(subId) ?? subId} className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-soft text-left text-text-muted">
                <th className="py-2 pr-3 w-32">Level</th>
                <th className="py-2 pr-3">전문성 기준</th>
                <th className="py-2">영향력 기준</th>
              </tr>
            </thead>
            <tbody>
              {items
                .sort((a, b) => a.level - b.level)
                .map((c) => (
                  <tr key={c.level} className="border-b border-border-soft">
                    <td className="py-2 pr-3 font-semibold">{LEVEL_NAMES[c.level]}</td>
                    <td className="py-2 pr-3">{c.expertise_criteria}</td>
                    <td className="py-2 text-text-muted">{c.impact_criteria}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

import { NAV_ITEMS, PERSONA_LABELS } from "@/lib/nav";
import { PageHeader, Card } from "@/components/ui";
import type { PersonaCode } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERSONAS: PersonaCode[] = [
  "employee",
  "team_leader",
  "calibration",
  "committee",
  "hr_admin",
  "hr_viewer",
  "executive",
];

export default function SystemSettingPage() {
  return (
    <div>
      <PageHeader title="Admin 권한 관리" desc="페르소나별 메뉴 노출 권한 매트릭스" />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-border-soft text-text-muted">
                <th className="py-2 pr-3 text-left">메뉴</th>
                {PERSONAS.map((p) => (
                  <th key={p} className="py-2 px-2 text-center whitespace-nowrap">
                    {PERSONA_LABELS[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NAV_ITEMS.map((item) => (
                <tr key={item.key} className="border-b border-border-soft">
                  <td className="py-1.5 pr-3 text-text-main">
                    <span className="text-text-muted">[{item.section}]</span> {item.title}
                  </td>
                  {PERSONAS.map((p) => (
                    <td key={p} className="py-1.5 px-2 text-center">
                      {item.visibility[p] ? (
                        <span className="text-success font-bold">O</span>
                      ) : (
                        <span className="text-border-soft">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted mt-3">O = 접근 가능 · 실제 권한은 lib/nav.ts 매트릭스로 관리됩니다.</p>
      </Card>
    </div>
  );
}

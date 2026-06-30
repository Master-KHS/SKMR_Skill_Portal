import { getSkills, getSubFamilies, getFamilies } from "@/lib/data";
import { PageHeader, Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function SkillMasterPage() {
  const skills = getSkills();
  const subs = getSubFamilies();
  const families = getFamilies();

  return (
    <div className="max-w-5xl">
      <PageHeader title="Skill Library" desc={`Skill 분류 체계 — ${families.length} Family · ${subs.length} Sub-family · ${skills.length} Skill`} />

      {families.map((f) => {
        const fSubs = subs.filter((s) => s.family_id === f.family_id);
        return (
          <Card key={f.family_id} title={`${f.family_name} — ${f.description ?? ""}`} className="mb-4">
            {fSubs.map((sub) => {
              const subSkills = skills.filter((s) => s.sub_family_id === sub.sub_family_id);
              return (
                <div key={sub.sub_family_id} className="mb-4 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-text-main">{sub.sub_family_name}</span>
                    <Badge tone="neutral" label={`${subSkills.length}개`} />
                    <span className="text-xs text-text-muted">{sub.description}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {subSkills.map((s) => (
                      <span
                        key={s.skill_id}
                        className={`inline-block border px-2 py-0.5 text-xs ${
                          s.is_critical
                            ? "border-sk-red text-sk-red bg-sk-red/[0.05]"
                            : "border-border-soft text-text-main bg-white"
                        }`}
                      >
                        #{String(s.skill_id).padStart(3, "0")} {s.skill_name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}

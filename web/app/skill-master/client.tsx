"use client";
import { useState, useMemo } from "react";
import { PageHeader, Card, Badge } from "@/components/ui";
import type { Skill, SubSkillFamily, SkillFamily } from "@/lib/types";

export function SkillMasterClient({
  skills,
  subs,
  families,
}: {
  skills: Skill[];
  subs: SubSkillFamily[];
  families: SkillFamily[];
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const filtered = useMemo(
    () => (query ? skills.filter((s) => s.skill_name.toLowerCase().includes(query)) : skills),
    [skills, query]
  );
  const filteredIds = new Set(filtered.map((s) => s.skill_id));

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Skill Library"
        desc={`Skill 분류 체계 — ${families.length} Family · ${subs.length} Sub-family · ${skills.length} Skill`}
      />

      {/* 스킬명 검색 */}
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <input
            className="flex-1 border border-border-soft bg-white px-3 py-2 text-sm"
            placeholder="스킬명으로 검색 (예: 분석, OLED, 시뮬레이션)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {query && <Badge tone="info" label={`${filtered.length}개 일치`} />}
          {query && (
            <button className="border border-border-soft px-3 py-2 text-xs text-text-muted" onClick={() => setQ("")}>
              지우기
            </button>
          )}
        </div>
        {query && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {filtered.length === 0 ? (
              <span className="text-sm text-text-muted">일치하는 스킬이 없습니다.</span>
            ) : (
              filtered.map((s) => {
                const sub = subs.find((x) => x.sub_family_id === s.sub_family_id);
                return (
                  <span
                    key={s.skill_id}
                    className={`inline-block border px-2 py-0.5 text-xs ${s.is_critical ? "border-sk-red text-sk-red bg-sk-red/[0.05]" : "border-border-soft text-text-main bg-white"}`}
                  >
                    #{String(s.skill_id).padStart(3, "0")} {s.skill_name}
                    <span className="text-text-muted"> · {sub?.sub_family_name}</span>
                  </span>
                );
              })
            )}
          </div>
        )}
      </Card>

      {families.map((f) => {
        const fSubs = subs.filter((s) => s.family_id === f.family_id);
        // 검색 중이면 일치 스킬이 있는 Sub만 표시
        const visibleSubs = fSubs.filter((sub) =>
          query ? skills.some((s) => s.sub_family_id === sub.sub_family_id && filteredIds.has(s.skill_id)) : true
        );
        if (query && visibleSubs.length === 0) return null;
        return (
          <Card key={f.family_id} title={`${f.family_name} — ${f.description ?? ""}`} className="mb-4">
            {visibleSubs.map((sub) => {
              const subSkills = skills.filter(
                (s) => s.sub_family_id === sub.sub_family_id && (!query || filteredIds.has(s.skill_id))
              );
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
                        className={`inline-block border px-2 py-0.5 text-xs ${s.is_critical ? "border-sk-red text-sk-red bg-sk-red/[0.05]" : "border-border-soft text-text-main bg-white"}`}
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

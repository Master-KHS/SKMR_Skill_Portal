"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { PageHeader, Card, Stat, Badge } from "@/components/ui";
import { usePersona } from "@/components/PersonaContext";

interface SkillRow {
  skill_id: number; skill_name: string; description: string | null; is_critical: number;
  sub_family_id: string; sub_family_name: string; family_id: string; family_name: string;
}
interface Sub { sub_family_id: string; sub_family_name: string; family_id: string; family_name: string }
interface Crit { sub_family_id: string; level: number; expertise_criteria: string; impact_criteria: string }
interface Holders { total: number; n_holders: number; avg_lv: number; levelDist: { lv: number; n: number }[]; teamDist: { div: string; n: number }[] }

const LEVEL_NAMES: Record<number, string> = { 1: "L1 Youngling", 2: "L2 Padawan", 3: "L3 Jedi Knight", 4: "L4 Jedi Master" };

export function SkillMasterClient() {
  const { persona } = usePersona();
  const isAdmin = persona === "hr_admin";
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [criteria, setCriteria] = useState<Crit[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [holders, setHolders] = useState<Holders | null>(null);
  // filters
  const [fFam, setFFam] = useState("");
  const [fSub, setFSub] = useState("");
  const [kw, setKw] = useState("");
  // forms
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/skills");
    const d = await res.json();
    setSkills(d.skills);
    setSubs(d.subs);
    setCriteria(d.criteria);
    setSelId((prev) => prev ?? (d.skills[0]?.skill_id ?? null));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selId == null) return;
    fetch(`/api/skills?holders=${selId}`).then((r) => r.json()).then(setHolders);
  }, [selId]);

  const families = useMemo(() => [...new Set(skills.map((s) => s.family_name))], [skills]);
  const subOptions = useMemo(
    () => [...new Set(skills.filter((s) => !fFam || s.family_name === fFam).map((s) => s.sub_family_name))],
    [skills, fFam]
  );

  const view = skills.filter((s) =>
    (!fFam || s.family_name === fFam) &&
    (!fSub || s.sub_family_name === fSub) &&
    (!kw.trim() || s.skill_name.toLowerCase().includes(kw.trim().toLowerCase()))
  );

  const sel = skills.find((s) => s.skill_id === selId) ?? null;
  const selCriteria = sel ? criteria.filter((c) => c.sub_family_id === sel.sub_family_id).sort((a, b) => b.level - a.level) : [];

  // tree grouping
  const tree = useMemo(() => {
    const byFam = new Map<string, Map<string, SkillRow[]>>();
    for (const s of view) {
      if (!byFam.has(s.family_name)) byFam.set(s.family_name, new Map());
      const subMap = byFam.get(s.family_name)!;
      (subMap.get(s.sub_family_name) ?? subMap.set(s.sub_family_name, []).get(s.sub_family_name)!).push(s);
    }
    return byFam;
  }, [view]);

  async function post(body: object) {
    const res = await fetch("/api/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json();
  }

  const holdPct = holders && holders.total ? Math.round((holders.n_holders / holders.total) * 100) : 0;

  return (
    <div>
      <PageHeader title="Skill Library" desc="Skill 카탈로그 — 정의·Level Guideline·보유 현황·CRUD" />

      {/* 신규 등록 */}
      {isAdmin && (
        <div className="mb-4">
          <button className="border border-sk-orange text-[#C45E00] px-3 py-1.5 text-sm font-medium" onClick={() => setShowNew((v) => !v)}>
            {showNew ? "− 새 Skill 등록 닫기" : "+ 새 Skill 등록"}
          </button>
          {showNew && <NewSkillForm subs={subs} onDone={(m) => { setShowNew(false); setMsg(m); load(); }} post={post} />}
        </div>
      )}

      {/* 필터 + KPI */}
      <Card className="mb-4">
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="text-xs text-text-muted">Family</span>
            <select className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1" value={fFam} onChange={(e) => { setFFam(e.target.value); setFSub(""); }}>
              <option value="">전체</option>{families.map((f) => <option key={f}>{f}</option>)}
            </select></label>
          <label className="block"><span className="text-xs text-text-muted">Sub-family</span>
            <select className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1" value={fSub} onChange={(e) => setFSub(e.target.value)}>
              <option value="">전체</option>{subOptions.map((s) => <option key={s}>{s}</option>)}
            </select></label>
          <label className="block"><span className="text-xs text-text-muted">Skill 이름 검색</span>
            <input className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1" placeholder="예: OLED, 설계" value={kw} onChange={(e) => setKw(e.target.value)} /></label>
        </div>
      </Card>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Stat label="필터 결과" value={`${view.length} / ${skills.length}`} accent />
        <Stat label="Sub-family" value={`${new Set(view.map((s) => s.sub_family_name)).size}`} />
        <Stat label="Critical Skill" value={`${view.filter((s) => s.is_critical).length}`} />
      </div>
      {msg && <div className="mb-3 border border-success bg-success/[0.06] p-2 text-sm text-success">{msg}</div>}

      <div className="grid grid-cols-[1fr_2.2fr] gap-4">
        {/* 트리 */}
        <Card title="Skill Tree" className="self-start max-h-[80vh] overflow-y-auto">
          {[...tree.entries()].map(([fam, subMap]) => (
            <div key={fam} className="mb-3">
              <div className="text-xs font-bold text-text-main mb-1">{fam}</div>
              {[...subMap.entries()].map(([sub, items]) => (
                <div key={sub} className="mb-2">
                  <div className="text-[11px] text-text-muted ml-1 mb-1">└ {sub} ({items.length})</div>
                  {items.map((s) => (
                    <button key={s.skill_id} onClick={() => setSelId(s.skill_id)}
                      className={`block w-full text-left px-2 py-1 text-xs border-l-2 ${selId === s.skill_id ? "border-sk-red bg-sk-red/[0.06] text-sk-red font-semibold" : "border-transparent hover:bg-bg-main"}`}>
                      #{String(s.skill_id).padStart(3, "0")} {s.skill_name}{s.is_critical ? " [CRT]" : ""}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {view.length === 0 && <div className="text-xs text-text-muted">조건에 맞는 Skill이 없습니다.</div>}
        </Card>

        {/* 상세 */}
        <div>
          {!sel ? (
            <Card><div className="text-sm text-text-muted">좌측에서 Skill을 선택하세요.</div></Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-[#0A2147] text-white px-3 py-1.5 text-sm font-semibold">#{String(sel.skill_id).padStart(3, "0")} · {sel.skill_name}</span>
                {sel.is_critical ? <Badge tone="danger" label="CRITICAL" /> : null}
                <span className="text-xs text-text-muted">{sel.family_name} · {sel.sub_family_name}</span>
                {isAdmin && <button className="ml-auto border border-border-soft px-2 py-1 text-xs" onClick={() => setShowEdit((v) => !v)}>{showEdit ? "편집 닫기" : "이 Skill 편집·삭제"}</button>}
              </div>

              {isAdmin && showEdit && (
                <EditSkillForm sel={sel} subs={subs} post={post}
                  onSaved={(m) => { setMsg(m); load(); }}
                  onDeleted={() => { setShowEdit(false); setSelId(null); load(); }} />
              )}

              <Card title="Skill Definition">
                {sel.description?.trim()
                  ? <p className="text-sm leading-relaxed text-text-main">{sel.description}</p>
                  : <p className="text-sm text-[#9B6B0F]">Skill 정의 미입력 — 편집에서 입력하세요.</p>}
              </Card>

              <Card title="Level Definition / Guideline">
                <div className="space-y-2">
                  {selCriteria.map((c) => (
                    <div key={c.level} className="flex gap-3 bg-bg-main/60 border border-border-soft p-2.5">
                      <div className="w-24 shrink-0">
                        <b className="text-text-main text-[13px]">{LEVEL_NAMES[c.level]}</b>
                        <div className="text-[11px] text-text-muted">L{c.level}</div>
                      </div>
                      <div className="flex-1 text-xs text-text-main">
                        <div className="text-[11px] font-semibold text-text-muted">전문성</div>{c.expertise_criteria || "—"}
                        <div className="text-[11px] font-semibold text-text-muted mt-1.5">영향력</div>{c.impact_criteria || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card title="전사 Skill 보유 현황">
                  {holders && (
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 shrink-0 grid place-items-center"
                        style={{ background: `conic-gradient(#0A2147 ${holdPct * 3.6}deg, #E8EEF5 0deg)`, borderRadius: "50%" }}>
                        <div className="w-16 h-16 bg-white grid place-items-center" style={{ borderRadius: "50%" }}>
                          <span className="font-extrabold text-navy text-[#0A2147]">{holdPct}%</span>
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="text-text-muted text-xs">전사 평균 Level</div>
                        <div className="text-xl font-bold">L{holders.avg_lv}</div>
                        <div className="text-xs text-text-muted mt-1">보유 {holders.n_holders} / 대상 {holders.total}명</div>
                      </div>
                    </div>
                  )}
                </Card>
                <Card title="보유자 분포">
                  {holders && (
                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] text-text-muted mb-1">담당 분포</div>
                        {holders.teamDist.length === 0 ? <div className="text-xs text-text-muted">보유자 없음</div> :
                          holders.teamDist.map((t) => (
                            <div key={t.div} className="flex justify-between text-xs border-b border-border-soft py-0.5">
                              <span>{t.div}</span><span className="font-medium">{t.n}명</span>
                            </div>
                          ))}
                      </div>
                      <div>
                        <div className="text-[11px] text-text-muted mb-1">Level 분포</div>
                        {[4, 3, 2, 1].map((lv) => {
                          const n = holders.levelDist.find((x) => x.lv === lv)?.n ?? 0;
                          const max = Math.max(...holders.levelDist.map((x) => x.n), 1);
                          return (
                            <div key={lv} className="flex items-center gap-2 text-xs mb-0.5">
                              <span className="w-6">L{lv}</span>
                              <div className="flex-1 bg-bg-main h-3"><div className="bg-[#0A2147] h-3" style={{ width: `${(n / max) * 100}%` }} /></div>
                              <span className="w-6 text-right">{n}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewSkillForm({ subs, onDone, post }: { subs: Sub[]; onDone: (m: string) => void; post: (b: object) => Promise<{ ok?: boolean; skill_id?: number }> }) {
  const families = [...new Set(subs.map((s) => s.family_name))];
  const [fam, setFam] = useState(families[0] ?? "");
  const subPool = subs.filter((s) => s.family_name === fam);
  const [sub, setSub] = useState(subPool[0]?.sub_family_id ?? "");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [crit, setCrit] = useState(false);
  return (
    <Card className="mt-2">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-text-muted">Family
          <select className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1 text-text-main" value={fam} onChange={(e) => { setFam(e.target.value); const p = subs.filter((s) => s.family_name === e.target.value); setSub(p[0]?.sub_family_id ?? ""); }}>
            {families.map((f) => <option key={f}>{f}</option>)}
          </select></label>
        <label className="block text-xs text-text-muted">Sub-family
          <select className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1 text-text-main" value={sub} onChange={(e) => setSub(e.target.value)}>
            {subPool.map((s) => <option key={s.sub_family_id} value={s.sub_family_id}>{s.sub_family_name}</option>)}
          </select></label>
      </div>
      <input className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-3" placeholder="Skill 이름 *" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-2 h-20" placeholder="Skill 정의" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <label className="flex items-center gap-2 mt-2 text-sm"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} /> Critical Skill</label>
      <button className="mt-3 bg-sk-orange text-white px-4 py-1.5 text-sm font-bold"
        onClick={async () => { if (!name.trim()) return; const r = await post({ action: "create", sub_family_id: sub, skill_name: name.trim(), description: desc.trim(), is_critical: crit }); if (r.ok) onDone(`#${String(r.skill_id).padStart(3, "0")} 등록 완료`); }}>
        Skill 등록
      </button>
    </Card>
  );
}

function EditSkillForm({ sel, subs, post, onSaved, onDeleted }: {
  sel: SkillRow; subs: Sub[]; post: (b: object) => Promise<{ ok?: boolean; refs?: Record<string, number> }>;
  onSaved: (m: string) => void; onDeleted: () => void;
}) {
  const families = [...new Set(subs.map((s) => s.family_name))];
  const [fam, setFam] = useState(sel.family_name);
  const subPool = subs.filter((s) => s.family_name === fam);
  const [sub, setSub] = useState(sel.sub_family_id);
  const [name, setName] = useState(sel.skill_name);
  const [desc, setDesc] = useState(sel.description ?? "");
  const [crit, setCrit] = useState(!!sel.is_critical);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card className="border-sk-orange">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-text-muted">Family
          <select className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1 text-text-main" value={fam} onChange={(e) => { setFam(e.target.value); const p = subs.filter((s) => s.family_name === e.target.value); setSub(p[0]?.sub_family_id ?? ""); }}>
            {families.map((f) => <option key={f}>{f}</option>)}
          </select></label>
        <label className="block text-xs text-text-muted">Sub-family
          <select className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1 text-text-main" value={sub} onChange={(e) => setSub(e.target.value)}>
            {subPool.map((s) => <option key={s.sub_family_id} value={s.sub_family_id}>{s.sub_family_name}</option>)}
          </select></label>
      </div>
      <input className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-3" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-2 h-24" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <label className="flex items-center gap-2 mt-2 text-sm"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} /> Critical Skill</label>
      {err && <div className="mt-2 text-xs text-sk-red border border-sk-red bg-sk-red/[0.06] p-2">{err}</div>}
      <div className="flex gap-2 mt-3">
        <button className="bg-sk-orange text-white px-4 py-1.5 text-sm font-bold"
          onClick={async () => { const r = await post({ action: "update", skill_id: sel.skill_id, sub_family_id: sub, skill_name: name.trim(), description: desc.trim(), is_critical: crit }); if (r.ok) onSaved("저장됨"); }}>변경사항 저장</button>
        <button className="border border-sk-red text-sk-red px-4 py-1.5 text-sm font-bold"
          onClick={async () => { const r = await post({ action: "delete", skill_id: sel.skill_id }); if (r.ok) onDeleted(); else if (r.refs) setErr(`삭제 차단 — Profile ${r.refs.profile} / Required ${r.refs.required} / Assessment ${r.refs.assessment} / Evidence ${r.refs.evidence}`); }}>Skill 삭제</button>
      </div>
    </Card>
  );
}

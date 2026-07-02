"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { usePersona } from "@/components/PersonaContext";
import { PageHeader, Card, Stat, Badge } from "@/components/ui";

interface Candidate {
  member_id: string; skill_id: number; aid: number; calib_lv: number; narrative: string | null;
  name: string; division: string; team: string; role_level: string;
  skill_name: string; sub_family_name: string; family_name: string; is_critical: number;
  self_lv: number | null; leader_lv: number | null;
}

// Narrative 작성 — 원본과 동일: Calibration Lv4 후보(승격자)만 대상, Skill 단위로 묶어 카드로 표시.
export function NarrativeClient() {
  const { persona, currentMember, loadingMembers } = usePersona();
  const [all, setAll] = useState<Candidate[]>([]);
  const [onlyPending, setOnlyPending] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (loadingMembers) return;
    const params = new URLSearchParams({
      persona,
      actor_id: currentMember?.employee_id ?? "",
    });
    const data = await fetch(`/api/narrative?${params.toString()}`).then((r) => r.json());
    setAll(data.candidates ?? []);
  }, [currentMember?.employee_id, loadingMembers, persona]);
  useEffect(() => { load(); }, [load]);

  const nTotal = all.length;
  const nWritten = all.filter((c) => (c.narrative ?? "").trim().length > 0).length;
  const nPending = nTotal - nWritten;

  const view = useMemo(() => {
    let v = all;
    if (onlyPending) v = v.filter((c) => (c.narrative ?? "").trim().length === 0);
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      v = v.filter((c) => c.name.toLowerCase().includes(kw) || c.skill_name.toLowerCase().includes(kw));
    }
    return v;
  }, [all, onlyPending, keyword]);

  const groups = useMemo(() => {
    const m = new Map<number, Candidate[]>();
    for (const c of view) (m.get(c.skill_id) ?? m.set(c.skill_id, []).get(c.skill_id)!).push(c);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [view]);

  async function save(aid: number) {
    setSaving(aid);
    const narrative = drafts[aid] ?? "";
    const res = await fetch("/api/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assessment_id: aid,
        narrative,
        persona,
        actor_id: currentMember?.employee_id ?? "",
      }),
    });
    const data = await res.json();
    setSaving(null);
    if (data.ok) { setMsg("저장됨"); load(); }
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="Narrative 작성" desc="Calibration → Committee 사이의 의결 자료 작성 — Lv4 후보자 대상" />

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Stat label="Lv4 후보자" value={`${nTotal}건`} accent />
        <Stat label="Narrative 작성 완료" value={`${nWritten}건`} />
        <Stat label="미작성" value={`${nPending}건`} />
      </div>

      <Card className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
            미작성만 보기
          </label>
          <input
            className="border border-border-soft bg-white px-2 py-1.5 text-sm flex-1 min-w-[200px]"
            placeholder="이름·Skill 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <span className="text-xs text-text-muted">{view.length} / {all.length} 건</span>
        </div>
      </Card>
      {msg && <div className="mb-4 border border-success bg-success/[0.06] p-2 text-sm text-success">{msg}</div>}

      {loadingMembers ? (
        <Card><div className="text-sm text-text-muted">권한 매핑 인원을 불러오는 중입니다.</div></Card>
      ) : all.length === 0 ? (
        <Card><div className="text-sm text-success">Lv4 후보자가 없습니다 — Calibration에서 후보 승격되어야 표시됩니다.</div></Card>
      ) : groups.length === 0 ? (
        <Card><div className="text-sm text-text-muted">조건에 맞는 후보가 없습니다.</div></Card>
      ) : (
        groups.map(([skillId, items]) => {
          const sk0 = items[0];
          return (
            <Card key={skillId} className="mb-4">
              <div className="text-xs text-text-muted">{sk0.family_name} · {sk0.sub_family_name}</div>
              <div className="flex items-center gap-2 mt-1 mb-3">
                <h4 className="font-bold text-text-main">#{String(skillId).padStart(3, "0")} {sk0.skill_name}</h4>
                {!!sk0.is_critical && <Badge tone="danger" label="CRITICAL" />}
                <span className="text-xs text-text-muted">Lv4 후보 {items.length}명</span>
              </div>

              {/* 후보자 비교 (자동 지표) */}
              <table className="w-full text-xs mb-4">
                <thead><tr className="border-b-2 border-border-soft text-left text-text-muted">
                  <th className="py-1.5 pr-2">이름</th><th className="py-1.5 pr-2">팀</th><th className="py-1.5 pr-2">R/L</th>
                  <th className="py-1.5 pr-2 text-center">자가</th><th className="py-1.5 pr-2 text-center">리더</th><th className="py-1.5 text-center">Calib</th></tr></thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.member_id} className="border-b border-border-soft">
                      <td className="py-1 pr-2 font-medium">{c.name}</td>
                      <td className="py-1 pr-2">{c.team}</td>
                      <td className="py-1 pr-2">{c.role_level}</td>
                      <td className="py-1 pr-2 text-center">{c.self_lv ? `L${c.self_lv}` : "-"}</td>
                      <td className="py-1 pr-2 text-center">{c.leader_lv ? `L${c.leader_lv}` : "-"}</td>
                      <td className="py-1 text-center font-bold">L{c.calib_lv}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 인원별 Narrative */}
              <div className="text-sm font-semibold text-text-main mb-2">인원별 Narrative</div>
              <div className="space-y-2">
                {items.map((c) => {
                  const key = `${c.member_id}_${c.skill_id}`;
                  const hasText = (c.narrative ?? "").trim().length > 0;
                  const isOpen = open[key] ?? !hasText;
                  const draft = drafts[c.aid] ?? c.narrative ?? "";
                  return (
                    <div key={key} className="border border-border-soft">
                      <button
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-left"
                        onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))}
                      >
                        <span>{c.name} <span className="text-text-muted text-xs">({c.team} · {c.role_level})</span></span>
                        {hasText ? <Badge tone="success" label="작성됨" /> : <Badge tone="danger" label="미작성" />}
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3">
                          <p className="text-xs text-text-muted mb-2">
                            Committee 의결을 위한 자료. 후보자의 Lv4 적격성 — 기여·성과·역량 발휘 사례·향후 기대 등을 명료하게.
                          </p>
                          <textarea
                            className="w-full h-32 border border-border-soft bg-white px-2 py-1.5 text-sm resize-y"
                            placeholder="예) 2025년 신규 프로젝트를 단독 리드. 비정형 제약 하에 Trade-Off를 조율하여 안정성과 신규 특성을 동시 확보..."
                            value={draft}
                            onChange={(e) => setDrafts((d) => ({ ...d, [c.aid]: e.target.value }))}
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              className="bg-sk-orange text-white px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                              onClick={() => save(c.aid)}
                              disabled={saving === c.aid}
                            >
                              {saving === c.aid ? "저장 중…" : "저장"}
                            </button>
                            {hasText && <span className="text-xs text-text-muted">마지막 저장: {(c.narrative ?? "").length}자</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

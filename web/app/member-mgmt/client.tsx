"use client";
import { useEffect, useState, useMemo } from "react";
import { PageHeader, Card, Stat, Badge } from "@/components/ui";
import { PERSONA_LABELS } from "@/lib/nav";
import type { Member, PersonaCode } from "@/lib/types";

const RL = ["L6", "L5", "L4", "L3", "L2", "임원"];
const POS = ["팀장", "팀원", "위원", "대표"];
const JOB = ["사무직", "기술직", "연구직", "경영"];
const PERSONAS = ["", ...Object.keys(PERSONA_LABELS)];

type Row = Member & { _new?: boolean };

export function MemberMgmtClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // 필터
  const [fDiv, setFDiv] = useState("");
  const [fTeam, setFTeam] = useState("");
  const [fJob, setFJob] = useState("");
  const [fRl, setFRl] = useState("");

  async function load() {
    const res = await fetch("/api/members");
    const data = await res.json();
    setRows(data.members ?? []);
    setDirty(false);
  }
  useEffect(() => {
    load();
  }, []);

  function edit(i: number, field: keyof Member, value: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
    setDirty(true);
  }
  function addRow() {
    setRows((rs) => [{ employee_id: "", name: "", corporation: "SK머티리얼즈", division: "", team: "", role_level: "L3", position: "팀원", job_type: "사무직", persona_role: "employee", extra_attrs: null, _new: true } as Row, ...rs]);
    setDirty(true);
  }
  function delRow(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: rows }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setMsg(`저장 완료 · ${data.saved}명 반영됨 (DB 영구 저장)`);
      load();
    } else {
      setErr(data.error ?? "저장 실패");
    }
  }

  const divisions = useMemo(() => [...new Set(rows.map((r) => r.division).filter(Boolean))] as string[], [rows]);
  const teams = useMemo(() => [...new Set(rows.map((r) => r.team).filter(Boolean))] as string[], [rows]);

  const view = rows
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) =>
      (!fDiv || r.division === fDiv) &&
      (!fTeam || r.team === fTeam) &&
      (!fJob || r.job_type === fJob) &&
      (!fRl || r.role_level === fRl)
    );

  const filtered = fDiv || fTeam || fJob || fRl;
  const evalN = rows.filter((r) => JOB.slice(0, 3).includes(r.job_type ?? "")).length;
  const adminN = rows.filter((r) => r.persona_role === "hr_admin").length;

  const personaCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.persona_role ?? "(없음)", (m.get(r.persona_role ?? "(없음)") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const inp = "border border-border-soft bg-white px-1.5 py-1 text-xs w-full";

  return (
    <div>
      <PageHeader title="구성원 Master Data" desc="구성원 조회·편집(추가/수정/삭제) — 저장 시 DB 영구 반영" />

      <div className="grid grid-cols-4 gap-4 mb-4">
        <Stat label="총 인원" value={`${rows.length}명`} accent />
        <Stat label="평가 대상" value={`${evalN}명`} />
        <Stat label="팀 수" value={`${teams.length}개`} />
        <Stat label="HR Admin" value={`${adminN}명`} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-4 gap-3">
          <label className="block"><span className="text-xs text-text-muted">담당</span>
            <select className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1" value={fDiv} onChange={(e) => setFDiv(e.target.value)}>
              <option value="">전체</option>{divisions.map((d) => <option key={d}>{d}</option>)}
            </select></label>
          <label className="block"><span className="text-xs text-text-muted">팀</span>
            <select className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1" value={fTeam} onChange={(e) => setFTeam(e.target.value)}>
              <option value="">전체</option>{teams.map((t) => <option key={t}>{t}</option>)}
            </select></label>
          <label className="block"><span className="text-xs text-text-muted">직종</span>
            <select className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1" value={fJob} onChange={(e) => setFJob(e.target.value)}>
              <option value="">전체</option>{JOB.map((j) => <option key={j}>{j}</option>)}
            </select></label>
          <label className="block"><span className="text-xs text-text-muted">R/L</span>
            <select className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1" value={fRl} onChange={(e) => setFRl(e.target.value)}>
              <option value="">전체</option>{RL.map((r) => <option key={r}>{r}</option>)}
            </select></label>
        </div>
      </Card>

      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-sm font-semibold">구성원 목록 ({view.length} / {rows.length})</h2>
        <button className="border border-sk-orange text-[#C45E00] px-3 py-1 text-xs font-medium" onClick={addRow}>+ 행 추가</button>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <Badge tone="orange" label="변경됨" />}
          <button className="bg-sk-orange text-white px-4 py-1.5 text-sm font-bold disabled:opacity-40" onClick={save} disabled={saving || !dirty}>
            {saving ? "저장 중…" : "변경사항 저장"}
          </button>
        </div>
      </div>
      {filtered && <div className="mb-2 text-xs text-[#9A6500] border border-warning bg-warning/[0.08] p-2">필터가 걸려 있어도 저장 시 <b>전체 인원</b>이 반영됩니다.</div>}
      {msg && <div className="mb-2 border border-success bg-success/[0.06] p-2 text-sm text-success">{msg}</div>}
      {err && <div className="mb-2 border border-sk-red bg-sk-red/[0.06] p-2 text-sm text-sk-red">{err}</div>}

      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-border-soft text-left text-text-muted">
                <th className="py-2 pr-2">사번*</th><th className="py-2 pr-2">이름*</th><th className="py-2 pr-2">법인</th>
                <th className="py-2 pr-2">담당</th><th className="py-2 pr-2">팀</th><th className="py-2 pr-2">R/L</th>
                <th className="py-2 pr-2">직책</th><th className="py-2 pr-2">직종</th><th className="py-2 pr-2">페르소나</th><th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {view.map(({ r, idx }) => (
                <tr key={idx} className={`border-b border-border-soft ${r._new ? "bg-sk-orange/[0.05]" : ""}`}>
                  <td className="py-1 pr-2"><input className={inp} value={r.employee_id} onChange={(e) => edit(idx, "employee_id", e.target.value)} /></td>
                  <td className="py-1 pr-2"><input className={inp} value={r.name} onChange={(e) => edit(idx, "name", e.target.value)} /></td>
                  <td className="py-1 pr-2"><input className={inp} value={r.corporation ?? ""} onChange={(e) => edit(idx, "corporation", e.target.value)} /></td>
                  <td className="py-1 pr-2"><input className={inp} value={r.division ?? ""} onChange={(e) => edit(idx, "division", e.target.value)} /></td>
                  <td className="py-1 pr-2"><input className={inp} value={r.team ?? ""} onChange={(e) => edit(idx, "team", e.target.value)} /></td>
                  <td className="py-1 pr-2"><select className={inp} value={r.role_level ?? ""} onChange={(e) => edit(idx, "role_level", e.target.value)}>{RL.map((x) => <option key={x}>{x}</option>)}</select></td>
                  <td className="py-1 pr-2"><select className={inp} value={r.position ?? ""} onChange={(e) => edit(idx, "position", e.target.value)}>{POS.map((x) => <option key={x}>{x}</option>)}</select></td>
                  <td className="py-1 pr-2"><select className={inp} value={r.job_type ?? ""} onChange={(e) => edit(idx, "job_type", e.target.value)}>{JOB.map((x) => <option key={x}>{x}</option>)}</select></td>
                  <td className="py-1 pr-2"><select className={inp} value={r.persona_role ?? ""} onChange={(e) => edit(idx, "persona_role", e.target.value)}>{PERSONAS.map((x) => <option key={x} value={x}>{x ? PERSONA_LABELS[x as PersonaCode] : "(없음)"}</option>)}</select></td>
                  <td className="py-1"><button className="text-sk-red text-xs" onClick={() => delRow(idx)}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="페르소나 매핑 현황">
        <table className="w-full text-sm">
          <tbody>
            {personaCounts.map(([p, n]) => (
              <tr key={p} className="border-b border-border-soft last:border-0">
                <td className="py-1.5">{p in PERSONA_LABELS ? PERSONA_LABELS[p as PersonaCode] : p}</td>
                <td className="py-1.5 text-right font-medium">{n}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

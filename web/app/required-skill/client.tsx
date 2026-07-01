"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Card, Badge } from "@/components/ui";

interface Req {
  org_or_individual: string; target_id: string; skill_id: number; target_level: number;
  is_core: number; status: string; skill_name: string; sub_family_name: string; family_name: string;
}
interface SkillOpt { skill_id: number; skill_name: string; sub_family_name: string; family_name: string }
interface Data { rows: Req[]; skills: SkillOpt[]; teams: string[]; members: { employee_id: string; name: string; team: string }[] }

type Tab = "company" | "department" | "individual";

export function RequiredSkillClient() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("company");
  const [team, setTeam] = useState("");
  const [member, setMember] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/required").then((r) => r.json());
    setData(d);
    setTeam((t) => t || d.teams[0] || "");
    setMember((m) => m || d.members[0]?.employee_id || "");
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(body: object) {
    const r = await fetch("/api/required", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  }

  if (!data) return <div className="text-sm text-text-muted">불러오는 중…</div>;

  const TABS: { key: Tab; label: string }[] = [
    { key: "company", label: "전사" },
    { key: "department", label: "부서별" },
    { key: "individual", label: "개인별" },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader title="필요 Skill 정의" desc="전사·부서·개인 단위 요구 Skill 정의 및 개인 신청 승인" />
      <div className="flex gap-1 mb-4 border-b border-border-soft">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setMsg(null); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t.key ? "border-sk-red text-sk-red" : "border-transparent text-text-muted"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {msg && <div className="mb-3 border border-success bg-success/[0.06] p-2 text-sm text-success">{msg}</div>}

      {tab === "company" && (
        <ScopeEditor title="전사 공통 필요 Skill (모든 구성원 대상)" data={data} orgKind="company" targetId="ALL"
          onSaved={(m) => { setMsg(m); load(); }} post={post} />
      )}

      {tab === "department" && (
        <div>
          <label className="text-sm text-text-muted mr-2">부서(팀)</label>
          <select className="border border-border-soft bg-white px-3 py-1.5 text-sm mb-4" value={team} onChange={(e) => setTeam(e.target.value)}>
            {data.teams.map((t) => <option key={t}>{t}</option>)}
          </select>
          <ScopeEditor key={team} title={`${team} 필요 Skill`} data={data} orgKind="department" targetId={team}
            onSaved={(m) => { setMsg(m); load(); }} post={post} />
        </div>
      )}

      {tab === "individual" && (
        <IndividualPanel data={data} member={member} setMember={setMember}
          onChanged={(m) => { setMsg(m); load(); }} post={post} />
      )}
    </div>
  );
}

function ScopeEditor({ title, data, orgKind, targetId, onSaved, post }: {
  title: string; data: Data; orgKind: string; targetId: string;
  onSaved: (m: string) => void; post: (b: object) => Promise<{ ok?: boolean; saved?: number }>;
}) {
  const initial = data.rows.filter((r) => r.org_or_individual === orgKind && r.target_id === targetId && r.status === "approved");
  const [rows, setRows] = useState(initial.map((r) => ({ skill_id: r.skill_id, target_level: r.target_level, is_core: !!r.is_core })));
  const [addId, setAddId] = useState<number | "">("");
  const skillName = useMemo(() => new Map(data.skills.map((s) => [s.skill_id, s.skill_name])), [data.skills]);
  const usedIds = new Set(rows.map((r) => r.skill_id));

  return (
    <Card title={title}>
      <table className="w-full text-sm mb-3">
        <thead>
          <tr className="border-b-2 border-border-soft text-left text-text-muted">
            <th className="py-2 pr-3">Skill</th><th className="py-2 pr-3 w-28">목표 Level</th><th className="py-2 pr-3 w-20">핵심(Core)</th><th className="py-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="py-3 text-text-muted text-xs">등록된 필요 Skill이 없습니다. 아래에서 추가하세요.</td></tr>}
          {rows.map((r, i) => (
            <tr key={r.skill_id} className="border-b border-border-soft">
              <td className="py-1.5 pr-3">#{String(r.skill_id).padStart(3, "0")} {skillName.get(r.skill_id)}</td>
              <td className="py-1.5 pr-3">
                <select className="border border-border-soft px-2 py-1 text-sm" value={r.target_level}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, target_level: Number(e.target.value) } : x))}>
                  {[1, 2, 3, 4].map((l) => <option key={l} value={l}>L{l}</option>)}
                </select>
              </td>
              <td className="py-1.5 pr-3">
                <input type="checkbox" checked={r.is_core} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, is_core: e.target.checked } : x))} />
              </td>
              <td className="py-1.5"><button className="text-sk-red text-xs" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mb-3">
        <select className="border border-border-soft bg-white px-2 py-1.5 text-sm flex-1" value={addId} onChange={(e) => setAddId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">+ Skill 추가 선택</option>
          {data.skills.filter((s) => !usedIds.has(s.skill_id)).map((s) => (
            <option key={s.skill_id} value={s.skill_id}>#{String(s.skill_id).padStart(3, "0")} {s.skill_name} ({s.sub_family_name})</option>
          ))}
        </select>
        <button className="border border-sk-orange text-[#C45E00] px-3 py-1.5 text-sm font-medium" disabled={addId === ""}
          onClick={() => { if (addId !== "") { setRows((rs) => [...rs, { skill_id: addId, target_level: 2, is_core: false }]); setAddId(""); } }}>추가</button>
      </div>
      <button className="bg-sk-orange text-white px-4 py-1.5 text-sm font-bold"
        onClick={async () => { const r = await post({ action: "saveScope", org_kind: orgKind, target_id: targetId, rows }); if (r.ok) onSaved(`${r.saved}건 저장 완료 (DB 영구 반영)`); }}>
        저장
      </button>
    </Card>
  );
}

function IndividualPanel({ data, member, setMember, onChanged, post }: {
  data: Data; member: string; setMember: (v: string) => void;
  onChanged: (m: string) => void; post: (b: object) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const [addId, setAddId] = useState<number | "">("");
  const mine = data.rows.filter((r) => r.org_or_individual === "individual" && r.target_id === member);
  const approved = mine.filter((r) => r.status === "approved");
  const pending = mine.filter((r) => r.status === "pending");
  const usedIds = new Set(mine.map((r) => r.skill_id));

  return (
    <div>
      <label className="text-sm text-text-muted mr-2">구성원</label>
      <select className="border border-border-soft bg-white px-3 py-1.5 text-sm mb-4" value={member} onChange={(e) => setMember(e.target.value)}>
        {data.members.map((m) => <option key={m.employee_id} value={m.employee_id}>{m.name} ({m.team})</option>)}
      </select>

      <Card title="개인 Skill 신청" className="mb-4">
        <div className="flex items-center gap-2">
          <select className="border border-border-soft bg-white px-2 py-1.5 text-sm flex-1" value={addId} onChange={(e) => setAddId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Skill 선택</option>
            {data.skills.filter((s) => !usedIds.has(s.skill_id)).map((s) => (
              <option key={s.skill_id} value={s.skill_id}>#{String(s.skill_id).padStart(3, "0")} {s.skill_name}</option>
            ))}
          </select>
          <button className="bg-sk-orange text-white px-3 py-1.5 text-sm font-bold" disabled={addId === ""}
            onClick={async () => { if (addId === "") return; const r = await post({ action: "request", member_id: member, skill_id: addId, target_level: 2 }); if (r.ok) { setAddId(""); onChanged("신청 완료 (팀장/HR 승인 대기)"); } else onChanged(r.error ?? "신청 실패"); }}>신청</button>
        </div>
      </Card>

      <Card title={`승인 대기 (${pending.length})`} className="mb-4">
        {pending.length === 0 ? <div className="text-xs text-text-muted">대기 중인 신청이 없습니다.</div> :
          pending.map((r) => (
            <div key={r.skill_id} className="flex items-center gap-2 border-b border-border-soft py-1.5 text-sm">
              <Badge tone="warning" label="대기" />
              <span className="flex-1">#{String(r.skill_id).padStart(3, "0")} {r.skill_name} · 목표 L{r.target_level}</span>
              <button className="border border-success text-success px-2 py-0.5 text-xs" onClick={async () => { await post({ action: "approve", member_id: member, skill_id: r.skill_id }); onChanged("승인됨"); }}>승인</button>
              <button className="border border-sk-red text-sk-red px-2 py-0.5 text-xs" onClick={async () => { await post({ action: "reject", member_id: member, skill_id: r.skill_id }); onChanged("반려됨"); }}>반려</button>
            </div>
          ))}
      </Card>

      <Card title={`승인된 개인 필요 Skill (${approved.length})`}>
        {approved.length === 0 ? <div className="text-xs text-text-muted">승인된 개인 Skill이 없습니다.</div> :
          approved.map((r) => (
            <div key={r.skill_id} className="flex items-center gap-2 border-b border-border-soft py-1.5 text-sm">
              <Badge tone="success" label="승인" />
              <span className="flex-1">#{String(r.skill_id).padStart(3, "0")} {r.skill_name} · 목표 L{r.target_level}</span>
              <button className="text-sk-red text-xs" onClick={async () => { await post({ action: "removeIndividual", member_id: member, skill_id: r.skill_id }); onChanged("제거됨"); }}>제거</button>
            </div>
          ))}
      </Card>
    </div>
  );
}

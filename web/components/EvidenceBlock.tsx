"use client";
import { useEffect, useState, useCallback } from "react";

interface Ev { evidence_id: number; evidence_type: string; title: string; description: string | null; created_date: string }

const TYPE_LABELS: Record<string, string> = {
  project: "프로젝트", certificate: "자격증", training: "교육", output: "산출물", patent: "특허",
};
const TYPES = Object.keys(TYPE_LABELS);

export function EvidenceBlock({ memberId, skillId }: { memberId: string; skillId: number }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Ev[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("project");
  const [desc, setDesc] = useState("");

  const load = useCallback(async () => {
    const d = await fetch(`/api/evidence?member_id=${memberId}&skill_id=${skillId}`).then((r) => r.json());
    setRows(d.rows ?? []);
  }, [memberId, skillId]);
  useEffect(() => { if (open) load(); }, [open, load]);

  async function add() {
    if (!title.trim()) return;
    await fetch("/api/evidence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member_id: memberId, skill_id: skillId, evidence_type: type, title, description: desc }) });
    setTitle(""); setDesc(""); load();
  }
  async function del(id: number) {
    await fetch(`/api/evidence?evidence_id=${id}`, { method: "DELETE" }); load();
  }

  return (
    <div className="text-xs">
      <button className="text-info underline" onClick={() => setOpen((v) => !v)}>Evidence {open ? "닫기" : "보기/추가"}</button>
      {open && (
        <div className="mt-2 border border-border-soft p-2 bg-bg-main/50">
          {rows.length === 0 ? <div className="text-text-muted">연결된 Evidence가 없습니다.</div> :
            rows.map((r) => (
              <div key={r.evidence_id} className="border-l-2 border-border-soft pl-2 mb-1.5 flex justify-between items-start">
                <div>
                  <div className="text-text-muted text-[10px]">{TYPE_LABELS[r.evidence_type] ?? r.evidence_type} · {r.created_date}</div>
                  <div className="text-text-main font-medium">{r.title}</div>
                  {r.description && <div className="text-text-muted">{r.description}</div>}
                </div>
                <button className="text-sk-red text-[10px]" onClick={() => del(r.evidence_id)}>삭제</button>
              </div>
            ))}
          <div className="flex gap-1 mt-2">
            <input className="border border-border-soft px-1.5 py-1 flex-1" placeholder="근거 제목" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select className="border border-border-soft px-1 py-1" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            <button className="bg-sk-orange text-white px-2 py-1 font-bold" onClick={add}>등록</button>
          </div>
          <input className="border border-border-soft px-1.5 py-1 w-full mt-1" placeholder="설명 (선택)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      )}
    </div>
  );
}

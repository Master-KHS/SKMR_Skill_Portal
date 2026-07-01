"use client";
import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { EvidenceBlock } from "@/components/EvidenceBlock";

interface Row {
  skill_id: number;
  skill_name: string;
  sub_family_name: string;
  current_level: number;
  target_level: number | null;
  self_level: number | null;
  stage_level: number | null;
}

interface Props {
  title: string;
  desc: string;
  stage: "leader" | "calibration" | "committee";
  members: { id: string; label: string }[];
  confirmLabel: string; // 예: "리더 확정" / "Calibration 확정" / "Committee 최종 확정"
}

export function StageAssess({ title, desc, stage, members, confirmLabel }: Props) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!memberId) return;
    const res = await fetch(`/api/assess?member_id=${memberId}&stage=${stage}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setEdits({});
    setMsg(null);
  }, [memberId, stage]);

  useEffect(() => {
    load();
  }, [load]);

  function setLevel(skill_id: number, level: number) {
    setEdits((e) => ({ ...e, [skill_id]: level }));
  }

  async function save() {
    const updates = rows.map((r) => ({
      skill_id: r.skill_id,
      confirmed_level: edits[r.skill_id] ?? r.stage_level ?? r.self_level ?? r.current_level,
    }));
    setSaving(true);
    const res = await fetch("/api/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, stage, assessor_id: memberId, updates }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setMsg(
        `${data.saved}건 ${confirmLabel} 저장 완료 (${data.date})` +
          (stage === "committee" ? " — 최종 결과에 반영되었습니다." : "")
      );
      load();
    }
  }

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    (groups.get(r.sub_family_name) ?? groups.set(r.sub_family_name, []).get(r.sub_family_name)!).push(r);
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title={title} desc={desc} />

      <Card className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-text-muted">대상 구성원</label>
          <select
            className="border border-border-soft bg-white px-3 py-1.5 text-sm"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-text-muted">보유 Skill {rows.length}개</span>
          <button
            className="ml-auto bg-sk-orange text-white px-4 py-1.5 text-sm font-bold disabled:opacity-40"
            onClick={save}
            disabled={saving || rows.length === 0}
          >
            {saving ? "저장 중…" : confirmLabel}
          </button>
        </div>
        {msg && (
          <div className="mt-3 border border-success bg-success/[0.06] p-2 text-sm text-success">
            <span className="font-semibold">완료 · </span>
            {msg}
          </div>
        )}
      </Card>

      {[...groups.entries()].map(([sub, items]) => (
        <Card key={sub} title={sub} className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-soft text-left text-text-muted">
                <th className="py-2 pr-3">Skill</th>
                <th className="py-2 pr-3 w-20">목표</th>
                <th className="py-2 pr-3 w-20">자가</th>
                <th className="py-2 pr-3 w-24">현재</th>
                <th className="py-2 w-56">{confirmLabel}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const val = edits[r.skill_id] ?? r.stage_level ?? r.self_level ?? r.current_level;
                const changed = r.skill_id in edits;
                return (
                  <tr key={r.skill_id} className="border-b border-border-soft">
                    <td className="py-2 pr-3">{r.skill_name}</td>
                    <td className="py-2 pr-3 text-text-muted">{r.target_level ? `L${r.target_level}` : "-"}</td>
                    <td className="py-2 pr-3 text-text-muted">{r.self_level ? `L${r.self_level}` : "-"}</td>
                    <td className="py-2 pr-3">L{r.current_level}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <select
                          className={`border px-2 py-1 text-sm ${changed ? "border-sk-orange" : "border-border-soft"}`}
                          value={val}
                          onChange={(e) => setLevel(r.skill_id, Number(e.target.value))}
                        >
                          {[1, 2, 3, 4].map((l) => (
                            <option key={l} value={l}>
                              L{l}
                            </option>
                          ))}
                        </select>
                        {r.stage_level ? <Badge tone="success" label="확정됨" /> : null}
                      </div>
                      <div className="mt-1"><EvidenceBlock memberId={memberId} skillId={r.skill_id} /></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

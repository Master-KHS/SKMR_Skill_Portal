"use client";
import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { EvidenceBlock } from "@/components/EvidenceBlock";
import { usePersona } from "@/components/PersonaContext";

interface Row {
  skill_id: number;
  skill_name: string;
  sub_family_name: string;
  family_name: string;
  current_level: number;
  target_level: number | null;
  is_critical: number;
}

const LEVEL_NAMES: Record<number, string> = {
  1: "L1 Youngling",
  2: "L2 Padawan",
  3: "L3 Jedi Knight",
  4: "L4 Jedi Master",
};

// 자가 진단 — 원본 Streamlit과 동일하게 "현재 로그인된 사람"(상단 페르소나의 2단계에서 고른 사람)
// 본인만 진단한다. 다른 사람을 골라볼 수 있는 드롭다운은 없음.
export function SelfAssessClient() {
  const { currentMember } = usePersona();
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentMember) return;
    const res = await fetch(`/api/self-assess?member_id=${currentMember.employee_id}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setEdits({});
    setSavedMsg(null);
  }, [currentMember]);

  useEffect(() => {
    load();
  }, [load]);

  function setLevel(skill_id: number, level: number) {
    setEdits((e) => ({ ...e, [skill_id]: level }));
  }

  async function save() {
    if (!currentMember) return;
    const updates = Object.entries(edits).map(([skill_id, current_level]) => ({
      skill_id: Number(skill_id),
      current_level,
    }));
    if (!updates.length) return;
    setSaving(true);
    const res = await fetch("/api/self-assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: currentMember.employee_id, updates }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setSavedMsg(`${data.saved}건 저장 완료 (${data.date}) — DB에 영구 반영되었습니다.`);
      load();
    }
  }

  const dirtyCount = Object.keys(edits).length;

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.family_name} / ${r.sub_family_name}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  if (!currentMember) {
    return (
      <div className="max-w-5xl">
        <PageHeader title="자가 진단" desc="본인 보유 Skill 레벨을 진단하여 저장합니다" />
        <div className="border border-warning bg-warning/[0.08] p-3 text-sm text-[#9A6500]">
          현재 페르소나에 매핑된 인원이 없습니다. 상단 &lsquo;사람&rsquo; 선택을 확인하세요.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="자가 진단" desc="본인 보유 Skill 레벨을 진단하여 저장합니다 (로컬 DB 영구 저장)" />

      <Card className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-text-muted">평가 대상</span>
          <span className="text-sm font-semibold text-text-main">
            {currentMember.name} <span className="text-text-muted font-normal">({currentMember.team ?? currentMember.division} · {currentMember.role_level})</span>
          </span>
          <span className="text-xs text-text-muted">보유 Skill {rows.length}개</span>
          <div className="ml-auto flex items-center gap-2">
            {dirtyCount > 0 && <Badge tone="orange" label={`변경 ${dirtyCount}건`} />}
            <button
              className="bg-sk-orange text-white px-4 py-1.5 text-sm font-bold disabled:opacity-40"
              onClick={save}
              disabled={saving || dirtyCount === 0}
            >
              {saving ? "저장 중…" : "진단 저장"}
            </button>
          </div>
        </div>
        {savedMsg && (
          <div className="mt-3 border border-success bg-success/[0.06] p-2 text-sm text-success">
            <span className="font-semibold">저장 완료 · </span>
            {savedMsg}
          </div>
        )}
      </Card>

      {[...groups.entries()].map(([group, items]) => (
        <Card key={group} title={group} className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-soft text-left text-text-muted">
                <th className="py-2 pr-3">Skill</th>
                <th className="py-2 pr-3 w-24">목표</th>
                <th className="py-2 w-56">현재 레벨 (진단)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const cur = edits[r.skill_id] ?? r.current_level;
                const changed = r.skill_id in edits && edits[r.skill_id] !== r.current_level;
                return (
                  <tr key={r.skill_id} className="border-b border-border-soft">
                    <td className="py-2 pr-3">
                      {r.skill_name}
                      {r.is_critical ? (
                        <span className="ml-2 align-middle">
                          <Badge tone="danger" label="Critical" />
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">
                      {r.target_level ? `L${r.target_level}` : "-"}
                    </td>
                    <td className="py-2">
                      <select
                        className={`border px-2 py-1 text-sm ${
                          changed ? "border-sk-orange" : "border-border-soft"
                        }`}
                        value={cur}
                        onChange={(e) => setLevel(r.skill_id, Number(e.target.value))}
                      >
                        {[1, 2, 3, 4].map((l) => (
                          <option key={l} value={l}>
                            {LEVEL_NAMES[l]}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1">
                        <EvidenceBlock memberId={currentMember.employee_id} skillId={r.skill_id} />
                      </div>
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

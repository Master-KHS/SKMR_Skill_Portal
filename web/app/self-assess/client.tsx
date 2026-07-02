"use client";

import { useCallback, useEffect, useState } from "react";
import { EvidenceBlock } from "@/components/EvidenceBlock";
import { usePersona } from "@/components/PersonaContext";
import { Badge, Card, PageHeader } from "@/components/ui";

interface Row {
  skill_id: number;
  skill_name: string;
  sub_family_name: string;
  family_name: string;
  current_level: number;
  target_level: number | null;
  is_critical: number;
  self_level: number | null;
  req_is_core: number;
}

const LEVEL_NAMES: Record<number, string> = {
  1: "L1 Youngling",
  2: "L2 Padawan",
  3: "L3 Jedi Knight",
  4: "L4 Jedi Master",
};

export function SelfAssessClient() {
  const { currentMember } = usePersona();
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [onlyPending, setOnlyPending] = useState(true);

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
    setEdits((current) => ({ ...current, [skill_id]: level }));
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
      setSavedMsg(`${data.saved}건 제출 완료 (${data.date})`);
      load();
    }
  }

  const dirtyCount = Object.keys(edits).length;
  const viewRows = onlyPending ? rows.filter((row) => row.self_level == null) : rows;

  const groups = new Map<string, Row[]>();
  for (const row of viewRows) {
    const key = `${row.family_name} / ${row.sub_family_name}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(row);
  }

  if (!currentMember) {
    return (
      <div className="max-w-5xl">
        <PageHeader title="자기 진단" desc="본인 보유 Skill 수준을 진단합니다" />
        <div className="border border-warning bg-warning/[0.08] p-3 text-sm text-[#9A6500]">
          현재 페르소나에 매핑된 구성원이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="자기 진단" desc="Required Skill 기준으로 자기평가를 제출합니다" />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-text-muted">평가 대상</span>
          <span className="text-sm font-semibold text-text-main">
            {currentMember.name} <span className="font-normal text-text-muted">({currentMember.team ?? currentMember.division} / {currentMember.role_level})</span>
          </span>
          <span className="text-xs text-text-muted">대상 Skill {rows.length}개</span>
          <label className="ml-2 flex items-center gap-2 text-xs text-text-muted">
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
            미제출만 보기
          </label>
          <div className="ml-auto flex items-center gap-2">
            {dirtyCount > 0 && <Badge tone="orange" label={`변경 ${dirtyCount}건`} />}
            <button
              className="bg-sk-orange px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
              onClick={save}
              disabled={saving || dirtyCount === 0}
            >
              {saving ? "제출 중.." : "자기평가 제출"}
            </button>
          </div>
        </div>
        {savedMsg && (
          <div className="mt-3 border border-success bg-success/[0.06] p-2 text-sm text-success">
            {savedMsg}
          </div>
        )}
      </Card>

      {viewRows.length === 0 && (
        <Card className="mb-4">
          <div className="text-sm text-text-muted">현재 조건에서 표시할 Skill이 없습니다.</div>
        </Card>
      )}

      {[...groups.entries()].map(([group, items]) => (
        <Card key={group} title={group} className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-soft text-left text-text-muted">
                <th className="py-2 pr-3">Skill</th>
                <th className="w-24 py-2 pr-3">목표</th>
                <th className="w-56 py-2">자기평가</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const value = edits[row.skill_id] ?? row.current_level;
                const changed = row.skill_id in edits && edits[row.skill_id] !== row.current_level;
                return (
                  <tr key={row.skill_id} className="border-b border-border-soft">
                    <td className="py-2 pr-3">
                      {row.skill_name}
                      {row.req_is_core ? <span className="ml-2 align-middle"><Badge tone="danger" label="CORE" /></span> : null}
                      {row.is_critical ? <span className="ml-2 align-middle"><Badge tone="danger" label="Critical" /></span> : null}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{row.target_level ? `L${row.target_level}` : "-"}</td>
                    <td className="py-2">
                      {row.self_level != null && <div className="mb-1 text-xs text-success">제출됨 L{row.self_level}</div>}
                      <select
                        className={`border px-2 py-1 text-sm ${changed ? "border-sk-orange" : "border-border-soft"}`}
                        value={value}
                        onChange={(e) => setLevel(row.skill_id, Number(e.target.value))}
                      >
                        {[1, 2, 3, 4].map((level) => (
                          <option key={level} value={level}>
                            {LEVEL_NAMES[level]}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1">
                        <EvidenceBlock memberId={currentMember.employee_id} skillId={row.skill_id} />
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

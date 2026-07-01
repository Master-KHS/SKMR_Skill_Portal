"use client";
import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card, Badge } from "@/components/ui";

interface Row {
  sub_family_id: string;
  sub_family_name: string;
  level: number;
  expertise_criteria: string;
  impact_criteria: string;
}

const LEVEL_NAMES: Record<number, string> = {
  1: "L1 Youngling",
  2: "L2 Padawan",
  3: "L3 Jedi Knight",
  4: "L4 Jedi Master",
};

export function PolicyClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<string, { expertise_criteria: string; impact_criteria: string }>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const key = (r: Row) => `${r.sub_family_id}|${r.level}`;

  const load = useCallback(async () => {
    const res = await fetch("/api/policy");
    const data = await res.json();
    setRows(data.rows ?? []);
    setEdits({});
    setMsg(null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField(r: Row, field: "expertise_criteria" | "impact_criteria", value: string) {
    const k = key(r);
    setEdits((e) => ({
      ...e,
      [k]: {
        expertise_criteria: field === "expertise_criteria" ? value : e[k]?.expertise_criteria ?? r.expertise_criteria,
        impact_criteria: field === "impact_criteria" ? value : e[k]?.impact_criteria ?? r.impact_criteria,
      },
    }));
  }

  async function save() {
    const updates = Object.entries(edits).map(([k, v]) => {
      const [sub_family_id, level] = k.split("|");
      return { sub_family_id, level: Number(level), ...v };
    });
    if (!updates.length) return;
    setSaving(true);
    const res = await fetch("/api/policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setMsg(`${data.saved}건 저장 완료 — DB에 영구 반영되었습니다.`);
      load();
    }
  }

  const dirty = Object.keys(edits).length;

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    (groups.get(r.sub_family_name) ?? groups.set(r.sub_family_name, []).get(r.sub_family_name)!).push(r);
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="운영 정책 관리" desc="Sub-family별 Level 판정 기준(스킬 마스터리)을 직접 편집·저장합니다" />

      <div className="sticky top-0 z-10 bg-bg-main py-2 mb-3 flex items-center gap-3">
        {dirty > 0 && <Badge tone="orange" label={`변경 ${dirty}건`} />}
        <button
          className="ml-auto bg-sk-orange text-white px-4 py-1.5 text-sm font-bold disabled:opacity-40"
          onClick={save}
          disabled={saving || dirty === 0}
        >
          {saving ? "저장 중…" : "기준 저장"}
        </button>
      </div>
      {msg && (
        <div className="mb-3 border border-success bg-success/[0.06] p-2 text-sm text-success">
          <span className="font-semibold">완료 · </span>
          {msg}
        </div>
      )}

      {[...groups.entries()].map(([sub, items]) => (
        <Card key={sub} title={sub} className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-soft text-left text-text-muted">
                <th className="py-2 pr-3 w-32 align-top">Level</th>
                <th className="py-2 pr-3 align-top">전문성 기준</th>
                <th className="py-2 align-top">영향력 기준</th>
              </tr>
            </thead>
            <tbody>
              {items
                .sort((a, b) => a.level - b.level)
                .map((r) => {
                  const k = key(r);
                  const e = edits[k];
                  const changed = k in edits;
                  return (
                    <tr key={k} className="border-b border-border-soft align-top">
                      <td className="py-2 pr-3 font-semibold">{LEVEL_NAMES[r.level]}</td>
                      <td className="py-2 pr-3">
                        <textarea
                          className={`w-full border px-2 py-1 text-sm resize-y min-h-[3rem] ${changed ? "border-sk-orange" : "border-border-soft"}`}
                          value={e?.expertise_criteria ?? r.expertise_criteria}
                          onChange={(ev) => setField(r, "expertise_criteria", ev.target.value)}
                        />
                      </td>
                      <td className="py-2">
                        <textarea
                          className={`w-full border px-2 py-1 text-sm resize-y min-h-[3rem] ${changed ? "border-sk-orange" : "border-border-soft"}`}
                          value={e?.impact_criteria ?? r.impact_criteria}
                          onChange={(ev) => setField(r, "impact_criteria", ev.target.value)}
                        />
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

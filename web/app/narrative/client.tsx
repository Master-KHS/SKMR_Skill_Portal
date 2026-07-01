"use client";
import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card, Badge } from "@/components/ui";

export function NarrativeClient({ members }: { members: { id: string; label: string }[] }) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [text, setText] = useState("");
  const [savedDate, setSavedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!memberId) return;
    const res = await fetch(`/api/narrative?member_id=${memberId}`);
    const data = await res.json();
    setText(data.narrative ?? "");
    setSavedDate(data.date ?? null);
    setMsg(null);
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, narrative: text }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setMsg(`저장 완료 (${data.date}) — DB에 영구 저장되었습니다.`);
      setSavedDate(data.date);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Narrative 작성" desc="Committee 의결용 종합 의견을 작성합니다 (구성원별)" />
      <Card>
        <div className="flex items-center gap-3 mb-3">
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
          {savedDate && <Badge tone="info" label={`최종 저장 ${savedDate}`} />}
        </div>
        <textarea
          className="w-full h-64 border border-border-soft bg-white px-3 py-2 text-sm resize-y"
          placeholder="구성원의 강점, 성장 포인트, Committee 판단 근거 등을 작성하세요…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            className="bg-sk-orange text-white px-4 py-1.5 text-sm font-bold disabled:opacity-40"
            onClick={save}
            disabled={saving}
          >
            {saving ? "저장 중…" : "Narrative 저장"}
          </button>
          <span className="text-xs text-text-muted">{text.length}자</span>
        </div>
        {msg && (
          <div className="mt-3 border border-success bg-success/[0.06] p-2 text-sm text-success">
            <span className="font-semibold">완료 · </span>
            {msg}
          </div>
        )}
      </Card>
    </div>
  );
}

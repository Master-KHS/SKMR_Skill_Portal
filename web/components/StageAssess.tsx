"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { EvidenceBlock } from "@/components/EvidenceBlock";
import { usePersona } from "@/components/PersonaContext";
import type { MemberOption } from "@/lib/member-options";

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
  members: MemberOption[];
  confirmLabel: string;
  // team: team_leader 페르소나면 본인 팀으로 고정(원본: leader_assess.py)
  // division: calibration/team_leader 페르소나면 본인 담당으로 고정(원본: calibration.py)
  // none: 범위 제한 없음(committee — 전사 심의 대상)
  scope: "team" | "division" | "none";
}

export function StageAssess({ title, desc, stage, members, confirmLabel, scope }: Props) {
  const { persona, currentMember } = usePersona();

  // 페르소나별 범위 제한 — team_leader/calibration은 자기 조직으로 고정, hr_admin 등은 자유 선택(운영용).
  const isLocked =
    (scope === "team" && persona === "team_leader" && !!currentMember) ||
    (scope === "division" && (persona === "calibration" || persona === "team_leader") && !!currentMember);

  const scopedMembers = useMemo(() => {
    if (scope === "team" && persona === "team_leader" && currentMember) {
      return members.filter((m) => m.team === currentMember.team);
    }
    if (scope === "division" && (persona === "calibration" || persona === "team_leader") && currentMember) {
      return members.filter((m) => m.division === currentMember.division);
    }
    return members;
  }, [members, scope, persona, currentMember]);

  const [memberId, setMemberId] = useState(scopedMembers[0]?.id ?? "");
  useEffect(() => {
    if (!scopedMembers.find((m) => m.id === memberId)) {
      setMemberId(scopedMembers[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedMembers]);

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
      body: JSON.stringify({ member_id: memberId, stage, assessor_id: currentMember?.employee_id ?? memberId, updates }),
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

  const scopeLabel =
    scope === "team" && isLocked
      ? `팀: ${currentMember?.team ?? "-"}`
      : scope === "division" && isLocked
        ? `담당: ${currentMember?.division ?? "-"}`
        : null;

  return (
    <div className="max-w-5xl">
      <PageHeader title={title} desc={desc} />

      <Card className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {isLocked ? (
            <>
              <label className="text-sm text-text-muted">대상 구성원</label>
              <span className="text-sm font-semibold text-text-main">{scopeLabel}</span>
              <select
                className="border border-border-soft bg-white px-3 py-1.5 text-sm"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                {scopedMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="text-sm text-text-muted">대상 구성원 (운영용 · 전체 선택 가능)</label>
              <select
                className="border border-border-soft bg-white px-3 py-1.5 text-sm"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                {scopedMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <span className="text-xs text-text-muted">보유 Skill {rows.length}개</span>
          <button
            className="ml-auto bg-sk-orange text-white px-4 py-1.5 text-sm font-bold disabled:opacity-40"
            onClick={save}
            disabled={saving || rows.length === 0}
          >
            {saving ? "저장 중…" : confirmLabel}
          </button>
        </div>
        {scopedMembers.length === 0 && (
          <div className="mt-3 text-xs text-[#9A6500] border border-warning bg-warning/[0.08] p-2">
            범위 내 대상 구성원이 없습니다.
          </div>
        )}
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

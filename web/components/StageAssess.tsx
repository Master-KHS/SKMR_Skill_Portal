"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EvidenceBlock } from "@/components/EvidenceBlock";
import { usePersona } from "@/components/PersonaContext";
import { Badge, Card, PageHeader } from "@/components/ui";
import type { MemberOption } from "@/lib/member-options";

type StageCode = "leader" | "calibration" | "committee";

interface Row {
  skill_id: number;
  skill_name: string;
  sub_family_name: string;
  family_name: string;
  is_critical: number;
  current_level: number;
  target_level: number | null;
  self_level: number | null;
  leader_level: number | null;
  calibration_level: number | null;
  narrative: string | null;
}

interface Props {
  title: string;
  desc: string;
  stage: StageCode;
  members: MemberOption[];
  confirmLabel: string;
  scope: "team" | "division" | "none";
}

function levelLabel(level: number | null | undefined) {
  return level ? `L${level}` : "-";
}

export function StageAssess({ title, desc, stage, members, confirmLabel, scope }: Props) {
  const { persona, currentMember, loadingMembers } = usePersona();
  const requiresMappedMember =
    (scope === "team" && persona === "team_leader") ||
    (scope === "division" && (persona === "calibration" || persona === "team_leader"));

  const isLocked =
    (scope === "team" && persona === "team_leader" && !!currentMember) ||
    (scope === "division" && (persona === "calibration" || persona === "team_leader") && !!currentMember);

  const scopedMembers = useMemo(() => {
    if (requiresMappedMember && !currentMember) {
      return [];
    }

    if (scope === "team" && persona === "team_leader" && currentMember) {
      return members.filter((m) => m.team === currentMember.team && (stage !== "leader" || m.id !== currentMember.employee_id));
    }

    if (scope === "division" && (persona === "calibration" || persona === "team_leader") && currentMember) {
      return members.filter((m) => m.division === currentMember.division);
    }

    return members;
  }, [currentMember, members, persona, requiresMappedMember, scope, stage]);

  const [memberId, setMemberId] = useState(scopedMembers[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const levelOptions = stage === "leader" ? [1, 2, 3, 4] : [3, 4];

  useEffect(() => {
    if (!scopedMembers.find((m) => m.id === memberId)) {
      setMemberId(scopedMembers[0]?.id ?? "");
    }
  }, [memberId, scopedMembers]);

  const load = useCallback(async () => {
    if (loadingMembers || !memberId || !currentMember?.employee_id) {
      setRows([]);
      setEdits({});
      return;
    }

    const params = new URLSearchParams({
      member_id: memberId,
      stage,
      assessor_id: currentMember.employee_id,
    });
    const res = await fetch(`/api/assess?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      setRows([]);
      setEdits({});
      setMsg(data.error ?? "Failed to load assessment items.");
      return;
    }
    setRows(data.rows ?? []);
    setEdits({});
    setMsg(null);
  }, [currentMember?.employee_id, loadingMembers, memberId, stage]);

  useEffect(() => {
    load();
  }, [load]);

  function setLevel(skillId: number, level: number) {
    setEdits((prev) => ({ ...prev, [skillId]: level }));
  }

  async function save() {
    if (!memberId || rows.length === 0) return;

    const updates = rows.map((row) => ({
      skill_id: row.skill_id,
      confirmed_level:
        edits[row.skill_id] ??
        (stage === "committee"
          ? row.calibration_level ?? 4
          : stage === "calibration"
            ? row.leader_level ?? 3
            : row.self_level ?? row.current_level),
    }));

    setSaving(true);
    setMsg(null);

    const res = await fetch("/api/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: memberId,
        stage,
        assessor_id: currentMember?.employee_id ?? memberId,
        updates,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMsg(data.error ?? "Failed to save assessment.");
      return;
    }

    setMsg(
      `${data.saved}건 처리 완료 (${data.date})` +
        (stage === "leader"
          ? " · Lv1-Lv2는 즉시 확정되고 Lv3-Lv4는 Calibration으로 이관됩니다."
          : stage === "calibration"
            ? " · Lv3는 확정되고 Lv4는 Committee 후보가 됩니다."
            : " · 최종 결과가 Skill Profile에 반영되었습니다.")
    );
    load();
  }

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.family_name}__${row.sub_family_name}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(row);
  }

  const scopeLabel =
    scope === "team" && isLocked
      ? `팀: ${currentMember?.team ?? "-"}`
      : scope === "division" && isLocked
        ? `담당: ${currentMember?.division ?? "-"}`
        : null;

  const stageHint =
    stage === "leader"
      ? "Self 제출 건만 표시됩니다. Lv1-Lv2는 리더 단계에서 확정되고, Lv3-Lv4만 Calibration 안건으로 넘어갑니다."
      : stage === "calibration"
        ? "Leader 제출 건만 표시됩니다. Calibration에서는 Lv3 확정 또는 Lv4 Committee 상정만 처리합니다."
        : "Calibration에서 Lv4로 상정된 건만 표시됩니다. Committee 확정 시 Skill Profile current_level이 갱신됩니다.";

  return (
    <div className="max-w-5xl">
      <PageHeader title={title} desc={desc} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {isLocked ? (
            <>
              <label className="text-sm text-text-muted">평가 범위</label>
              <span className="text-sm font-semibold text-text-main">{scopeLabel}</span>
            </>
          ) : (
            <label className="text-sm text-text-muted">평가 대상 구성원</label>
          )}

          <select
            className="border border-border-soft bg-white px-3 py-1.5 text-sm"
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            disabled={loadingMembers || scopedMembers.length === 0}
          >
            {scopedMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>

          <span className="text-xs text-text-muted">처리 대기 {rows.length}건</span>

          <button
            className="ml-auto bg-sk-orange px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
            onClick={save}
            disabled={saving || rows.length === 0 || !memberId}
          >
            {saving ? "저장 중..." : confirmLabel}
          </button>
        </div>

        <div className="mt-3 text-xs text-text-muted">{stageHint}</div>

        {loadingMembers && (
          <div className="mt-3 border border-border-soft bg-white p-2 text-xs text-text-muted">
            권한 매핑 인원을 불러오는 중입니다.
          </div>
        )}

        {scopedMembers.length === 0 && (
          <div className="mt-3 border border-warning bg-warning/[0.08] p-2 text-xs text-[#9A6500]">
            현재 범위에서 처리 가능한 구성원이 없습니다.
          </div>
        )}

        {msg && (
          <div className="mt-3 border border-success bg-success/[0.06] p-2 text-sm text-success">
            {msg}
          </div>
        )}
      </Card>

      {rows.length === 0 && memberId && (
        <Card className="mb-4">
          <div className="text-sm text-text-muted">현재 선택된 구성원에 대한 처리 대기 건이 없습니다.</div>
        </Card>
      )}

      {[...groups.entries()].map(([groupKey, items]) => {
        const first = items[0];

        return (
          <Card key={groupKey} className="mb-4">
            <div className="mb-3 flex items-center gap-2">
              <div>
                <div className="text-xs text-text-muted">{first.family_name}</div>
                <div className="text-sm font-semibold text-text-main">{first.sub_family_name}</div>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border-soft text-left text-text-muted">
                  <th className="py-2 pr-3">Skill</th>
                  <th className="w-20 py-2 pr-3">목표</th>
                  <th className="w-20 py-2 pr-3">Self</th>
                  <th className="w-20 py-2 pr-3">Leader</th>
                  <th className="w-20 py-2 pr-3">Calib</th>
                  <th className="w-20 py-2 pr-3">현재</th>
                  <th className="w-56 py-2">{confirmLabel}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const fallback =
                    stage === "committee"
                      ? row.calibration_level ?? 4
                      : stage === "calibration"
                        ? row.leader_level ?? 3
                        : row.self_level ?? row.current_level;
                  const value = edits[row.skill_id] ?? fallback;
                  const changed = row.skill_id in edits;

                  return (
                    <tr key={row.skill_id} className="border-b border-border-soft align-top">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <span>{row.skill_name}</span>
                          {!!row.is_critical && <Badge tone="danger" label="CRITICAL" />}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-text-muted">{levelLabel(row.target_level)}</td>
                      <td className="py-2 pr-3 text-text-muted">{levelLabel(row.self_level)}</td>
                      <td className="py-2 pr-3 text-text-muted">{levelLabel(row.leader_level)}</td>
                      <td className="py-2 pr-3 text-text-muted">{levelLabel(row.calibration_level)}</td>
                      <td className="py-2 pr-3">L{row.current_level}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <select
                            className={`border px-2 py-1 text-sm ${changed ? "border-sk-orange" : "border-border-soft"}`}
                            value={value}
                            onChange={(event) => setLevel(row.skill_id, Number(event.target.value))}
                          >
                            {levelOptions.map((level) => (
                              <option key={level} value={level}>
                                L{level}
                              </option>
                            ))}
                          </select>
                          {stage === "leader" && value <= 2 && <Badge tone="success" label="즉시 확정" />}
                          {stage === "leader" && value >= 3 && <Badge tone="warning" label="Calib 이관" />}
                          {stage === "calibration" && value === 3 && <Badge tone="success" label="Lv3 확정" />}
                          {stage === "calibration" && value === 4 && <Badge tone="warning" label="Committee 상정" />}
                          {stage === "committee" && <Badge tone="success" label="최종 확정" />}
                        </div>

                        {stage === "committee" && row.narrative?.trim() ? (
                          <div className="mt-2 border border-border-soft bg-white p-2 text-xs text-text-muted">
                            <div className="mb-1 font-semibold text-text-main">Narrative</div>
                            <div>{row.narrative}</div>
                          </div>
                        ) : null}

                        <div className="mt-2">
                          <EvidenceBlock memberId={memberId} skillId={row.skill_id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}

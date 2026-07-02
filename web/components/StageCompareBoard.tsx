"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EvidenceBlock } from "@/components/EvidenceBlock";
import { usePersona } from "@/components/PersonaContext";
import { Badge, Card, PageHeader, PrimaryButton, Stat } from "@/components/ui";
import type { MemberOption } from "@/lib/member-options";

type StageCode = "calibration" | "committee";

interface AssessRow {
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

interface CandidateRow extends AssessRow {
  member_id: string;
  name: string;
  team: string | null;
  division: string | null;
  role_level: string | null;
}

interface Props {
  title: string;
  desc: string;
  stage: StageCode;
  members: MemberOption[];
  confirmLabel: string;
}

function levelLabel(level: number | null | undefined) {
  return level ? `L${level}` : "-";
}

export function StageCompareBoard({ title, desc, stage, members, confirmLabel }: Props) {
  const { persona, currentMember, loadingMembers } = usePersona();
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const requiresMappedMember = stage === "calibration" && (persona === "calibration" || persona === "team_leader");

  const scopedMembers = useMemo(() => {
    if (requiresMappedMember && !currentMember) {
      return [];
    }

    if (stage === "calibration" && currentMember && (persona === "calibration" || persona === "team_leader")) {
      return members.filter((member) => member.division === currentMember.division);
    }
    return members;
  }, [currentMember, members, persona, requiresMappedMember, stage]);

  const load = useCallback(async () => {
    if (loadingMembers || !currentMember?.employee_id) {
      setRows([]);
      return;
    }

    const requests = await Promise.all(
      scopedMembers.map(async (member) => {
        const params = new URLSearchParams({
          member_id: member.id,
          stage,
          assessor_id: currentMember.employee_id,
        });
        const res = await fetch(`/api/assess?${params.toString()}`);
        if (!res.ok) {
          return [];
        }

        const data = (await res.json()) as { rows?: AssessRow[] };
        return (data.rows ?? []).map((row) => ({
          ...row,
          member_id: member.id,
          name: member.label.split(" (")[0] ?? member.id,
          team: member.team,
          division: member.division,
          role_level: member.label.match(/· (.+)\)$/)?.[1] ?? null,
        }));
      })
    );

    setRows(requests.flat());
    setDrafts({});
    setMsg(null);
  }, [currentMember?.employee_id, loadingMembers, scopedMembers, stage]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<number, CandidateRow[]>();
    for (const row of rows) {
      const list = map.get(row.skill_id) ?? [];
      list.push(row);
      map.set(row.skill_id, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);

  async function saveRow(row: CandidateRow) {
    const key = `${row.member_id}_${row.skill_id}`;
    const confirmedLevel =
      drafts[key] ??
      (stage === "committee" ? row.calibration_level ?? 4 : row.leader_level ?? 3);

    setSavingKey(key);
    setMsg(null);

    const res = await fetch("/api/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: row.member_id,
        stage,
        assessor_id: currentMember?.employee_id,
        updates: [{ skill_id: row.skill_id, confirmed_level: confirmedLevel }],
      }),
    });

    const data = await res.json();
    setSavingKey(null);

    if (!res.ok) {
      setMsg(data.error ?? "Failed to save assessment.");
      return;
    }

    setMsg(
      stage === "calibration"
        ? `${row.name} · #${String(row.skill_id).padStart(3, "0")} 처리 완료`
        : `${row.name} · #${String(row.skill_id).padStart(3, "0")} 최종 확정 완료`
    );
    await load();
  }

  const scopeLabel =
    stage === "calibration" && currentMember && (persona === "calibration" || persona === "team_leader")
      ? `담당: ${currentMember.division ?? "-"}`
      : "범위: 전사";

  return (
    <div className="max-w-6xl">
      <PageHeader title={title} desc={desc} />

      <div className="mb-4 grid grid-cols-3 gap-4">
        <Stat label="처리 대상 Skill" value={grouped.length} accent />
        <Stat label="처리 대상 건" value={rows.length} />
        <Stat label="운영 범위" value={scopeLabel} />
      </div>

      <Card className="mb-4">
        <div className="text-sm text-text-muted">
          {stage === "calibration"
            ? "Leader 제출 건만 표시됩니다. 같은 Skill 안에서 후보를 비교하고, Lv3 확정 또는 Lv4 Committee 상정으로 처리합니다."
            : "Calibration에서 Lv4로 상정된 건만 표시됩니다. Committee 확정 시 Skill Profile current_level이 즉시 갱신됩니다."}
        </div>
        {loadingMembers && (
          <div className="mt-3 border border-border-soft bg-white p-2 text-xs text-text-muted">
            권한 매핑 인원을 불러오는 중입니다.
          </div>
        )}
        {msg && <div className="mt-3 border border-success bg-success/[0.06] p-2 text-sm text-success">{msg}</div>}
      </Card>

      {grouped.length === 0 ? (
        <Card>
          <div className="text-sm text-text-muted">현재 처리 대기 항목이 없습니다.</div>
        </Card>
      ) : (
        grouped.map(([skillId, items]) => {
          const first = items[0];
          return (
            <Card key={skillId} className="mb-4">
              <div className="mb-3">
                <div className="text-xs text-text-muted">
                  {first.family_name} · {first.sub_family_name}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <h3 className="text-base font-bold text-text-main">
                    #{String(skillId).padStart(3, "0")} {first.skill_name}
                  </h3>
                  {!!first.is_critical && <Badge tone="danger" label="CRITICAL" />}
                  <span className="text-xs text-text-muted">후보 {items.length}명</span>
                </div>
              </div>

              <div className="mb-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-border-soft text-left text-text-muted">
                      <th className="py-1.5 pr-2">이름</th>
                      <th className="py-1.5 pr-2">팀</th>
                      <th className="py-1.5 pr-2">R/L</th>
                      <th className="py-1.5 pr-2 text-center">Self</th>
                      <th className="py-1.5 pr-2 text-center">Leader</th>
                      <th className="py-1.5 text-center">Calib</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={`${row.member_id}_${row.skill_id}_summary`} className="border-b border-border-soft">
                        <td className="py-1 pr-2 font-medium">{row.name}</td>
                        <td className="py-1 pr-2">{row.team ?? "-"}</td>
                        <td className="py-1 pr-2">{row.role_level ?? "-"}</td>
                        <td className="py-1 pr-2 text-center">{levelLabel(row.self_level)}</td>
                        <td className="py-1 pr-2 text-center">{levelLabel(row.leader_level)}</td>
                        <td className="py-1 text-center">
                          {stage === "committee" ? levelLabel(row.calibration_level) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4">
                {items.map((row) => {
                  const key = `${row.member_id}_${row.skill_id}`;
                  const value =
                    drafts[key] ??
                    (stage === "committee" ? row.calibration_level ?? 4 : row.leader_level ?? 3);

                  return (
                    <div key={key} className="border border-border-soft p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-text-main">
                          {row.name}
                          <span className="ml-2 text-xs font-normal text-text-muted">
                            ({row.team ?? "-"} · {row.role_level ?? "-"})
                          </span>
                        </div>
                        <Badge tone="neutral" label={`Self ${levelLabel(row.self_level)}`} />
                        <Badge tone="neutral" label={`Leader ${levelLabel(row.leader_level)}`} />
                        {stage === "committee" && (
                          <Badge tone="neutral" label={`Calib ${levelLabel(row.calibration_level)}`} />
                        )}
                      </div>

                      {stage === "committee" && row.narrative?.trim() ? (
                        <div className="mb-3 border border-border-soft bg-white p-2 text-xs text-text-muted">
                          <div className="mb-1 font-semibold text-text-main">Narrative</div>
                          <div>{row.narrative}</div>
                        </div>
                      ) : null}

                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <select
                          className="border border-border-soft bg-white px-2 py-1 text-sm"
                          value={value}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [key]: Number(event.target.value) }))
                          }
                        >
                          <option value={3}>L3</option>
                          <option value={4}>L4</option>
                        </select>
                        {stage === "calibration" && value === 3 && <Badge tone="success" label="Lv3 확정" />}
                        {stage === "calibration" && value === 4 && <Badge tone="warning" label="Committee 상정" />}
                        {stage === "committee" && <Badge tone="success" label="최종 확정" />}
                        <PrimaryButton onClick={() => saveRow(row)} disabled={savingKey === key}>
                          {savingKey === key ? "저장 중..." : confirmLabel}
                        </PrimaryButton>
                      </div>

                      <EvidenceBlock memberId={row.member_id} skillId={row.skill_id} />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

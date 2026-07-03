"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Card, Badge, Stat } from "@/components/ui";
import { usePersona } from "@/components/PersonaContext";
import type { MemberOption } from "@/lib/member-options";

interface Prof {
  skill_id: number;
  current_level: number;
  target_level: number | null;
  last_assessed_date: string | null;
  skill_name: string;
  is_critical: number;
  sub_family_name: string;
  family_name: string;
}
interface Gap {
  skill_id: number;
  skill_name: string;
  target_level: number;
  is_core: number;
  current_level: number;
  gap: number;
}
interface Hist {
  stage: string;
  proposed_level: number | null;
  confirmed_level: number | null;
  assessed_date: string;
  status: string;
  rationale: string | null;
  skill_name: string;
  assessor_name: string | null;
}
interface Prog {
  skill_id: number;
  skill_name: string;
  current_level: number;
  done_self: number;
  done_leader: number;
  done_calib: number;
  done_comm: number;
}
interface Data {
  member: { name: string; team: string; division: string; role_level: string } | null;
  profile: Prof[];
  subAvg: { sub_family_name: string; avg_lv: number }[];
  gaps: Gap[];
  history: Hist[];
  progress: Prog[];
}

const STAGE_LABEL: Record<string, string> = {
  self: "자가",
  leader: "리더",
  calibration: "Calib",
  committee: "Committee",
  narrative: "Narrative",
};

function Radar({ data }: { data: { sub_family_name: string; avg_lv: number }[] }) {
  if (data.length < 3) return <div className="text-xs text-text-muted">레이더 표시를 위해 3개 이상 Sub-skill Family가 필요합니다.</div>;
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const R = 122;
  const max = 4;
  const n = data.length;
  const pt = (i: number, r: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  };
  const poly = data.map((d, i) => pt(i, (d.avg_lv / max) * R).join(",")).join(" ");
  return (
    <svg width={size} height={size} className="mx-auto">
      {[1, 2, 3, 4].map((lv) => (
        <polygon key={lv} points={data.map((_, i) => pt(i, (lv / max) * R).join(",")).join(" ")} fill="none" stroke="#E1E7EF" />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E1E7EF" />;
      })}
      <polygon points={poly} fill="rgba(234,0,44,0.15)" stroke="#EA002C" strokeWidth={2.5} />
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 20);
        return (
          <text key={i} x={x} y={y} fontSize={11} fill="#5F6B7A" textAnchor="middle" dominantBaseline="middle">
            {d.sub_family_name}
          </text>
        );
      })}
    </svg>
  );
}

function formatLevel(value: number | null | undefined) {
  if (value == null) return "-";
  return `L${value.toFixed(1).replace(".0", "")}`;
}

function formatGap(gap: number) {
  return gap <= 0.049 ? "달성" : `-${gap.toFixed(1)}`;
}

export function SkillProfileClient({
  members,
  title = "최종 결과 확인",
  desc = "구성원별 확정 Skill 보유 현황, 역량 요약, 요구 Skill Gap, 평가 이력을 확인합니다.",
}: {
  members: MemberOption[];
  title?: string;
  desc?: string;
}) {
  const { persona, currentMember, loadingMembers } = usePersona();

  const visible = useMemo(() => {
    if ((persona === "employee" || persona === "team_leader") && !currentMember) {
      return [];
    }

    if (persona === "employee" && currentMember) {
      return members.filter((m) => m.id === currentMember.employee_id);
    }
    if (persona === "team_leader" && currentMember) {
      return members.filter((m) => m.team === currentMember.team);
    }
    return members;
  }, [members, persona, currentMember]);

  const [memberId, setMemberId] = useState(currentMember?.employee_id ?? visible[0]?.id ?? "");
  useEffect(() => {
    const preferred = currentMember && visible.find((m) => m.id === currentMember.employee_id) ? currentMember.employee_id : visible[0]?.id ?? "";
    setMemberId(preferred);
  }, [visible, currentMember]);

  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    if (loadingMembers || !memberId) return;
    const params = new URLSearchParams({
      id: memberId,
      persona,
      actor_id: currentMember?.employee_id ?? "",
    });
    const data = await fetch(`/api/member-profile?${params.toString()}`).then((r) => r.json());
    setD(data);
  }, [currentMember?.employee_id, loadingMembers, memberId, persona]);
  useEffect(() => {
    load();
  }, [load]);

  const avg = d?.profile.length ? Math.round((d.profile.reduce((s, r) => s + r.current_level, 0) / d.profile.length) * 100) / 100 : 0;
  const met = d?.gaps.filter((g) => g.gap <= 0.049).length ?? 0;
  const gapN = d?.gaps.filter((g) => g.gap > 0.049).length ?? 0;

  return (
    <div className="max-w-6xl">
      <PageHeader title={title} desc={desc} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-text-muted">구성원</label>
          {persona === "employee" ? (
            <span className="text-sm font-semibold">{visible[0]?.label ?? "-"}</span>
          ) : (
            <select
              className="border border-border-soft bg-white px-3 py-1.5 text-sm"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              disabled={loadingMembers || visible.length === 0}
            >
              {visible.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
          {d?.member && <span className="text-xs text-text-muted">{d.member.division} · {d.member.team} · {d.member.role_level}</span>}
          {loadingMembers && <span className="text-xs text-text-muted">권한 매핑 인원을 불러오는 중입니다.</span>}
        </div>
      </Card>

      {!d ? (
        <div className="text-sm text-text-muted">{loadingMembers ? "권한 범위를 불러오는 중입니다." : "불러오는 중입니다."}</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-4 gap-4">
            <Stat label="보유 Skill" value={`${d.profile.length}개`} accent />
            <Stat label="평균 Level" value={avg.toFixed(1).replace(".0", "")} />
            <Stat label="요구 달성" value={`${met}개`} />
            <Stat label="Gap" value={`${gapN}개`} />
          </div>

          <div className="mb-4">
            <Card title={`역량 요약 · 요구 Skill Gap (${d.gaps.length})`}>
              <div className="grid grid-cols-[420px_1fr] gap-6">
                <div className="border-r border-border-soft pr-6">
                  <Radar data={d.subAvg} />
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {d.subAvg.map((item) => (
                      <div key={item.sub_family_name} className="border border-border-soft bg-bg-main/40 px-3 py-2 text-sm">
                        <div className="truncate font-semibold text-text-main">{item.sub_family_name}</div>
                        <div className="mt-1 font-bold text-sk-red">{formatLevel(item.avg_lv)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  {d.gaps.length === 0 ? (
                    <div className="text-xs text-text-muted">매핑된 요구 Skill이 없습니다.</div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b-2 border-border-soft text-left text-text-muted">
                            <th className="py-2 pr-2">Skill</th>
                            <th className="w-16 py-2 pr-2">요구</th>
                            <th className="w-16 py-2 pr-2">현재</th>
                            <th className="w-20 py-2">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.gaps.map((g) => (
                            <tr key={g.skill_id} className="border-b border-border-soft">
                              <td className="py-2 pr-2 text-[13px]">{g.is_core ? <span className="mr-1 font-bold text-sk-red">C</span> : null}{g.skill_name}</td>
                              <td className="py-2 pr-2 text-[13px]">{formatLevel(g.target_level)}</td>
                              <td className="py-2 pr-2 text-[13px]">{formatLevel(g.current_level)}</td>
                              <td className="py-2">{g.gap <= 0.049 ? <Badge tone="success" label="달성" /> : <Badge tone="warning" label={formatGap(g.gap)} />}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <Card title="평가 진행 현황 (스킬별 단계)" className="mb-4">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-border-soft text-left text-text-muted">
                    <th className="py-1.5 pr-2">Skill</th>
                    <th className="w-12 py-1.5 pr-2">현재</th>
                    <th className="w-14 py-1.5 text-center">자가</th>
                    <th className="w-14 py-1.5 text-center">리더</th>
                    <th className="w-16 py-1.5 text-center">Calib</th>
                    <th className="w-20 py-1.5 text-center">Committee</th>
                  </tr>
                </thead>
                <tbody>
                  {d.progress.map((p) => (
                    <tr key={p.skill_id} className="border-b border-border-soft">
                      <td className="py-1 pr-2">{p.skill_name.slice(0, 24)}</td>
                      <td className="py-1 pr-2 font-bold">{formatLevel(p.current_level)}</td>
                      {[p.done_self, p.done_leader, p.done_calib, p.done_comm].map((done, i) => (
                        <td key={i} className="py-1 text-center">
                          {done ? <span className="font-bold text-success">완료</span> : <span className="text-border-soft">-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="평가 이력">
            {d.history.length === 0 ? (
              <div className="text-xs text-text-muted">평가 이력이 없습니다.</div>
            ) : (
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {d.history.map((h, i) => {
                  const lv = h.confirmed_level ?? h.proposed_level;
                  return (
                    <div key={i} className="border-l-[3px] border-[#0A2147] py-0.5 pl-2.5">
                      <div className="text-[11px] text-text-muted">
                        {h.assessed_date} · <span className="bg-[#0A2147] px-1.5 py-0.5 text-[10px] text-white">{STAGE_LABEL[h.stage] ?? h.stage}</span>
                        {h.assessor_name ? ` · 평가자 ${h.assessor_name}` : ""}
                      </div>
                      <div className="text-[13px] text-text-main">
                        {h.skill_name.slice(0, 30)} · <b>{formatLevel(lv)}</b>
                        {h.rationale ? <span className="text-xs text-text-muted"> · {h.rationale.slice(0, 40)}</span> : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

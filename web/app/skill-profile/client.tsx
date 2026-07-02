"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Card, Badge, Stat } from "@/components/ui";
import { usePersona } from "@/components/PersonaContext";
import type { MemberOption } from "@/lib/member-options";

interface Prof { skill_id: number; current_level: number; target_level: number | null; last_assessed_date: string | null; skill_name: string; is_critical: number; sub_family_name: string; family_name: string }
interface Gap { skill_id: number; skill_name: string; target_level: number; is_core: number; current_level: number; gap: number }
interface Hist { stage: string; proposed_level: number | null; confirmed_level: number | null; assessed_date: string; status: string; rationale: string | null; skill_name: string; assessor_name: string | null }
interface Prog { skill_id: number; skill_name: string; current_level: number; done_self: number; done_leader: number; done_calib: number; done_comm: number }
interface Data {
  member: { name: string; team: string; division: string; role_level: string } | null;
  profile: Prof[]; subAvg: { sub_family_name: string; avg_lv: number }[];
  gaps: Gap[]; history: Hist[]; progress: Prog[];
}

const STAGE_LABEL: Record<string, string> = { self: "자가", leader: "리더", calibration: "Calib", committee: "Committee", narrative: "Narrative" };

function Radar({ data }: { data: { sub_family_name: string; avg_lv: number }[] }) {
  if (data.length < 3) return <div className="text-xs text-text-muted">레이더 표시(3개 이상 Sub-family 필요)</div>;
  const size = 260, cx = size / 2, cy = size / 2, R = 100, max = 4;
  const n = data.length;
  const pt = (i: number, r: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  };
  const poly = data.map((d, i) => pt(i, (d.avg_lv / max) * R).join(",")).join(" ");
  return (
    <svg width={size} height={size} className="mx-auto">
      {[1, 2, 3, 4].map((lv) => (
        <polygon key={lv} points={data.map((_, i) => pt(i, (lv / max) * R).join(",")).join(" ")}
          fill="none" stroke="#E1E7EF" />
      ))}
      {data.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E1E7EF" />; })}
      <polygon points={poly} fill="rgba(234,0,44,0.15)" stroke="#EA002C" strokeWidth={2} />
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 16);
        return <text key={i} x={x} y={y} fontSize={9} fill="#5F6B7A" textAnchor="middle" dominantBaseline="middle">{d.sub_family_name}</text>;
      })}
    </svg>
  );
}

// 원본 skill_profile.py 범위 규칙: employee→본인만, team_leader→본인 팀, 그 외(hr_admin 등)→전체 자유 선택.
export function SkillProfileClient({ members }: { members: MemberOption[] }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
  useEffect(() => { load(); }, [load]);

  const avg = d?.profile.length ? Math.round((d.profile.reduce((s, r) => s + r.current_level, 0) / d.profile.length) * 100) / 100 : 0;
  const met = d?.gaps.filter((g) => g.gap === 0).length ?? 0;
  const gapN = d?.gaps.filter((g) => g.gap > 0).length ?? 0;

  return (
    <div className="max-w-5xl">
      <PageHeader title="최종 결과 확인" desc="구성원별 확정 Skill 보유 현황 · Radar · Gap · 평가 이력" />

      <Card className="mb-4">
        <label className="text-sm text-text-muted mr-3">구성원</label>
        {persona === "employee" ? (
          <span className="text-sm font-semibold">{visible[0]?.label ?? "-"}</span>
        ) : (
          <select className="border border-border-soft bg-white px-3 py-1.5 text-sm" value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={loadingMembers || visible.length === 0}>
            {visible.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        )}
        {d?.member && <span className="ml-3 text-xs text-text-muted">{d.member.division} · {d.member.team} · {d.member.role_level}</span>}
        {loadingMembers && <span className="ml-3 text-xs text-text-muted">권한 매핑 인원을 불러오는 중입니다.</span>}
      </Card>

      {!d ? <div className="text-sm text-text-muted">{loadingMembers ? "권한 범위를 불러오는 중…" : "불러오는 중…"}</div> : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <Stat label="보유 Skill" value={`${d.profile.length}개`} accent />
            <Stat label="평균 Level" value={avg} />
            <Stat label="요구 달성" value={`${met}개`} />
            <Stat label="Gap" value={`${gapN}개`} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card title="Sub-family Radar"><Radar data={d.subAvg} /></Card>
            <Card title={`요구 Skill Gap (${d.gaps.length})`}>
              {d.gaps.length === 0 ? <div className="text-xs text-text-muted">매핑된 요구 Skill이 없습니다.</div> : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b-2 border-border-soft text-left text-text-muted">
                      <th className="py-1.5 pr-2">Skill</th><th className="py-1.5 pr-2 w-14">요구</th><th className="py-1.5 pr-2 w-14">현재</th><th className="py-1.5 w-16">상태</th></tr></thead>
                    <tbody>
                      {d.gaps.map((g) => (
                        <tr key={g.skill_id} className="border-b border-border-soft">
                          <td className="py-1 pr-2">{g.is_core ? <span className="text-sk-red font-bold mr-1">C</span> : null}{g.skill_name.slice(0, 20)}</td>
                          <td className="py-1 pr-2">L{g.target_level}</td>
                          <td className="py-1 pr-2">L{g.current_level}</td>
                          <td className="py-1">{g.gap === 0 ? <Badge tone="success" label="달성" /> : <Badge tone="warning" label={`-${g.gap}`} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <Card title="평가 진행 현황 (스킬별 단계)" className="mb-4">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b-2 border-border-soft text-left text-text-muted">
                  <th className="py-1.5 pr-2">Skill</th><th className="py-1.5 pr-2 w-12">현재</th>
                  <th className="py-1.5 text-center w-14">자가</th><th className="py-1.5 text-center w-14">리더</th><th className="py-1.5 text-center w-16">Calib</th><th className="py-1.5 text-center w-20">Committee</th></tr></thead>
                <tbody>
                  {d.progress.map((p) => (
                    <tr key={p.skill_id} className="border-b border-border-soft">
                      <td className="py-1 pr-2">{p.skill_name.slice(0, 24)}</td>
                      <td className="py-1 pr-2 font-bold">L{p.current_level}</td>
                      {[p.done_self, p.done_leader, p.done_calib, p.done_comm].map((done, i) => (
                        <td key={i} className="py-1 text-center">{done ? <span className="text-success font-bold">●</span> : <span className="text-border-soft">○</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="평가 이력">
            {d.history.length === 0 ? <div className="text-xs text-text-muted">평가 이력이 없습니다.</div> : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {d.history.map((h, i) => {
                  const lv = h.confirmed_level ?? h.proposed_level;
                  return (
                    <div key={i} className="border-l-[3px] border-[#0A2147] pl-2.5 py-0.5">
                      <div className="text-[11px] text-text-muted">{h.assessed_date} · <span className="bg-[#0A2147] text-white px-1.5 py-0.5 text-[10px]">{STAGE_LABEL[h.stage] ?? h.stage}</span>{h.assessor_name ? ` · 평가자 ${h.assessor_name}` : ""}</div>
                      <div className="text-[13px] text-text-main">{h.skill_name.slice(0, 30)} → <b>L{lv}</b>{h.rationale ? <span className="text-text-muted text-xs"> · {h.rationale.slice(0, 40)}</span> : ""}</div>
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { usePersona } from "@/components/PersonaContext";
import type { MemberOption } from "@/lib/member-options";

interface ProfileRow {
  skill_id: number;
  current_level: number;
  target_level: number | null;
  skill_name: string;
  is_critical: number;
  sub_family_name: string;
  family_name: string;
}

interface GapRow {
  skill_id: number;
  skill_name: string;
  family_name: string;
  sub_family_name: string;
  target_level: number;
  is_core: number;
  current_level: number;
  gap: number;
}

interface ReportData {
  member: { name: string; team: string; division: string; role_level: string } | null;
  profile: ProfileRow[];
  subAvg: { sub_family_name: string; avg_lv: number }[];
  gaps: GapRow[];
}

function toneByGap(gap: number) {
  if (gap <= 0) return "success";
  if (gap <= 0.5) return "warning";
  return "danger";
}

function Radar({ data }: { data: { sub_family_name: string; avg_lv: number }[] }) {
  if (data.length < 3) {
    return <div className="text-sm text-text-muted">Radar 표시에는 3개 이상의 Sub-family가 필요합니다.</div>;
  }

  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 138;
  const max = 4;
  const n = data.length;
  const point = (i: number, r: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };
  const polygon = data.map((row, i) => point(i, (row.avg_lv / max) * radius).join(",")).join(" ");

  return (
    <div className="overflow-visible">
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-[420px] w-full max-w-[520px] overflow-visible">
        {[1, 2, 3, 4].map((level) => (
          <polygon
            key={level}
            points={data.map((_, i) => point(i, (level / max) * radius).join(",")).join(" ")}
            fill="none"
            stroke="#D8E0EA"
          />
        ))}
        {data.map((_, i) => {
          const [x, y] = point(i, radius);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#D8E0EA" />;
        })}
        <polygon points={polygon} fill="rgba(234,0,44,0.16)" stroke="#EA002C" strokeWidth={3} />
        {data.map((row, i) => {
          const [x, y] = point(i, radius + 46);
          return (
            <g key={row.sub_family_name}>
              <text x={x} y={y - 8} fontSize={13} fontWeight={800} fill="#111827" textAnchor="middle">
                {row.sub_family_name}
              </text>
              <text x={x} y={y + 12} fontSize={13} fontWeight={800} fill="#EA002C" textAnchor="middle">
                L{row.avg_lv.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function PersonalReportClient({ members }: { members: MemberOption[] }) {
  const { persona, currentMember, loadingMembers } = usePersona();
  const visible = useMemo(() => {
    if ((persona === "employee" || persona === "team_leader") && !currentMember) return [];
    if (persona === "employee" && currentMember) return members.filter((m) => m.id === currentMember.employee_id);
    if (persona === "team_leader" && currentMember) return members.filter((m) => m.team === currentMember.team);
    return members;
  }, [currentMember, members, persona]);

  const [memberId, setMemberId] = useState(currentMember?.employee_id ?? visible[0]?.id ?? "");
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    const next = currentMember && visible.find((m) => m.id === currentMember.employee_id)
      ? currentMember.employee_id
      : visible[0]?.id ?? "";
    setMemberId(next);
  }, [currentMember, visible]);

  const load = useCallback(async () => {
    if (loadingMembers || !memberId) return;
    const params = new URLSearchParams({
      id: memberId,
      persona,
      actor_id: currentMember?.employee_id ?? "",
    });
    const next = await fetch(`/api/member-profile?${params.toString()}`).then((res) => res.json());
    setData(next);
  }, [currentMember?.employee_id, loadingMembers, memberId, persona]);

  useEffect(() => {
    void load();
  }, [load]);

  const requiredSkills = useMemo(
    () => [...(data?.gaps ?? [])].sort((a, b) => b.current_level - a.current_level || b.is_core - a.is_core),
    [data?.gaps]
  );
  const avgLevel = requiredSkills.length
    ? requiredSkills.reduce((sum, row) => sum + row.current_level, 0) / requiredSkills.length
    : 0;
  const radarData = useMemo(() => {
    const grouped = new Map<string, { sum: number; count: number }>();
    for (const skill of requiredSkills) {
      const key = skill.sub_family_name || "기타";
      const prev = grouped.get(key) ?? { sum: 0, count: 0 };
      grouped.set(key, { sum: prev.sum + skill.current_level, count: prev.count + 1 });
    }
    return Array.from(grouped, ([sub_family_name, value]) => ({
      sub_family_name,
      avg_lv: Math.round((value.sum / value.count) * 10) / 10,
    }));
  }, [requiredSkills]);
  const sortedGaps = [...(data?.gaps ?? [])].sort((a, b) => b.is_core - a.is_core || b.gap - a.gap);
  const gapCount = sortedGaps.filter((row) => row.gap > 0).length;

  return (
    <div>
      <PageHeader
        title="인별 리포트"
        desc="개인별 Sub-family Radar, 주요 보유 Skill Level, 요구 Skill Gap을 확인합니다."
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-text-muted">구성원</label>
          {persona === "employee" ? (
            <span className="text-sm font-bold text-text-main">{visible[0]?.label ?? "-"}</span>
          ) : (
            <select
              className="min-w-72 border border-border-soft bg-white px-3 py-2 text-sm outline-none focus:border-sk-red"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              disabled={loadingMembers || visible.length === 0}
            >
              {visible.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          )}
          {data?.member && (
            <span className="text-sm text-text-muted">
              {data.member.division} · {data.member.team} · {data.member.role_level}
            </span>
          )}
        </div>
      </Card>

      {!data ? (
        <div className="text-sm text-text-muted">리포트 데이터를 불러오는 중입니다...</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="요구 기준 보유 Skill" value={`${requiredSkills.filter((row) => row.current_level > 0).length}개`} accent />
            <Stat label="평균 Skill Level" value={`L${avgLevel.toFixed(1)}`} />
            <Stat label="요구 Skill" value={`${data.gaps.length}개`} />
            <Stat label="보완 필요 Gap" value={`${gapCount}개`} />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.95fr]">
            <Card title="Sub-skill Family Radar">
              <Radar data={radarData} />
            </Card>

            <Card title={`보유 Skill Level (요구 Skill 기준 · DB 전체 ${data.profile.length}개 별도 보관)`}>
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {requiredSkills.map((skill) => (
                  <div key={skill.skill_id} className="border border-border-soft bg-bg-main/40 p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-text-main">{skill.skill_name}</div>
                        <div className="text-xs text-text-muted">
                          {skill.family_name} · {skill.sub_family_name} · 요구 L{skill.target_level.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-xl font-extrabold text-sk-red">L{skill.current_level.toFixed(1)}</div>
                    </div>
                    <div className="h-2 bg-white">
                      <div className="h-2 bg-sk-red" style={{ width: `${Math.min(100, (skill.current_level / 4) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title="요구 Skill Gap" className="mt-4">
            <div className="grid gap-3 lg:grid-cols-2">
              {sortedGaps.map((gap) => {
                const currentPct = Math.min(100, (gap.current_level / Math.max(gap.target_level, 1)) * 100);
                const gapPct = Math.min(100, (gap.gap / Math.max(gap.target_level, 1)) * 100);
                return (
                  <div key={gap.skill_id} className="border border-border-soft bg-white p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {gap.is_core ? <Badge tone="danger" label="Core" /> : <Badge tone="neutral" label="Required" />}
                          <span className="font-extrabold text-text-main">{gap.skill_name}</span>
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          현재 L{gap.current_level.toFixed(1)} / 요구 L{gap.target_level.toFixed(1)}
                        </div>
                      </div>
                      <Badge tone={toneByGap(gap.gap)} label={gap.gap <= 0 ? "충족" : `Gap ${gap.gap.toFixed(1)}`} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[12px] font-semibold text-text-muted">
                        <span>현재 보유</span>
                        <span>L{gap.current_level.toFixed(1)}</span>
                      </div>
                      <div className="relative h-3 bg-bg-main">
                        <div className="h-3 bg-sk-red" style={{ width: `${currentPct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[12px] font-semibold text-text-muted">
                        <span>부족 Gap</span>
                        <span>{gap.gap <= 0 ? "충족" : `-${gap.gap.toFixed(1)}`}</span>
                      </div>
                      <div className="relative h-3 bg-bg-main">
                        <div
                          className={`h-3 ${gap.gap <= 0 ? "bg-success" : "bg-warning"}`}
                          style={{ width: `${gap.gap <= 0 ? 100 : gapPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

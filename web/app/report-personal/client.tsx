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
  has_individual?: number;
  current_level: number;
  gap: number;
}

interface ReportData {
  member: { name: string; team: string; division: string; role_level: string } | null;
  profile: ProfileRow[];
  subAvg: { sub_family_name: string; avg_lv: number }[];
  gaps: GapRow[];
}

type DisplaySkillRow = {
  skill_id: number;
  skill_name: string;
  family_name: string;
  sub_family_name: string;
  current_level: number;
  target_level: number | null;
  is_core: number;
  has_individual: number;
  gap: number | null;
  source: "core" | "individual" | "required";
};

function toneByGap(gap: number) {
  if (gap <= 0) return "success";
  if (gap <= 0.5) return "warning";
  return "danger";
}

function LevelScaleBar({ current, target }: { current: number; target: number | null }) {
  const currentPct = Math.min(100, Math.max(0, (current / 4) * 100));
  const targetPct = target == null ? currentPct : Math.min(100, Math.max(0, (target / 4) * 100));
  const gapLeft = Math.min(currentPct, targetPct);
  const gapWidth = Math.max(0, targetPct - currentPct);

  return (
    <div className="pt-4">
      <div className="relative mb-1.5 h-4">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="absolute top-0 -translate-x-1/2 text-[11px] font-extrabold text-text-muted"
            style={{ left: `${(level / 4) * 100}%` }}
          >
            {level}
          </div>
        ))}
      </div>
      <div className="relative h-6 bg-bg-main">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="absolute top-[-6px] h-8 w-px bg-border-soft"
            style={{ left: `${(level / 4) * 100}%` }}
          />
        ))}
        <div className="absolute left-0 top-0 h-4.5 bg-sk-orange" style={{ width: `${currentPct}%`, height: 18 }} />
        {gapWidth > 0 && (
          <div className="absolute top-[18px] h-1.5 bg-[#FFD1A3]" style={{ left: `${gapLeft}%`, width: `${gapWidth}%` }} />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-text-muted">
        <span>현재 L{current.toFixed(1)}</span>
        {target == null ? (
          <span className="text-[#C45E00]">개인 보유 Skill</span>
        ) : (
          <span className="text-[#C45E00]">보완 필요 L{Math.max(target - current, 0).toFixed(1)} · 요구 L{target.toFixed(1)}</span>
        )}
      </div>
    </div>
  );
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

  const displaySkills = useMemo<DisplaySkillRow[]>(() => {
    const requiredRows: DisplaySkillRow[] = (data?.gaps ?? []).map((row) => ({
      ...row,
      target_level: row.target_level,
      gap: row.gap,
      has_individual: row.has_individual ?? 0,
      source: row.is_core ? "core" : row.has_individual ? "individual" : "required",
    }));
    const requiredIds = new Set(requiredRows.map((row) => row.skill_id));
    const profileRows: DisplaySkillRow[] = (data?.profile ?? [])
      .filter((row) => !requiredIds.has(row.skill_id))
      .map((row) => ({
        skill_id: row.skill_id,
        skill_name: row.skill_name,
        family_name: row.family_name,
        sub_family_name: row.sub_family_name,
        current_level: row.current_level,
        target_level: null,
        is_core: 0,
        has_individual: 1,
        gap: null,
        source: "individual",
      }));
    return [...requiredRows, ...profileRows].sort((a, b) => {
      const sourceOrder = { core: 0, individual: 1, required: 2 };
      return sourceOrder[a.source] - sourceOrder[b.source] || (b.gap ?? -1) - (a.gap ?? -1) || b.current_level - a.current_level;
    });
  }, [data?.gaps, data?.profile]);
  const requiredSkills = displaySkills.filter((row) => row.source !== "individual" || row.target_level !== null);
  const avgLevel = displaySkills.length
    ? displaySkills.reduce((sum, row) => sum + row.current_level, 0) / displaySkills.length
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
  const gapCount = requiredSkills.filter((row) => (row.gap ?? 0) > 0).length;

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
            <Stat label="전체 보유 Skill" value={`${displaySkills.filter((row) => row.current_level > 0).length}개`} accent />
            <Stat label="평균 Skill Level" value={`L${avgLevel.toFixed(1)}`} />
            <Stat label="요구 Skill" value={`${data.gaps.length}개`} />
            <Stat label="보완 필요 Gap" value={`${gapCount}개`} />
          </div>

          <div className="mt-5">
            <Card title="Sub-skill Family Radar">
              <Radar data={radarData} />
            </Card>
          </div>

          <Card title="개인 Skill / Required Gap" className="mt-4">
            <div className="mb-3 grid grid-cols-[260px_1fr_150px] gap-3 border-b border-border-soft pb-2 text-xs font-extrabold text-text-muted">
              <div>Skill</div>
              <div>현재 Level / 요구 Level</div>
              <div className="text-right">Gap / 충족여부</div>
            </div>
            <div className="space-y-2">
              {displaySkills.map((gap) => {
                return (
                  <div key={gap.skill_id} className="grid grid-cols-[260px_1fr_150px] items-center gap-3 border border-border-soft bg-white px-3 py-2">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        {gap.source === "core" ? (
                          <Badge tone="danger" label="Core" />
                        ) : gap.source === "individual" ? (
                          <Badge tone="orange" label="Individual" />
                        ) : gap.source === "required" ? (
                          <Badge tone="neutral" label="Required" />
                        ) : null}
                        <span className="truncate font-extrabold text-text-main">{gap.skill_name}</span>
                      </div>
                      <div className="text-xs leading-relaxed text-text-muted">
                        {gap.family_name} · {gap.sub_family_name}
                      </div>
                    </div>

                    <LevelScaleBar current={gap.current_level} target={gap.target_level} />

                    <div className="text-right">
                      <div className="text-lg font-extrabold text-text-main">
                        L{gap.current_level.toFixed(1)}
                      </div>
                      <div className="mt-1">
                        {gap.gap == null ? (
                          <Badge tone="orange" label="Individual" />
                        ) : (
                          <Badge tone={toneByGap(gap.gap)} label={gap.gap <= 0 ? "충족" : `Gap ${gap.gap.toFixed(1)}`} />
                        )}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {gap.target_level == null ? "요구 Level 없음" : `요구 L${gap.target_level.toFixed(1)}`}
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

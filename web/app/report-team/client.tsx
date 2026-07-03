"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";

interface TeamSkill {
  skill_id: number;
  skill_name: string;
  is_core?: boolean;
  target_level: number;
  avg_lv: number;
  holders: number;
  metPct?: number;
}

interface DashboardData {
  teamStatus: { team: string; nTeam: number; overall: number; skills: TeamSkill[] }[];
  teamCoreStatus: { team: string; nTeam: number; skills: TeamSkill[] }[];
}

function pctTone(value: number) {
  if (value >= 90) return "success";
  if (value >= 75) return "warning";
  return "danger";
}

function LevelScaleBar({ current, target, pct }: { current: number; target: number; pct?: number }) {
  const currentPct = Math.min(100, Math.max(0, (current / 4) * 100));
  const targetPct = Math.min(100, Math.max(0, (target / 4) * 100));
  const gapWidth = Math.max(0, targetPct - currentPct);

  return (
    <div className="pt-4">
      <div className="relative mb-1.5 h-4">
        {[1, 2, 3, 4].map((mark) => (
          <div
            key={mark}
            className="absolute top-0 -translate-x-1/2 text-[11px] font-extrabold text-text-muted"
            style={{ left: `${(mark / 4) * 100}%` }}
          >
            {mark}
          </div>
        ))}
      </div>
      <div className="relative h-6 bg-bg-main">
        {[1, 2, 3, 4].map((mark) => (
          <div
            key={mark}
            className="absolute top-[-6px] h-8 w-px bg-border-soft"
            style={{ left: `${(mark / 4) * 100}%` }}
          />
        ))}
        <div className="absolute left-0 top-0 bg-sk-orange" style={{ width: `${currentPct}%`, height: 18 }} />
        {gapWidth > 0 && (
          <div
            className="absolute top-[18px] bg-[#FFB86B]"
            style={{ left: `${currentPct}%`, width: `${gapWidth}%`, height: 6 }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-text-muted">
        <span>현재 L{current.toFixed(1)}</span>
        <span className="text-[#C45E00]">
          Gap +{Math.max(target - current, 0).toFixed(1)} · 요구 L{target.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

export function TeamReportClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [team, setTeam] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((next: DashboardData) => {
        setData(next);
        setTeam(next.teamStatus[0]?.team ?? "");
      });
  }, []);

  const report = useMemo(() => {
    if (!data) return null;
    const required = data.teamStatus.find((row) => row.team === team) ?? data.teamStatus[0];
    const core = data.teamCoreStatus.find((row) => row.team === required?.team);
    return { required, core };
  }, [data, team]);

  if (!data || !report?.required) {
    return <div className="text-sm text-text-muted">리포트 데이터를 불러오는 중입니다...</div>;
  }

  const gapCount = report.required.skills.filter((skill) => (skill.metPct ?? 0) < 90).length;
  const coreSkills = report.required.skills.filter((skill) => skill.is_core);
  const avgCore =
    coreSkills.length === 0
      ? 0
      : coreSkills.reduce((sum, skill) => sum + skill.avg_lv, 0) / coreSkills.length;
  const prioritySkills = [...report.required.skills]
    .map((skill) => ({ ...skill, gap: Math.max(skill.target_level - skill.avg_lv, 0) }))
    .filter((skill) => skill.gap > 0)
    .sort((a, b) => Number(b.is_core) - Number(a.is_core) || b.gap - a.gap || (a.metPct ?? 0) - (b.metPct ?? 0))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="조직별 리포트"
        desc="조직 단위 Required Skill 충족률, Core Skill 평균 Level, 우선 보완 Skill을 확인합니다."
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-text-muted">팀 선택</span>
          <select
            value={team}
            onChange={(event) => setTeam(event.target.value)}
            className="min-w-56 border border-border-soft bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-sk-red"
          >
            {data.teamStatus.map((row) => (
              <option key={row.team} value={row.team}>
                {row.team}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="팀 인원" value={`${report.required.nTeam}명`} accent />
        <Stat label="요구 Skill 충족률" value={`${Math.round(report.required.overall)}%`} />
        <Stat label="Core Skill 평균" value={`L${avgCore.toFixed(1)}`} />
        <Stat label="우선 보완 Skill" value={`${gapCount}개`} />
      </div>

      <Card title="조직별 육성 우선순위 Skill" className="mt-5">
        <div className="mb-3 text-xs leading-relaxed text-text-muted">
          선택 조직의 Required/Core Skill 중 요구 Level 대비 현재 평균 Level이 낮은 항목입니다. Core Skill을 우선 표시하고, Gap이 큰 순서로 정렬합니다.
        </div>
        {prioritySkills.length === 0 ? (
          <div className="text-sm text-text-muted">현재 선택 조직의 보완 필요 Skill이 없습니다.</div>
        ) : (
          <div className="grid gap-2 lg:grid-cols-5">
            {prioritySkills.map((skill, index) => (
              <div key={skill.skill_id} className="border border-border-soft border-t-[3px] bg-white p-3" style={{ borderTopColor: skill.is_core ? "#EA002C" : "#FF7A00" }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-sk-red">#{index + 1}</span>
                  {skill.is_core ? <Badge tone="danger" label="Core" /> : <Badge tone="neutral" label="Required" />}
                </div>
                <div className="min-h-[34px] text-sm font-bold leading-tight text-text-main">{skill.skill_name}</div>
                <div className="mt-2 text-xs text-text-muted">
                  현재 L{skill.avg_lv.toFixed(1)} / 요구 L{skill.target_level.toFixed(1)}
                </div>
                <div className="mt-1 text-xs font-bold text-[#C45E00]">Gap {skill.gap.toFixed(1)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-5">
        <Card title="Required Skill 현황 / Core Skill 구분">
          <div className="mb-3 grid grid-cols-[260px_1fr_150px] gap-3 border-b border-border-soft pb-2 text-xs font-extrabold text-text-muted">
            <div>Skill</div>
            <div>현재 평균 Level / 요구 Level</div>
            <div className="text-right">충족률</div>
          </div>
          <div className="space-y-3">
            {report.required.skills.map((skill) => {
              const pct = Math.round(skill.metPct ?? 0);
              return (
                <div key={skill.skill_id} className="grid grid-cols-[260px_1fr_150px] items-center gap-3 border border-border-soft bg-white px-3 py-2">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      {skill.is_core ? <Badge tone="danger" label="Core" /> : <Badge tone="neutral" label="Required" />}
                      <span className="truncate font-bold text-text-main">{skill.skill_name}</span>
                    </div>
                    <div className="text-xs text-text-muted">
                      보유 {skill.holders}명 · 요구 L{skill.target_level.toFixed(1)}
                    </div>
                  </div>
                  <LevelScaleBar current={skill.avg_lv} target={skill.target_level} pct={pct} />
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-text-main">L{skill.avg_lv.toFixed(1)}</div>
                    <div className="mt-1">
                      <Badge tone={pctTone(pct)} label={`${pct}%`} />
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      {skill.avg_lv >= skill.target_level ? "충족" : `Gap ${(skill.target_level - skill.avg_lv).toFixed(1)}`}
                    </div>
                  </div>
                </div>
                );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

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

  const coreSkills = report.core?.skills ?? [];
  const gapCount = report.required.skills.filter((skill) => (skill.metPct ?? 0) < 90).length;
  const avgCore =
    coreSkills.length === 0
      ? 0
      : coreSkills.reduce((sum, skill) => sum + skill.avg_lv, 0) / coreSkills.length;

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

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="Required Skill 현황">
          <div className="space-y-3">
            {report.required.skills.map((skill) => {
              const pct = Math.round(skill.metPct ?? 0);
              return (
                <div key={skill.skill_id} className="border border-border-soft bg-bg-main/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-text-main">{skill.skill_name}</div>
                      <div className="text-xs text-text-muted">
                        평균 L{skill.avg_lv.toFixed(1)} / 요구 L{skill.target_level.toFixed(1)}
                      </div>
                    </div>
                    <Badge tone={pctTone(pct)} label={`${pct}%`} />
                  </div>
                  <div className="h-2 bg-white">
                    <div className="h-2 bg-sk-red" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Core Skill 평균 Level">
          <div className="space-y-3">
            {coreSkills.map((skill) => (
              <div key={skill.skill_id} className="flex items-center justify-between border-b border-border-soft pb-2">
                <div>
                  <div className="text-sm font-bold text-text-main">{skill.skill_name}</div>
                  <div className="text-xs text-text-muted">요구 L{skill.target_level.toFixed(1)}</div>
                </div>
                <div className="text-lg font-extrabold text-sk-red">L{skill.avg_lv.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

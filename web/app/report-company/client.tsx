"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, PageHeader, Stat } from "@/components/ui";

interface CompanySkillTeam {
  skill_id: number;
  skill_name: string;
  target_level: number;
  teams: { team: string; nTeam: number; avg_lv: number; holders: number }[];
}

interface DashboardData {
  kpi: { members: number; skills: number; assessRate: number; criticalRate: number };
  companySkillTeams: CompanySkillTeam[];
  topHolders: {
    name: string;
    division: string;
    team: string;
    role_level: string;
    position: string;
    avg_lv: number;
    n_skills: number;
  }[];
  gaps: { skill_id: number; skill_name: string; target_level: number; avg_cur: number; gap: number; is_core: boolean }[];
}

export function CompanyReportClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [skillId, setSkillId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((next: DashboardData) => {
        setData(next);
        setSkillId(next.companySkillTeams[0]?.skill_id ?? null);
      });
  }, []);

  const selectedSkill = useMemo(() => {
    if (!data) return null;
    return data.companySkillTeams.find((skill) => skill.skill_id === skillId) ?? data.companySkillTeams[0] ?? null;
  }, [data, skillId]);

  if (!data) {
    return <div className="text-sm text-text-muted">리포트 데이터를 불러오는 중입니다...</div>;
  }

  const priorityGaps = data.gaps
    .filter((gap) => gap.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        title="전사 분석 리포트"
        desc="전사 Skill 진단 결과를 기준으로 조직별 평균 Level, 상위 인재, 우선 보완 Skill을 확인합니다."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="평가 대상" value={`${data.kpi.members}명`} accent />
        <Stat label="평가 진행률" value={`${Math.round(data.kpi.assessRate)}%`} />
        <Stat label="등록 Skill" value={`${data.kpi.skills}개`} />
        <Stat label="핵심 Skill 관리율" value={`${Math.round(data.kpi.criticalRate)}%`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card title="전사 필수 Skill - 팀별 평균 Level">
          <div className="mb-3">
            <select
              value={selectedSkill?.skill_id ?? ""}
              onChange={(event) => setSkillId(Number(event.target.value))}
              className="w-full border border-border-soft bg-white px-3 py-2 text-sm outline-none focus:border-sk-red"
            >
              {data.companySkillTeams.map((skill) => (
                <option key={skill.skill_id} value={skill.skill_id}>
                  {skill.skill_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {selectedSkill?.teams.map((team) => (
              <div key={team.team} className="grid grid-cols-[130px_1fr_70px] items-center gap-3">
                <div className="truncate text-sm font-semibold text-text-main">{team.team}</div>
                <div className="h-2 bg-bg-main">
                  <div
                    className="h-2 bg-sk-red"
                    style={{ width: `${Math.min(100, (team.avg_lv / Math.max(selectedSkill.target_level, 1)) * 100)}%` }}
                  />
                </div>
                <div className="text-right text-sm font-extrabold text-text-main">L{team.avg_lv.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="평균 Skill Level TOP 5">
          <div className="space-y-3">
            {data.topHolders.slice(0, 5).map((row) => (
              <div key={`${row.name}-${row.team}`} className="border-b border-border-soft pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-text-main">{row.name}</div>
                  <div className="text-lg font-extrabold text-sk-red">L{row.avg_lv.toFixed(1)}</div>
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {row.division} · {row.team} · {row.role_level} · {row.position || "구성원"} · 보유 Skill {row.n_skills}개
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="우선 보완 Skill" className="mt-4">
        <div className="grid gap-2 md:grid-cols-2">
          {priorityGaps.map((gap) => (
            <div key={gap.skill_id} className="border border-border-soft bg-bg-main/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-bold text-text-main">{gap.skill_name}</div>
                <div className="text-sm font-extrabold text-sk-red">Gap {gap.gap.toFixed(1)}</div>
              </div>
              <div className="mt-1 text-xs text-text-muted">
                평균 L{gap.avg_cur.toFixed(1)} / 요구 L{gap.target_level.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

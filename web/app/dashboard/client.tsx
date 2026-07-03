"use client";

import { useEffect, useState } from "react";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";

interface TeamSkill {
  skill_id: number;
  skill_name: string;
  is_core: boolean;
  target_level: number;
  avg_lv: number;
  holders: number;
  metPct: number;
}

interface Dash {
  kpi: { members: number; skills: number; assessRate: number; criticalRate: number };
  teamStatus: { team: string; nTeam: number; overall: number; skills: TeamSkill[] }[];
  companySkillTeams: {
    skill_id: number;
    skill_name: string;
    target_level: number;
    teams: { team: string; nTeam: number; avg_lv: number; holders: number }[];
  }[];
  teamCoreStatus: {
    team: string;
    nTeam: number;
    skills: { skill_id: number; skill_name: string; target_level: number; avg_lv: number; holders: number }[];
  }[];
  topHolders: {
    name: string;
    division: string;
    team: string;
    role_level: string;
    position: string;
    n_skills: number;
    avg_lv: number;
    critical_held: number;
  }[];
  critical: { skill_id: number; skill_name: string; sub_family_name: string; holders: number; avg_lv: number; coverage: number }[];
}

type DashboardTab = "overview" | "gap";

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 mt-7 border border-border-soft bg-white px-4 py-3 shadow-[0_1px_0_rgba(31,41,51,0.04)]">
      <h2 className="text-[15px] font-extrabold tracking-tight text-text-main">{title}</h2>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={`border px-4 py-2 text-sm font-semibold ${
        active
          ? "border-sk-red bg-sk-red/[0.06] text-sk-red"
          : "border-border-soft bg-white text-text-muted hover:text-text-main"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function pctColor(p: number) {
  if (p >= 90) return "text-success";
  if (p >= 75) return "text-[#9A6500]";
  return "text-sk-red";
}

function barColor(p: number) {
  if (p >= 90) return "#16A34A";
  if (p >= 75) return "#F59E0B";
  return "#EA002C";
}

function levelColor(level: number) {
  if (level >= 3) return "#16A34A";
  if (level >= 2) return "#F59E0B";
  return "#EA002C";
}

function levelToneLabel(level: number) {
  if (level >= 3) return "충족";
  if (level >= 2) return "보완";
  return "위험";
}

export function DashboardClient() {
  const [d, setD] = useState<Dash | null>(null);
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [selectedCompanySkillId, setSelectedCompanySkillId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedGapTeam, setSelectedGapTeam] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setD);
  }, []);

  if (!d) return <div className="text-sm text-text-muted">불러오는 중...</div>;

  const selectedCompanySkill =
    d.companySkillTeams.find((skill) => skill.skill_id === selectedCompanySkillId) ?? d.companySkillTeams[0];
  const selectedCoreTeam = d.teamCoreStatus.find((team) => team.team === selectedTeam) ?? d.teamCoreStatus[0];
  const selectedGapStatus = d.teamStatus.find((team) => team.team === selectedGapTeam) ?? d.teamStatus[0];
  const teamSkillGaps = [...(selectedGapStatus?.skills ?? [])]
    .map((skill) => ({
      ...skill,
      gap: Math.max(skill.target_level - skill.avg_lv, 0),
    }))
    .sort((a, b) => Number(b.is_core) - Number(a.is_core) || b.gap - a.gap || a.skill_id - b.skill_id)
    .slice(0, 5);
  const coreGapCount = (selectedGapStatus?.skills ?? []).filter(
    (skill) => skill.is_core && skill.target_level > skill.avg_lv
  ).length;
  const priorityGapCount = (selectedGapStatus?.skills ?? []).filter((skill) => skill.target_level - skill.avg_lv >= 0.5).length;

  return (
    <div>
      <PageHeader
        title="전사 Skill Dashboard"
        desc="평가 완료 기준의 Skill Level, 조직별 Core Skill 수준, 요구 Level 대비 Gap을 한눈에 확인합니다."
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={tab === "gap"} onClick={() => setTab("gap")}>
            Gap / Profile
          </TabButton>
        </div>
        <a
          href="/api/skill-profile/export"
          className="border border-sk-orange bg-white px-4 py-2 text-sm font-bold text-[#C45E00] hover:bg-sk-orange/[0.08]"
        >
          개인별 Skill Excel
        </a>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="평가 대상" value={`${d.kpi.members}명`} accent />
        <Stat label="평가 진행률" value={`${d.kpi.assessRate}%`} />
        <Stat label="선택 조직 Core Gap" value={`${coreGapCount}개`} />
        <Stat label="선택 조직 보완 Skill" value={`${priorityGapCount}개`} />
      </div>

      {tab === "overview" ? (
        <>
          <SectionHeader title="전사 필수 Skill 및 조직 Core Skill" />
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="border border-success bg-success/[0.06] px-2 py-1 font-semibold text-success">초록: L3.0 이상</span>
            <span className="border border-warning bg-warning/[0.08] px-2 py-1 font-semibold text-[#9A6500]">주황: L2.0~2.9</span>
            <span className="border border-sk-red bg-sk-red/[0.06] px-2 py-1 font-semibold text-sk-red">빨강: L2.0 미만</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <div className="mb-4 border-b border-border-soft pb-3">
                <div className="mb-2 text-sm font-extrabold text-text-main">전사 필수 Skill 팀별 평균 Level</div>
                <select
                  className="w-full border border-border-soft bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-sk-red"
                  value={selectedCompanySkill?.skill_id ?? ""}
                  onChange={(event) => setSelectedCompanySkillId(Number(event.target.value))}
                >
                  {d.companySkillTeams.map((skill) => (
                    <option key={skill.skill_id} value={skill.skill_id}>
                      #{String(skill.skill_id).padStart(3, "0")} {skill.skill_name} · 요구 L{skill.target_level}
                    </option>
                  ))}
                </select>
              </div>
              {!selectedCompanySkill ? (
                <div className="text-sm text-text-muted">전사 필수 Skill이 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {selectedCompanySkill.teams.map((team) => (
                    <div key={team.team} className="grid grid-cols-[130px_1fr_70px] items-center gap-3">
                      <div className="truncate text-xs font-semibold text-text-main">{team.team}</div>
                      <div className="h-3 bg-bg-main">
                        <div
                          className="h-3"
                          style={{ width: `${Math.max((team.avg_lv / 4) * 100, 2)}%`, background: levelColor(team.avg_lv) }}
                        />
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-bold text-text-main">L{team.avg_lv}</div>
                        <div className="text-text-muted">{team.holders}명</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-4 border-b border-border-soft pb-3">
                <div className="mb-2 text-sm font-extrabold text-text-main">조직별 Core Skill 평균 Level</div>
                <select
                  className="w-full border border-border-soft bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-sk-red"
                  value={selectedCoreTeam?.team ?? ""}
                  onChange={(event) => setSelectedTeam(event.target.value)}
                >
                  {d.teamCoreStatus.map((team) => (
                    <option key={team.team} value={team.team}>
                      {team.team} · {team.nTeam}명
                    </option>
                  ))}
                </select>
              </div>
              {!selectedCoreTeam || selectedCoreTeam.skills.length === 0 ? (
                <div className="text-sm text-text-muted">선택 조직의 Core Skill이 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {selectedCoreTeam.skills.map((skill) => (
                    <div key={skill.skill_id} className="border border-border-soft bg-white px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <div className="truncate text-xs font-semibold text-text-main">
                          #{String(skill.skill_id).padStart(3, "0")} {skill.skill_name}
                        </div>
                        <div className="shrink-0 text-xs text-text-muted">요구 L{skill.target_level}</div>
                      </div>
                      <div className="grid grid-cols-[1fr_76px] items-center gap-3">
                        <div className="h-3 bg-bg-main">
                          <div className="h-3" style={{ width: `${Math.max((skill.avg_lv / 4) * 100, 2)}%`, background: levelColor(skill.avg_lv) }} />
                        </div>
                        <div className="text-right text-xs">
                          <div className="font-bold text-text-main">L{skill.avg_lv}</div>
                          <div className="text-text-muted">{levelToneLabel(skill.avg_lv)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <SectionHeader title="평균 Skill Level 기준 Top 5" />
          <Card>
            <div className="mb-3 border-b border-border-soft pb-2 text-xs leading-relaxed text-text-muted">
              보유 Skill의 평균 Level이 높은 구성원입니다. 동률이면 전체 보유 Skill 수가 많은 순으로 표시합니다.
            </div>
            <div className="grid grid-cols-5 gap-3">
              {d.topHolders.map((holder, index) => (
                <div
                  key={`${holder.name}-${index}`}
                  className="border border-border-soft border-t-[3px] bg-white p-3"
                  style={{ borderTopColor: levelColor(holder.avg_lv) }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-sk-red">#{index + 1}</span>
                    <span className="border border-border-soft px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                      {holder.role_level ?? "-"}
                    </span>
                  </div>
                  <div className="truncate text-sm font-bold text-text-main">{holder.name}</div>
                  <div className="mt-1 space-y-0.5 text-xs text-text-muted">
                    <div className="truncate">
                      {holder.division ?? "-"} / {holder.team ?? "-"}
                    </div>
                    <div className="truncate">직책 {holder.position ?? "-"}</div>
                  </div>
                  <div className="mt-3 border-t border-border-soft pt-2 text-xs">
                    <div className="font-bold text-text-main">평균 Level {holder.avg_lv}</div>
                    <div className="text-text-muted">전체 보유 Skill {holder.n_skills}개</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <SectionHeader title="조직별 육성 우선 Skill Gap" />
          <Card className="mb-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-semibold text-text-muted">조직 선택</span>
              <select
                className="min-w-56 border border-border-soft bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-sk-red"
                value={selectedGapStatus?.team ?? ""}
                onChange={(event) => setSelectedGapTeam(event.target.value)}
              >
                {d.teamStatus.map((team) => (
                  <option key={team.team} value={team.team}>
                    {team.team} · {team.nTeam}명
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 border-t border-border-soft pt-3 text-xs leading-relaxed text-text-muted md:grid-cols-3">
              <div>
                <b className="text-text-main">요구 Level</b>
                <div>선택 조직에 적용되는 전사 필수 Skill + 해당 조직 Required/Core Skill의 목표 Level입니다.</div>
              </div>
              <div>
                <b className="text-text-main">현재 Level</b>
                <div>선택 조직 구성원이 보유한 해당 Skill의 현재 Level 평균입니다.</div>
              </div>
              <div>
                <b className="text-text-main">Gap / 우선순위</b>
                <div>요구 Level - 현재 평균 Level입니다. Core Skill을 먼저 보고, Gap이 큰 순서로 표시합니다.</div>
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-5 gap-3">
            {teamSkillGaps.map((gap) => (
              <div
                key={gap.skill_id}
                className="border border-border-soft border-t-[3px] bg-bg-surface p-3"
                style={{ borderTopColor: gap.is_core ? "#EA002C" : "#F59E0B" }}
              >
                <div className="text-[11px] text-text-muted">
                  {gap.is_core && <span className="mr-1 font-bold text-sk-red">CORE</span>}#{String(gap.skill_id).padStart(3, "0")}
                </div>
                <div className="my-1.5 min-h-[34px] text-[13px] font-semibold leading-tight text-text-main">
                  {gap.skill_name.slice(0, 30)}
                </div>
                <div className="text-xs text-text-main">
                  요구 <b>L{gap.target_level}</b> · 현재 <b>L{gap.avg_lv}</b>
                </div>
                <div className="mt-1 text-[11px] text-text-muted">
                  평균 Gap <b className="text-sk-red">+{Math.round(gap.gap * 10) / 10}</b> · 보유 {gap.holders}명
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <SectionHeader title="조직별 Required Skill 상세" />
          <div className="grid grid-cols-2 gap-4">
            {d.teamStatus.map((team) => (
              <Card key={team.team}>
                <div className="mb-3 flex items-center justify-between border-b border-border-soft pb-2">
                  <div className="font-bold text-text-main">
                    {team.team} <span className="text-xs font-normal text-text-muted">· {team.nTeam}명</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-extrabold ${pctColor(team.overall)}`}>{team.overall}%</span>
                    <span className="ml-1 text-[10px] text-text-muted">요구 Level 충족률</span>
                  </div>
                </div>
                <div>
                  {team.skills.map((skill) => {
                    const levelPct = skill.metPct;
                    const met = skill.avg_lv >= skill.target_level;
                    return (
                      <div key={skill.skill_id} className="border-b border-border-soft py-2 last:border-0">
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="truncate pr-2 text-text-main">
                            {skill.is_core ? (
                              <span className="mr-1.5 inline-block bg-sk-red px-1.5 py-0.5 align-middle text-[9px] font-bold text-white">
                                CORE
                              </span>
                            ) : (
                              <span className="mr-1.5 inline-block border border-border-soft px-1.5 py-0.5 align-middle text-[9px] text-text-muted">
                                일반
                              </span>
                            )}
                            #{String(skill.skill_id).padStart(3, "0")} {skill.skill_name.slice(0, 28)}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="text-text-muted">
                              평균 L{skill.avg_lv}/요구 L{skill.target_level}
                            </span>
                            {met ? <Badge tone="success" label="충족" /> : <Badge tone="warning" label="미달" />}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 bg-[#E1E7EF]">
                            <div
                              className="h-2.5"
                              style={{ width: `${Math.max(levelPct, 2)}%`, background: barColor(levelPct) }}
                            />
                          </div>
                          <span className="w-14 text-right text-[11px] font-semibold" style={{ color: barColor(levelPct) }}>
                            {levelPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          <SectionHeader title="전사 Critical Skill 현황" />
          {d.critical.length === 0 ? (
            <Card>
              <div className="text-sm text-text-muted">Critical Skill로 지정된 항목이 없습니다.</div>
            </Card>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {d.critical.map((critical) => (
                <div
                  key={critical.skill_id}
                  className="border border-border-soft border-t-[3px] bg-bg-surface p-3"
                  style={{ borderTopColor: levelColor(critical.avg_lv) }}
                >
                  <Badge tone="danger" label="CRITICAL" />
                  <div className="my-1.5 text-[13px] font-semibold text-text-main">
                    #{String(critical.skill_id).padStart(3, "0")} {critical.skill_name.slice(0, 24)}
                  </div>
                  <div className="text-xs text-text-main">
                    보유 {critical.holders}명 · 평균 L{critical.avg_lv}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

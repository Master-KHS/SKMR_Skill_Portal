"use client";
import { useEffect, useState } from "react";
import { PageHeader, Card, Badge } from "@/components/ui";

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
  topHolders: { name: string; team: string; role_level: string; n_skills: number; avg_lv: number; critical_held: number }[];
  funnel: { stage: string; cnt: number }[];
  subAvg: { sub_family_name: string; avg_lv: number; cnt: number }[];
  gaps: { skill_id: number; skill_name: string; target_level: number; avg_cur: number; gap: number; is_core: boolean; n_holders: number }[];
  critical: { skill_id: number; skill_name: string; sub_family_name: string; holders: number; avg_lv: number; coverage: number }[];
  recent: { assessed_date: string; stage: string; proposed_level: number | null; confirmed_level: number | null; name: string; skill_name: string }[];
}

const STAGE_LABEL: Record<string, string> = { self: "Self", leader: "Leader", calibration: "Calibration", committee: "Committee" };

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-3">
      <span className="h-4 w-1.5 bg-sk-red inline-block" />
      <h2 className="text-[15px] font-bold text-text-main">{title}</h2>
    </div>
  );
}

function pctColor(p: number) {
  if (p >= 80) return "text-success";
  if (p >= 60) return "text-[#9A6500]";
  return "text-sk-red";
}

export function DashboardClient() {
  const [d, setD] = useState<Dash | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setD);
  }, []);

  if (!d) return <div className="text-sm text-text-muted">불러오는 중…</div>;

  const funnelMax = Math.max(...d.funnel.map((f) => f.cnt), 1);
  const subMax = 4;

  return (
    <div>
      <PageHeader title="진단 결과 확인" desc="권한별 Skill 현황 통합 · 조회 범위: 전사" />

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "구성원", value: d.kpi.members, unit: "명", accent: true },
          { label: "등록 Skill", value: d.kpi.skills, unit: "개", accent: false },
          { label: "평가 진행률", value: d.kpi.assessRate, unit: "%", accent: false },
          { label: "Critical 보유율", value: d.kpi.criticalRate, unit: "%", accent: false },
        ].map((k) => (
          <div key={k.label} className={`bg-bg-surface border border-border-soft border-t-[3px] p-4 ${k.accent ? "border-t-sk-red" : "border-t-text-main/70"}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{k.label}</div>
            <div className="text-2xl font-extrabold text-text-main mt-1.5">
              {k.value}
              <span className="text-sm font-medium text-text-muted ml-0.5">{k.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 조직별 필수 스킬 현황 */}
      <SectionHeader title="조직별 필수 스킬 현황" />
      <div className="grid grid-cols-2 gap-4">
        {d.teamStatus.map((t) => (
          <Card key={t.team}>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-soft">
              <div className="font-bold text-text-main">
                {t.team} <span className="text-xs text-text-muted font-normal">· {t.nTeam}명</span>
              </div>
              <div className={`text-lg font-extrabold ${pctColor(t.overall)}`}>{t.overall}%</div>
            </div>
            {t.skills.length === 0 ? (
              <div className="text-xs text-text-muted">매핑된 필수 스킬이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {t.skills.map((s) => (
                  <div key={s.skill_id}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-text-main">
                        {s.is_core ? <span className="text-sk-red font-bold mr-1">[CORE]</span> : <span className="text-text-muted mr-1">[일반]</span>}
                        #{String(s.skill_id).padStart(3, "0")} {s.skill_name.slice(0, 22)}
                      </span>
                      <span className="text-text-muted">L{s.avg_lv}/L{s.target_level} · {s.holders}/{t.nTeam}명</span>
                    </div>
                    <div className="bg-bg-main h-1.5 overflow-hidden">
                      <div className="bg-sk-red h-1.5" style={{ width: `${Math.min(s.metPct, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Funnel + Top holders */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <SectionHeader title="평가 진행 Funnel" />
          <Card>
            <div className="space-y-2">
              {d.funnel.map((f) => (
                <div key={f.stage} className="flex items-center gap-2">
                  <span className="w-24 text-xs text-text-muted">{STAGE_LABEL[f.stage]}</span>
                  <div className="flex-1 bg-bg-main h-5">
                    <div className="bg-navy h-5 bg-[#0A2147] flex items-center justify-end pr-2" style={{ width: `${Math.max((f.cnt / funnelMax) * 100, 3)}%` }}>
                      <span className="text-white text-[10px] font-bold">{f.cnt}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div>
          <SectionHeader title="상위 보유자 Top 5" />
          <Card>
            {d.topHolders.length === 0 ? (
              <div className="text-xs text-text-muted">표시할 보유자가 없습니다.</div>
            ) : (
              <div className="space-y-1.5">
                {d.topHolders.map((h, i) => (
                  <div key={h.name} className="flex items-center border border-border-soft px-2.5 py-1.5">
                    <span className="w-5 text-text-muted font-semibold text-sm">{i + 1}</span>
                    <div className="flex-1">
                      <b className="text-text-main">{h.name}</b>
                      <span className="text-xs text-text-muted ml-1.5">{h.team} · {h.role_level}</span>
                    </div>
                    <div className="text-right text-xs">
                      <b className="text-text-main">L{h.avg_lv}</b>
                      <span className="text-text-muted"> · {h.n_skills}개</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Sub-family 평균 */}
      <SectionHeader title="Sub-family별 평균 Level" />
      <Card>
        <div className="space-y-1.5">
          {d.subAvg.map((s) => (
            <div key={s.sub_family_name} className="flex items-center gap-2">
              <span className="w-40 text-xs text-text-main text-right pr-2">{s.sub_family_name}</span>
              <div className="flex-1 bg-bg-main h-4">
                <div className="bg-[#0A2147] h-4" style={{ width: `${(s.avg_lv / subMax) * 100}%` }} />
              </div>
              <span className="w-14 text-xs text-text-muted">L{s.avg_lv}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 부족 Skill Top 5 */}
      <SectionHeader title="부족 Skill Top 5 — 우선 육성 대상" />
      <div className="grid grid-cols-5 gap-3">
        {d.gaps.map((g) => (
          <div key={g.skill_id} className="bg-bg-surface border border-border-soft p-3">
            <div className="text-[11px] text-text-muted">
              {g.is_core && <span className="text-sk-red font-bold mr-1">CORE</span>}#{String(g.skill_id).padStart(3, "0")}
            </div>
            <div className="text-[13px] font-semibold text-text-main my-1.5 leading-tight min-h-[34px]">{g.skill_name.slice(0, 28)}</div>
            <div className="text-xs text-text-main">요구 <b>L{g.target_level}</b> · 현재 <b>L{g.avg_cur}</b></div>
            <div className="text-[11px] text-text-muted mt-1">Gap <b className="text-sk-red">+{g.gap}</b> · 보유 {g.n_holders}명</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted mt-2">우선도 = Gap × (1 + Scarcity) × Core 가중치(1.5) 기준 정렬</p>

      {/* Critical 현황 */}
      <SectionHeader title="전사 Critical Skill 현황" />
      {d.critical.length === 0 ? (
        <Card><div className="text-sm text-text-muted">Critical Skill로 지정된 항목이 없습니다. (Skill Library에서 지정)</div></Card>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {d.critical.map((c) => (
            <div key={c.skill_id} className="bg-bg-surface border border-border-soft p-3">
              <Badge tone="danger" label="CRITICAL" />
              <div className="text-[13px] font-semibold text-text-main my-1.5">#{String(c.skill_id).padStart(3, "0")} {c.skill_name.slice(0, 22)}</div>
              <div className="text-xs text-text-main">보유 {c.holders}명 · 평균 L{c.avg_lv} · Coverage {c.coverage}%</div>
            </div>
          ))}
        </div>
      )}

      {/* 최근 평가 활동 */}
      <SectionHeader title="최근 평가 활동" />
      <Card>
        {d.recent.length === 0 ? (
          <div className="text-xs text-text-muted">평가 활동이 없습니다.</div>
        ) : (
          <div className="space-y-1.5">
            {d.recent.map((r, i) => {
              const lv = r.confirmed_level ?? r.proposed_level;
              return (
                <div key={i} className="border-l-[3px] border-[#0A2147] pl-2.5 py-0.5">
                  <div className="text-[11px] text-text-muted">
                    {r.assessed_date} · <span className="bg-[#0A2147] text-white px-1.5 py-0.5 text-[10px]">{STAGE_LABEL[r.stage] ?? r.stage}</span>
                  </div>
                  <div className="text-[13px] text-text-main">
                    <b>{r.name}</b> · {r.skill_name.slice(0, 30)} → <b>L{lv}</b>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

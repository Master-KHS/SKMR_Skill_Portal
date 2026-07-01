// 대시보드 집계 — 원본 Streamlit dashboard.py 위젯들을 이식 (전사 스코프).
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVAL = "('사무직','기술직','연구직')";

export async function GET() {
  // ---- KPI 요약 ----
  const nMembers = (query<{ c: number }>(`SELECT COUNT(*) c FROM member WHERE job_type IN ${EVAL}`)[0]?.c) ?? 0;
  const nSkills = (query<{ c: number }>(`SELECT COUNT(*) c FROM skill`)[0]?.c) ?? 0;
  const nProfile =
    (query<{ c: number }>(
      `SELECT COUNT(*) c FROM skill_profile sp JOIN member m ON sp.member_id=m.employee_id WHERE m.job_type IN ${EVAL}`
    )[0]?.c) ?? 0;
  const nAssessed =
    (query<{ c: number }>(
      `SELECT COUNT(DISTINCT a.member_id || '_' || a.skill_id) c
       FROM assessment a JOIN member m ON a.member_id=m.employee_id WHERE m.job_type IN ${EVAL}`
    )[0]?.c) ?? 0;
  const critHeld =
    (query<{ c: number }>(
      `SELECT COUNT(*) c FROM skill_profile sp
       JOIN skill s ON sp.skill_id=s.skill_id
       JOIN member m ON sp.member_id=m.employee_id
       WHERE s.is_critical=1 AND m.job_type IN ${EVAL}`
    )[0]?.c) ?? 0;

  const kpi = {
    members: nMembers,
    skills: nSkills,
    assessRate: nProfile ? Math.round((nAssessed / nProfile) * 100) : 0,
    criticalRate: nProfile ? Math.round((critHeld / nProfile) * 100) : 0,
  };

  // ---- 조직별 필수 스킬 현황 (팀별) ----
  const teams = query<{ team: string }>(
    `SELECT DISTINCT team FROM member WHERE job_type IN ${EVAL} AND team IS NOT NULL ORDER BY team`
  ).map((r) => r.team);

  const teamStatus = teams.map((team) => {
    const members = query<{ employee_id: string }>(
      `SELECT employee_id FROM member WHERE team=? AND job_type IN ${EVAL}`,
      [team]
    ).map((r) => r.employee_id);
    const nTeam = members.length;
    if (!nTeam) return { team, nTeam: 0, skills: [], overall: 0 };
    const ph = members.map(() => "?").join(",");
    const reqs = query<{ skill_id: number; target_level: number; is_core: number; skill_name: string }>(
      `SELECT r.skill_id, MAX(r.target_level) target_level, MAX(r.is_core) is_core, s.skill_name
       FROM required_skill r JOIN skill s ON r.skill_id=s.skill_id
       WHERE (r.org_or_individual='company' AND r.target_id='ALL')
          OR (r.org_or_individual='department' AND r.target_id=?)
          OR (r.org_or_individual='individual' AND r.target_id IN (${ph}) AND r.status='approved')
       GROUP BY r.skill_id`,
      [team, ...members]
    );
    const profs = query<{ skill_id: number; holders: number; avg_lv: number }>(
      `SELECT skill_id, COUNT(*) holders, AVG(current_level) avg_lv
       FROM skill_profile WHERE member_id IN (${ph}) GROUP BY skill_id`,
      members
    );
    const profMap = new Map(profs.map((p) => [p.skill_id, p]));
    const skills = reqs
      .map((r) => {
        const p = profMap.get(r.skill_id);
        const avg = p?.avg_lv ?? 0;
        const holders = p?.holders ?? 0;
        const metPct = avg >= r.target_level ? 100 : Math.round((avg / r.target_level) * 100);
        return {
          skill_id: r.skill_id,
          skill_name: r.skill_name,
          is_core: !!r.is_core,
          target_level: r.target_level,
          avg_lv: Math.round(avg * 10) / 10,
          holders,
          metPct,
        };
      })
      .sort((a, b) => Number(b.is_core) - Number(a.is_core) || a.skill_id - b.skill_id);
    const overall = skills.length ? Math.round(skills.reduce((s, x) => s + x.metPct, 0) / skills.length) : 0;
    return { team, nTeam, skills, overall };
  });

  // ---- 상위 보유자 Top 5 ----
  const topHolders = query<{
    name: string; team: string; role_level: string; n_skills: number; avg_lv: number; critical_held: number;
  }>(
    `SELECT m.name, m.team, m.role_level,
            COUNT(sp.skill_id) n_skills, AVG(sp.current_level) avg_lv,
            SUM(CASE WHEN s.is_critical=1 THEN 1 ELSE 0 END) critical_held
     FROM member m
     LEFT JOIN skill_profile sp ON m.employee_id=sp.member_id
     LEFT JOIN skill s ON sp.skill_id=s.skill_id
     WHERE m.job_type IN ${EVAL}
     GROUP BY m.employee_id HAVING n_skills>0
     ORDER BY avg_lv DESC, n_skills DESC LIMIT 5`
  ).map((r) => ({ ...r, avg_lv: Math.round(r.avg_lv * 100) / 100 }));

  // ---- 평가 Funnel ----
  const funnelRaw = query<{ stage: string; cnt: number }>(
    `SELECT stage, COUNT(DISTINCT member_id || '_' || skill_id) cnt FROM assessment GROUP BY stage`
  );
  const funnelMap = new Map(funnelRaw.map((r) => [r.stage, r.cnt]));
  const funnel = ["self", "leader", "calibration", "committee"].map((s) => ({
    stage: s,
    cnt: funnelMap.get(s) ?? 0,
  }));

  // ---- Sub-family 평균 ----
  const subAvg = query<{ sub_family_name: string; avg_lv: number; cnt: number }>(
    `SELECT sf.sub_family_name, AVG(sp.current_level) avg_lv, COUNT(*) cnt
     FROM skill_profile sp
     JOIN skill s ON sp.skill_id=s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id
     JOIN member m ON sp.member_id=m.employee_id
     WHERE m.job_type IN ${EVAL}
     GROUP BY sf.sub_family_name ORDER BY avg_lv DESC`
  ).map((r) => ({ ...r, avg_lv: Math.round(r.avg_lv * 100) / 100 }));

  // ---- 부족 Skill Top 5 (우선도 = Gap × (1+Scarcity) × Core가중) ----
  const reqAll = query<{ skill_id: number; target_level: number; is_core: number }>(
    `SELECT skill_id, MAX(target_level) target_level, MAX(is_core) is_core
     FROM required_skill
     WHERE org_or_individual IN ('company','department') GROUP BY skill_id`
  );
  const profAll = query<{ skill_id: number; avg_cur: number; n_holders: number }>(
    `SELECT sp.skill_id, AVG(sp.current_level) avg_cur, COUNT(*) n_holders
     FROM skill_profile sp JOIN member m ON sp.member_id=m.employee_id
     WHERE m.job_type IN ${EVAL} GROUP BY sp.skill_id`
  );
  const skillNames = new Map(
    query<{ skill_id: number; skill_name: string }>(`SELECT skill_id, skill_name FROM skill`).map((r) => [
      r.skill_id,
      r.skill_name,
    ])
  );
  const profAllMap = new Map(profAll.map((p) => [p.skill_id, p]));
  const gaps = reqAll
    .map((r) => {
      const p = profAllMap.get(r.skill_id);
      const avgCur = p?.avg_cur ?? 0;
      const nHolders = p?.n_holders ?? 0;
      const gap = Math.max(r.target_level - avgCur, 0);
      const scarcity = 1 - nHolders / (nMembers || 1);
      const priority = gap * (1 + scarcity) * (r.is_core ? 1.5 : 1.0);
      return {
        skill_id: r.skill_id,
        skill_name: skillNames.get(r.skill_id) ?? `#${r.skill_id}`,
        target_level: r.target_level,
        avg_cur: Math.round(avgCur * 10) / 10,
        gap: Math.round(gap * 10) / 10,
        is_core: !!r.is_core,
        n_holders: nHolders,
        priority,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);

  // ---- Critical Skill 현황 ----
  const critical = query<{ skill_id: number; skill_name: string; sub_family_name: string; holders: number; avg_lv: number }>(
    `SELECT s.skill_id, s.skill_name, sf.sub_family_name,
            COUNT(DISTINCT sp.member_id) holders, AVG(sp.current_level) avg_lv
     FROM skill s
     JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id
     LEFT JOIN skill_profile sp ON s.skill_id=sp.skill_id
     LEFT JOIN member m ON sp.member_id=m.employee_id AND m.job_type IN ${EVAL}
     WHERE s.is_critical=1
     GROUP BY s.skill_id ORDER BY holders DESC`
  ).map((r) => ({
    ...r,
    avg_lv: Math.round((r.avg_lv ?? 0) * 10) / 10,
    coverage: nMembers ? Math.round((r.holders / nMembers) * 100) : 0,
  }));

  // ---- 최근 평가 활동 ----
  const recent = query<{
    assessed_date: string; stage: string; proposed_level: number | null; confirmed_level: number | null;
    name: string; skill_name: string;
  }>(
    `SELECT a.assessed_date, a.stage, a.proposed_level, a.confirmed_level, m.name, s.skill_name
     FROM assessment a JOIN member m ON a.member_id=m.employee_id
     JOIN skill s ON a.skill_id=s.skill_id
     WHERE a.skill_id IS NOT NULL
     ORDER BY a.assessment_id DESC LIMIT 8`
  );

  return NextResponse.json({ kpi, teamStatus, topHolders, funnel, subAvg, gaps, critical, recent });
}

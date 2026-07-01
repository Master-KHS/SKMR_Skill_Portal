// 추천 스킬 근거 — 현재 직무 + 발령이력 + 보유스킬 기반 부족 스킬 후보.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const member = query<{ employee_id: string; name: string; team: string; division: string; job_type: string; role_level: string }>(
    `SELECT employee_id, name, team, division, job_type, role_level FROM member WHERE employee_id=?`, [id]
  )[0];
  if (!member) return NextResponse.json({ error: "구성원 없음" }, { status: 404 });

  const doc = query<{ job_title: string; summary: string; responsibilities: string }>(
    `SELECT job_title, summary, responsibilities FROM member_doc WHERE member_id=?`, [id]
  )[0] ?? null;
  const appts = query(`SELECT appt_date, from_team, to_team, role, note FROM appointment WHERE member_id=? ORDER BY appt_date`, [id]);

  const heldTop = query(
    `SELECT s.skill_name, sp.current_level FROM skill_profile sp JOIN skill s ON sp.skill_id=s.skill_id
     WHERE sp.member_id=? ORDER BY sp.current_level DESC LIMIT 6`, [id]
  );

  // 부족 스킬 = (전사+팀+개인 요구) ∪ (팀 동료가 많이 보유하는 스킬) − 본인 보유
  const held = new Set(query<{ skill_id: number }>(`SELECT skill_id FROM skill_profile WHERE member_id=?`, [id]).map((r) => r.skill_id));

  const required = query<{ skill_id: number; skill_name: string; sub_family_name: string; target_level: number; is_core: number; cur: number | null }>(
    `SELECT rq.skill_id, s.skill_name, sf.sub_family_name, rq.target_level, rq.is_core, sp.current_level cur
     FROM (SELECT skill_id, MAX(target_level) target_level, MAX(is_core) is_core FROM required_skill
           WHERE (org_or_individual='company' AND target_id='ALL')
              OR (org_or_individual='department' AND target_id=?)
              OR (org_or_individual='individual' AND target_id=? AND status='approved')
           GROUP BY skill_id) rq
     JOIN skill s ON rq.skill_id=s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id
     LEFT JOIN skill_profile sp ON sp.member_id=? AND sp.skill_id=rq.skill_id`,
    [member.team, id, id]
  );

  // 팀 인기 스킬 (동료 보유율 높은 것 중 본인 미보유)
  const teamPopular = query<{ skill_id: number; skill_name: string; sub_family_name: string; holders: number }>(
    `SELECT s.skill_id, s.skill_name, sf.sub_family_name, COUNT(*) holders
     FROM skill_profile sp
     JOIN member m ON sp.member_id=m.employee_id
     JOIN skill s ON sp.skill_id=s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id
     WHERE m.team=? AND m.employee_id<>? AND sp.current_level>=3
     GROUP BY s.skill_id ORDER BY holders DESC LIMIT 15`, [member.team, id]
  );

  const candidates: { skill_id: number; skill_name: string; sub_family_name: string; reason: string; priority: number }[] = [];
  for (const r of required) {
    if (r.is_core || (r.cur ?? 0) < r.target_level) {
      candidates.push({
        skill_id: r.skill_id, skill_name: r.skill_name, sub_family_name: r.sub_family_name,
        reason: `${r.is_core ? "직무 핵심(Core) 요구 스킬" : "요구 스킬"} · 목표 L${r.target_level} / 현재 L${r.cur ?? 0}`,
        priority: (r.is_core ? 100 : 50) + (r.target_level - (r.cur ?? 0)) * 5,
      });
    }
  }
  for (const r of teamPopular) {
    if (!held.has(r.skill_id) && !candidates.find((c) => c.skill_id === r.skill_id)) {
      candidates.push({
        skill_id: r.skill_id, skill_name: r.skill_name, sub_family_name: r.sub_family_name,
        reason: `같은 팀(${member.team}) 동료 ${r.holders}명이 L3+ 보유 — 직무 흐름상 필요도 높음`,
        priority: 30 + r.holders,
      });
    }
  }
  candidates.sort((a, b) => b.priority - a.priority);

  return NextResponse.json({
    member, doc, appointments: appts, heldTop,
    recommendations: candidates.slice(0, 5),
  });
}

// 최종 결과 확인 — 개인 보유 Skill 종합(프로필/Radar/Gap/평가이력/진행현황).
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AccessRow {
  employee_id: string;
  persona_role: string | null;
  team: string | null;
  division: string | null;
}

function getActor(actorId: string) {
  return query<AccessRow>(
    `SELECT employee_id, persona_role, team, division
     FROM member
     WHERE employee_id = ?`,
    [actorId]
  )[0] ?? null;
}

function assertProfileAccess(
  persona: string,
  actor: AccessRow | null,
  member: Pick<AccessRow, "employee_id" | "team" | "division"> | null
) {
  if (!member) {
    throw new Error("Member not found.");
  }

  if (persona === "hr_admin" || persona === "hr_viewer" || persona === "committee" || persona === "executive") {
    return;
  }

  if (!actor) {
    throw new Error("Invalid actor.");
  }

  if (persona === "employee") {
    if (actor.employee_id !== member.employee_id) {
      throw new Error("Employees can only view their own profile.");
    }
    return;
  }

  if (persona === "team_leader") {
    if (!actor.team || actor.team !== member.team) {
      throw new Error("Team leaders can only view profiles in their team.");
    }
    return;
  }

  if (persona === "calibration") {
    if (!actor.division || actor.division !== member.division) {
      throw new Error("Calibration participants can only view profiles in their division.");
    }
    return;
  }

  throw new Error("Profile access is not allowed for this persona.");
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const persona = req.nextUrl.searchParams.get("persona") ?? "hr_admin";
  const actorId = req.nextUrl.searchParams.get("actor_id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const member = query<{ employee_id: string; name: string; team: string; division: string; role_level: string }>(
    `SELECT employee_id, name, team, division, role_level FROM member WHERE employee_id=?`, [id]
  )[0];

  try {
    assertProfileAccess(persona, actorId ? getActor(actorId) : null, member ?? null);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Forbidden" },
      { status: 403 }
    );
  }

  const team = member?.team ?? "";

  const profile = query(
    `SELECT sp.skill_id, sp.current_level, sp.target_level, sp.last_assessed_date,
            s.skill_name, s.is_critical, sf.sub_family_name, f.family_name
     FROM skill_profile sp
     JOIN skill s ON sp.skill_id=s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id
     JOIN skill_family f ON sf.family_id=f.family_id
     WHERE sp.member_id=? ORDER BY sp.current_level DESC, sp.skill_id`, [id]
  );

  // Sub-family 평균 (레이더용)
  const subAvg = query<{ sub_family_name: string; avg_lv: number }>(
    `SELECT sf.sub_family_name, AVG(sp.current_level) avg_lv
     FROM skill_profile sp JOIN skill s ON sp.skill_id=s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id
     WHERE sp.member_id=? GROUP BY sf.sub_family_name`, [id]
  ).map((r) => ({ sub_family_name: r.sub_family_name, avg_lv: Math.round(r.avg_lv * 100) / 100 }));

  // 요구 Skill (전사+팀+개인승인) vs 보유 → Gap
  const gaps = query<{
    skill_id: number;
    skill_name: string;
    family_name: string;
    sub_family_name: string;
    target_level: number;
    is_core: number;
    current_level: number | null;
  }>(
    `SELECT rq.skill_id, s.skill_name, f.family_name, sf.sub_family_name, rq.target_level, rq.is_core, sp.current_level
     FROM (
       SELECT skill_id, MAX(target_level) target_level, MAX(is_core) is_core FROM required_skill
       WHERE (org_or_individual='company' AND target_id='ALL')
          OR (org_or_individual='department' AND target_id=?)
          OR (org_or_individual='individual' AND target_id=? AND status='approved')
       GROUP BY skill_id
     ) rq
     JOIN skill s ON rq.skill_id=s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id
     JOIN skill_family f ON sf.family_id=f.family_id
     LEFT JOIN skill_profile sp ON sp.member_id=? AND sp.skill_id=rq.skill_id
     ORDER BY rq.is_core DESC, rq.skill_id`,
    [team, id, id]
  ).map((r) => ({ ...r, current_level: r.current_level ?? 0, gap: Math.max(r.target_level - (r.current_level ?? 0), 0) }));

  // 평가 이력
  const history = query(
    `SELECT a.stage, a.proposed_level, a.confirmed_level, a.assessed_date, a.status, a.rationale,
            s.skill_name, m.name AS assessor_name
     FROM assessment a JOIN skill s ON a.skill_id=s.skill_id
     LEFT JOIN member m ON a.assessor_id=m.employee_id
     WHERE a.member_id=? AND a.skill_id IS NOT NULL
     ORDER BY a.assessment_id DESC LIMIT 30`, [id]
  );

  // 진행 현황 (스킬별 어느 단계까지)
  const progress = query(
    `SELECT s.skill_id, s.skill_name, sp.current_level,
            MAX(CASE WHEN a.stage='self' THEN 1 ELSE 0 END) done_self,
            MAX(CASE WHEN a.stage='leader' THEN 1 ELSE 0 END) done_leader,
            MAX(CASE WHEN a.stage='calibration' THEN 1 ELSE 0 END) done_calib,
            MAX(CASE WHEN a.stage='committee' THEN 1 ELSE 0 END) done_comm
     FROM skill_profile sp JOIN skill s ON sp.skill_id=s.skill_id
     LEFT JOIN assessment a ON a.member_id=sp.member_id AND a.skill_id=sp.skill_id
     WHERE sp.member_id=? GROUP BY s.skill_id ORDER BY s.skill_id`, [id]
  );

  return NextResponse.json({ member, profile, subAvg, gaps, history, progress });
}

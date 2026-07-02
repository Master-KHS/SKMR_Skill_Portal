// Narrative 작성 — 원본 app/views/narrative.py 이식.
// Calibration에서 Lv4 후보로 승격(stage='calibration', status='submitted', proposed_level=4)되었으나
// 아직 Committee 확정(stage='committee', status='confirmed')되지 않은 (member, skill) 페어만 대상.
import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Candidate {
  member_id: string; skill_id: number; aid: number; calib_lv: number; narrative: string | null;
  name: string; division: string; team: string; role_level: string;
  skill_name: string; sub_family_name: string; family_name: string; is_critical: number;
  self_lv: number | null; leader_lv: number | null;
}

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

function assertNarrativeAccess(persona: string, actor: AccessRow | null, candidate: Pick<Candidate, "member_id" | "team" | "division">) {
  if (!actor) {
    throw new Error("Invalid actor.");
  }

  if (persona === "hr_admin" || persona === "hr_viewer" || persona === "committee" || persona === "executive") {
    return;
  }

  if (persona === "calibration") {
    if (!actor.division || actor.division !== candidate.division) {
      throw new Error("Narrative access is limited to the actor's division.");
    }
    return;
  }

  if (persona === "team_leader") {
    if (!actor.team || actor.team !== candidate.team) {
      throw new Error("Narrative access is limited to the actor's team.");
    }
    return;
  }

  throw new Error("Narrative access is not allowed for this persona.");
}

function getCandidates() {
  return query<Candidate & { self_lv_c: number | null; self_lv_p: number | null }>(
    `WITH calib_done AS (
       SELECT member_id, skill_id, MAX(assessment_id) AS aid,
              MAX(proposed_level) AS calib_lv, MAX(narrative) AS narrative
       FROM assessment
       WHERE stage='calibration' AND status='submitted' AND proposed_level=4
       GROUP BY member_id, skill_id
     ),
     commit_done AS (
       SELECT DISTINCT member_id, skill_id FROM assessment
       WHERE stage='committee' AND status='confirmed'
     )
     SELECT cd.member_id, cd.skill_id, cd.aid, cd.calib_lv, cd.narrative,
            m.name, m.division, m.team, m.role_level,
            s.skill_name, sf.sub_family_name, f.family_name, s.is_critical,
            (SELECT confirmed_level FROM assessment a WHERE a.member_id=cd.member_id AND a.skill_id=cd.skill_id AND a.stage='self' ORDER BY a.assessment_id DESC LIMIT 1) AS self_lv_c,
            (SELECT proposed_level FROM assessment a WHERE a.member_id=cd.member_id AND a.skill_id=cd.skill_id AND a.stage='self' ORDER BY a.assessment_id DESC LIMIT 1) AS self_lv_p,
            (SELECT confirmed_level FROM assessment a WHERE a.member_id=cd.member_id AND a.skill_id=cd.skill_id AND a.stage='leader' ORDER BY a.assessment_id DESC LIMIT 1) AS leader_lv
     FROM calib_done cd
     JOIN member m ON cd.member_id = m.employee_id
     JOIN skill s ON cd.skill_id = s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
     JOIN skill_family f ON sf.family_id = f.family_id
     LEFT JOIN commit_done co ON cd.member_id = co.member_id AND cd.skill_id = co.skill_id
     WHERE co.member_id IS NULL
     ORDER BY s.skill_id, m.name`
  ).map((r) => ({
    ...r,
    self_lv: r.self_lv_c ?? r.self_lv_p ?? null,
  }));
}

export async function GET(req: NextRequest) {
  const persona = req.nextUrl.searchParams.get("persona") ?? "hr_admin";
  const actorId = req.nextUrl.searchParams.get("actor_id");
  const actor = actorId ? getActor(actorId) : null;

  const candidates = getCandidates().filter((candidate) => {
    try {
      if (!actorId) {
        return persona === "hr_admin";
      }
      assertNarrativeAccess(persona, actor, candidate);
      return true;
    } catch {
      return false;
    }
  });

  return NextResponse.json({ candidates });
}

export async function POST(req: NextRequest) {
  const { assessment_id, narrative, persona, actor_id } = (await req.json()) as {
    assessment_id: number;
    narrative: string;
    persona?: string;
    actor_id?: string;
  };
  if (!assessment_id) return NextResponse.json({ error: "assessment_id 필요" }, { status: 400 });

  const actor = actor_id ? getActor(actor_id) : null;
  const candidate = getCandidates().find((item) => item.aid === assessment_id);
  if (!candidate) {
    return NextResponse.json({ error: "대상 assessment를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    assertNarrativeAccess(persona ?? "hr_admin", actor, candidate);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Forbidden" },
      { status: 403 }
    );
  }

  run(`UPDATE assessment SET narrative=? WHERE assessment_id=?`, [narrative.trim(), assessment_id]);
  return NextResponse.json({ ok: true });
}

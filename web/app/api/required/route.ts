import { NextRequest, NextResponse } from "next/server";
import { query, run, tx } from "@/lib/db";
import { TEAM_REQUIRED_DUMMY } from "@/lib/required-dummy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Persona =
  | "employee"
  | "team_leader"
  | "calibration"
  | "committee"
  | "hr_admin"
  | "hr_viewer"
  | "executive";

interface EnrichedReq {
  org_or_individual: string;
  target_id: string;
  skill_id: number;
  target_level: number;
  is_core: number;
  status: string;
  skill_name: string;
  sub_family_name: string;
  family_name: string;
}

interface MemberRow {
  employee_id: string;
  name: string;
  team: string | null;
}

interface ActorScope {
  employee_id: string;
  team: string | null;
}

function getActorScope(actorId: string | null) {
  if (!actorId) return null;
  return (
    query<ActorScope>(
      `SELECT employee_id, team
         FROM member
        WHERE employee_id = ?`,
      [actorId]
    )[0] ?? null
  );
}

function listMembers() {
  return query<MemberRow>(
    `SELECT employee_id, name, team
       FROM member
      WHERE job_type IN ('사무직', '기술직', '연구직')
      ORDER BY division, team, role_level DESC, name`
  );
}

function isTeamLeaderScopeAllowed(persona: Persona, actor: ActorScope | null, team: string) {
  return persona === "hr_admin" || (persona === "team_leader" && actor?.team === team);
}

function isIndividualScopeAllowed(persona: Persona, actor: ActorScope | null, targetMemberId: string) {
  if (persona === "hr_admin") return true;
  if (persona === "employee" && actor?.employee_id === targetMemberId) return true;
  if (persona === "team_leader" && actor?.team) {
    const targetTeam = query<{ team: string | null }>(
      `SELECT team FROM member WHERE employee_id = ?`,
      [targetMemberId]
    )[0]?.team;
    return actor.team === targetTeam;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const persona = (req.nextUrl.searchParams.get("persona") ?? "hr_admin") as Persona;
  const actorId = req.nextUrl.searchParams.get("actor_id");
  const actor = getActorScope(actorId);

  const rows = query<EnrichedReq>(
    `SELECT r.org_or_individual, r.target_id, r.skill_id, r.target_level, r.is_core, r.status,
            s.skill_name, sf.sub_family_name, f.family_name
       FROM required_skill r
       JOIN skill s ON r.skill_id = s.skill_id
       JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
       JOIN skill_family f ON sf.family_id = f.family_id
      ORDER BY r.org_or_individual, r.target_id, r.skill_id`
  );

  const skills = query(
    `SELECT s.skill_id, s.skill_name, sf.sub_family_name, f.family_name
       FROM skill s
       JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
       JOIN skill_family f ON sf.family_id = f.family_id
      ORDER BY s.skill_id`
  );

  const allMembers = listMembers();
  const members =
    persona === "employee" && actor
      ? allMembers.filter((member) => member.employee_id === actor.employee_id)
      : persona === "team_leader" && actor?.team
        ? allMembers.filter((member) => member.team === actor.team)
        : allMembers;

  const teams = [...new Set(members.map((member) => member.team).filter(Boolean))] as string[];

  const visibleRows = rows.filter((row) => {
    if (row.org_or_individual === "company") return true;
    if (row.org_or_individual === "department") {
      return persona === "team_leader" && actor?.team ? row.target_id === actor.team : true;
    }
    if (row.org_or_individual === "individual") {
      if (persona === "employee" && actor) return row.target_id === actor.employee_id;
      if (persona === "team_leader" && actor?.team) {
        return members.some((member) => member.employee_id === row.target_id);
      }
      return true;
    }
    return false;
  });

  return NextResponse.json({
    rows: visibleRows,
    skills,
    teams,
    members,
    permissions: {
      canEditCompany: persona === "hr_admin",
      canEditDepartment: persona === "hr_admin" || persona === "team_leader",
      canRequestIndividual: persona === "hr_admin" || persona === "team_leader" || persona === "employee",
      canApproveIndividual: persona === "hr_admin" || persona === "team_leader",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;
  const persona = (body.persona ?? "hr_admin") as Persona;
  const actor = getActorScope(body.actor_id ?? null);

  if (action === "saveScope") {
    const { org_kind, target_id, rows } = body as {
      org_kind: string;
      target_id: string;
      rows: { skill_id: number; target_level: number; is_core: boolean }[];
    };

    if (org_kind === "company" && persona !== "hr_admin") {
      return NextResponse.json({ error: "Company scope edit is not allowed." }, { status: 403 });
    }
    if (org_kind === "department") {
      if (!isTeamLeaderScopeAllowed(persona, actor, target_id)) {
        return NextResponse.json({ error: "Department scope edit is not allowed." }, { status: 403 });
      }
      const coreCount = rows.filter((row) => row.is_core).length;
      if (coreCount !== 5) {
        return NextResponse.json({ error: "Department core skill count must be exactly 5." }, { status: 400 });
      }
    }

    tx(() => {
      run(
        `DELETE FROM required_skill
          WHERE org_or_individual = ?
            AND target_id = ?
            AND status = 'approved'`,
        [org_kind, target_id]
      );
      for (const row of rows) {
        run(
          `INSERT OR REPLACE INTO required_skill
             (org_or_individual, target_id, skill_id, target_level, is_core, status)
           VALUES (?,?,?,?,?,'approved')`,
          [org_kind, target_id, row.skill_id, row.target_level ?? 2, row.is_core ? 1 : 0]
        );
      }
    });
    return NextResponse.json({ ok: true, saved: rows.length });
  }

  if (action === "seedTeamCoreDummy") {
    if (persona !== "hr_admin") {
      return NextResponse.json({ error: "Only HR Admin can apply team core dummy mappings." }, { status: 403 });
    }

    tx(() => {
      for (const [team, items] of Object.entries(TEAM_REQUIRED_DUMMY)) {
        run(
          `DELETE FROM required_skill
            WHERE org_or_individual = 'department'
              AND target_id = ?`,
          [team]
        );
        for (const item of items) {
          run(
            `INSERT OR REPLACE INTO required_skill
               (org_or_individual, target_id, skill_id, target_level, is_core, status)
             VALUES ('department', ?, ?, ?, ?, 'approved')`,
            [team, item.skill_id, item.target_level, item.is_core ? 1 : 0]
          );
        }
      }
    });

    return NextResponse.json({ ok: true, saved: Object.keys(TEAM_REQUIRED_DUMMY).length });
  }

  if (action === "request") {
    const { member_id, skill_id, target_level } = body as {
      member_id: string;
      skill_id: number;
      target_level: number;
    };
    if (!isIndividualScopeAllowed(persona, actor, member_id)) {
      return NextResponse.json({ error: "Individual request is not allowed." }, { status: 403 });
    }
    const existing = query(
      `SELECT 1
         FROM required_skill
        WHERE org_or_individual = 'individual'
          AND target_id = ?
          AND skill_id = ?`,
      [member_id, skill_id]
    );
    if (existing.length) {
      return NextResponse.json({ ok: false, error: "Skill already exists in individual scope." });
    }
    const status = persona === "hr_admin" ? "approved" : "pending";
    run(
      `INSERT INTO required_skill
         (org_or_individual, target_id, skill_id, target_level, is_core, status)
       VALUES ('individual', ?, ?, ?, 0, ?)`,
      [member_id, skill_id, target_level ?? 2, status]
    );
    return NextResponse.json({ ok: true, status });
  }

  if (action === "approve") {
    const { member_id, skill_id } = body as { member_id: string; skill_id: number };
    if (!(persona === "hr_admin" || persona === "team_leader")) {
      return NextResponse.json({ error: "Approval is not allowed." }, { status: 403 });
    }
    if (!isIndividualScopeAllowed(persona, actor, member_id)) {
      return NextResponse.json({ error: "Approval scope is not allowed." }, { status: 403 });
    }
    run(
      `UPDATE required_skill
          SET status = 'approved'
        WHERE org_or_individual = 'individual'
          AND target_id = ?
          AND skill_id = ?`,
      [member_id, skill_id]
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    const { member_id, skill_id } = body as { member_id: string; skill_id: number };
    if (!(persona === "hr_admin" || persona === "team_leader")) {
      return NextResponse.json({ error: "Reject is not allowed." }, { status: 403 });
    }
    if (!isIndividualScopeAllowed(persona, actor, member_id)) {
      return NextResponse.json({ error: "Reject scope is not allowed." }, { status: 403 });
    }
    run(
      `DELETE FROM required_skill
        WHERE org_or_individual = 'individual'
          AND target_id = ?
          AND skill_id = ?
          AND status = 'pending'`,
      [member_id, skill_id]
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    const { member_id, skill_id } = body as { member_id: string; skill_id: number };
    if (!(persona === "employee" || persona === "hr_admin")) {
      return NextResponse.json({ error: "Cancel is not allowed." }, { status: 403 });
    }
    if (!isIndividualScopeAllowed(persona, actor, member_id)) {
      return NextResponse.json({ error: "Cancel scope is not allowed." }, { status: 403 });
    }
    run(
      `DELETE FROM required_skill
        WHERE org_or_individual = 'individual'
          AND target_id = ?
          AND skill_id = ?
          AND status = 'pending'`,
      [member_id, skill_id]
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "removeIndividual") {
    const { member_id, skill_id } = body as { member_id: string; skill_id: number };
    if (!(persona === "hr_admin" || persona === "team_leader")) {
      return NextResponse.json({ error: "Remove is not allowed." }, { status: 403 });
    }
    if (!isIndividualScopeAllowed(persona, actor, member_id)) {
      return NextResponse.json({ error: "Remove scope is not allowed." }, { status: 403 });
    }
    run(
      `DELETE FROM required_skill
        WHERE org_or_individual = 'individual'
          AND target_id = ?
          AND skill_id = ?
          AND status = 'approved'`,
      [member_id, skill_id]
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { query, run, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StageCode = "leader" | "calibration" | "committee";

interface AssessRow {
  skill_id: number;
  skill_name: string;
  sub_family_name: string;
  family_name: string;
  is_critical: number;
  current_level: number;
  target_level: number | null;
  self_level: number | null;
  leader_level: number | null;
  calibration_level: number | null;
  narrative: string | null;
}

interface MemberAccessRow {
  employee_id: string;
  persona_role: string | null;
  team: string | null;
  division: string | null;
}

const STAGES = new Set<StageCode>(["leader", "calibration", "committee"]);

function isStageCode(value: string): value is StageCode {
  return STAGES.has(value as StageCode);
}

function getMemberAccess(memberId: string): MemberAccessRow | null {
  return (
    query<MemberAccessRow>(
      `SELECT employee_id, persona_role, team, division
       FROM member
       WHERE employee_id = ?`,
      [memberId]
    )[0] ?? null
  );
}

function assertStageAccess(stage: StageCode, assessorId: string, memberId: string) {
  const assessor = getMemberAccess(assessorId);
  const member = getMemberAccess(memberId);

  if (!assessor || !member) {
    throw new Error("Invalid assessor or member.");
  }

  if (assessor.persona_role === "hr_admin") {
    return;
  }

  if (stage === "leader") {
    if (assessor.persona_role !== "team_leader") {
      throw new Error("Only team leaders or HR admins can access leader assessment.");
    }
    if (!assessor.team || assessor.team !== member.team) {
      throw new Error("Leader assessment is limited to the assessor's team.");
    }
    if (assessor.employee_id === member.employee_id) {
      throw new Error("A team leader cannot assess their own profile in leader assessment.");
    }
    return;
  }

  if (stage === "calibration") {
    if (assessor.persona_role !== "calibration") {
      throw new Error("Only calibration participants or HR admins can access calibration.");
    }
    if (!assessor.division || assessor.division !== member.division) {
      throw new Error("Calibration is limited to the assessor's division.");
    }
    return;
  }

  if (assessor.persona_role !== "committee") {
    throw new Error("Only committee members or HR admins can access committee assessment.");
  }
}

function getPendingRows(memberId: string, stage: StageCode): AssessRow[] {
  if (stage === "leader") {
    return query<AssessRow>(
      `SELECT sp.skill_id,
              s.skill_name,
              sf.sub_family_name,
              f.family_name,
              s.is_critical,
              sp.current_level,
              sp.target_level,
              (
                SELECT COALESCE(a.proposed_level, a.confirmed_level)
                FROM assessment a
                WHERE a.member_id = sp.member_id
                  AND a.skill_id = sp.skill_id
                  AND a.stage = 'self'
                  AND a.status = 'submitted'
                ORDER BY a.assessment_id DESC
                LIMIT 1
              ) AS self_level,
              NULL AS leader_level,
              NULL AS calibration_level,
              NULL AS narrative
       FROM skill_profile sp
       JOIN skill s ON sp.skill_id = s.skill_id
       JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
       JOIN skill_family f ON sf.family_id = f.family_id
       WHERE sp.member_id = ?
         AND EXISTS (
           SELECT 1
           FROM assessment a
           WHERE a.member_id = sp.member_id
             AND a.skill_id = sp.skill_id
             AND a.stage = 'self'
             AND a.status = 'submitted'
         )
         AND NOT EXISTS (
           SELECT 1
           FROM assessment a
           WHERE a.member_id = sp.member_id
             AND a.skill_id = sp.skill_id
             AND a.stage = 'leader'
             AND a.status IN ('submitted', 'confirmed')
         )
       ORDER BY sf.sub_family_id, s.skill_id`,
      [memberId]
    );
  }

  if (stage === "calibration") {
    return query<AssessRow>(
      `SELECT sp.skill_id,
              s.skill_name,
              sf.sub_family_name,
              f.family_name,
              s.is_critical,
              sp.current_level,
              sp.target_level,
              (
                SELECT COALESCE(a.confirmed_level, a.proposed_level)
                FROM assessment a
                WHERE a.member_id = sp.member_id
                  AND a.skill_id = sp.skill_id
                  AND a.stage = 'self'
                ORDER BY a.assessment_id DESC
                LIMIT 1
              ) AS self_level,
              (
                SELECT a.proposed_level
                FROM assessment a
                WHERE a.member_id = sp.member_id
                  AND a.skill_id = sp.skill_id
                  AND a.stage = 'leader'
                  AND a.status = 'submitted'
                ORDER BY a.assessment_id DESC
                LIMIT 1
              ) AS leader_level,
              NULL AS calibration_level,
              NULL AS narrative
       FROM skill_profile sp
       JOIN skill s ON sp.skill_id = s.skill_id
       JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
       JOIN skill_family f ON sf.family_id = f.family_id
       WHERE sp.member_id = ?
         AND EXISTS (
           SELECT 1
           FROM assessment a
           WHERE a.member_id = sp.member_id
             AND a.skill_id = sp.skill_id
             AND a.stage = 'leader'
             AND a.status = 'submitted'
         )
         AND NOT EXISTS (
           SELECT 1
           FROM assessment a
           WHERE a.member_id = sp.member_id
             AND a.skill_id = sp.skill_id
             AND a.stage = 'calibration'
             AND a.status IN ('submitted', 'confirmed')
         )
       ORDER BY sf.sub_family_id, s.skill_id`,
      [memberId]
    );
  }

  return query<AssessRow>(
    `SELECT sp.skill_id,
            s.skill_name,
            sf.sub_family_name,
            f.family_name,
            s.is_critical,
            sp.current_level,
            sp.target_level,
            (
              SELECT COALESCE(a.confirmed_level, a.proposed_level)
              FROM assessment a
              WHERE a.member_id = sp.member_id
                AND a.skill_id = sp.skill_id
                AND a.stage = 'self'
              ORDER BY a.assessment_id DESC
              LIMIT 1
            ) AS self_level,
            (
              SELECT COALESCE(a.confirmed_level, a.proposed_level)
              FROM assessment a
              WHERE a.member_id = sp.member_id
                AND a.skill_id = sp.skill_id
                AND a.stage = 'leader'
              ORDER BY a.assessment_id DESC
              LIMIT 1
            ) AS leader_level,
            (
              SELECT a.proposed_level
              FROM assessment a
              WHERE a.member_id = sp.member_id
                AND a.skill_id = sp.skill_id
                AND a.stage = 'calibration'
                AND a.status = 'submitted'
              ORDER BY a.assessment_id DESC
              LIMIT 1
            ) AS calibration_level,
            (
              SELECT a.narrative
              FROM assessment a
              WHERE a.member_id = sp.member_id
                AND a.skill_id = sp.skill_id
                AND a.stage = 'calibration'
                AND a.status = 'submitted'
              ORDER BY a.assessment_id DESC
              LIMIT 1
            ) AS narrative
     FROM skill_profile sp
     JOIN skill s ON sp.skill_id = s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
     JOIN skill_family f ON sf.family_id = f.family_id
     WHERE sp.member_id = ?
       AND EXISTS (
         SELECT 1
         FROM assessment a
         WHERE a.member_id = sp.member_id
           AND a.skill_id = sp.skill_id
           AND a.stage = 'calibration'
           AND a.status = 'submitted'
           AND a.proposed_level = 4
       )
       AND NOT EXISTS (
         SELECT 1
         FROM assessment a
         WHERE a.member_id = sp.member_id
           AND a.skill_id = sp.skill_id
           AND a.stage = 'committee'
           AND a.status = 'confirmed'
       )
     ORDER BY sf.sub_family_id, s.skill_id`,
    [memberId]
  );
}

function isPendingForStage(memberId: string, skillId: number, stage: StageCode): boolean {
  if (stage === "leader") {
    const row = query<{ ok: number }>(
      `SELECT CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM assessment a
                  WHERE a.member_id = ?
                    AND a.skill_id = ?
                    AND a.stage = 'self'
                    AND a.status = 'submitted'
                )
                 AND NOT EXISTS (
                  SELECT 1
                  FROM assessment a
                  WHERE a.member_id = ?
                    AND a.skill_id = ?
                    AND a.stage = 'leader'
                    AND a.status IN ('submitted', 'confirmed')
                )
                THEN 1 ELSE 0 END AS ok`,
      [memberId, skillId, memberId, skillId]
    )[0];
    return row?.ok === 1;
  }

  if (stage === "calibration") {
    const row = query<{ ok: number }>(
      `SELECT CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM assessment a
                  WHERE a.member_id = ?
                    AND a.skill_id = ?
                    AND a.stage = 'leader'
                    AND a.status = 'submitted'
                )
                 AND NOT EXISTS (
                  SELECT 1
                  FROM assessment a
                  WHERE a.member_id = ?
                    AND a.skill_id = ?
                    AND a.stage = 'calibration'
                    AND a.status IN ('submitted', 'confirmed')
                )
                THEN 1 ELSE 0 END AS ok`,
      [memberId, skillId, memberId, skillId]
    )[0];
    return row?.ok === 1;
  }

  const row = query<{ ok: number }>(
    `SELECT CASE
              WHEN EXISTS (
                SELECT 1
                FROM assessment a
                WHERE a.member_id = ?
                  AND a.skill_id = ?
                  AND a.stage = 'calibration'
                  AND a.status = 'submitted'
                  AND a.proposed_level = 4
              )
               AND NOT EXISTS (
                SELECT 1
                FROM assessment a
                WHERE a.member_id = ?
                  AND a.skill_id = ?
                  AND a.stage = 'committee'
                  AND a.status = 'confirmed'
              )
              THEN 1 ELSE 0 END AS ok`,
    [memberId, skillId, memberId, skillId]
  )[0];
  return row?.ok === 1;
}

function upsertSkillProfile(memberId: string, skillId: number, level: number, today: string) {
  run(
    `INSERT INTO skill_profile (member_id, skill_id, current_level, target_level, last_assessed_date)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(member_id, skill_id) DO UPDATE SET
       current_level = excluded.current_level,
       last_assessed_date = excluded.last_assessed_date`,
    [memberId, skillId, level, level, today]
  );
}

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("member_id");
  const stageValue = req.nextUrl.searchParams.get("stage") ?? "leader";
  const assessorId = req.nextUrl.searchParams.get("assessor_id");

  if (!memberId || !assessorId) {
    return NextResponse.json({ error: "member_id and assessor_id are required" }, { status: 400 });
  }
  if (!isStageCode(stageValue)) {
    return NextResponse.json({ error: "invalid stage" }, { status: 400 });
  }

  try {
    assertStageAccess(stageValue, assessorId, memberId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Forbidden" },
      { status: 403 }
    );
  }

  return NextResponse.json({ rows: getPendingRows(memberId, stageValue) });
}

export async function POST(req: NextRequest) {
  const { member_id, stage, assessor_id, updates, narrative } = (await req.json()) as {
    member_id: string;
    stage: string;
    assessor_id?: string;
    updates: { skill_id: number; confirmed_level: number; rationale?: string }[];
    narrative?: string;
  };

  if (!member_id || !isStageCode(stage) || !Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (!assessor_id) {
    return NextResponse.json({ error: "assessor_id is required" }, { status: 400 });
  }

  try {
    assertStageAccess(stage, assessor_id, member_id);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Forbidden" },
      { status: 403 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    tx(() => {
      for (const update of updates) {
        if (!isPendingForStage(member_id, update.skill_id, stage)) {
          throw new Error(`This assessment item is no longer pending for ${stage}.`);
        }

        const level = Number(update.confirmed_level);
        const rationale = update.rationale?.trim() || null;
        const note = narrative?.trim() || null;

        if (stage === "leader") {
          if (level <= 2) {
            run(
              `INSERT INTO assessment
                 (member_id, skill_id, stage, assessor_id, proposed_level, confirmed_level, rationale, narrative, assessed_date, status)
               VALUES (?, ?, 'leader', ?, ?, ?, ?, ?, ?, 'confirmed')`,
              [member_id, update.skill_id, assessor_id ?? null, level, level, rationale, note, today]
            );
            upsertSkillProfile(member_id, update.skill_id, level, today);
          } else {
            run(
              `INSERT INTO assessment
                 (member_id, skill_id, stage, assessor_id, proposed_level, confirmed_level, rationale, narrative, assessed_date, status)
               VALUES (?, ?, 'leader', ?, ?, NULL, ?, ?, ?, 'submitted')`,
              [member_id, update.skill_id, assessor_id ?? null, level, rationale, note, today]
            );
          }
          continue;
        }

        if (stage === "calibration") {
          if (level !== 3 && level !== 4) {
            throw new Error("Calibration only allows L3 or L4.");
          }
          if (level === 3) {
            run(
              `INSERT INTO assessment
                 (member_id, skill_id, stage, assessor_id, proposed_level, confirmed_level, rationale, narrative, assessed_date, status)
               VALUES (?, ?, 'calibration', ?, ?, ?, ?, ?, ?, 'confirmed')`,
              [member_id, update.skill_id, assessor_id ?? null, level, level, rationale, note, today]
            );
            upsertSkillProfile(member_id, update.skill_id, level, today);
          } else {
            run(
              `INSERT INTO assessment
                 (member_id, skill_id, stage, assessor_id, proposed_level, confirmed_level, rationale, narrative, assessed_date, status)
               VALUES (?, ?, 'calibration', ?, 4, NULL, ?, ?, ?, 'submitted')`,
              [member_id, update.skill_id, assessor_id ?? null, rationale, note, today]
            );
          }
          continue;
        }

        if (level !== 3 && level !== 4) {
          throw new Error("Committee only allows L3 or L4.");
        }

        run(
          `INSERT INTO assessment
             (member_id, skill_id, stage, assessor_id, proposed_level, confirmed_level, rationale, narrative, assessed_date, status)
           VALUES (?, ?, 'committee', ?, ?, ?, ?, ?, ?, 'confirmed')`,
          [member_id, update.skill_id, assessor_id ?? null, level, level, rationale, note, today]
        );
        upsertSkillProfile(member_id, update.skill_id, level, today);
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save assessment." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, saved: updates.length, date: today, stage });
}

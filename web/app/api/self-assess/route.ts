import { NextRequest, NextResponse } from "next/server";
import { query, run, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SelfRow {
  skill_id: number;
  skill_name: string;
  sub_family_name: string;
  family_name: string;
  current_level: number;
  target_level: number | null;
  is_critical: number;
  self_level: number | null;
  req_is_core: number;
}

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("member_id");
  if (!memberId) {
    return NextResponse.json({ error: "member_id is required" }, { status: 400 });
  }

  const team =
    query<{ team: string | null }>(`SELECT team FROM member WHERE employee_id = ?`, [memberId])[0]?.team ?? "";

  const rows = query<SelfRow>(
    `WITH required_union AS (
        SELECT skill_id, MAX(target_level) AS target_level
          FROM required_skill
         WHERE (org_or_individual = 'company' AND target_id = 'ALL')
            OR (org_or_individual = 'department' AND target_id = ?)
            OR (org_or_individual = 'individual' AND target_id = ? AND status = 'approved')
         GROUP BY skill_id
      ),
      profile_union AS (
        SELECT sp.skill_id,
               sp.current_level,
               sp.target_level AS profile_target,
               s.skill_name,
               sf.sub_family_name,
               f.family_name,
               s.is_critical
          FROM skill_profile sp
          JOIN skill s ON sp.skill_id = s.skill_id
          JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
          JOIN skill_family f ON sf.family_id = f.family_id
         WHERE sp.member_id = ?
      ),
      latest_self AS (
        SELECT a.skill_id,
               COALESCE(a.confirmed_level, a.proposed_level) AS self_level
          FROM assessment a
          JOIN (
            SELECT skill_id, MAX(assessment_id) AS assessment_id
              FROM assessment
             WHERE member_id = ? AND stage = 'self' AND status IN ('submitted', 'confirmed')
             GROUP BY skill_id
          ) latest
            ON latest.assessment_id = a.assessment_id
      )
      SELECT s.skill_id,
             s.skill_name,
             sf.sub_family_name,
             f.family_name,
             COALESCE(ls.self_level, pu.current_level, 1) AS current_level,
             COALESCE(ru.target_level, pu.profile_target, NULL) AS target_level,
             s.is_critical,
             ls.self_level,
             COALESCE((
               SELECT MAX(is_core)
                 FROM required_skill r
                WHERE r.skill_id = s.skill_id
                  AND (
                    (r.org_or_individual = 'company' AND r.target_id = 'ALL')
                    OR (r.org_or_individual = 'department' AND r.target_id = ?)
                    OR (r.org_or_individual = 'individual' AND r.target_id = ? AND r.status = 'approved')
                  )
             ), 0) AS req_is_core
        FROM skill s
        JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
        JOIN skill_family f ON sf.family_id = f.family_id
        LEFT JOIN required_union ru ON ru.skill_id = s.skill_id
        LEFT JOIN profile_union pu ON pu.skill_id = s.skill_id
        LEFT JOIN latest_self ls ON ls.skill_id = s.skill_id
       WHERE ru.skill_id IS NOT NULL OR pu.skill_id IS NOT NULL
       ORDER BY f.family_id, sf.sub_family_id, s.skill_id`,
    [team, memberId, memberId, memberId, team, memberId]
  );

  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const { member_id, updates } = (await req.json()) as {
    member_id: string;
    updates: { skill_id: number; current_level: number }[];
  };

  if (!member_id || !Array.isArray(updates)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  tx(() => {
    for (const update of updates) {
      run(
        `INSERT INTO assessment
           (member_id, skill_id, stage, assessor_id, proposed_level, assessed_date, status)
         VALUES (?, ?, 'self', ?, ?, ?, 'submitted')`,
        [member_id, update.skill_id, member_id, update.current_level, today]
      );
    }
  });

  return NextResponse.json({ ok: true, saved: updates.length, date: today });
}

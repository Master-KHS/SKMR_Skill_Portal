import { NextRequest, NextResponse } from "next/server";
import { query, run, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AssessRow {
  skill_id: number;
  skill_name: string;
  sub_family_name: string;
  current_level: number;
  target_level: number | null;
  self_level: number | null;
  stage_level: number | null;
}

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("member_id");
  const stage = req.nextUrl.searchParams.get("stage") ?? "leader";

  if (!memberId) {
    return NextResponse.json({ error: "member_id is required" }, { status: 400 });
  }

  const rows = query<AssessRow>(
    `SELECT sp.skill_id, s.skill_name, sf.sub_family_name,
            sp.current_level, sp.target_level,
            (SELECT proposed_level
               FROM assessment a
              WHERE a.member_id = sp.member_id
                AND a.skill_id = sp.skill_id
                AND a.stage = 'self'
              ORDER BY a.assessment_id DESC
              LIMIT 1) AS self_level,
            (SELECT confirmed_level
               FROM assessment a
              WHERE a.member_id = sp.member_id
                AND a.skill_id = sp.skill_id
                AND a.stage = ?
              ORDER BY a.assessment_id DESC
              LIMIT 1) AS stage_level
       FROM skill_profile sp
       JOIN skill s ON sp.skill_id = s.skill_id
       JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
      WHERE sp.member_id = ?
      ORDER BY sf.sub_family_id, s.skill_id`,
    [stage, memberId]
  );

  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const { member_id, stage, assessor_id, updates, narrative } = (await req.json()) as {
    member_id: string;
    stage: string;
    assessor_id?: string;
    updates: { skill_id: number; confirmed_level: number; rationale?: string }[];
    narrative?: string;
  };

  if (!member_id || !stage || !Array.isArray(updates)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (stage === "leader" && assessor_id && assessor_id === member_id) {
    return NextResponse.json({ error: "A team leader cannot assess their own profile in leader assessment." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  tx(() => {
    for (const u of updates) {
      run(
        `INSERT INTO assessment (member_id, skill_id, stage, assessor_id, confirmed_level, rationale, narrative, assessed_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
        [member_id, u.skill_id, stage, assessor_id ?? null, u.confirmed_level, u.rationale ?? null, narrative ?? null, today]
      );

      if (stage === "committee") {
        run(`UPDATE skill_profile SET current_level = ? WHERE member_id = ? AND skill_id = ?`, [
          u.confirmed_level,
          member_id,
          u.skill_id,
        ]);
      }
    }
  });

  return NextResponse.json({ ok: true, saved: updates.length, date: today, stage });
}

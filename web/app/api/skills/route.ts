// Skill Library — 카탈로그 + CRUD + 보유 현황.
import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVAL = "('사무직','기술직','연구직')";

// GET               → 전체 스킬 + sub/family + level_criteria
// GET ?holders=ID   → 해당 스킬 보유 현황(전사 보유수/평균, 담당분포, 레벨분포)
export async function GET(req: NextRequest) {
  const holdersId = req.nextUrl.searchParams.get("holders");
  if (holdersId) {
    const id = Number(holdersId);
    const total = (query<{ c: number }>(`SELECT COUNT(*) c FROM member WHERE job_type IN ${EVAL}`)[0]?.c) ?? 0;
    const h = query<{ n: number; avg_lv: number }>(
      `SELECT COUNT(*) n, AVG(current_level) avg_lv FROM skill_profile sp
       JOIN member m ON sp.member_id=m.employee_id
       WHERE sp.skill_id=? AND m.job_type IN ${EVAL}`,
      [id]
    )[0];
    const levelDist = query<{ lv: number; n: number }>(
      `SELECT sp.current_level lv, COUNT(*) n FROM skill_profile sp
       JOIN member m ON sp.member_id=m.employee_id
       WHERE sp.skill_id=? AND m.job_type IN ${EVAL} GROUP BY sp.current_level`,
      [id]
    );
    const teamDist = query<{ div: string; n: number }>(
      `SELECT m.division div, COUNT(*) n FROM skill_profile sp
       JOIN member m ON sp.member_id=m.employee_id
       WHERE sp.skill_id=? AND m.job_type IN ${EVAL} GROUP BY m.division ORDER BY n DESC`,
      [id]
    );
    return NextResponse.json({
      total,
      n_holders: h?.n ?? 0,
      avg_lv: Math.round((h?.avg_lv ?? 0) * 10) / 10,
      levelDist,
      teamDist,
    });
  }

  const skills = query(
    `SELECT s.skill_id, s.skill_name, s.description, s.is_critical,
            sf.sub_family_id, sf.sub_family_name, f.family_id, f.family_name
     FROM skill s
     JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id
     JOIN skill_family f ON sf.family_id=f.family_id
     ORDER BY f.family_id, sf.sub_family_id, s.skill_id`
  );
  const subs = query(
    `SELECT sf.sub_family_id, sf.sub_family_name, f.family_id, f.family_name
     FROM sub_skill_family sf JOIN skill_family f ON sf.family_id=f.family_id ORDER BY sf.sub_family_id`
  );
  const criteria = query(`SELECT sub_family_id, level, expertise_criteria, impact_criteria FROM level_criteria`);
  return NextResponse.json({ skills, subs, criteria });
}

// POST {action, ...}
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as "create" | "update" | "delete";

  if (action === "create") {
    const maxId = (query<{ m: number }>(`SELECT MAX(skill_id) m FROM skill`)[0]?.m) ?? 0;
    const id = maxId + 1;
    run(`INSERT INTO skill (skill_id, sub_family_id, skill_name, description, is_critical) VALUES (?,?,?,?,?)`, [
      id, body.sub_family_id, body.skill_name, body.description ?? null, body.is_critical ? 1 : 0,
    ]);
    return NextResponse.json({ ok: true, skill_id: id });
  }

  if (action === "update") {
    run(`UPDATE skill SET sub_family_id=?, skill_name=?, description=?, is_critical=? WHERE skill_id=?`, [
      body.sub_family_id, body.skill_name, body.description ?? null, body.is_critical ? 1 : 0, body.skill_id,
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const id = body.skill_id;
    const refs = {
      profile: (query<{ c: number }>(`SELECT COUNT(*) c FROM skill_profile WHERE skill_id=?`, [id])[0]?.c) ?? 0,
      required: (query<{ c: number }>(`SELECT COUNT(*) c FROM required_skill WHERE skill_id=?`, [id])[0]?.c) ?? 0,
      assessment: (query<{ c: number }>(`SELECT COUNT(*) c FROM assessment WHERE skill_id=?`, [id])[0]?.c) ?? 0,
      evidence: (query<{ c: number }>(`SELECT COUNT(*) c FROM evidence_skill_link WHERE skill_id=?`, [id])[0]?.c) ?? 0,
    };
    if (refs.profile + refs.required + refs.assessment + refs.evidence > 0) {
      return NextResponse.json({ ok: false, refs });
    }
    run(`DELETE FROM skill WHERE skill_id=?`, [id]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

// 필요 Skill 정의 — 전사(company/ALL)·부서(department)·개인(individual) 범위 CRUD + 개인 승인 워크플로우.
import { NextRequest, NextResponse } from "next/server";
import { query, run, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EnrichedReq {
  org_or_individual: string; target_id: string; skill_id: number; target_level: number;
  is_core: number; status: string; skill_name: string; sub_family_name: string; family_name: string;
}

export async function GET() {
  const rows = query<EnrichedReq>(
    `SELECT r.org_or_individual, r.target_id, r.skill_id, r.target_level, r.is_core, r.status,
            s.skill_name, sf.sub_family_name, f.family_name
     FROM required_skill r
     JOIN skill s ON r.skill_id=s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id
     JOIN skill_family f ON sf.family_id=f.family_id
     ORDER BY r.skill_id`
  );
  const skills = query(
    `SELECT s.skill_id, s.skill_name, sf.sub_family_name, f.family_name
     FROM skill s JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id
     JOIN skill_family f ON sf.family_id=f.family_id ORDER BY s.skill_id`
  );
  const teams = query<{ team: string }>(
    `SELECT DISTINCT team FROM member WHERE job_type IN ('사무직','기술직','연구직') AND team IS NOT NULL ORDER BY team`
  ).map((r) => r.team);
  const members = query<{ employee_id: string; name: string; team: string }>(
    `SELECT employee_id, name, team FROM member WHERE job_type IN ('사무직','기술직','연구직') ORDER BY employee_id`
  );
  return NextResponse.json({ rows, skills, teams, members });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  if (action === "saveScope") {
    const { org_kind, target_id, rows } = body as {
      org_kind: string; target_id: string;
      rows: { skill_id: number; target_level: number; is_core: boolean }[];
    };
    tx(() => {
      run(`DELETE FROM required_skill WHERE org_or_individual=? AND target_id=? AND status='approved'`, [org_kind, target_id]);
      for (const r of rows) {
        if (r.skill_id == null) continue;
        run(
          `INSERT OR REPLACE INTO required_skill (org_or_individual, target_id, skill_id, target_level, is_core, status)
           VALUES (?,?,?,?,?,'approved')`,
          [org_kind, target_id, r.skill_id, r.target_level ?? 2, r.is_core ? 1 : 0]
        );
      }
    });
    return NextResponse.json({ ok: true, saved: rows.length });
  }

  if (action === "request") {
    const { member_id, skill_id, target_level } = body;
    const existing = query(`SELECT 1 FROM required_skill WHERE org_or_individual='individual' AND target_id=? AND skill_id=?`, [member_id, skill_id]);
    if (existing.length) return NextResponse.json({ ok: false, error: "이미 신청/등록된 스킬입니다." });
    run(`INSERT INTO required_skill (org_or_individual, target_id, skill_id, target_level, is_core, status)
         VALUES ('individual', ?, ?, ?, 0, 'pending')`, [member_id, skill_id, target_level ?? 2]);
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    run(`UPDATE required_skill SET status='approved' WHERE org_or_individual='individual' AND target_id=? AND skill_id=?`, [body.member_id, body.skill_id]);
    return NextResponse.json({ ok: true });
  }

  if (action === "reject" || action === "removeIndividual") {
    run(`DELETE FROM required_skill WHERE org_or_individual='individual' AND target_id=? AND skill_id=?`, [body.member_id, body.skill_id]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

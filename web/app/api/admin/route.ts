// Admin 권한 관리 — 시스템 정보, Critical Skill 토글, DB 리셋.
import { NextRequest, NextResponse } from "next/server";
import { query, run, resetToSeed } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function count(t: string) {
  return (query<{ c: number }>(`SELECT COUNT(*) c FROM ${t}`)[0]?.c) ?? 0;
}

export async function GET() {
  const counts = {
    member: count("member"), skill: count("skill"), skill_profile: count("skill_profile"),
    required_skill: count("required_skill"), assessment: count("assessment"), evidence: count("evidence"),
    critical: (query<{ c: number }>(`SELECT COUNT(*) c FROM skill WHERE is_critical=1`)[0]?.c) ?? 0,
  };
  const skills = query(`SELECT s.skill_id, s.skill_name, s.is_critical, sf.sub_family_name
    FROM skill s JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id ORDER BY s.skill_id`);
  return NextResponse.json({ counts, skills });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === "toggleCritical") {
    run(`UPDATE skill SET is_critical=? WHERE skill_id=?`, [body.value ? 1 : 0, body.skill_id]);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "reset") {
    resetToSeed();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

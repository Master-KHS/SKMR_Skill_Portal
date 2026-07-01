// SKILL 챗봇 컨텍스트 — 인텐트 분류/그라운딩용 경량 메타.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const skills = query(`SELECT s.skill_id, s.skill_name, sf.sub_family_name, s.description
                        FROM skill s JOIN sub_skill_family sf ON s.sub_family_id=sf.sub_family_id ORDER BY s.skill_id`);
  const members = query(`SELECT employee_id, name, team, job_type FROM member WHERE job_type IN ('사무직','기술직','연구직') ORDER BY name`);
  const teams = query<{ team: string }>(`SELECT DISTINCT team FROM member WHERE team IS NOT NULL ORDER BY team`).map((r) => r.team);
  const families = query(`SELECT f.family_name, sf.sub_family_name, sf.description
                          FROM sub_skill_family sf JOIN skill_family f ON sf.family_id=f.family_id ORDER BY f.family_id, sf.sub_family_id`);
  const refDocs = query(`SELECT title, category, content FROM reference_doc`);
  return NextResponse.json({ skills, members, teams, families, refDocs });
}

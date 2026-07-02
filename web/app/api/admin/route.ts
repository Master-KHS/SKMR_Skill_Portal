import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import {
  DB_PATH,
  query,
  resetToSeed,
  run,
  seedTaxonomyFromSeed,
  seedRequiredFromSeed,
  seedProfilesFromSeed,
  seedEvidenceFromSeed,
  seedDemoCompletedAssessments,
} from "@/lib/db";
import { MEMBERS_XLSX_PATH } from "@/lib/members-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function count(table: string) {
  return (query<{ c: number }>(`SELECT COUNT(*) c FROM ${table}`)[0]?.c) ?? 0;
}

export async function GET() {
  const counts = {
    member: count("member"),
    skill: count("skill"),
    skill_profile: count("skill_profile"),
    required_skill: count("required_skill"),
    assessment: count("assessment"),
    evidence: count("evidence"),
    critical: (query<{ c: number }>(`SELECT COUNT(*) c FROM skill WHERE is_critical=1`)[0]?.c) ?? 0,
  };

  const skills = query<{
    skill_id: number;
    skill_name: string;
    is_critical: number;
    sub_family_name: string;
    family_name: string;
  }>(`
    SELECT s.skill_id, s.skill_name, s.is_critical,
           sf.sub_family_name, f.family_name
      FROM skill s
      JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
      JOIN skill_family f ON sf.family_id = f.family_id
     ORDER BY s.is_critical DESC, s.skill_id
  `);

  const generatedCount =
    (query<{ c: number }>(`SELECT COUNT(*) c FROM member WHERE employee_id LIKE 'G%'`)[0]?.c) ?? 0;

  return NextResponse.json({
    counts,
    skills,
    files: {
      dbPath: DB_PATH,
      dbSizeKb: fs.existsSync(DB_PATH) ? Math.round(fs.statSync(DB_PATH).size / 1024) : 0,
      membersXlsxPath: MEMBERS_XLSX_PATH,
      membersXlsxExists: fs.existsSync(MEMBERS_XLSX_PATH),
    },
    simulation: {
      active: generatedCount > 0,
      generatedCount,
    },
  });
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

  if (body.action === "seedTaxonomy") {
    seedTaxonomyFromSeed();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "seedRequired") {
    seedRequiredFromSeed();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "seedProfiles") {
    seedProfilesFromSeed(true);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "seedEvidence") {
    seedEvidenceFromSeed(true);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "seedDemoCompletedAssessments") {
    const result = seedDemoCompletedAssessments();
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

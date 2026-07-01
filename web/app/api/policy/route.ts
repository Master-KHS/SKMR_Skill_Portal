// 운영 정책 관리 — Sub-family별 Level 판정 기준(스킬 마스터리) 조회/편집. DB 영구 저장.
import { NextRequest, NextResponse } from "next/server";
import { query, run, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CriteriaRow {
  sub_family_id: string;
  sub_family_name: string;
  level: number;
  expertise_criteria: string;
  impact_criteria: string;
}

export async function GET() {
  const rows = query<CriteriaRow>(
    `SELECT lc.sub_family_id, sf.sub_family_name, lc.level,
            lc.expertise_criteria, lc.impact_criteria
     FROM level_criteria lc
     JOIN sub_skill_family sf ON lc.sub_family_id = sf.sub_family_id
     ORDER BY lc.sub_family_id, lc.level`
  );
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const { updates } = (await req.json()) as {
    updates: {
      sub_family_id: string;
      level: number;
      expertise_criteria: string;
      impact_criteria: string;
    }[];
  };
  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  tx(() => {
    for (const u of updates) {
      run(
        `UPDATE level_criteria SET expertise_criteria = ?, impact_criteria = ?
         WHERE sub_family_id = ? AND level = ?`,
        [u.expertise_criteria, u.impact_criteria, u.sub_family_id, u.level]
      );
    }
  });
  return NextResponse.json({ ok: true, saved: updates.length });
}

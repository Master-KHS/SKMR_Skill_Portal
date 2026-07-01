// 평가 워크플로우 공용 API — 단계(stage)별 진단 조회/저장.
// stage: 'leader'(리더 진단) / 'calibration' / 'committee'
// 자가(self)는 /api/self-assess 에서 처리. 여기선 리더 이후 단계 기록.
import { NextRequest, NextResponse } from "next/server";
import { query, run, getDb } from "@/lib/db";

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

// GET ?member_id=&stage= → 구성원 보유 Skill + self 제안 + 해당 stage 기존 확정값
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("member_id");
  const stage = req.nextUrl.searchParams.get("stage") ?? "leader";
  if (!memberId) return NextResponse.json({ error: "member_id 필요" }, { status: 400 });

  const rows = query<AssessRow>(
    `SELECT sp.skill_id, s.skill_name, sf.sub_family_name,
            sp.current_level, sp.target_level,
            (SELECT proposed_level FROM assessment a
               WHERE a.member_id = sp.member_id AND a.skill_id = sp.skill_id AND a.stage='self'
               ORDER BY a.assessment_id DESC LIMIT 1) AS self_level,
            (SELECT confirmed_level FROM assessment a
               WHERE a.member_id = sp.member_id AND a.skill_id = sp.skill_id AND a.stage=?
               ORDER BY a.assessment_id DESC LIMIT 1) AS stage_level
     FROM skill_profile sp
     JOIN skill s ON sp.skill_id = s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
     WHERE sp.member_id = ?
     ORDER BY sf.sub_family_id, s.skill_id`,
    [stage, memberId]
  );
  return NextResponse.json({ rows });
}

// POST {member_id, stage, assessor_id?, updates:[{skill_id, confirmed_level, rationale?}], narrative?}
export async function POST(req: NextRequest) {
  const { member_id, stage, assessor_id, updates, narrative } = (await req.json()) as {
    member_id: string;
    stage: string;
    assessor_id?: string;
    updates: { skill_id: number; confirmed_level: number; rationale?: string }[];
    narrative?: string;
  };
  if (!member_id || !stage || !Array.isArray(updates)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const db = getDb();
  const tx = db.transaction(() => {
    for (const u of updates) {
      run(
        `INSERT INTO assessment (member_id, skill_id, stage, assessor_id, confirmed_level, rationale, narrative, assessed_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
        [member_id, u.skill_id, stage, assessor_id ?? null, u.confirmed_level, u.rationale ?? null, narrative ?? null, today]
      );
      // committee 단계 확정 시 최종 skill_profile 반영
      if (stage === "committee") {
        run(`UPDATE skill_profile SET current_level = ? WHERE member_id = ? AND skill_id = ?`, [
          u.confirmed_level,
          member_id,
          u.skill_id,
        ]);
      }
    }
  });
  tx();
  return NextResponse.json({ ok: true, saved: updates.length, date: today, stage });
}

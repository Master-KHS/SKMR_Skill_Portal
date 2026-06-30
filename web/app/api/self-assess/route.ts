// 자가 진단 — 구성원의 보유 Skill 레벨 조회/저장. 저장 시 로컬 DB에 영구 반영.
import { NextRequest, NextResponse } from "next/server";
import { query, run, getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProfileRow {
  skill_id: number;
  skill_name: string;
  sub_family_name: string;
  family_name: string;
  current_level: number;
  target_level: number | null;
  is_critical: number;
}

// GET ?member_id=EMP001 → 해당 구성원의 보유 Skill 목록
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id 필요" }, { status: 400 });
  const rows = query<ProfileRow>(
    `SELECT sp.skill_id, s.skill_name, sf.sub_family_name, f.family_name,
            sp.current_level, sp.target_level, s.is_critical
     FROM skill_profile sp
     JOIN skill s ON sp.skill_id = s.skill_id
     JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
     JOIN skill_family f ON sf.family_id = f.family_id
     WHERE sp.member_id = ?
     ORDER BY f.family_id, sf.sub_family_id, s.skill_id`,
    [memberId]
  );
  return NextResponse.json({ rows });
}

// POST {member_id, updates:[{skill_id, current_level}]} → 저장 (skill_profile 갱신 + assessment 이력)
export async function POST(req: NextRequest) {
  const { member_id, updates } = (await req.json()) as {
    member_id: string;
    updates: { skill_id: number; current_level: number }[];
  };
  if (!member_id || !Array.isArray(updates)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const db = getDb();
  const tx = db.transaction(() => {
    for (const u of updates) {
      run(
        `UPDATE skill_profile SET current_level = ?, last_assessed_date = ?
         WHERE member_id = ? AND skill_id = ?`,
        [u.current_level, today, member_id, u.skill_id]
      );
      run(
        `INSERT INTO assessment (member_id, skill_id, stage, assessor_id, proposed_level, assessed_date, status)
         VALUES (?, ?, 'self', ?, ?, ?, 'submitted')`,
        [member_id, u.skill_id, member_id, u.current_level, today]
      );
    }
  });
  tx();
  return NextResponse.json({ ok: true, saved: updates.length, date: today });
}

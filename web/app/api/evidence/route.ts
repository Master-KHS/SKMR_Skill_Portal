// Evidence(근거 자료) — (구성원, 스킬)별 등록/조회/삭제.
import { NextRequest, NextResponse } from "next/server";
import { query, run, getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("member_id");
  const skillId = req.nextUrl.searchParams.get("skill_id");
  if (!memberId || !skillId) return NextResponse.json({ error: "member_id, skill_id 필요" }, { status: 400 });
  const rows = query(
    `SELECT e.evidence_id, e.evidence_type, e.title, e.description, e.created_date
     FROM evidence e JOIN evidence_skill_link l ON e.evidence_id=l.evidence_id
     WHERE e.member_id=? AND l.skill_id=?
     ORDER BY e.evidence_id DESC`,
    [memberId, skillId]
  );
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const { member_id, skill_id, evidence_type, title, description } = await req.json();
  if (!member_id || !skill_id || !title?.trim()) {
    return NextResponse.json({ error: "member_id, skill_id, title 필수" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const db = getDb();
  const info = db.prepare(
    `INSERT INTO evidence (member_id, evidence_type, title, description, created_date) VALUES (?,?,?,?,?)`
  ).run(member_id, evidence_type ?? "project", title.trim(), description?.trim() ?? null, today);
  run(`INSERT OR IGNORE INTO evidence_skill_link (evidence_id, skill_id) VALUES (?,?)`, [Number(info.lastInsertRowid), skill_id]);
  return NextResponse.json({ ok: true, evidence_id: Number(info.lastInsertRowid) });
}

export async function DELETE(req: NextRequest) {
  const evidenceId = req.nextUrl.searchParams.get("evidence_id");
  if (!evidenceId) return NextResponse.json({ error: "evidence_id 필요" }, { status: 400 });
  run(`DELETE FROM evidence_skill_link WHERE evidence_id=?`, [evidenceId]);
  run(`DELETE FROM evidence WHERE evidence_id=?`, [evidenceId]);
  return NextResponse.json({ ok: true });
}

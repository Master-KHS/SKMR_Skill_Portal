// Narrative 작성 — Calibration~Committee 사이 의결 자료. 구성원별 최신 narrative 조회/저장.
import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id 필요" }, { status: 400 });
  const rows = query<{ narrative: string; assessed_date: string }>(
    `SELECT narrative, assessed_date FROM assessment
     WHERE member_id = ? AND stage = 'narrative' AND narrative IS NOT NULL
     ORDER BY assessment_id DESC LIMIT 1`,
    [memberId]
  );
  return NextResponse.json({ narrative: rows[0]?.narrative ?? "", date: rows[0]?.assessed_date ?? null });
}

export async function POST(req: NextRequest) {
  const { member_id, narrative } = (await req.json()) as { member_id: string; narrative: string };
  if (!member_id) return NextResponse.json({ error: "member_id 필요" }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  run(
    `INSERT INTO assessment (member_id, stage, narrative, assessed_date, status)
     VALUES (?, 'narrative', ?, ?, 'submitted')`,
    [member_id, narrative, today]
  );
  return NextResponse.json({ ok: true, date: today });
}

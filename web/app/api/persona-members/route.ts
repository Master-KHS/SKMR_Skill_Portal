// 페르소나(권한)에 매핑된 구성원 목록 — app/permissions.py get_members_for_persona() 이식.
// 2단 페르소나 선택(권한→사람)의 2단계에서 사용.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const persona = req.nextUrl.searchParams.get("persona");
  if (!persona) return NextResponse.json({ members: [] });
  const members = query(
    `SELECT employee_id, name, team, division, role_level, position
     FROM member WHERE persona_role = ? ORDER BY employee_id`,
    [persona]
  );
  return NextResponse.json({ members });
}

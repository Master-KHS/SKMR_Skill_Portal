// 구성원 Master Data API — data/members.xlsx 가 Single Source of Truth.
// GET: 엑셀을 읽어 반환 (+ DB 동기화, 외부에서 엑셀을 직접 고쳤어도 반영되도록).
// POST: 화면에서 편집한 목록을 엑셀에 저장 + DB에 동기화.
import { NextRequest, NextResponse } from "next/server";
import { readMembersFromXlsx, writeMembersToXlsx } from "@/lib/members-xlsx";
import { syncMembersToDb } from "@/lib/db";
import type { Member } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const members = readMembersFromXlsx();
  if (members.length) syncMembersToDb(members);
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const { members } = (await req.json()) as { members: Partial<Member>[] };
  if (!Array.isArray(members)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  for (const m of members) {
    if (!m.employee_id?.trim() || !m.name?.trim()) {
      return NextResponse.json({ error: "사번과 이름은 필수입니다." }, { status: 400 });
    }
  }
  const full = members.map((m) => ({ extra_attrs: null, ...m })) as Member[];
  writeMembersToXlsx(full);
  syncMembersToDb(full);
  return NextResponse.json({ ok: true, saved: full.length });
}

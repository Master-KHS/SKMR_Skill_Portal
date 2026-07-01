// 구성원 Master Data — 조회/편집(추가·수정·삭제) 저장. DB 영구 반영.
import { NextRequest, NextResponse } from "next/server";
import { query, run, tx } from "@/lib/db";
import type { Member } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const members = query<Member>("SELECT * FROM member ORDER BY employee_id");
  return NextResponse.json({ members });
}

// POST {members:[...]} — 전체 목록 저장(upsert + 제거된 인원 삭제).
export async function POST(req: NextRequest) {
  const { members } = (await req.json()) as { members: Partial<Member>[] };
  if (!Array.isArray(members)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  // 필수 검증
  for (const m of members) {
    if (!m.employee_id?.trim() || !m.name?.trim()) {
      return NextResponse.json({ error: "사번과 이름은 필수입니다." }, { status: 400 });
    }
  }
  const keepIds = new Set(members.map((m) => m.employee_id));
  const existing = query<{ employee_id: string }>("SELECT employee_id FROM member").map((r) => r.employee_id);

  tx(() => {
    // 제거된 인원 삭제
    for (const id of existing) {
      if (!keepIds.has(id)) run("DELETE FROM member WHERE employee_id=?", [id]);
    }
    // upsert
    for (const m of members) {
      run(
        `INSERT INTO member (employee_id, name, corporation, division, team, role_level, position, job_type, persona_role, extra_attrs)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(employee_id) DO UPDATE SET
           name=excluded.name, corporation=excluded.corporation, division=excluded.division,
           team=excluded.team, role_level=excluded.role_level, position=excluded.position,
           job_type=excluded.job_type, persona_role=excluded.persona_role`,
        [
          m.employee_id, m.name, m.corporation ?? null, m.division ?? null, m.team ?? null,
          m.role_level ?? null, m.position ?? null, m.job_type ?? null, m.persona_role ?? null, m.extra_attrs ?? null,
        ]
      );
    }
  });
  return NextResponse.json({ ok: true, saved: members.length });
}

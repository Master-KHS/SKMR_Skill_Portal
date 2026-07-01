// 샘플 인원 대량 생성 — 목표 인원수까지 가상 구성원 + 스킬 프로필을 자동 생성.
// 기존 인원은 유지하고 부족분만 추가. 대시보드/검색/AI가 대규모 데이터로 동작하게 함.
import { NextRequest, NextResponse } from "next/server";
import { query, run, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SURNAMES = "김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노정하곽성차주우구민".split("");
const GIVEN = "서준하윤도현지민예은수아지호시우하은주원은우유진성민현우예린지우다은시윤건우민재하준지아윤서연호정우재훈세림가람도윤채원".split("");

function randName(): string {
  const s = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
  const g1 = GIVEN[Math.floor(Math.random() * GIVEN.length)];
  const g2 = GIVEN[Math.floor(Math.random() * GIVEN.length)];
  return s + g1 + g2;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function weightedLevel(): number {
  const r = Math.random();
  if (r < 0.3) return 1;
  if (r < 0.65) return 2;
  if (r < 0.9) return 3;
  return 4;
}

export async function POST(req: NextRequest) {
  const { target } = (await req.json()) as { target?: number };
  const goal = Math.min(Math.max(target ?? 300, 1), 2000);

  // 조직 풀: 기존 데이터에서 (담당,팀) 조합 수집
  const orgPairs = query<{ division: string; team: string }>(
    `SELECT DISTINCT division, team FROM member
     WHERE job_type IN ('사무직','기술직','연구직') AND team IS NOT NULL AND division IS NOT NULL`
  );
  const jobByTeam = new Map<string, string>();
  for (const r of query<{ team: string; job_type: string }>(
    `SELECT team, job_type FROM member WHERE team IS NOT NULL GROUP BY team`
  )) jobByTeam.set(r.team, r.job_type);

  const skillIds = query<{ skill_id: number }>(`SELECT skill_id FROM skill`).map((r) => r.skill_id);
  const current = (query<{ c: number }>(`SELECT COUNT(*) c FROM member`)[0]?.c) ?? 0;
  const toAdd = Math.max(goal - current, 0);
  if (toAdd === 0) {
    return NextResponse.json({ ok: true, added: 0, total: current, message: "이미 목표 인원 이상입니다." });
  }

  // 사번 시작 번호
  const maxNum =
    (query<{ m: number }>(`SELECT MAX(CAST(substr(employee_id,2) AS INTEGER)) m FROM member WHERE employee_id LIKE 'G%'`)[0]?.m) ?? 0;

  const RL = ["L2", "L3", "L3", "L4", "L4", "L5"];
  const today = new Date().toISOString().slice(0, 10);

  tx(() => {
    for (let i = 0; i < toAdd; i++) {
      const id = `G${String(maxNum + i + 1).padStart(4, "0")}`;
      const org = orgPairs.length ? pick(orgPairs) : { division: "R&D담당", team: "소재개발팀" };
      const job = jobByTeam.get(org.team) ?? pick(["사무직", "기술직", "연구직"]);
      run(
        `INSERT INTO member (employee_id, name, corporation, division, team, role_level, position, job_type, persona_role, extra_attrs)
         VALUES (?,?,?,?,?,?,?,?, 'employee', NULL)`,
        [id, randName(), "SK머티리얼즈", org.division, org.team, pick(RL), "팀원", job]
      );
      // 스킬 프로필 8~16개
      const n = 8 + Math.floor(Math.random() * 9);
      const shuffled = [...skillIds].sort(() => Math.random() - 0.5).slice(0, n);
      for (const sid of shuffled) {
        const cur = weightedLevel();
        const tgt = Math.min(cur + (Math.random() < 0.5 ? 1 : 0), 4);
        run(
          `INSERT OR IGNORE INTO skill_profile (member_id, skill_id, current_level, target_level, last_assessed_date)
           VALUES (?,?,?,?,?)`,
          [id, sid, cur, tgt, today]
        );
      }
    }
  });

  const total = (query<{ c: number }>(`SELECT COUNT(*) c FROM member`)[0]?.c) ?? 0;
  return NextResponse.json({ ok: true, added: toAdd, total });
}

// 생성된 샘플(G로 시작) 전체 삭제 — 원복용
export async function DELETE() {
  tx(() => {
    const ids = query<{ employee_id: string }>(`SELECT employee_id FROM member WHERE employee_id LIKE 'G%'`).map((r) => r.employee_id);
    for (const id of ids) {
      run(`DELETE FROM skill_profile WHERE member_id=?`, [id]);
      run(`DELETE FROM assessment WHERE member_id=?`, [id]);
      run(`DELETE FROM member WHERE employee_id=?`, [id]);
    }
  });
  const total = (query<{ c: number }>(`SELECT COUNT(*) c FROM member`)[0]?.c) ?? 0;
  return NextResponse.json({ ok: true, total });
}

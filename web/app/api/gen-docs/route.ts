// 챗봇 추천 근거용 더미 문서 생성 — 직무기술서(member_doc) + 발령이력(appointment) + 참고문서(reference_doc).
import { NextResponse } from "next/server";
import { query, run, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLE_BY_JOB: Record<string, string[]> = {
  사무직: ["기획", "운영관리", "구매", "품질기획", "HR"],
  기술직: ["공정엔지니어", "설비엔지니어", "생산기술", "품질기술"],
  연구직: ["소재연구", "분석연구", "공정개발", "평가연구"],
};

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

export async function POST() {
  const members = query<{ employee_id: string; name: string; team: string; division: string; job_type: string; role_level: string }>(
    `SELECT employee_id, name, team, division, job_type, role_level FROM member WHERE job_type IN ('사무직','기술직','연구직')`
  );
  const topSkills = new Map<string, string[]>();
  for (const r of query<{ member_id: string; skill_name: string }>(
    `SELECT sp.member_id, s.skill_name FROM skill_profile sp JOIN skill s ON sp.skill_id=s.skill_id
     WHERE sp.current_level >= 3 ORDER BY sp.current_level DESC`
  )) {
    const arr = topSkills.get(r.member_id) ?? [];
    if (arr.length < 4) { arr.push(r.skill_name); topSkills.set(r.member_id, arr); }
  }

  tx(() => {
    run(`DELETE FROM member_doc`);
    run(`DELETE FROM appointment`);
    run(`DELETE FROM reference_doc`);
    for (const m of members) {
      const role = pick(ROLE_BY_JOB[m.job_type] ?? ["담당"]);
      const skills = topSkills.get(m.employee_id) ?? [];
      const summary = `${m.division} ${m.team} 소속 ${role}. ${m.role_level} 레벨로 ${m.job_type} 직무 수행. ` +
        (skills.length ? `주요 강점 스킬: ${skills.join(", ")}.` : "보유 스킬 진단 진행 중.");
      const resp = `${m.team}의 ${role} 업무를 담당하며, 관련 공정/과제의 실행과 개선을 수행.`;
      run(`INSERT INTO member_doc (member_id, job_title, summary, responsibilities) VALUES (?,?,?,?)`,
        [m.employee_id, role, summary, resp]);
      // 발령 이력 1~3건
      const nAppt = 1 + Math.floor(Math.random() * 3);
      let year = 2019 + Math.floor(Math.random() * 3);
      let prevTeam = "신입배치";
      for (let i = 0; i < nAppt; i++) {
        run(`INSERT INTO appointment (member_id, appt_date, from_team, to_team, role, note) VALUES (?,?,?,?,?,?)`,
          [m.employee_id, `${year}-0${1 + Math.floor(Math.random() * 9)}-01`, prevTeam, m.team, role, i === nAppt - 1 ? "현재 보직" : "직무 이동"]);
        prevTeam = m.team;
        year += 1 + Math.floor(Math.random() * 2);
      }
    }
    const refs = [
      ["Skill 평가 제도 안내", "제도", "Skill 진단은 자가→리더→Calibration→Committee 4단계로 확정되며, Level은 L1~L4(전문성·영향력 2축)로 판정합니다."],
      ["Level 판정 기준", "제도", "L1 표준절차 수행, L2 독립수행, L3 비정형 응용·코칭, L4 프레임 설계·전사 리드."],
      ["추천 스킬 원칙", "가이드", "추천은 현재 직무·발령이력·보유스킬을 근거로 부족 스킬 3~5개를 제시하며, 경력기술서/KPI 미반영 상태의 1차 추천임을 명시합니다."],
    ];
    for (const [title, cat, content] of refs) run(`INSERT INTO reference_doc (title, category, content) VALUES (?,?,?)`, [title, cat, content]);
  });

  return NextResponse.json({
    ok: true,
    member_docs: members.length,
    appointments: (query<{ c: number }>(`SELECT COUNT(*) c FROM appointment`)[0]?.c) ?? 0,
    reference_docs: 3,
  });
}

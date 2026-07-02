const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "web", "data", "skmr.db");
const db = new DatabaseSync(DB_PATH);
const today = new Date().toISOString().slice(0, 10);

const keySkillLevels = {
  EMP018: {
    name: "임가영",
    note: "Photo Resist/Litho 평가 시연 핵심 인력",
    skills: [
      [120, 2.9], // Photo 공정 평가 운영
      [12, 2.8], // Application CTQ 평가 Protocol 정의
      [22, 2.7], // 시험법 설계
      [24, 2.7], // DoE 기반 최적화
      [33, 2.8], // 소재 QC 분석법 설정
      [37, 2.6], // 품질 분석 최적조건 설계
      [56, 2.7], // 소재 분석·검증
      [63, 2.8], // 성능 평가 결과 분석/해석
      [64, 2.6], // 공정 Simulation
      [73, 2.7], // 측정 시스템 분석(MSA)
      [131, 2.6], // 데이터 분석
    ],
  },
  G0043: {
    name: "김선재",
    note: "OLED Blue Dopant/TADF 시연 핵심 인력",
    skills: [
      [5, 2.9], // 유기 반도체 소재/소자 특성 이해
      [28, 2.9], // OLED 소재 분자 설계
      [29, 2.8], // 분자 설계 Parameter Targeting
      [30, 2.8], // 합성 Recipe 도출·실행
      [31, 2.8], // 승화 정제 조건 최적화
      [32, 2.9], // OLED 소재 설계·제작
      [56, 2.8], // 소재 분석·검증
      [58, 2.8], // IP 기반 경쟁사 기술 분석 및 FTO 리스크 평가
      [60, 2.8], // 구조 분석 Simulation
      [61, 2.9], // OLED 소자 측정·분석
      [63, 2.8], // 성능 평가 결과 분석/해석
      [131, 2.7], // 데이터 분석
    ],
  },
};

const upsertProfile = db.prepare(`
  INSERT INTO skill_profile (member_id, skill_id, current_level, target_level, last_assessed_date)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(member_id, skill_id) DO UPDATE SET
    current_level = excluded.current_level,
    target_level = excluded.target_level,
    last_assessed_date = excluded.last_assessed_date
`);

const insertAssessment = db.prepare(`
  INSERT INTO assessment
    (member_id, skill_id, stage, assessor_id, proposed_level, confirmed_level, rationale, assessed_date, status, narrative)
  VALUES (?, ?, 'committee', 'EXE001', ?, ?, ?, ?, 'confirmed', ?)
`);

db.exec("BEGIN");
try {
  for (const [memberId, config] of Object.entries(keySkillLevels)) {
    for (const [skillId, level] of config.skills) {
      upsertProfile.run(memberId, skillId, level, level, today);
      insertAssessment.run(
        memberId,
        skillId,
        level,
        level,
        `${config.name} 시연 핵심 인력 Skill Level 보정: ${config.note}`,
        today,
        `${config.name} 후보는 ${config.note}으로 내부 과제/학력/직무 근거와 일치하여 동 R/L 대비 약간 높은 수준으로 확정한 데모 평가입니다.`
      );
    }
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

for (const memberId of Object.keys(keySkillLevels)) {
  const rows = db.prepare(`
    SELECT m.name, s.skill_id, s.skill_name, sp.current_level, sp.target_level
      FROM skill_profile sp
      JOIN skill s ON s.skill_id = sp.skill_id
      JOIN member m ON m.employee_id = sp.member_id
     WHERE sp.member_id = ?
     ORDER BY sp.current_level DESC, s.skill_id
     LIMIT 15
  `).all(memberId);
  console.log(memberId, rows);
}

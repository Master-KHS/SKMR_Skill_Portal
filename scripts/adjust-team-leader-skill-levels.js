const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "web", "data", "skmr.db");
const db = new DatabaseSync(DB_PATH);

const leaders = db
  .prepare(
    `SELECT employee_id, name
       FROM member
      WHERE position = '팀장'
         OR persona_role = 'team_leader'
      ORDER BY employee_id`
  )
  .all();

const profiles = db.prepare("SELECT skill_id FROM skill_profile WHERE member_id = ? ORDER BY skill_id");
const updateProfile = db.prepare(
  `UPDATE skill_profile
      SET current_level = ?
    WHERE member_id = ?
      AND skill_id = ?`
);
const updateAssessments = db.prepare(
  `UPDATE assessment
      SET proposed_level = CASE WHEN proposed_level IS NULL THEN NULL ELSE ? END,
          confirmed_level = CASE WHEN confirmed_level IS NULL THEN NULL ELSE ? END
    WHERE member_id = ?
      AND skill_id = ?`
);

function leaderLevel(name, memberId, skillId) {
  if (name === "정현수") return 3.0;
  const bucket = (String(memberId).split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) + skillId) % 6;
  return Math.round((2.5 + bucket * 0.1) * 10) / 10;
}

let updated = 0;
db.exec("BEGIN");
try {
  for (const leader of leaders) {
    for (const profile of profiles.all(leader.employee_id)) {
      const level = leaderLevel(leader.name, leader.employee_id, profile.skill_id);
      updateProfile.run(level, leader.employee_id, profile.skill_id);
      updateAssessments.run(level, level, leader.employee_id, profile.skill_id);
      updated += 1;
    }
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

const summary = db
  .prepare(
    `SELECT m.employee_id, m.name, m.team,
            ROUND(AVG(sp.current_level), 2) AS avg_level,
            MIN(sp.current_level) AS min_level,
            MAX(sp.current_level) AS max_level,
            COUNT(*) AS skills
       FROM member m
       JOIN skill_profile sp ON sp.member_id = m.employee_id
      WHERE m.position = '팀장'
         OR m.persona_role = 'team_leader'
      GROUP BY m.employee_id
      ORDER BY m.team, m.name`
  )
  .all();

console.log({ updated, summary });

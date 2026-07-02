const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "web", "data", "skmr.db");
const MAX_EXTRA_SKILLS = 5;

const db = new DatabaseSync(DB_PATH);

const members = db.prepare("SELECT employee_id, team FROM member ORDER BY employee_id").all();
const requiredStmt = db.prepare(`
  SELECT skill_id
    FROM required_skill
   WHERE status = 'approved'
     AND (
       (org_or_individual = 'company' AND target_id = 'ALL')
       OR (org_or_individual = 'department' AND target_id = ?)
       OR (org_or_individual = 'individual' AND target_id = ?)
     )
   GROUP BY skill_id
`);
const profileStmt = db.prepare(`
  SELECT skill_id, current_level
    FROM skill_profile
   WHERE member_id = ?
   ORDER BY current_level DESC, skill_id
`);
const deleteProfile = db.prepare("DELETE FROM skill_profile WHERE member_id = ? AND skill_id = ?");
const deleteAssessment = db.prepare("DELETE FROM assessment WHERE member_id = ? AND skill_id = ?");

let deleted = 0;
db.exec("BEGIN");
try {
  for (const member of members) {
    const required = new Set(requiredStmt.all(member.team ?? "", member.employee_id).map((row) => row.skill_id));
    const extras = profileStmt.all(member.employee_id).filter((row) => !required.has(row.skill_id));
    for (const row of extras.slice(MAX_EXTRA_SKILLS)) {
      deleteAssessment.run(member.employee_id, row.skill_id);
      deleteProfile.run(member.employee_id, row.skill_id);
      deleted += 1;
    }
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

console.log(`Deleted ${deleted} extra personal skill_profile rows. Max extra per member: ${MAX_EXTRA_SKILLS}.`);

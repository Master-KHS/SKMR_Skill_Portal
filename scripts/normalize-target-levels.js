const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "web", "data", "skmr.db");
const db = new DatabaseSync(DB_PATH);

function half(level) {
  return Math.max(1, Math.min(4, Math.round(Number(level || 0) * 2) / 2));
}

const required = db.prepare("SELECT org_or_individual, target_id, skill_id, target_level FROM required_skill").all();
const profiles = db.prepare("SELECT member_id, skill_id, target_level FROM skill_profile WHERE target_level IS NOT NULL").all();
const updateRequired = db.prepare(
  `UPDATE required_skill
      SET target_level = ?
    WHERE org_or_individual = ?
      AND target_id = ?
      AND skill_id = ?`
);
const updateProfile = db.prepare(
  `UPDATE skill_profile
      SET target_level = ?
    WHERE member_id = ?
      AND skill_id = ?`
);

let requiredChanged = 0;
let profileChanged = 0;

db.exec("BEGIN");
try {
  for (const row of required) {
    const next = half(row.target_level);
    if (next !== row.target_level) {
      updateRequired.run(next, row.org_or_individual, row.target_id, row.skill_id);
      requiredChanged += 1;
    }
  }
  for (const row of profiles) {
    const next = half(row.target_level);
    if (next !== row.target_level) {
      updateProfile.run(next, row.member_id, row.skill_id);
      profileChanged += 1;
    }
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

console.log({ requiredChanged, profileChanged });

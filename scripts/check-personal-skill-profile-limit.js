const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "web", "data", "skmr.db");
const db = new DatabaseSync(DB_PATH);

const topCounts = db
  .prepare(`
    SELECT m.employee_id, m.name, m.team, COUNT(sp.skill_id) n
      FROM member m
      JOIN skill_profile sp ON sp.member_id = m.employee_id
     GROUP BY m.employee_id
     ORDER BY n DESC
     LIMIT 12
  `)
  .all();

const overLimit = db
  .prepare(`
    WITH profile_scope AS (
      SELECT m.employee_id,
             sp.skill_id,
             CASE WHEN EXISTS (
               SELECT 1
                 FROM required_skill r
                WHERE r.status = 'approved'
                  AND r.skill_id = sp.skill_id
                  AND (
                    (r.org_or_individual = 'company' AND r.target_id = 'ALL')
                    OR (r.org_or_individual = 'department' AND r.target_id = m.team)
                    OR (r.org_or_individual = 'individual' AND r.target_id = m.employee_id)
                  )
             ) THEN 1 ELSE 0 END AS is_required
        FROM member m
        JOIN skill_profile sp ON sp.member_id = m.employee_id
    )
    SELECT employee_id,
           SUM(CASE WHEN is_required = 0 THEN 1 ELSE 0 END) AS extra
      FROM profile_scope
     GROUP BY employee_id
    HAVING extra > 5
     ORDER BY extra DESC
  `)
  .all();

console.log({ topCounts, overLimit });

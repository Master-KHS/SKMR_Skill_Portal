// 로컬 SQLite 데이터 레이어 (서버 전용) — Node 내장 node:sqlite 사용(네이티브 빌드 불필요).
// 최초 실행 시 web/data/skmr.db 를 생성하고 seed.json 으로 시드.
// 이후 입력/수정은 이 .db 파일에 영구 저장됨 (Streamlit 로컬 SQLite와 동일).
// 요구 Node: 24+ (node:sqlite 기본 활성). Node 22 사용 시 --experimental-sqlite 필요.
import path from "path";
import fs from "fs";
import seed from "@/data/seed.json";
// node:sqlite 타입이 없을 수 있어 느슨하게 로드
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (p: string) => SqliteDb;
};

interface SqliteStmt {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}
interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStmt;
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "skmr.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS skill_family (
  family_id TEXT PRIMARY KEY, family_name TEXT NOT NULL, description TEXT
);
CREATE TABLE IF NOT EXISTS sub_skill_family (
  sub_family_id TEXT PRIMARY KEY, family_id TEXT NOT NULL, sub_family_name TEXT NOT NULL, description TEXT
);
CREATE TABLE IF NOT EXISTS skill (
  skill_id INTEGER PRIMARY KEY, sub_family_id TEXT NOT NULL, skill_name TEXT NOT NULL,
  description TEXT, is_critical INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS level_criteria (
  sub_family_id TEXT, level INTEGER, expertise_criteria TEXT, impact_criteria TEXT,
  PRIMARY KEY (sub_family_id, level)
);
CREATE TABLE IF NOT EXISTS member (
  employee_id TEXT PRIMARY KEY, name TEXT NOT NULL, corporation TEXT, division TEXT,
  team TEXT, role_level TEXT, position TEXT, job_type TEXT, persona_role TEXT, extra_attrs TEXT
);
CREATE TABLE IF NOT EXISTS required_skill (
  org_or_individual TEXT, target_id TEXT, skill_id INTEGER, target_level INTEGER,
  is_core INTEGER DEFAULT 0, status TEXT DEFAULT 'approved',
  PRIMARY KEY (org_or_individual, target_id, skill_id)
);
CREATE TABLE IF NOT EXISTS skill_profile (
  member_id TEXT, skill_id INTEGER, current_level INTEGER, target_level INTEGER,
  last_assessed_date TEXT, PRIMARY KEY (member_id, skill_id)
);
CREATE TABLE IF NOT EXISTS assessment (
  assessment_id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT, skill_id INTEGER,
  stage TEXT, assessor_id TEXT, proposed_level INTEGER, confirmed_level INTEGER,
  rationale TEXT, assessed_date TEXT, status TEXT, narrative TEXT
);
CREATE TABLE IF NOT EXISTS evidence (
  evidence_id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT, evidence_type TEXT,
  title TEXT, description TEXT, file_path TEXT, created_date TEXT
);
CREATE TABLE IF NOT EXISTS evidence_skill_link (
  evidence_id INTEGER, skill_id INTEGER, PRIMARY KEY (evidence_id, skill_id)
);
`;

type Row = Record<string, unknown>;
let _db: SqliteDb | null = null;

function seedTable(db: SqliteDb, table: string, rows: Row[]) {
  if (!rows?.length) return;
  const existing = db.prepare(`SELECT COUNT(*) c FROM ${table}`).get() as { c: number };
  if (existing.c > 0) return;
  const cols = Object.keys(rows[0]);
  const placeholders = cols.map(() => "?").join(",");
  const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`);
  db.exec("BEGIN");
  try {
    for (const r of rows) stmt.run(...cols.map((c) => r[c] ?? null));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function getDb(): SqliteDb {
  if (_db) return _db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);

  const s = seed as unknown as Record<string, Row[]>;
  seedTable(db, "skill_family", s.skill_family);
  seedTable(db, "sub_skill_family", s.sub_skill_family);
  seedTable(db, "skill", s.skill);
  seedTable(db, "level_criteria", s.level_criteria);
  seedTable(db, "member", s.member);
  seedTable(db, "required_skill", s.required_skill);
  seedTable(db, "skill_profile", s.skill_profile);
  seedTable(db, "evidence", s.evidence);
  seedTable(db, "evidence_skill_link", s.evidence_skill_link);

  _db = db;
  return db;
}

export function query<T = Row>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function run(sql: string, params: unknown[] = []) {
  return getDb().prepare(sql).run(...params);
}

// 트랜잭션 헬퍼 (node:sqlite에는 db.transaction이 없어 BEGIN/COMMIT로 구현).
export function tx(fn: () => void) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    fn();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// 로컬 SQLite 데이터 레이어 (서버 전용) — Node 내장 node:sqlite 사용(네이티브 빌드 불필요).
// 최초 실행 시 web/data/skmr.db 를 생성하고 seed.json 으로 시드.
// 이후 입력/수정은 이 .db 파일에 영구 저장됨 (Streamlit 로컬 SQLite와 동일).
// 요구 Node: 24+ (node:sqlite 기본 활성). Node 22 사용 시 --experimental-sqlite 필요.
import path from "path";
import fs from "fs";
import seed from "@/data/seed.json";
import { readMembersFromXlsx, membersXlsxExists } from "./members-xlsx";
import type { Member } from "./types";
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
-- 발령 이력 (SKILL 챗봇 추천 근거)
CREATE TABLE IF NOT EXISTS appointment (
  appt_id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT, appt_date TEXT,
  from_team TEXT, to_team TEXT, role TEXT, note TEXT
);
-- 인재별 직무기술/경력요약 문서 (비정형, RAG 근거)
CREATE TABLE IF NOT EXISTS member_doc (
  member_id TEXT PRIMARY KEY, job_title TEXT, summary TEXT, responsibilities TEXT
);
-- 시스템 참고 문서 (제도/평가 맥락 등, RAG 근거)
CREATE TABLE IF NOT EXISTS reference_doc (
  doc_id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, category TEXT, content TEXT
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

  // data/members.xlsx 가 원본(SSOT) — 있으면 부팅 시 1회 DB에 반영.
  if (membersXlsxExists()) {
    try {
      applyMembersToDb(db, readMembersFromXlsx());
    } catch {
      // 엑셀 읽기 실패 시 조용히 무시 (기존 DB 유지)
    }
  }

  _db = db;
  return db;
}

// member 테이블을 주어진 Member[] 로 교체(upsert + 목록에 없는 인원 삭제).
// 엑셀이 정제된 원본이라는 전제 하에 값 자체를 임의 보정하지 않음(있는 그대로 반영).
function applyMembersToDb(db: SqliteDb, members: Member[]) {
  if (!members.length) return;
  const keepIds = new Set(members.map((m) => m.employee_id));
  const existing = (db.prepare("SELECT employee_id FROM member").all() as { employee_id: string }[]).map(
    (r) => r.employee_id
  );

  db.exec("BEGIN");
  try {
    for (const id of existing) {
      if (!keepIds.has(id)) db.prepare("DELETE FROM member WHERE employee_id=?").run(id);
    }
    const ins = db.prepare(
      `INSERT INTO member (employee_id, name, corporation, division, team, role_level, position, job_type, persona_role, extra_attrs)
       VALUES (?,?,?,?,?,?,?,?,?,NULL)
       ON CONFLICT(employee_id) DO UPDATE SET
         name=excluded.name, corporation=excluded.corporation, division=excluded.division,
         team=excluded.team, role_level=excluded.role_level, position=excluded.position,
         job_type=excluded.job_type, persona_role=excluded.persona_role`
    );
    for (const m of members) {
      ins.run(
        m.employee_id, m.name, m.corporation ?? null, m.division ?? null, m.team ?? null,
        m.role_level ?? null, m.position ?? null, m.job_type ?? null, m.persona_role ?? null
      );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  // 프로필이 아직 없는 신규 구성원에만 데모용 스킬 프로필을 부여(평가대상 직종만).
  // 이름/사번 등 원본 필드는 건드리지 않음 — 스킬 진단 시스템이 바로 동작하게 하기 위한 보강일 뿐.
  const skillIds = (db.prepare("SELECT skill_id FROM skill").all() as { skill_id: number }[]).map((r) => r.skill_id);
  const today = new Date().toISOString().slice(0, 10);
  const need = db.prepare(
    `SELECT employee_id FROM member m
     WHERE m.job_type IN ('사무직','기술직','연구직')
       AND NOT EXISTS (SELECT 1 FROM skill_profile sp WHERE sp.member_id=m.employee_id)`
  ).all() as { employee_id: string }[];
  if (need.length && skillIds.length) {
    db.exec("BEGIN");
    try {
      const insP = db.prepare(
        `INSERT OR IGNORE INTO skill_profile (member_id, skill_id, current_level, target_level, last_assessed_date) VALUES (?,?,?,?,?)`
      );
      for (const { employee_id } of need) {
        const n = 8 + Math.floor(Math.random() * 9);
        const shuffled = [...skillIds].sort(() => Math.random() - 0.5).slice(0, n);
        for (const sid of shuffled) {
          const r = Math.random();
          const cur = r < 0.3 ? 1 : r < 0.65 ? 2 : r < 0.9 ? 3 : 4;
          insP.run(employee_id, sid, cur, Math.min(cur + (Math.random() < 0.5 ? 1 : 0), 4), today);
        }
      }
      db.exec("COMMIT");
    } catch {
      db.exec("ROLLBACK");
    }
  }
}

// API 라우트 등 외부에서 "이 목록을 DB에 반영" 하고 싶을 때 쓰는 공개 함수.
export function syncMembersToDb(members: Member[]) {
  applyMembersToDb(getDb(), members);
}

export function query<T = Row>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function run(sql: string, params: unknown[] = []) {
  return getDb().prepare(sql).run(...params);
}

// 전체 데이터를 시드 상태로 초기화 (Admin DB 리셋).
export function resetToSeed() {
  const db = getDb();
  const tables = [
    "evidence_skill_link", "evidence", "assessment", "skill_profile",
    "required_skill", "member", "level_criteria", "skill", "sub_skill_family", "skill_family",
  ];
  db.exec("BEGIN");
  try {
    for (const t of tables) db.exec(`DELETE FROM ${t}`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
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

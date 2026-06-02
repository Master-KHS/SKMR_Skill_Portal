# DB 테이블 정의 - 9개 핵심 테이블의 CREATE 문을 한 곳에 모아 최초 실행 시 자동 생성.
# 스키마 변경 시 이 파일만 수정하면 됨 (개발 단계에서는 data/skmr.db 지우고 재생성 권장).
from db import get_connection

# 3.1 핵심 테이블 - 사양서에 정의된 스키마를 그대로 코드화
SCHEMA_SQL = """
-- 스킬 대분류 (전문지식 / 업무기술)
CREATE TABLE IF NOT EXISTS skill_family (
    family_id    TEXT PRIMARY KEY,
    family_name  TEXT NOT NULL,
    description  TEXT
);

-- 스킬 중분류 (Domain / Planning / Design / Analysis / ...)
CREATE TABLE IF NOT EXISTS sub_skill_family (
    sub_family_id   TEXT PRIMARY KEY,
    family_id       TEXT NOT NULL,
    sub_family_name TEXT NOT NULL,
    description     TEXT,
    FOREIGN KEY (family_id) REFERENCES skill_family(family_id)
);

-- 개별 스킬 (130개)
CREATE TABLE IF NOT EXISTS skill (
    skill_id      INTEGER PRIMARY KEY,
    sub_family_id TEXT NOT NULL,
    skill_name    TEXT NOT NULL,
    description   TEXT,
    is_critical   INTEGER DEFAULT 0,
    FOREIGN KEY (sub_family_id) REFERENCES sub_skill_family(sub_family_id)
);

-- Sub-family별 L1~L4 기준 (전문성·영향력 2축)
CREATE TABLE IF NOT EXISTS level_criteria (
    sub_family_id       TEXT,
    level               INTEGER,
    expertise_criteria  TEXT,
    impact_criteria     TEXT,
    PRIMARY KEY (sub_family_id, level),
    FOREIGN KEY (sub_family_id) REFERENCES sub_skill_family(sub_family_id)
);

-- 구성원 마스터 (HRIS 대체. 엑셀 = Single Source of Truth)
CREATE TABLE IF NOT EXISTS member (
    employee_id   TEXT PRIMARY KEY,    -- 사번
    name          TEXT NOT NULL,
    corporation   TEXT,                -- 법인
    division      TEXT,                -- 담당
    team          TEXT,                -- 팀
    role_level    TEXT,                -- R/L: L6(팀장)/L5/L4/L3/L2
    position      TEXT,                -- 직책: 팀장/팀원
    job_type      TEXT,                -- 직종: 사무직/기술직/연구직/경영(비평가)
    persona_role  TEXT,                -- 페르소나 매핑: 'employee'/'team_leader'/'calibration'/'committee'/'hr_admin'/'hr_viewer'/'executive'
    extra_attrs   TEXT                 -- JSON 문자열. 엑셀에 추가된 임의 컬럼 보관
);

-- 요구 스킬 (전사·조직·개인 단위)
-- status: 'approved'(기본·자동 활성) / 'pending'(개인 신청, 팀장 승인 대기)
CREATE TABLE IF NOT EXISTS required_skill (
    org_or_individual TEXT,        -- 'company' / 'department' / 'individual'
    target_id         TEXT,        -- 회사='ALL' / 부서명 / member_id
    skill_id          INTEGER,
    target_level      INTEGER,
    is_core           INTEGER DEFAULT 0,
    status            TEXT    DEFAULT 'approved',  -- 'approved' / 'pending'
    PRIMARY KEY (org_or_individual, target_id, skill_id),
    FOREIGN KEY (skill_id) REFERENCES skill(skill_id)
);

-- 개인별 보유 Skill (자가 진단 결과 누적)
CREATE TABLE IF NOT EXISTS skill_profile (
    member_id          TEXT,
    skill_id           INTEGER,
    current_level      INTEGER,
    target_level       INTEGER,
    last_assessed_date DATE,
    PRIMARY KEY (member_id, skill_id),
    FOREIGN KEY (member_id) REFERENCES member(employee_id),
    FOREIGN KEY (skill_id)  REFERENCES skill(skill_id)
);

-- 평가 이력 (Self → Leader → Calibration → Committee 4단계)
CREATE TABLE IF NOT EXISTS assessment (
    assessment_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id        TEXT,
    skill_id         INTEGER,
    stage            TEXT,        -- 'self' / 'leader' / 'calibration' / 'committee'
    assessor_id      TEXT,
    proposed_level   INTEGER,
    confirmed_level  INTEGER,
    rationale        TEXT,
    assessed_date    DATE,
    status           TEXT,        -- 'draft' / 'submitted' / 'confirmed'
    FOREIGN KEY (member_id)   REFERENCES member(employee_id),
    FOREIGN KEY (skill_id)    REFERENCES skill(skill_id),
    FOREIGN KEY (assessor_id) REFERENCES member(employee_id)
);

-- 평가 근거 자료 (프로젝트/자격증/교육/산출물/특허 등)
CREATE TABLE IF NOT EXISTS evidence (
    evidence_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id     TEXT,
    evidence_type TEXT,            -- 'project' / 'certificate' / 'training' / 'output' / 'patent'
    title         TEXT,
    description   TEXT,
    file_path     TEXT,
    created_date  DATE,
    FOREIGN KEY (member_id) REFERENCES member(employee_id)
);

-- Evidence ↔ Skill 다대다 연결
CREATE TABLE IF NOT EXISTS evidence_skill_link (
    evidence_id INTEGER,
    skill_id    INTEGER,
    PRIMARY KEY (evidence_id, skill_id),
    FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id),
    FOREIGN KEY (skill_id)    REFERENCES skill(skill_id)
);
"""


def init_db() -> None:
    """DB가 없으면 생성하고 모든 테이블을 만든다. 이미 있으면 무해 (IF NOT EXISTS).
    스키마 변경 시 멱등 마이그레이션도 여기서 처리 (ALTER TABLE try-except)."""
    import sqlite3 as _sqlite3
    conn = get_connection()
    try:
        conn.executescript(SCHEMA_SQL)
        # 기존 DB에 status 컬럼이 없다면 추가 (멱등성 보장)
        try:
            conn.execute(
                "ALTER TABLE required_skill ADD COLUMN status TEXT DEFAULT 'approved'"
            )
        except _sqlite3.OperationalError:
            pass
        # assessment.narrative — Calibration → Committee 사이 작성하는 의결 자료
        try:
            conn.execute("ALTER TABLE assessment ADD COLUMN narrative TEXT")
        except _sqlite3.OperationalError:
            pass
        conn.commit()
    finally:
        conn.close()

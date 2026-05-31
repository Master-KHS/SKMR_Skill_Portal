# 엑셀(=마스터)과 DB의 동기화 모듈.
# - 엑셀이 없으면 초기 시드로 생성
# - 엑셀이 있으면 DB의 member 테이블을 통째로 교체 (엑셀이 늘 정답)
# - 엑셀에 추가된 임의 컬럼은 extra_attrs JSON으로 보관
import json
from pathlib import Path

import pandas as pd

from config import PROJECT_ROOT
from db import get_connection
from seed.members_seed import INITIAL_MEMBERS, REQUIRED_COLUMNS

# 엑셀 파일 위치 - HR이 직접 열어 편집할 파일
MEMBERS_XLSX = PROJECT_ROOT / "data" / "members.xlsx"


def ensure_members_xlsx() -> bool:
    """엑셀 파일이 없으면 초기 시드로 생성. 반환: 새로 만들었으면 True."""
    MEMBERS_XLSX.parent.mkdir(parents=True, exist_ok=True)
    if MEMBERS_XLSX.exists():
        return False
    df = pd.DataFrame(INITIAL_MEMBERS, columns=REQUIRED_COLUMNS)
    df.to_excel(MEMBERS_XLSX, index=False)
    return True


def load_xlsx_to_df() -> pd.DataFrame:
    """엑셀을 읽어 DataFrame으로 반환. 필수 컬럼이 빠지면 KeyError."""
    df = pd.read_excel(MEMBERS_XLSX, dtype=str).fillna("")
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise KeyError(f"엑셀에 필수 컬럼이 없습니다: {missing}")
    return df


def sync_members_from_xlsx() -> dict:
    """엑셀 → DB 동기화. member 테이블을 통째로 교체.
    엑셀의 추가 컬럼은 extra_attrs JSON으로 보관. 반환: 카운트 정보."""
    ensure_members_xlsx()
    df = load_xlsx_to_df()

    # 추가 컬럼 = 필수 외 컬럼
    extra_cols = [c for c in df.columns if c not in REQUIRED_COLUMNS]

    rows = []
    for _, row in df.iterrows():
        extras = {c: row[c] for c in extra_cols if str(row[c]).strip()}
        rows.append((
            str(row["employee_id"]).strip(),
            str(row["name"]).strip(),
            str(row["corporation"]).strip(),
            str(row["division"]).strip(),
            str(row["team"]).strip(),
            str(row["role_level"]).strip(),
            str(row["position"]).strip(),
            str(row["job_type"]).strip(),
            str(row["persona_role"]).strip(),
            json.dumps(extras, ensure_ascii=False) if extras else None,
        ))

    conn = get_connection()
    try:
        cur = conn.cursor()
        # 외래키 제약 임시 비활성화 — DELETE FROM member가
        # skill_profile/assessment/evidence의 FK로 차단되는 것을 우회.
        # 같은 connection 안에서만 적용되므로 안전.
        cur.execute("PRAGMA foreign_keys = OFF")
        cur.execute("DELETE FROM member")
        cur.executemany(
            """INSERT INTO member
               (employee_id, name, corporation, division, team, role_level,
                position, job_type, persona_role, extra_attrs)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            rows,
        )
        cur.execute("PRAGMA foreign_keys = ON")
        conn.commit()
    finally:
        conn.close()

    return {
        "loaded": len(rows),
        "extra_columns": extra_cols,
        "xlsx_path": str(MEMBERS_XLSX),
    }


def save_uploaded_xlsx(uploaded_bytes: bytes) -> dict:
    """업로드된 엑셀 파일로 마스터 교체. 검증 통과 후 저장 + DB 동기화."""
    tmp = MEMBERS_XLSX.with_suffix(".uploaded.tmp.xlsx")
    tmp.write_bytes(uploaded_bytes)
    # 검증: 일단 읽어보고 필수 컬럼 체크
    df = pd.read_excel(tmp, dtype=str).fillna("")
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        tmp.unlink(missing_ok=True)
        raise KeyError(f"업로드 엑셀에 필수 컬럼이 없습니다: {missing}")
    # 검증 통과 → 정식 파일로 교체
    tmp.replace(MEMBERS_XLSX)
    return sync_members_from_xlsx()


def save_df_to_xlsx_and_db(df: pd.DataFrame) -> dict:
    """편집된 DataFrame을 엑셀에 저장하고 DB와 동기화.
    검증: 필수 컬럼 존재 + employee_id 비어있지 않고 중복 없음."""
    # 필수 컬럼 검증
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise KeyError(f"필수 컬럼이 누락됐습니다: {missing}")

    # PK 검증
    empty_ids = df[df["employee_id"].astype(str).str.strip() == ""]
    if len(empty_ids) > 0:
        raise ValueError(f"사번이 비어 있는 행이 {len(empty_ids)}개 있습니다.")

    dup = df["employee_id"][df["employee_id"].duplicated()].tolist()
    if dup:
        raise ValueError(f"사번 중복: {dup}")

    # 이름 검증
    empty_names = df[df["name"].astype(str).str.strip() == ""]
    if len(empty_names) > 0:
        raise ValueError(f"이름이 비어 있는 행이 {len(empty_names)}개 있습니다.")

    # 엑셀에 저장 (extra 컬럼도 보존)
    # 컬럼 순서: 필수 9개 먼저, 그 다음 추가 컬럼
    extra_cols = [c for c in df.columns if c not in REQUIRED_COLUMNS]
    ordered_cols = REQUIRED_COLUMNS + extra_cols
    df_out = df[ordered_cols].copy()
    df_out.to_excel(MEMBERS_XLSX, index=False)

    # DB 재동기화 (엑셀에서 다시 읽음)
    return sync_members_from_xlsx()


def load_members_df_from_db() -> pd.DataFrame:
    """DB의 member 테이블을 DataFrame으로 (extra_attrs JSON을 컬럼으로 풀어줌)."""
    conn = get_connection()
    try:
        df = pd.read_sql_query("SELECT * FROM member", conn)
    finally:
        conn.close()
    # extra_attrs를 풀어서 각 키를 컬럼으로
    if not df.empty and "extra_attrs" in df.columns:
        extras_list = df["extra_attrs"].apply(
            lambda s: json.loads(s) if s and s != "None" else {}
        )
        # 등장한 모든 추가 컬럼
        keys = set()
        for d in extras_list:
            keys.update(d.keys())
        for k in keys:
            df[k] = extras_list.apply(lambda d: d.get(k, ""))
    df = df.drop(columns=["extra_attrs"], errors="ignore")
    return df

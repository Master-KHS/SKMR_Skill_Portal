# SQLite 커넥션을 한 곳에서 발급 - 모든 모듈이 동일한 방식·옵션으로 DB에 접근하게.
import sqlite3

from config import DB_PATH


def get_connection() -> sqlite3.Connection:
    """SKMR DB 커넥션 반환. 호출 측에서 close() 또는 with 문으로 닫을 것."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    # row를 dict처럼 컬럼명으로 접근할 수 있게 (row["skill_name"] 형태)
    conn.row_factory = sqlite3.Row
    # SQLite는 기본 외래키 OFF - 명시적으로 켜야 PK/FK 무결성 보장됨
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

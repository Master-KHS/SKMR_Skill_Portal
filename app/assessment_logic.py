# 평가 4단계 워크플로 공통 로직.
# Self → Leader → Calibration → Committee, 각 단계는 이전 단계 submitted 상태일 때만 진행.
# 최종 Committee confirmed 시 skill_profile.current_level 자동 갱신.
import pandas as pd

from db import get_connection

CURRENT_CYCLE = "2026H1"  # 평가 사이클 - 단순화를 위해 하드코딩, 추후 별도 테이블로 확장 가능
STAGES = ["self", "leader", "calibration", "committee"]
STAGE_LABELS = {
    "self":        "Self",
    "leader":      "Leader",
    "calibration": "Calibration",
    "committee":   "Committee",
}


def get_latest_stage(member_id: str, skill_id: int) -> str | None:
    """해당 (member, skill)의 가장 최근 평가 stage (submitted 또는 confirmed). 없으면 None."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT stage FROM assessment
               WHERE member_id=? AND skill_id=? AND status IN ('submitted','confirmed')
               ORDER BY assessment_id DESC LIMIT 1""",
            (member_id, skill_id),
        ).fetchall()
    finally:
        conn.close()
    return rows[0]["stage"] if rows else None


def get_proposed_level(member_id: str, skill_id: int, stage: str) -> int | None:
    """특정 stage의 proposed_level 반환 (해당 stage의 가장 최근 submitted)."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT proposed_level FROM assessment
               WHERE member_id=? AND skill_id=? AND stage=? AND status='submitted'
               ORDER BY assessment_id DESC LIMIT 1""",
            (member_id, skill_id, stage),
        ).fetchall()
    finally:
        conn.close()
    return rows[0]["proposed_level"] if rows else None


def submit_assessment(
    *, member_id: str, skill_id: int, stage: str, assessor_id: str,
    proposed_level: int, rationale: str = "",
) -> int:
    """평가 1건 제출 → assessment 테이블 INSERT (status=submitted)."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO assessment
               (member_id, skill_id, stage, assessor_id, proposed_level,
                confirmed_level, rationale, assessed_date, status)
               VALUES (?,?,?,?,?,NULL,?,DATE('now'),'submitted')""",
            (member_id, skill_id, stage, assessor_id, proposed_level, rationale),
        )
        new_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    return new_id


def confirm_final(
    *, member_id: str, skill_id: int, assessor_id: str,
    confirmed_level: int, rationale: str = "",
) -> int:
    """Committee 단계 최종 확정 → assessment + skill_profile.current_level 갱신."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO assessment
               (member_id, skill_id, stage, assessor_id, proposed_level,
                confirmed_level, rationale, assessed_date, status)
               VALUES (?,?,'committee',?,?,?,?,DATE('now'),'confirmed')""",
            (member_id, skill_id, assessor_id, confirmed_level, confirmed_level, rationale),
        )
        new_id = cur.lastrowid

        # skill_profile UPSERT
        cur.execute("SELECT 1 FROM skill_profile WHERE member_id=? AND skill_id=?",
                    (member_id, skill_id))
        if cur.fetchone():
            cur.execute(
                """UPDATE skill_profile SET current_level=?, last_assessed_date=DATE('now')
                   WHERE member_id=? AND skill_id=?""",
                (confirmed_level, member_id, skill_id),
            )
        else:
            cur.execute(
                """INSERT INTO skill_profile
                   (member_id, skill_id, current_level, target_level, last_assessed_date)
                   VALUES (?,?,?,?,DATE('now'))""",
                (member_id, skill_id, confirmed_level, confirmed_level),
            )
        conn.commit()
    finally:
        conn.close()
    return new_id


def get_skill_workflow_state(member_id: str, team: str | None = None) -> pd.DataFrame:
    """구성원의 Required + 보유 Skill 통합 리스트 + 현재 워크플로 단계."""
    conn = get_connection()
    try:
        # Required Skill (전사 + 팀 + 개인)
        req = pd.read_sql_query(
            """SELECT skill_id, target_level, is_core FROM required_skill
               WHERE (org_or_individual='company' AND target_id='ALL')
                  OR (org_or_individual='department' AND target_id=?)
                  OR (org_or_individual='individual' AND target_id=?)""",
            conn, params=(team or "", member_id),
        )
        # 보유 Skill
        prof = pd.read_sql_query(
            """SELECT sp.skill_id, sp.current_level, sp.target_level AS profile_target,
                      s.skill_name, sf.sub_family_name, f.family_name, s.is_critical
               FROM skill_profile sp
               JOIN skill s             ON sp.skill_id = s.skill_id
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               JOIN skill_family f      ON sf.family_id = f.family_id
               WHERE sp.member_id=?""",
            conn, params=(member_id,),
        )
        # Skill 마스터 (이름·family용)
        sk = pd.read_sql_query(
            """SELECT s.skill_id, s.skill_name, s.is_critical,
                      sf.sub_family_name, f.family_name
               FROM skill s
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               JOIN skill_family f      ON sf.family_id = f.family_id""",
            conn,
        )
        # 평가 단계 현황
        assess = pd.read_sql_query(
            """SELECT skill_id, stage, proposed_level, confirmed_level, assessment_id
               FROM assessment
               WHERE member_id=? AND status IN ('submitted','confirmed')
               ORDER BY assessment_id""",
            conn, params=(member_id,),
        )
    finally:
        conn.close()

    # Required + Profile 합집합 - 어느 한 쪽에라도 있으면 평가 대상
    skill_ids = set(req["skill_id"]).union(set(prof["skill_id"]))
    if not skill_ids:
        return pd.DataFrame(columns=[
            "skill_id", "skill_name", "family_name", "sub_family_name",
            "current_level", "required_level", "is_core", "latest_stage",
            "self_lv", "leader_lv", "calib_lv", "committee_lv",
        ])

    base = sk[sk["skill_id"].isin(skill_ids)].copy()
    # current_level 매핑
    cur_map = dict(zip(prof["skill_id"], prof["current_level"]))
    base["current_level"] = base["skill_id"].map(cur_map)
    # required_level / is_core
    req_map = dict(zip(req["skill_id"], req["target_level"]))
    core_map = dict(zip(req["skill_id"], req["is_core"]))
    base["required_level"] = base["skill_id"].map(req_map)
    base["req_is_core"] = base["skill_id"].map(core_map).fillna(0).astype(int)

    # 각 stage 별 proposed_level
    for stg in STAGES:
        col = "committee_lv" if stg == "committee" else f"{stg}_lv"
        if stg == "self":
            col = "self_lv"
        elif stg == "leader":
            col = "leader_lv"
        elif stg == "calibration":
            col = "calib_lv"
        elif stg == "committee":
            col = "committee_lv"
        stage_df = assess[assess["stage"] == stg]
        if not stage_df.empty:
            latest = stage_df.groupby("skill_id").tail(1)
            stage_map = dict(zip(
                latest["skill_id"],
                latest["confirmed_level"].fillna(latest["proposed_level"]),
            ))
            base[col] = base["skill_id"].map(stage_map)
        else:
            base[col] = None

    # 가장 최근 stage 계산
    def latest_stage(sid):
        rows = assess[(assess["skill_id"] == sid) & (assess["stage"].isin(STAGES))]
        if rows.empty:
            return None
        return rows.iloc[-1]["stage"]
    base["latest_stage"] = base["skill_id"].apply(latest_stage)

    return base.sort_values(["req_is_core", "skill_id"], ascending=[False, True]).reset_index(drop=True)

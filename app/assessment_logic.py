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


def get_evaluators(employee_id: str) -> dict:
    """평가자 자동 매핑.
    팀원 → N+1=팀의 팀장, N+2=담당의 담당
    팀장 → N+1=담당의 담당, N+2=경영(임원)
    담당 → N+1=경영(임원), N+2=None
    매핑 실패 시 None.
    """
    conn = get_connection()
    try:
        me = conn.execute(
            "SELECT team, division, position FROM member WHERE employee_id=?",
            (employee_id,),
        ).fetchone()
        if not me:
            return {"n1": None, "n2": None, "n1_name": None, "n2_name": None}
        team, division, position = me["team"], me["division"], me["position"]

        def _find(sql: str, params: tuple) -> dict | None:
            r = conn.execute(sql, params).fetchone()
            return dict(r) if r else None

        n1 = n2 = None
        if position == "팀원":
            n1 = _find(
                "SELECT employee_id, name FROM member WHERE team=? AND position='팀장' "
                "AND employee_id != ? LIMIT 1",
                (team, employee_id),
            )
            n2 = _find(
                "SELECT employee_id, name FROM member WHERE division=? AND position='담당' LIMIT 1",
                (division,),
            )
        elif position == "팀장":
            n1 = _find(
                "SELECT employee_id, name FROM member WHERE division=? AND position='담당' "
                "AND employee_id != ? LIMIT 1",
                (division, employee_id),
            )
            n2 = _find(
                "SELECT employee_id, name FROM member WHERE job_type='경영' LIMIT 1",
                (),
            )
        elif position == "담당":
            n1 = _find(
                "SELECT employee_id, name FROM member WHERE job_type='경영' LIMIT 1",
                (),
            )
    finally:
        conn.close()

    return {
        "n1": n1["employee_id"] if n1 else None,
        "n2": n2["employee_id"] if n2 else None,
        "n1_name": n1["name"] if n1 else None,
        "n2_name": n2["name"] if n2 else None,
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
    confirmed_level: int, rationale: str = "", stage: str = "committee",
) -> int:
    """평가 확정 → assessment(status='confirmed') + skill_profile.current_level 갱신.
    stage는 leader/calibration/committee 중 하나 (Lv 기준 분기 워크플로)."""
    if stage not in ("leader", "calibration", "committee"):
        raise ValueError(f"확정 가능 stage: leader/calibration/committee. 입력: {stage}")
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO assessment
               (member_id, skill_id, stage, assessor_id, proposed_level,
                confirmed_level, rationale, assessed_date, status)
               VALUES (?,?,?,?,?,?,?,DATE('now'),'confirmed')""",
            (member_id, skill_id, stage, assessor_id, confirmed_level, confirmed_level, rationale),
        )
        new_id = cur.lastrowid

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


# ===== 후보자 비교 자동 산출 지표 =====
def get_candidate_stats(employee_id: str) -> dict:
    """후보자 비교용 자동 산출 지표.
    반환:
      - avg_lv: 보유 Skill 평균 Level
      - total_skills: 보유 Skill 수
      - n_l3_plus: 현재 Lv3 이상 Skill 수
      - n_l4: 현재 Lv4 Skill 수
      - critical_held: Critical Skill 보유 수
      - required_fulfill: 본인 Required 충족률 (%)
      - n_evidence: 총 Evidence 수
      - n_recent_assess: 최근 6개월 평가 활동 수
      - top_sub_family: 가장 평균 높은 Sub-family (이름, 평균 Level)
    """
    conn = get_connection()
    try:
        # 기본 통계
        row = conn.execute(
            """SELECT
                 COUNT(*) AS total,
                 AVG(sp.current_level) AS avg_lv,
                 SUM(CASE WHEN sp.current_level >= 3 THEN 1 ELSE 0 END) AS n_l3_plus,
                 SUM(CASE WHEN sp.current_level = 4 THEN 1 ELSE 0 END) AS n_l4,
                 SUM(CASE WHEN s.is_critical=1 THEN 1 ELSE 0 END) AS crit
               FROM skill_profile sp
               JOIN skill s ON sp.skill_id = s.skill_id
               WHERE sp.member_id=?""",
            (employee_id,),
        ).fetchone()

        # 멤버 team
        mrow = conn.execute(
            "SELECT team FROM member WHERE employee_id=?", (employee_id,),
        ).fetchone()
        team = mrow["team"] if mrow else ""

        # Required 충족률
        req_row = conn.execute(
            """SELECT r.skill_id, r.target_level,
                       (SELECT current_level FROM skill_profile sp WHERE sp.member_id=? AND sp.skill_id=r.skill_id) AS cur
                FROM required_skill r
                WHERE (r.org_or_individual='company' AND r.target_id='ALL')
                   OR (r.org_or_individual='department' AND r.target_id=?)
                   OR (r.org_or_individual='individual' AND r.target_id=? AND r.status='approved')""",
            (employee_id, team, employee_id),
        ).fetchall()
        n_req = len(req_row)
        if n_req > 0:
            met = sum(1 for r in req_row if (r["cur"] or 0) >= r["target_level"])
            fulfill = met / n_req * 100
        else:
            fulfill = 0

        # Evidence 수
        n_ev = conn.execute(
            "SELECT COUNT(*) FROM evidence WHERE member_id=?", (employee_id,),
        ).fetchone()[0]

        # 최근 6개월 평가
        n_recent = conn.execute(
            """SELECT COUNT(*) FROM assessment
               WHERE member_id=? AND assessed_date >= DATE('now', '-6 months')""",
            (employee_id,),
        ).fetchone()[0]

        # 가장 평균 높은 Sub-family
        top = conn.execute(
            """SELECT sf.sub_family_name, AVG(sp.current_level) AS avg_lv, COUNT(*) AS n
               FROM skill_profile sp
               JOIN skill s ON sp.skill_id = s.skill_id
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               WHERE sp.member_id=?
               GROUP BY sf.sub_family_id
               HAVING n >= 2
               ORDER BY avg_lv DESC LIMIT 1""",
            (employee_id,),
        ).fetchone()
    finally:
        conn.close()

    return {
        "total_skills": int(row["total"] or 0),
        "avg_lv": float(row["avg_lv"] or 0),
        "n_l3_plus": int(row["n_l3_plus"] or 0),
        "n_l4": int(row["n_l4"] or 0),
        "critical_held": int(row["crit"] or 0),
        "required_fulfill": fulfill,
        "n_required": n_req,
        "n_evidence": int(n_ev),
        "n_recent_assess": int(n_recent),
        "top_sub_family": top["sub_family_name"] if top else None,
        "top_sub_avg": float(top["avg_lv"]) if top else 0,
    }


# ===== Evidence 평가 단계 통합 헬퍼 =====
def get_evidence_for_skill(member_id: str, skill_id: int):
    """그 구성원의 해당 Skill에 연결된 Evidence 목록."""
    import pandas as pd
    conn = get_connection()
    try:
        return pd.read_sql_query(
            """SELECT e.evidence_id, e.evidence_type, e.title, e.description, e.created_date
               FROM evidence e
               JOIN evidence_skill_link esl ON e.evidence_id = esl.evidence_id
               WHERE e.member_id=? AND esl.skill_id=?
               ORDER BY e.created_date DESC""",
            conn, params=(member_id, skill_id),
        )
    finally:
        conn.close()


def add_evidence_for_skill(*, member_id: str, skill_id: int,
                            evidence_type: str, title: str, description: str = "") -> int:
    """Evidence 등록 + 해당 Skill 연결."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO evidence
               (member_id, evidence_type, title, description, created_date)
               VALUES (?,?,?,?,DATE('now'))""",
            (member_id, evidence_type, title, description),
        )
        eid = cur.lastrowid
        cur.execute("INSERT OR IGNORE INTO evidence_skill_link VALUES (?,?)",
                    (eid, skill_id))
        conn.commit()
    finally:
        conn.close()
    return eid


def get_skill_workflow_state(member_id: str, team: str | None = None) -> pd.DataFrame:
    """구성원의 Required + 보유 Skill 통합 리스트 + 현재 워크플로 단계."""
    conn = get_connection()
    try:
        # Required Skill (전사 + 팀 + 개인)
        req = pd.read_sql_query(
            """SELECT skill_id, target_level, is_core FROM required_skill
               WHERE (org_or_individual='company' AND target_id='ALL')
                  OR (org_or_individual='department' AND target_id=?)
                  OR (org_or_individual='individual' AND target_id=? AND status='approved')""",
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

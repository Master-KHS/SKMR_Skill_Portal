# 페르소나별 권한 매트릭스 + 동적 인물 매핑.
# 마스터(member 테이블)의 persona_role 컬럼으로 매핑되므로 엑셀 편집으로 자유 변경 가능.
# Phase 2: 메뉴 구조 재편 (Foundation / Assessment / Reporting 3섹션).

PERSONA_LABELS = {
    "hr_admin":    "HR Admin",
    "hr_viewer":   "HR Viewer",
    "team_leader": "Team Leader",
    "calibration": "Calibration 참여자",
    "committee":   "Skill Committee 위원",
    "executive":   "경영진",
    "employee":    "구성원",
}

# 메뉴 노출 매트릭스 — 13개 메뉴
MENU_VISIBILITY = {
    # ===== Foundation =====
    "policy":          {"employee": False, "team_leader": False, "calibration": False, "committee": False, "hr_admin": True,  "hr_viewer": True,  "executive": False},
    "skill_master":    {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": True,  "executive": True},
    "required_skill":  {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": True,  "executive": True},
    "eval_lines":      {"employee": True,  "team_leader": True,  "calibration": True,  "committee": False, "hr_admin": True,  "hr_viewer": True,  "executive": False},
    "member_mgmt":     {"employee": False, "team_leader": False, "calibration": False, "committee": False, "hr_admin": True,  "hr_viewer": False, "executive": False},
    "system_setting":  {"employee": False, "team_leader": False, "calibration": False, "committee": False, "hr_admin": True,  "hr_viewer": False, "executive": False},
    # ===== Assessment =====
    "self_assess":     {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": False, "hr_viewer": False, "executive": False},
    "leader_assess":   {"employee": False, "team_leader": True,  "calibration": True,  "committee": False, "hr_admin": True,  "hr_viewer": False, "executive": False},
    "calibration":     {"employee": False, "team_leader": True,  "calibration": True,  "committee": False, "hr_admin": True,  "hr_viewer": False, "executive": False},
    "committee":       {"employee": False, "team_leader": False, "calibration": False, "committee": True,  "hr_admin": True,  "hr_viewer": False, "executive": False},
    "skill_profile":   {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": True,  "executive": False},
    # ===== Reporting =====
    "dashboard":       {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": True,  "executive": True},
    "talent_search":   {"employee": False, "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": True,  "executive": True},
    # ===== Deprecated (Phase 3에서 각 평가 화면에 통합) =====
    "evidence_my":     {"employee": False, "team_leader": False, "calibration": False, "committee": False, "hr_admin": False, "hr_viewer": False, "executive": False},
    "evidence_review": {"employee": False, "team_leader": False, "calibration": False, "committee": False, "hr_admin": False, "hr_viewer": False, "executive": False},
    "gap_analytics":   {"employee": False, "team_leader": False, "calibration": False, "committee": False, "hr_admin": False, "hr_viewer": False, "executive": False},
}


def can_see(menu_key: str, persona: str) -> bool:
    return MENU_VISIBILITY.get(menu_key, {}).get(persona, False)


def get_members_for_persona(persona: str) -> list[dict]:
    from db import get_connection
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT employee_id, name, team, role_level, position
               FROM member WHERE persona_role = ? ORDER BY employee_id""",
            (persona,),
        ).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]

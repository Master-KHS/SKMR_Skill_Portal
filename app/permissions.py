# 페르소나별 권한 매트릭스 + 동적 인물 매핑.
# 마스터(member 테이블)의 persona_role 컬럼을 기반으로 매핑하므로 HR이 엑셀에서 자유 변경 가능.

# 페르소나 코드 → 한국어 표시 라벨 (selectbox에 보임)
PERSONA_LABELS = {
    "hr_admin":    "HR Admin",
    "hr_viewer":   "HR Viewer",
    "team_leader": "Team Leader",
    "calibration": "Calibration 참여자",
    "committee":   "Skill Committee 위원",
    "executive":   "경영진",
    "employee":    "구성원",
}

# 메뉴 노출 매트릭스 (사양 5-A.4)
MENU_VISIBILITY = {
    "dashboard":       {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": True,  "executive": True},
    "skill_master":    {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": True,  "executive": True},
    "member_mgmt":     {"employee": False, "team_leader": False, "calibration": False, "committee": False, "hr_admin": True,  "hr_viewer": False, "executive": False},
    "required_skill":  {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": True,  "executive": True},
    "self_assess":     {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": False, "hr_viewer": False, "executive": False},
    "leader_assess":   {"employee": False, "team_leader": True,  "calibration": False, "committee": False, "hr_admin": True,  "hr_viewer": False, "executive": False},
    "calibration":     {"employee": False, "team_leader": True,  "calibration": True,  "committee": False, "hr_admin": True,  "hr_viewer": False, "executive": False},
    "committee":       {"employee": False, "team_leader": False, "calibration": False, "committee": True,  "hr_admin": True,  "hr_viewer": False, "executive": False},
    "evidence_my":     {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": False, "executive": False},
    "evidence_review": {"employee": False, "team_leader": True,  "calibration": False, "committee": False, "hr_admin": True,  "hr_viewer": False, "executive": False},
    "skill_profile":   {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": True,  "executive": False},
    "gap_analytics":   {"employee": True,  "team_leader": True,  "calibration": True,  "committee": True,  "hr_admin": True,  "hr_viewer": True,  "executive": True},
    "system_setting":  {"employee": False, "team_leader": False, "calibration": False, "committee": False, "hr_admin": True,  "hr_viewer": False, "executive": False},
}


def can_see(menu_key: str, persona: str) -> bool:
    """해당 페르소나가 메뉴를 볼 수 있는지. 미정의 시 안전상 False."""
    return MENU_VISIBILITY.get(menu_key, {}).get(persona, False)


def get_members_for_persona(persona: str) -> list[dict]:
    """마스터에서 해당 페르소나로 매핑된 인원 목록을 반환.
    HR Admin이 엑셀에서 persona_role을 바꾸면 즉시 반영됨."""
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

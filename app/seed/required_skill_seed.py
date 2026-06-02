# Required Skill 초기 시드 - 전사 공통 + 팀별 Core/Required 매핑.
# DB가 비어 있을 때만 적재. 이후 HR/Leader가 화면에서 편집 가능.
# (org_or_individual, target_id, skill_id, target_level, is_core)

# 전사 공통 - 모든 평가 대상자가 갖춰야 할 기본
# Enabler 4개는 전사 공통 자동 포함 (조직별 차이는 부서 Required에서 처리)
COMPANY_REQUIRED = [
    # (skill_id, target_level, is_core)
    (11,  2, 1),   # EHS 규제 및 유해·위험물 관리 기준 이해 - Core
    (13,  2, 0),   # Project Planning & Coordination
    # Enabler (전사 기본)
    (131, 2, 0),   # 데이터 분석
    (132, 2, 0),   # 생성형 AI Literacy
    (133, 2, 0),   # 디지털 협업
    (134, 2, 0),   # Project Management
]

# 팀별 Core 5 + Non-Core 3 = 8건 (HR이 화면에서 자유롭게 추가·삭제 가능)
# Core는 is_core=1, Non-Core는 is_core=0
TEAM_REQUIRED: dict[str, list[tuple[int, int, int]]] = {
    # HR기획팀 (사무직) - 130 Skill 카탈로그가 R&D/공정 위주라 사무직 매핑은 제한적
    # Core 3 + Non-Core 0 (사용자가 화면에서 추가 가능)
    "HR기획팀": [
        (13, 3, 1),  # Project Planning & Coordination - Core
        (17, 2, 1),  # 투자·유지보수 예산 계획 수립 및 통제 - Core
        (76, 3, 1),  # 프로젝트 기획 및 종합 통제 - Core
    ],
    # 소재개발팀 (연구직) - Domain(EXP) + Design + Analysis 중심
    "소재개발팀": [
        # Core 5
        (1,  3, 1),  # 유기화학·분석화학의 이해
        (5,  3, 1),  # 유기 반도체 소재/소자 특성 이해
        (28, 3, 1),  # OLED 소재 분자 설계
        (30, 3, 1),  # 합성 Recipe 도출·실행
        (49, 2, 1),  # VOC-to-CTQ Translation
        # Non-Core 3
        (22, 2, 0),  # 시험법 설계
        (24, 2, 0),  # DoE 기반 최적화
        (63, 2, 0),  # 성능 평가 결과 분석/해석
    ],
    # 공정기술팀 (기술직) - Planning + Design + Analysis + Management 중심
    "공정기술팀": [
        # Core 5
        (9,  3, 1),  # 공정 원리·시스템/설비 인프라 이해
        (25, 3, 1),  # 합성·정제 Process 설계
        (26, 3, 1),  # 양산공정 설계·최적화
        (66, 2, 1),  # 생산공정 최적화
        (68, 2, 1),  # 통계적 공정관리(SPC)
        # Non-Core 3
        (12, 2, 0),  # Application CTQ 평가 Protocol 정의
        (70, 2, 0),  # 공정 이상 원인분석-CAPA 이행
        (73, 2, 0),  # 측정 시스템 분석(MSA)
    ],
}


def seed_required_skills(conn) -> dict:
    """멱등 적재. 전사 Required(Enabler 포함)는 항상 누락분 보강. 팀별은 처음 한 번만."""
    cur = conn.cursor()

    # 전사 — 누락된 행만 추가 (Enabler 신규 추가가 부팅 시 자동 반영됨)
    for sid, lv, core in COMPANY_REQUIRED:
        cur.execute(
            """INSERT OR IGNORE INTO required_skill
               (org_or_individual, target_id, skill_id, target_level, is_core, status)
               VALUES ('company', 'ALL', ?, ?, ?, 'approved')""",
            (sid, lv, core),
        )

    # 팀별 — 한 번도 시드 안 됐으면 적재 (이미 있는 팀은 skip)
    for team, items in TEAM_REQUIRED.items():
        team_count = cur.execute(
            "SELECT COUNT(*) FROM required_skill WHERE org_or_individual='department' AND target_id=?",
            (team,),
        ).fetchone()[0]
        if team_count == 0:
            for sid, lv, core in items:
                cur.execute(
                    """INSERT OR IGNORE INTO required_skill
                       (org_or_individual, target_id, skill_id, target_level, is_core, status)
                       VALUES ('department', ?, ?, ?, ?, 'approved')""",
                    (team, sid, lv, core),
                )

    conn.commit()
    total = cur.execute("SELECT COUNT(*) FROM required_skill").fetchone()[0]
    return {"count": total}

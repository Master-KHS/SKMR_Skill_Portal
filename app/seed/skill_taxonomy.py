# Skill 분류 체계 + 130개 Skill + Level Criteria 시드 데이터.
# 첫 실행 시 DB가 비어 있으면 자동 적재. HR이 추후 마스터 화면에서 편집·추가 가능.

FAMILIES = [
    # (family_id, family_name, description)
    ("EXP", "전문지식", "산업·도메인 이해 — 알아야 하는 지식 영역"),
    ("WRK", "업무기술", "실제로 수행하는 업무 스킬"),
    ("ENB", "Enabler", "전사 공통 필요 스킬 — 디지털·협업 인프라"),
]

SUB_FAMILIES = [
    # (sub_family_id, family_id, sub_family_name, description)
    ("DOM", "EXP", "Domain",              "기초·응용 학문 도메인 이해"),
    ("BIZ", "EXP", "Business·Industry",   "고객·산업·시장 이해"),
    ("PRS", "EXP", "Process & System",    "공정·설비·시스템 이해"),
    ("REG", "EXP", "Regulatory",          "법규·EHS·규제 이해"),
    ("PLN", "WRK", "Planning",            "계획 수립·일정·예산·전략"),
    ("DES", "WRK", "Design",              "설계·시험법·Recipe 도출"),
    ("ANA", "WRK", "Analysis",            "분석·평가·진단·시뮬레이션"),
    ("MGT", "WRK", "Management",          "운영 통제·표준화·문서 관리"),
    ("OPS", "WRK", "Operations",          "직접 수행 작업·정비·점검"),
    ("AIT", "ENB", "AI/DT",               "데이터 분석·AI 활용 역량"),
    ("TMS", "ENB", "Teamship",            "디지털 협업·프로젝트 운영 역량"),
]

# 130개 Skill - 사양 4.1 그대로 적재 (skill_id, sub_family_id, name)
SKILLS = [
    # 전문지식 / Domain (7)
    (1,  "DOM", "유기화학·분석화학의 이해"),
    (2,  "DOM", "유기화학·화공학의 이해"),
    (3,  "DOM", "유기화학·무기화학의 이해"),
    (4,  "DOM", "유기화학의 이해"),
    (5,  "DOM", "유기 반도체 소재/소자 특성 이해"),
    (6,  "DOM", "기계공학의 이해"),
    (7,  "DOM", "전기·전자공학의 이해"),
    # 전문지식 / Business·Industry (1)
    (8,  "BIZ", "고객 공정·소재의 기술적 이해"),
    # 전문지식 / Process & System (2)
    (9,  "PRS", "공정 원리·시스템/설비 인프라 이해"),
    (10, "PRS", "분석 장비에 대한 이해"),
    # 전문지식 / Regulatory (1)
    (11, "REG", "EHS 규제 및 유해·위험물 관리 기준 이해"),
    # 업무기술 / Planning (9)
    (12, "PLN", "Application CTQ 평가 Protocol 정의"),
    (13, "PLN", "Project Planning & Coordination"),
    (14, "PLN", "생산 Scheduling & Sequencing"),
    (15, "PLN", "측정 계획 수립 및 표준화"),
    (16, "PLN", "설비 예방정비(PM) 계획 수립·관리"),
    (17, "PLN", "투자·유지보수 예산 계획 수립 및 통제"),
    (18, "PLN", "유지보수전략 수립 및 실행"),
    (19, "PLN", "Canister Valve 적합성 최적 기준 수립"),
    (20, "PLN", "Canister Valve 이력관리 체계 구축"),
    # 업무기술 / Design (28)
    (21, "DES", "전처리 방법 설계"),
    (22, "DES", "시험법 설계"),
    (23, "DES", "시험법 Validation 설계"),
    (24, "DES", "DoE 기반 최적화"),
    (25, "DES", "합성·정제 Process 설계"),
    (26, "DES", "양산공정 설계·최적화"),
    (27, "DES", "Simulation 기반 설계"),
    (28, "DES", "OLED 소재 분자 설계"),
    (29, "DES", "분자 설계 Parameter Targeting"),
    (30, "DES", "합성 Recipe 도출·실행"),
    (31, "DES", "승화 정제 조건 최적화"),
    (32, "DES", "OLED 소재 설계·제작"),
    (33, "DES", "소재 QC 분석법 설정"),
    (34, "DES", "원재료 구조 설계"),
    (35, "DES", "혼합물 조성 설계"),
    (36, "DES", "중합 구조 설계"),
    (37, "DES", "품질 분석 최적조건 설계"),
    (38, "DES", "Process 설계"),
    (39, "DES", "장치기술 엔지니어링"),
    (40, "DES", "기계기술 엔지니어링"),
    (41, "DES", "계기기술 엔지니어링"),
    (42, "DES", "전기기술 엔지니어링"),
    (43, "DES", "공조기술 엔지니어링"),
    (44, "DES", "건축/구조 기술 엔지니어링"),
    (45, "DES", "자동화/자동차 기술 엔지니어링"),
    (46, "DES", "CAPEX 설비 개선 기본 설계"),
    (47, "DES", "설비 자동화 구조 설계"),
    (48, "DES", "공정/설비 개선 기술검토"),
    # 업무기술 / Analysis (25)
    (49, "ANA", "VOC-to-CTQ Translation"),
    (50, "ANA", "Technical Feasibility 평가"),
    (51, "ANA", "분광 분석·검증"),
    (52, "ANA", "원소 분석·검증"),
    (53, "ANA", "형상 분석·검증"),
    (54, "ANA", "GC 분석·검증"),
    (55, "ANA", "LC 분석·검증"),
    (56, "ANA", "소재 분석·검증"),
    (57, "ANA", "박막·성능 검증"),
    (58, "ANA", "IP 기반 경쟁사 기술 분석 및 FTO 리스크 평가"),
    (59, "ANA", "제품개발 트렌드 및 기회 분석"),
    (60, "ANA", "구조 분석 Simulation"),
    (61, "ANA", "OLED 소자 측정·분석"),
    (62, "ANA", "고객 기술 서비스"),
    (63, "ANA", "성능 평가 결과 분석/해석"),
    (64, "ANA", "공정 Simulation"),
    (65, "ANA", "CAPEX/OPEX 평가"),
    (66, "ANA", "생산공정 최적화"),
    (67, "ANA", "상태진단 및 분석"),
    (68, "ANA", "통계적 공정관리(SPC)"),
    (69, "ANA", "OEE 및 Capacity 모델링"),
    (70, "ANA", "공정 이상 원인분석-CAPA 이행"),
    (71, "ANA", "설비 이상 원인분석-CAPA 이행"),
    (72, "ANA", "Canister Valve 필요 Spec 분석"),
    (73, "ANA", "측정 시스템 분석(MSA)"),
    # 업무기술 / Management (13)
    (74, "MGT", "Lab-Pilot 단위 공정 관리 및 트러블슈팅"),
    (75, "MGT", "투자 경제성 분석 및 소규모 개선사업 수행/관리"),
    (76, "MGT", "프로젝트 기획 및 종합 통제"),
    (77, "MGT", "시공 및 SHE 관리"),
    (78, "MGT", "Process 관리"),
    (79, "MGT", "MOC 기반 설비관리·통제"),
    (80, "MGT", "MOC 기반 공정관리·통제"),
    (81, "MGT", "Canister Valve 안전·품질 리스크 식별·통제"),
    (82, "MGT", "MOC 기반 Canister Valve 관리 및 통제"),
    (83, "MGT", "Shop Floor 관리"),
    (84, "MGT", "공정/설비 엔지니어 문서 관리"),
    (85, "MGT", "정비·작업 표준화 작업 품질 관리"),
    (86, "MGT", "CMMS 기반 설비관리"),
    # 업무기술 / Operations (44)
    (87,  "OPS", "원재료 입출고 처리 및 추적"),
    (88,  "OPS", "밸브/펌프 조작 및 Lock-out/Tag-out(LOTO)"),
    (89,  "OPS", "DCS 기반 단위 공정 운전"),
    (90,  "OPS", "공정 파라미터 모니터링 및 이상 신호 판단/대응"),
    (91,  "OPS", "오염/혼입 제어 및 방지"),
    (92,  "OPS", "Glove Box 운영 및 이상 신호 판단/초기대응"),
    (93,  "OPS", "공정 설비 부품 점검·교체"),
    (94,  "OPS", "부적합 처리"),
    (95,  "OPS", "Cleaning 수행·오염 제거"),
    (96,  "OPS", "분석 샘플링 처리 및 결과 추적"),
    (97,  "OPS", "설비 이상 징후 판단 및 초기대응"),
    (98,  "OPS", "설비 예방정비(PM) 점검"),
    (99,  "OPS", "Lab-Pilot 단위 공정 운영 및 트러블슈팅"),
    (100, "OPS", "대기방지설비 운전 및 점검"),
    (101, "OPS", "분석 장비 운영"),
    (102, "OPS", "샘플 충전 및 회수"),
    (103, "OPS", "설비 고장정비(CM)"),
    (104, "OPS", "설비 개선비(M)"),
    (105, "OPS", "정비소모 안전재고 점검 및 확보"),
    (106, "OPS", "설비 계기/센서 검교정"),
    (107, "OPS", "3정5S 기반 공무 Shop 운영"),
    (108, "OPS", "Canister Valve 입출고 처리 및 추적"),
    (109, "OPS", "세정 설비 운전 및 이상 대응"),
    (110, "OPS", "Solvent Rinse 설비 운전 및 이상 대응"),
    (111, "OPS", "퍼지 설비 운전 및 이상 대응"),
    (112, "OPS", "충전 설비 운전 및 이상 대응"),
    (113, "OPS", "부품 조립 및 누설 점검"),
    (114, "OPS", "Canister 폐기장 운영"),
    (115, "OPS", "Canister 해체 및 조립"),
    (116, "OPS", "Canister 배치 및 조립"),
    (117, "OPS", "CMMS 기반 설비 운영"),
    (118, "OPS", "샘플 입고 관리·추적"),
    (119, "OPS", "평가 조건 Recipe 설정"),
    (120, "OPS", "Photo 공정 평가 운영"),
    (121, "OPS", "패턴 CD 계측 운영"),
    (122, "OPS", "기판 전처리 및 Plasma Cleaning 운영"),
    (123, "OPS", "유기막 특성 측정 장비 운영"),
    (124, "OPS", "진공 열증착 설비 운영"),
    (125, "OPS", "OLED 소자 성능평가 장비 운영"),
    (126, "OPS", "Clean Room 환경 제어"),
    (127, "OPS", "OLED Encapsulation 설비 운영"),
    (128, "OPS", "Lab 유틸리티 유지관리"),
    (129, "OPS", "설비 점검 및 기본 유지관리"),
    (130, "OPS", "측정 정도 점검"),
    # Enabler / AI·DT (2)
    (131, "AIT", "데이터 분석"),
    (132, "AIT", "생성형 AI Literacy"),
    # Enabler / Teamship (2)
    (133, "TMS", "디지털 협업"),
    (134, "TMS", "Project Management"),
]

# --- Level Criteria 공통 베이스 (사양 4.2 통합 표) ---
# Sub-family별 특화가 필요하면 SUB_SPECIFIC에서 override.
LEVEL_BASE = {
    1: ("표준 절차·가이드 기반 수행", "개인 단위 영향, 상위 도움 일부 필요"),
    2: ("독립 수행, 일반 문제 해결", "팀 단위 운영 안정화 기여"),
    3: ("비정형 상황 응용·최적화", "동료 코칭, 사내 강사·전파"),
    4: ("새로운 프레임·방법론 설계", "전사 기술 전략 리드, 표준 수립"),
}

# Sub-family별 특화 표현 (사양 4.2 "예: Design L4 ..." 패턴)
SUB_SPECIFIC = {
    "DES": {
        4: ("설계 산출 표준화·내재화, 전사 설계 품질 상향 표준화",
            "전사 설계 가이드라인 수립, 후속 프로젝트의 기준점 제공"),
    },
    "OPS": {
        1: ("작업 표준서대로 단위 작업 수행", "자기 영역 안전·품질 기본 확보"),
        2: ("일상 운영 독립 수행, 일반 이상 대응", "교대조 단위 안정 운영 기여"),
    },
    "ANA": {
        4: ("분석 프레임·해석 방법론 개발", "데이터 기반 의사결정 표준 수립·전사 적용"),
    },
}


def build_level_criteria_rows():
    """9 Sub-family × 4 Level = 36 row 생성 (특화 적용)."""
    rows = []
    for sub in SUB_FAMILIES:
        sub_id = sub[0]
        for lv in (1, 2, 3, 4):
            specific = SUB_SPECIFIC.get(sub_id, {}).get(lv)
            expertise, impact = specific if specific else LEVEL_BASE[lv]
            rows.append((sub_id, lv, expertise, impact))
    return rows


def seed_skill_taxonomy(conn) -> dict:
    """멱등 적재: 없는 행만 추가. Enabler 같은 신규 family/sub/skill을 추후에 추가하면
    부팅 시 자동으로 들어옴 (INSERT OR IGNORE)."""
    cur = conn.cursor()

    cur.executemany("INSERT OR IGNORE INTO skill_family VALUES (?,?,?)", FAMILIES)
    cur.executemany("INSERT OR IGNORE INTO sub_skill_family VALUES (?,?,?,?)", SUB_FAMILIES)
    cur.executemany(
        "INSERT OR IGNORE INTO skill (skill_id, sub_family_id, skill_name, description, is_critical) "
        "VALUES (?,?,?,NULL,0)",
        SKILLS,
    )
    cur.executemany(
        "INSERT OR IGNORE INTO level_criteria VALUES (?,?,?,?)",
        build_level_criteria_rows(),
    )
    conn.commit()
    return {
        "family":     cur.execute("SELECT COUNT(*) FROM skill_family").fetchone()[0],
        "sub_family": cur.execute("SELECT COUNT(*) FROM sub_skill_family").fetchone()[0],
        "skill":      cur.execute("SELECT COUNT(*) FROM skill").fetchone()[0],
        "level_criteria": cur.execute("SELECT COUNT(*) FROM level_criteria").fetchone()[0],
    }

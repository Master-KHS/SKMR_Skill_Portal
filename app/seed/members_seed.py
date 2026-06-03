# 마스터 데이터 초기 시드 - data/members.xlsx가 없을 때만 사용됨.
# 한 번 엑셀이 생성되면 이 후로는 엑셀이 마스터 (이 파일은 첫 부팅 한정).
# 컬럼: 필수 9개 (사번~persona_role) + 자유 확장 컬럼은 엑셀에서 직접 추가.

# 회사·법인은 가정값 - 사용자가 엑셀에서 변경
CORPORATION = "SK머티리얼즈"

# 필수 컬럼 순서 (엑셀 상단 헤더 순서도 이것)
REQUIRED_COLUMNS = [
    "employee_id",   # 사번
    "name",          # 이름
    "corporation",   # 법인
    "division",      # 담당
    "team",          # 팀
    "role_level",    # R/L (L6/L5/L4/L3/L2)
    "position",      # 직책 (팀장/팀원)
    "job_type",      # 직종 (사무직/기술직/연구직/경영)
    "persona_role",  # 페르소나 매핑
]

# --- 초기 24명 ---
# HR기획팀 6명 = 실명 (사용자 제공)
# R&D 8명, 공정기술 8명 = 가상
# 임원 더미 2명 = 페르소나 매핑용 (직종=경영, 평가 대상 X)
INITIAL_MEMBERS = [
    # HR기획팀 (가상 이름) - 전원 HR Admin
    ("EMP001", "우성유", CORPORATION, "기업문화담당", "HR기획팀", "L6", "팀장", "사무직", "hr_admin"),
    ("EMP002", "윤영찬", CORPORATION, "기업문화담당", "HR기획팀", "L5", "팀원", "사무직", "hr_admin"),
    ("EMP003", "박규정", CORPORATION, "기업문화담당", "HR기획팀", "L5", "팀원", "사무직", "hr_admin"),
    ("EMP004", "반선윤", CORPORATION, "기업문화담당", "HR기획팀", "L5", "팀원", "사무직", "hr_admin"),
    ("EMP005", "김수현", CORPORATION, "기업문화담당", "HR기획팀", "L4", "팀원", "사무직", "hr_admin"),
    ("EMP006", "박원정", CORPORATION, "기업문화담당", "HR기획팀", "L3", "팀원", "사무직", "hr_admin"),
    ("EMP007", "이경주", CORPORATION, "기업문화담당", "HR기획팀", "L5", "팀원", "사무직", "hr_admin"),
    ("EMP008", "훈윤",   CORPORATION, "기업문화담당", "HR기획팀", "L5", "팀원", "사무직", "hr_admin"),

    # R&D담당 / 소재개발팀 (연구직) 8명 - 가상
    ("EMP011", "이도현", CORPORATION, "R&D담당", "소재개발팀", "L6", "팀장",   "연구직", "team_leader"),
    ("EMP012", "최서연", CORPORATION, "R&D담당", "소재개발팀", "L5", "팀원",   "연구직", "calibration"),
    ("EMP013", "정민호", CORPORATION, "R&D담당", "소재개발팀", "L5", "팀원",   "연구직", "employee"),
    ("EMP014", "한지윤", CORPORATION, "R&D담당", "소재개발팀", "L4", "팀원",   "연구직", "employee"),
    ("EMP015", "오재훈", CORPORATION, "R&D담당", "소재개발팀", "L4", "팀원",   "연구직", "employee"),
    ("EMP016", "송예린", CORPORATION, "R&D담당", "소재개발팀", "L4", "팀원",   "연구직", "employee"),
    ("EMP017", "강시우", CORPORATION, "R&D담당", "소재개발팀", "L3", "팀원",   "연구직", "employee"),
    ("EMP018", "임수아", CORPORATION, "R&D담당", "소재개발팀", "L3", "팀원",   "연구직", "employee"),

    # 생산기술담당 / 공정기술팀 (기술직) 8명 - 가상
    ("EMP021", "조태경", CORPORATION, "생산기술담당", "공정기술팀", "L6", "팀장", "기술직", "team_leader"),
    ("EMP022", "권나래", CORPORATION, "생산기술담당", "공정기술팀", "L5", "팀원", "기술직", "calibration"),
    ("EMP023", "백승준", CORPORATION, "생산기술담당", "공정기술팀", "L5", "팀원", "기술직", "employee"),
    ("EMP024", "유미정", CORPORATION, "생산기술담당", "공정기술팀", "L4", "팀원", "기술직", "employee"),
    ("EMP025", "신동우", CORPORATION, "생산기술담당", "공정기술팀", "L4", "팀원", "기술직", "employee"),
    ("EMP026", "고은채", CORPORATION, "생산기술담당", "공정기술팀", "L4", "팀원", "기술직", "employee"),
    ("EMP027", "황민재", CORPORATION, "생산기술담당", "공정기술팀", "L3", "팀원", "기술직", "employee"),
    ("EMP028", "노수빈", CORPORATION, "생산기술담당", "공정기술팀", "L3", "팀원", "기술직", "employee"),

    # 임원 더미 2명 - 평가 대상 아님 (직종=경영). 페르소나 매핑용
    ("EXE001", "박정우", CORPORATION, "경영진", "Skill Committee", "임원", "위원", "경영", "committee"),
    ("EXE002", "강대표", CORPORATION, "경영진", "사업대표",         "임원", "대표", "경영", "executive"),
]

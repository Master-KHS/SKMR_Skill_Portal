# 경로·색상·상수를 한 곳에 모아둠 - 여러 파일이 같은 값을 흩어서 갖지 않도록.
from pathlib import Path

# 프로젝트 루트 (이 파일 기준 한 단계 위)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# SQLite DB 파일 위치 - data 폴더 안에 생성됨
DB_PATH = PROJECT_ROOT / "data" / "skmr.db"

# 회사 로고 (사이드바·favicon·Dashboard 헤더)
LOGO_PATH = PROJECT_ROOT / "data" / "company_logo.png"

# --- 디자인 토큰 (참고 이미지: 흰색 강조 + 연한 하늘색 포인트) ---
COLOR_NAVY = "#0A2147"        # 주색 - 헤더·강조 (약간 더 진한 네이비)
COLOR_NAVY_LIGHT = "#1A3A6B"  # 사이드바 active, 버튼 hover
COLOR_SK_RED = "#E60012"      # Critical·경고 포인트 (SK Red)
COLOR_SKY = "#E8F0F8"         # 연한 하늘색 — 메뉴 hover/active, 헤더 배경
COLOR_SKY_MED = "#C2D4EC"     # 연한 하늘색 진한 버전 — 구분선
COLOR_BG_WHITE = "#FFFFFF"    # 메인 배경·카드 (흰색 강조)
COLOR_BG_LIGHT = "#F0F4FA"    # 페이지 배경 (아주 연한 하늘빛)
COLOR_TEXT_DARK = "#1A2A3A"   # 본문 (약간 네이비 빛)
COLOR_TEXT_MED = "#5A7090"    # 보조 텍스트 (하늘빛 회색)
COLOR_BORDER = "#D4E0EE"      # 테두리 (연한 하늘색 계열)

# --- Skill Level 표기 (3.2 Level 체계) ---
LEVEL_NAMES = {
    1: "Youngling",
    2: "Padawan",
    3: "Jedi Knight",
    4: "Jedi Master",
}

# --- 7개 페르소나 코드 (5-A.3) - Step 2에서 본격 사용 ---
PERSONA_CODES = [
    "employee",
    "team_leader",
    "calibration",
    "committee",
    "hr_admin",
    "hr_viewer",
    "executive",
]

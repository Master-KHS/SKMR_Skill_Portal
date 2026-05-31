# 경로·색상·상수를 한 곳에 모아둠 - 여러 파일이 같은 값을 흩어서 갖지 않도록.
from pathlib import Path

# 프로젝트 루트 (이 파일 기준 한 단계 위)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# SQLite DB 파일 위치 - data 폴더 안에 생성됨
DB_PATH = PROJECT_ROOT / "data" / "skmr.db"

# 회사 로고 (사이드바·favicon·Dashboard 헤더)
LOGO_PATH = PROJECT_ROOT / "data" / "company_logo.png"

# --- 디자인 토큰 (Notion/Linear 톤, Navy 주색 + SK Red 포인트) ---
COLOR_NAVY = "#0A1929"        # 주색 - 헤더·강조 텍스트
COLOR_SK_RED = "#E60012"      # 포인트만 사용 - Critical·경고·KPI 강조
COLOR_BG_WHITE = "#FFFFFF"    # 카드·메인 배경
COLOR_BG_LIGHT = "#F5F5F7"    # 페이지 배경
COLOR_TEXT_DARK = "#1D1D1F"   # 본문
COLOR_TEXT_MED = "#6E6E73"    # 보조 텍스트
COLOR_BORDER = "#E5E5EA"      # 카드 테두리·구분선

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

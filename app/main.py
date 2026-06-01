# Streamlit 진입점 - 페르소나 selectbox + 권한 매트릭스 기반 동적 네비게이션.
# st.navigation을 써서 페르소나별로 사이드바 메뉴 노출을 실시간 분기.
import streamlit as st

from config import LOGO_PATH
from db import get_connection
from permissions import can_see
from persona_switch import render_persona_switch
from schema import init_db
from seed.members_loader import sync_members_from_xlsx
from seed.evidence_seed import seed_evidences
from seed.required_skill_seed import seed_required_skills
from seed.skill_profile_seed import seed_skill_profiles
from seed.skill_taxonomy import seed_skill_taxonomy
from theme import apply_theme

# --- 페이지 설정 (반드시 최상단) ---
_favicon = str(LOGO_PATH) if LOGO_PATH.exists() else None
st.set_page_config(
    page_title="SKMR Skill Portal",
    page_icon=_favicon,
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- 디자인 토큰 적용 ---
apply_theme()

# --- DB 초기화 (없으면 생성) + 시드 적재 ---
init_db()

# Skill 130개 자동 적재 (비어 있을 때만)
_conn = get_connection()
try:
    seed_skill_taxonomy(_conn)
    seed_required_skills(_conn)
finally:
    _conn.close()

# 마스터(엑셀) → DB 동기화 (엑셀 없으면 초기 시드로 생성)
# 매 부팅마다 호출하여 사용자가 엑셀 편집 후 재시작만 해도 반영됨
sync_members_from_xlsx()

# 가상 Skill Profile 적재 - member 정보가 DB에 들어간 뒤에 호출해야 함
_conn = get_connection()
try:
    seed_skill_profiles(_conn)
    # Evidence 시드는 Skill Profile이 들어간 뒤에 (Skill 연결에 Profile 풀 사용)
    seed_evidences(_conn)
finally:
    _conn.close()

# --- 사이드바 최상단: 로고 + 페르소나 selectbox (2단: 권한 → 사람) ---
with st.sidebar:
    if LOGO_PATH.exists():
        st.image(str(LOGO_PATH), use_container_width=True)
        st.markdown("<div style='height:4px;'></div>", unsafe_allow_html=True)

persona, _member = render_persona_switch()

# --- 사이드바 하단: 시스템 정보 ---
with st.sidebar:
    st.markdown("---")
    st.caption("SKMR Skill Portal · prototype")

# --- 모든 화면 정의 (메뉴 키, 경로, 표시 라벨, 아이콘) ---
# menu_key는 permissions.py와 1:1 매칭되어야 함.
ALL_PAGES = [
    # (menu_key, file_path, title, section)
    # ===== Foundation =====
    ("policy",          "views/policy.py",          "운영 정책 관리",      "Foundation"),
    ("skill_master",    "views/skill_master.py",    "Skill Library",      "Foundation"),
    ("required_skill",  "views/required_skill.py",  "필요 Skill 정의",     "Foundation"),
    ("eval_lines",      "views/eval_lines.py",      "Assessment 라인 관리", "Foundation"),
    ("member_mgmt",     "views/member_mgmt.py",     "구성원 관리",         "Foundation"),
    ("system_setting",  "views/system_setting.py",  "Admin 권한 관리",     "Foundation"),
    # ===== Assessment =====
    ("self_assess",     "views/self_assess.py",     "자가 진단",          "Assessment"),
    ("leader_assess",   "views/leader_assess.py",   "리더 진단",          "Assessment"),
    ("calibration",     "views/calibration.py",     "Calibration",       "Assessment"),
    ("committee",       "views/committee.py",       "Committee",         "Assessment"),
    ("skill_profile",   "views/skill_profile.py",   "최종 결과 확인",      "Assessment"),
    # ===== Reporting =====
    ("dashboard",       "views/dashboard.py",       "진단 결과 확인",      "Reporting"),
    ("talent_search",   "views/talent_search.py",   "Talent Search",     "Reporting"),
]

# --- 페르소나 권한으로 필터링 + 섹션별 그룹화 ---
nav_dict: dict[str, list] = {"": []}  # ""는 섹션 없는 항목 (사이드바 상단에 평평하게)
for menu_key, file_path, title, section in ALL_PAGES:
    if not can_see(menu_key, persona):
        continue
    page = st.Page(file_path, title=title, url_path=menu_key)
    section_key = section if section else ""
    nav_dict.setdefault(section_key, []).append(page)

# 빈 섹션 제거 (필터링 후 항목이 0개면 그룹 자체를 안 그림)
nav_dict = {k: v for k, v in nav_dict.items() if v}

# --- 권한이 0개인 경우 (이론상 없지만 안전장치) ---
if not nav_dict:
    st.error("이 페르소나로 볼 수 있는 화면이 없습니다. permissions.py를 확인하세요.")
    st.stop()

# --- 동적 네비게이션 실행 ---
pg = st.navigation(nav_dict, position="sidebar")
pg.run()

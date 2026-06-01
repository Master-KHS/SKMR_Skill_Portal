# Policy - 운영 정책 관리 (Skill Architecture·Level 체계 편집).
# Phase 3에서 본격 구현: Family/Sub-family CRUD, Level 단계·명칭·기준 편집.
import streamlit as st

from persona_switch import render_persona_badge
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
render_persona_badge(persona)
page_header(
    "Policy",
    "Skill Architecture · Level 체계 운영 정책 (HR Admin 전용)",
)

if persona not in ("hr_admin", "hr_viewer"):
    st.error("이 화면은 HR Admin / HR Viewer 권한에서만 접근 가능합니다.")
    st.stop()

st.info(
    "**Phase 3에서 본격 구현 예정**\n\n"
    "- Family / Sub-family 추가·편집·삭제\n"
    "- Skill Level 단계 수·명칭·기준 편집\n"
    "- 향후 정책 변경 시 시스템 개편 없이 화면에서 자체 대응"
)

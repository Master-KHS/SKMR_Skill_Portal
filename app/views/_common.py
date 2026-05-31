# 더미 페이지 공통 헬퍼 - 미구현 화면이 일관된 형태로 보이도록.
# Step 11-A: 이모지 prefix 무시 (디자인 정책에 맞춰 page_header가 자동 처리).
import streamlit as st

from persona_switch import render_persona_badge
from theme import page_header


def stub_page(title: str, subtitle: str, step_note: str, icon: str = "") -> None:
    """미구현 화면 표준 레이아웃. icon은 호환성 위해 인자로만 받고 사용 X."""
    persona = st.session_state.get("current_persona", "hr_admin")
    render_persona_badge(persona)
    page_header(title, subtitle)
    st.info(step_note)

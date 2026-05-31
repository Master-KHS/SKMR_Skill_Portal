# 더미 페이지 공통 헬퍼 - Step 2~10 사이 "아직 안 만든 화면"들이 모두 동일한 형태로 보이도록.
# 각 화면이 자기 Step에 도달하면 이 stub_page를 실제 구현으로 교체하면 됨.
import streamlit as st

from persona_switch import render_persona_badge
from theme import page_header


def stub_page(title: str, subtitle: str, step_note: str, icon: str = "") -> None:
    """미구현 화면 표준 레이아웃: 페르소나 배지 + 헤더 + 안내문."""
    persona = st.session_state.get("current_persona", "hr_admin")
    render_persona_badge(persona)
    page_header(f"{icon} {title}".strip(), subtitle)
    st.info(step_note)

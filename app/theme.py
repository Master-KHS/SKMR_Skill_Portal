# 디자인 토큰 적용 - Navy 주색 + SK Red 포인트, 카드형 레이아웃, Pretendard 폰트.
# 매 페이지 첫줄에서 apply_theme() 한 번만 호출하면 됨.
import streamlit as st

from config import (
    COLOR_BG_LIGHT,
    COLOR_BG_WHITE,
    COLOR_BORDER,
    COLOR_NAVY,
    COLOR_SK_RED,
    COLOR_TEXT_DARK,
    COLOR_TEXT_MED,
)


def apply_theme() -> None:
    """전역 CSS 주입 - 색상·폰트·카드 스타일을 한 번에 적용."""
    st.markdown(
        f"""
        <style>
        /* Pretendard 폰트 - 한국어 가독성 우선, 실패 시 시스템 폰트 fallback */
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

        html, body, [class*="css"] {{
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont,
                         'Segoe UI', 'Malgun Gothic', sans-serif !important;
            color: {COLOR_TEXT_DARK};
        }}

        /* 메인 배경 - 라이트 그레이로 카드와 대비 */
        .stApp {{
            background-color: {COLOR_BG_LIGHT};
        }}

        /* 사이드바 - 네이비 톤 */
        section[data-testid="stSidebar"] {{
            background-color: {COLOR_BG_WHITE};
            border-right: 1px solid {COLOR_BORDER};
        }}

        /* 헤더 - 네이비 */
        h1, h2, h3 {{
            color: {COLOR_NAVY} !important;
            letter-spacing: -0.01em;
        }}

        /* 본문 보조 텍스트 */
        p, label, .stMarkdown {{
            color: {COLOR_TEXT_DARK};
        }}

        /* Primary 버튼 - SK Red 포인트 */
        .stButton > button[kind="primary"] {{
            background-color: {COLOR_SK_RED};
            border-color: {COLOR_SK_RED};
            color: white;
            font-weight: 600;
        }}
        .stButton > button[kind="primary"]:hover {{
            background-color: {COLOR_NAVY};
            border-color: {COLOR_NAVY};
        }}

        /* Secondary 버튼 - 네이비 아웃라인 */
        .stButton > button[kind="secondary"] {{
            background-color: {COLOR_BG_WHITE};
            border: 1px solid {COLOR_BORDER};
            color: {COLOR_NAVY};
        }}

        /* 링크 */
        a {{ color: {COLOR_SK_RED}; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}

        /* 메트릭 카드 톤 */
        [data-testid="stMetric"] {{
            background-color: {COLOR_BG_WHITE};
            border: 1px solid {COLOR_BORDER};
            border-radius: 12px;
            padding: 16px 20px;
        }}
        [data-testid="stMetricLabel"] {{
            color: {COLOR_TEXT_MED};
            font-size: 13px;
        }}
        [data-testid="stMetricValue"] {{
            color: {COLOR_NAVY};
            font-weight: 700;
        }}

        /* 구분선 */
        hr {{
            border-color: {COLOR_BORDER};
        }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def page_header(title: str, subtitle: str | None = None) -> None:
    """모든 페이지 상단에서 호출 - 일관된 타이틀 스타일."""
    st.markdown(
        f"<h1 style='margin-bottom:4px;'>{title}</h1>",
        unsafe_allow_html=True,
    )
    if subtitle:
        st.markdown(
            f"<p style='color:{COLOR_TEXT_MED}; margin-top:0; font-size:15px;'>{subtitle}</p>",
            unsafe_allow_html=True,
        )
    st.markdown("<br>", unsafe_allow_html=True)

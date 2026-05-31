# 디자인 토큰 - Notion/Linear 톤. Navy 주색 + SK Red 포인트 + Pretendard.
# Step 11-A: 각진 형태 (4-6px), 이모지 배제, 헤더 정돈된 무게감.
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
    """전역 CSS 주입 - 톤·여백·각진 모서리를 한 번에 적용."""
    st.markdown(
        f"""
        <style>
        /* Pretendard 폰트 - 한국어 가독성 우선, 실패 시 시스템 폰트 fallback */
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

        html, body, [class*="css"] {{
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont,
                         'Segoe UI', 'Malgun Gothic', sans-serif !important;
            color: {COLOR_TEXT_DARK};
            font-feature-settings: 'tnum';
        }}

        /* 메인 배경 */
        .stApp {{
            background-color: {COLOR_BG_LIGHT};
        }}

        /* 사이드바 */
        section[data-testid="stSidebar"] {{
            background-color: {COLOR_BG_WHITE};
            border-right: 1px solid {COLOR_BORDER};
        }}
        section[data-testid="stSidebar"] [data-testid="stSidebarNavSeparator"] {{
            border-color: {COLOR_BORDER};
        }}

        /* 헤더 — 정돈된 무게, 좁은 letter-spacing */
        h1 {{
            color: {COLOR_NAVY} !important;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin-bottom: 4px;
        }}
        h2 {{
            color: {COLOR_NAVY} !important;
            font-weight: 700;
            letter-spacing: -0.015em;
        }}
        h3, h4 {{
            color: {COLOR_NAVY} !important;
            font-weight: 600;
            letter-spacing: -0.01em;
        }}
        h5 {{
            color: {COLOR_NAVY} !important;
            font-weight: 600;
            font-size: 15px;
            letter-spacing: -0.005em;
            margin-bottom: 8px;
        }}

        /* 본문 */
        p, label, .stMarkdown {{
            color: {COLOR_TEXT_DARK};
        }}

        /* Primary 버튼 - SK Red, 각진 모서리 */
        .stButton > button[kind="primary"] {{
            background-color: {COLOR_SK_RED};
            border-color: {COLOR_SK_RED};
            color: white;
            font-weight: 600;
            border-radius: 4px;
        }}
        .stButton > button[kind="primary"]:hover {{
            background-color: {COLOR_NAVY};
            border-color: {COLOR_NAVY};
        }}

        /* Secondary 버튼 */
        .stButton > button[kind="secondary"] {{
            background-color: {COLOR_BG_WHITE};
            border: 1px solid {COLOR_BORDER};
            color: {COLOR_NAVY};
            border-radius: 4px;
        }}
        .stButton > button[kind="secondary"]:hover {{
            border-color: {COLOR_NAVY};
        }}

        /* 링크 */
        a {{ color: {COLOR_SK_RED}; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}

        /* 메트릭 카드 - 각진 형태 */
        [data-testid="stMetric"] {{
            background-color: {COLOR_BG_WHITE};
            border: 1px solid {COLOR_BORDER};
            border-radius: 4px;
            padding: 14px 18px;
        }}
        [data-testid="stMetricLabel"] {{
            color: {COLOR_TEXT_MED};
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.02em;
            text-transform: uppercase;
        }}
        [data-testid="stMetricValue"] {{
            color: {COLOR_NAVY};
            font-weight: 700;
            font-size: 24px;
        }}
        [data-testid="stMetricDelta"] {{
            color: {COLOR_TEXT_MED};
            font-size: 12px;
        }}

        /* Container border - 각진 */
        [data-testid="stVerticalBlockBorderWrapper"] {{
            border-radius: 4px !important;
        }}

        /* Tab 스타일 정돈 */
        button[data-baseweb="tab"] {{
            font-weight: 500;
        }}
        button[data-baseweb="tab"][aria-selected="true"] {{
            color: {COLOR_NAVY} !important;
            font-weight: 700;
        }}

        /* Dataframe - 각진 */
        [data-testid="stDataFrame"] {{
            border-radius: 4px;
        }}

        /* 구분선 */
        hr {{
            border-color: {COLOR_BORDER};
            margin: 16px 0;
        }}

        /* Selectbox / Input - 각진 */
        [data-baseweb="select"] > div,
        [data-baseweb="input"] > div,
        [data-baseweb="textarea"] > div {{
            border-radius: 4px !important;
        }}

        /* Expander - 각진 */
        [data-testid="stExpander"] {{
            border-radius: 4px !important;
            border: 1px solid {COLOR_BORDER};
        }}

        /* Caption 톤 */
        [data-testid="stCaptionContainer"] {{
            color: {COLOR_TEXT_MED};
            font-size: 12px;
        }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def page_header(title: str, subtitle: str | None = None) -> None:
    """모든 페이지 상단에서 호출 - 일관된 타이틀 스타일.
    title에 이모지가 들어와도 자동으로 제거 (Step 11 디자인 정책)."""
    # 이모지/특수기호 prefix 제거
    clean_title = title.lstrip("📊🏗️👥🎯📝📂👤📈⚙️🏢⚙ ").strip()
    st.markdown(
        f"<h1 style='margin-bottom:4px;'>{clean_title}</h1>",
        unsafe_allow_html=True,
    )
    if subtitle:
        st.markdown(
            f"<p style='color:{COLOR_TEXT_MED}; margin-top:0; font-size:14px;'>{subtitle}</p>",
            unsafe_allow_html=True,
        )
    st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)


def status_tag(text: str, color: str = COLOR_NAVY) -> str:
    """이모지 대신 쓸 텍스트 배지 — Critical/Core/Pending 등 상태 표시용."""
    return (
        f"<span style='display:inline-block; background:{color}; color:white; "
        f"padding:1px 7px; border-radius:3px; font-size:10px; font-weight:600; "
        f"letter-spacing:0.04em; text-transform:uppercase; vertical-align:middle;'>"
        f"{text}</span>"
    )


def outline_tag(text: str, color: str = COLOR_TEXT_MED) -> str:
    """outline 형태 배지 (덜 강한 강조)."""
    return (
        f"<span style='display:inline-block; border:1px solid {color}; color:{color}; "
        f"padding:0 6px; border-radius:3px; font-size:10px; font-weight:500; "
        f"letter-spacing:0.04em; text-transform:uppercase; vertical-align:middle;'>"
        f"{text}</span>"
    )

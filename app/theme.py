# 디자인 토큰 적용 - 흰색 강조 + 연한 하늘색 메뉴 포인트 + Pretendard.
# 참고 이미지: 깔끔한 흰 배경, 사이드바 active = 연한 하늘색, 네이비 텍스트.
import streamlit as st

from config import (
    COLOR_BG_LIGHT,
    COLOR_BG_WHITE,
    COLOR_BORDER,
    COLOR_NAVY,
    COLOR_NAVY_LIGHT,
    COLOR_SK_RED,
    COLOR_SKY,
    COLOR_SKY_MED,
    COLOR_TEXT_DARK,
    COLOR_TEXT_MED,
)


def apply_theme() -> None:
    """전역 CSS 주입."""
    st.markdown(
        f"""
        <style>
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

        html, body, [class*="css"] {{
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont,
                         'Segoe UI', 'Malgun Gothic', sans-serif !important;
            color: {COLOR_TEXT_DARK};
        }}

        /* ===== 페이지 배경 ===== */
        .stApp {{
            background-color: {COLOR_BG_LIGHT};
        }}

        /* ===== 사이드바 ===== */
        section[data-testid="stSidebar"] {{
            background-color: {COLOR_BG_WHITE};
            border-right: 1px solid {COLOR_BORDER};
        }}

        /* 사이드바 메뉴 아이템 */
        section[data-testid="stSidebar"] a[data-testid="stSidebarNavLink"] {{
            border-radius: 6px;
            padding: 6px 10px;
            margin: 1px 4px;
            color: {COLOR_TEXT_DARK} !important;
            font-size: 13px;
            font-weight: 500;
            transition: background 0.15s;
        }}
        section[data-testid="stSidebar"] a[data-testid="stSidebarNavLink"]:hover {{
            background-color: {COLOR_SKY} !important;
            color: {COLOR_NAVY} !important;
        }}
        /* 활성 메뉴 — 연한 하늘색 강조 */
        section[data-testid="stSidebar"] a[data-testid="stSidebarNavLink"][aria-current="page"] {{
            background-color: {COLOR_SKY} !important;
            color: {COLOR_NAVY} !important;
            font-weight: 700;
            border-left: 3px solid {COLOR_NAVY};
        }}

        /* 섹션 헤더 (Foundation / Assessment / Reporting) */
        section[data-testid="stSidebar"] [data-testid="stSidebarNavSeparator"] + div,
        section[data-testid="stSidebar"] li.st-emotion-cache-1cymh87 {{
            color: {COLOR_TEXT_MED} !important;
            font-size: 10px !important;
            font-weight: 700 !important;
            letter-spacing: 0.08em !important;
            text-transform: uppercase !important;
        }}

        /* ===== 헤더 ===== */
        h1 {{
            color: {COLOR_NAVY} !important;
            font-weight: 700;
            font-size: 24px;
            letter-spacing: -0.02em;
            margin-bottom: 4px;
        }}
        h2, h3, h4 {{
            color: {COLOR_NAVY} !important;
            font-weight: 600;
            letter-spacing: -0.01em;
        }}
        h5 {{
            color: {COLOR_NAVY} !important;
            font-weight: 600;
            font-size: 14px;
            letter-spacing: -0.005em;
            margin-bottom: 8px;
        }}

        /* ===== 메트릭 카드 ===== */
        [data-testid="stMetric"] {{
            background-color: {COLOR_BG_WHITE};
            border: 1px solid {COLOR_BORDER};
            border-radius: 8px;
            padding: 14px 18px;
            box-shadow: 0 1px 4px rgba(10,33,71,0.07);
        }}
        [data-testid="stMetricLabel"] > div {{
            color: {COLOR_TEXT_MED} !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            letter-spacing: 0.06em !important;
            text-transform: uppercase !important;
        }}
        [data-testid="stMetricValue"] > div {{
            color: {COLOR_NAVY} !important;
            font-weight: 700 !important;
            font-size: 26px !important;
        }}

        /* ===== 버튼 ===== */
        .stButton > button[kind="primary"] {{
            background-color: {COLOR_NAVY};
            border-color: {COLOR_NAVY};
            color: white;
            font-weight: 600;
            border-radius: 6px;
            transition: background 0.15s;
        }}
        .stButton > button[kind="primary"]:hover {{
            background-color: {COLOR_NAVY_LIGHT};
            border-color: {COLOR_NAVY_LIGHT};
        }}
        .stButton > button[kind="secondary"] {{
            background-color: {COLOR_BG_WHITE};
            border: 1.5px solid {COLOR_BORDER};
            color: {COLOR_NAVY};
            border-radius: 6px;
        }}
        .stButton > button[kind="secondary"]:hover {{
            background-color: {COLOR_SKY};
            border-color: {COLOR_SKY_MED};
        }}

        /* ===== 컨테이너 (with border=True) ===== */
        [data-testid="stVerticalBlockBorderWrapper"] {{
            background-color: {COLOR_BG_WHITE};
            border: 1px solid {COLOR_BORDER} !important;
            border-radius: 8px !important;
            box-shadow: 0 1px 4px rgba(10,33,71,0.06);
        }}

        /* ===== 탭 ===== */
        button[data-baseweb="tab"] {{
            font-weight: 500;
            font-size: 13px;
            color: {COLOR_TEXT_MED};
        }}
        button[data-baseweb="tab"][aria-selected="true"] {{
            color: {COLOR_NAVY} !important;
            font-weight: 700 !important;
        }}
        [data-baseweb="tab-highlight"] {{
            background-color: {COLOR_NAVY} !important;
        }}
        [data-baseweb="tab-border"] {{
            background-color: {COLOR_BORDER} !important;
        }}

        /* ===== Expander ===== */
        [data-testid="stExpander"] {{
            background-color: {COLOR_BG_WHITE};
            border: 1px solid {COLOR_BORDER} !important;
            border-radius: 6px !important;
        }}

        /* ===== Input / Selectbox ===== */
        [data-baseweb="select"] > div,
        [data-baseweb="input"] > div,
        [data-baseweb="textarea"] > div {{
            border-radius: 6px !important;
            border-color: {COLOR_BORDER} !important;
        }}
        [data-baseweb="select"] > div:focus-within,
        [data-baseweb="input"] > div:focus-within {{
            border-color: {COLOR_NAVY} !important;
        }}

        /* ===== Dataframe ===== */
        [data-testid="stDataFrame"] {{
            border-radius: 6px;
            border: 1px solid {COLOR_BORDER};
            overflow: hidden;
        }}

        /* ===== 구분선 ===== */
        hr {{
            border-color: {COLOR_BORDER};
            margin: 12px 0;
        }}

        /* ===== Caption ===== */
        [data-testid="stCaptionContainer"] > p {{
            color: {COLOR_TEXT_MED} !important;
            font-size: 11px !important;
        }}

        /* ===== Success / Warning / Error 박스 ===== */
        [data-testid="stAlert"] {{
            border-radius: 6px;
        }}

        /* ===== 링크 ===== */
        a {{ color: {COLOR_NAVY}; text-decoration: none; }}
        a:hover {{ color: {COLOR_SK_RED}; }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def page_header(title: str, subtitle: str | None = None) -> None:
    """페이지 상단 헤더 — 하늘색 배경 가로줄 + 타이틀."""
    # 이모지/특수기호 prefix 제거
    clean_title = title.lstrip("📊🏗️👥🎯📝📂👤📈⚙️🏢⚙ ").strip()
    st.markdown(
        f"""
        <div style='background:linear-gradient(90deg, {COLOR_NAVY} 0%, {COLOR_NAVY_LIGHT} 100%);
                    padding:16px 24px; border-radius:8px; margin-bottom:16px;'>
            <h1 style='color:white !important; margin:0; font-size:20px; letter-spacing:-0.01em;'>
                {clean_title}
            </h1>
            {f'<p style="color:rgba(255,255,255,0.7); margin:4px 0 0 0; font-size:13px;">{subtitle}</p>' if subtitle else ''}
        </div>
        """,
        unsafe_allow_html=True,
    )


def section_header(title: str) -> None:
    """섹션 소제목 — 연한 하늘색 좌측 바 강조."""
    st.markdown(
        f"""
        <div style='border-left:3px solid {COLOR_NAVY}; padding:2px 10px;
                    margin:16px 0 8px 0;'>
            <span style='color:{COLOR_NAVY}; font-weight:600; font-size:14px;'>{title}</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def kpi_card(label: str, value: str, sub: str = "") -> str:
    """커스텀 KPI 카드 HTML — 흰 배경 + 네이비 수치."""
    sub_html = f"<div style='color:{COLOR_TEXT_MED}; font-size:11px; margin-top:2px;'>{sub}</div>" if sub else ""
    return (
        f"<div style='background:{COLOR_BG_WHITE}; border:1px solid {COLOR_BORDER}; "
        f"border-radius:8px; padding:14px 18px; box-shadow:0 1px 4px rgba(10,33,71,0.07);'>"
        f"<div style='color:{COLOR_TEXT_MED}; font-size:11px; font-weight:600; "
        f"letter-spacing:0.06em; text-transform:uppercase;'>{label}</div>"
        f"<div style='color:{COLOR_NAVY}; font-weight:700; font-size:26px; margin-top:2px;'>{value}</div>"
        f"{sub_html}</div>"
    )


def status_tag(text: str, color: str = COLOR_NAVY) -> str:
    return (
        f"<span style='display:inline-block; background:{color}; color:white; "
        f"padding:1px 7px; border-radius:4px; font-size:10px; font-weight:600; "
        f"letter-spacing:0.04em; text-transform:uppercase; vertical-align:middle;'>"
        f"{text}</span>"
    )


def outline_tag(text: str, color: str = COLOR_TEXT_MED) -> str:
    return (
        f"<span style='display:inline-block; border:1px solid {color}; color:{color}; "
        f"padding:0 6px; border-radius:4px; font-size:10px; font-weight:500; "
        f"letter-spacing:0.04em; text-transform:uppercase; vertical-align:middle;'>"
        f"{text}</span>"
    )

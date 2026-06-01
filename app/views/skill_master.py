# Skill Master 화면 - 130개 스킬 트리 + 검색·필터 + Skill 상세·Level Criteria 표시.
# HR Admin이면 추후 편집 가능 (현 단계는 조회 중심, 편집은 Step 11 또는 별도).
import pandas as pd
import streamlit as st

from config import COLOR_BORDER, COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header


def _load_all():
    """Family / Sub-family / Skill 전체 + Level Criteria를 DataFrame으로 로드."""
    conn = get_connection()
    try:
        skills = pd.read_sql_query(
            """
            SELECT s.skill_id, s.skill_name, s.is_critical,
                   sf.sub_family_id, sf.sub_family_name,
                   f.family_id, f.family_name
            FROM skill s
            JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
            JOIN skill_family f      ON sf.family_id   = f.family_id
            ORDER BY f.family_id, sf.sub_family_id, s.skill_id
            """,
            conn,
        )
        criteria = pd.read_sql_query(
            "SELECT sub_family_id, level, expertise_criteria, impact_criteria FROM level_criteria",
            conn,
        )
    finally:
        conn.close()
    return skills, criteria


# --- 페이지 시작 ---
persona = st.session_state.get("current_persona", "hr_admin")
render_persona_badge(persona)
page_header(
    "Skill Library",
    "Family → Sub-family → Skill 계층 + Level Criteria (총 130개 Skill)",
)

skills_df, criteria_df = _load_all()

# --- 상단: 검색·필터 ---
filter_col1, filter_col2, filter_col3 = st.columns([2, 2, 3])
with filter_col1:
    family_opts = ["전체"] + skills_df["family_name"].drop_duplicates().tolist()
    sel_family = st.selectbox("Family", family_opts)
with filter_col2:
    if sel_family == "전체":
        sub_pool = skills_df["sub_family_name"].drop_duplicates().tolist()
    else:
        sub_pool = (
            skills_df[skills_df["family_name"] == sel_family]["sub_family_name"]
            .drop_duplicates().tolist()
        )
    sub_opts = ["전체"] + sub_pool
    sel_sub = st.selectbox("Sub-family", sub_opts)
with filter_col3:
    keyword = st.text_input("Skill 이름 검색", placeholder="예: OLED, Canister, 설계 …")

# 필터 적용
view_df = skills_df.copy()
if sel_family != "전체":
    view_df = view_df[view_df["family_name"] == sel_family]
if sel_sub != "전체":
    view_df = view_df[view_df["sub_family_name"] == sel_sub]
if keyword.strip():
    view_df = view_df[view_df["skill_name"].str.contains(keyword.strip(), case=False, na=False)]

# 상단 요약 메트릭
mcol1, mcol2, mcol3 = st.columns(3)
mcol1.metric("필터 결과", f"{len(view_df)} / {len(skills_df)} Skill")
mcol2.metric("Sub-family", f"{view_df['sub_family_name'].nunique()} / {skills_df['sub_family_name'].nunique()}")
mcol3.metric("Critical Skill", int(view_df["is_critical"].sum()))

st.divider()

# --- 좌측 트리 + 우측 상세 ---
left, right = st.columns([1, 1.4])

with left:
    st.markdown(f"<h4 style='color:{COLOR_NAVY};'>Skill Tree</h4>", unsafe_allow_html=True)

    if view_df.empty:
        st.info("조건에 맞는 Skill이 없습니다.")
        selected_skill_id = None
    else:
        # 트리: Family expander 안에 Sub-family expander, 그 안에 Skill 버튼 리스트
        # session_state로 선택된 skill_id 추적
        if "skill_master_selected_id" not in st.session_state:
            st.session_state.skill_master_selected_id = int(view_df.iloc[0]["skill_id"])

        for fname, f_group in view_df.groupby("family_name", sort=False):
            with st.expander(f"📁 **{fname}**  ({len(f_group)})", expanded=True):
                for sfname, sf_group in f_group.groupby("sub_family_name", sort=False):
                    st.markdown(
                        f"<p style='color:{COLOR_TEXT_MED}; font-size:13px; margin:6px 0 4px 4px;'>"
                        f"└ {sfname} ({len(sf_group)})</p>",
                        unsafe_allow_html=True,
                    )
                    for _, row in sf_group.iterrows():
                        sid = int(row["skill_id"])
                        is_sel = sid == st.session_state.skill_master_selected_id
                        prefix = "▶ " if is_sel else "  "
                        critical_tag = "  [CRT]" if row["is_critical"] else ""
                        if st.button(
                            f"{prefix}#{sid:03d}  {row['skill_name']}{critical_tag}",
                            key=f"sk_{sid}",
                            use_container_width=True,
                            type="primary" if is_sel else "secondary",
                        ):
                            st.session_state.skill_master_selected_id = sid
                            st.rerun()

        selected_skill_id = st.session_state.skill_master_selected_id

with right:
    st.markdown(f"<h4 style='color:{COLOR_NAVY};'>Skill 상세</h4>", unsafe_allow_html=True)

    if selected_skill_id is None:
        st.info("좌측에서 Skill을 선택하세요.")
    else:
        # 선택된 Skill 정보
        sk = skills_df[skills_df["skill_id"] == selected_skill_id].iloc[0]

        # 상세 카드
        critical_badge = (
            f"<span style='background:{COLOR_SK_RED}; color:white; padding:2px 8px; "
            f"border-radius:3px; font-size:11px; font-weight:600; letter-spacing:0.04em; "
            f"margin-left:8px; vertical-align:middle;'>CRITICAL</span>"
            if sk["is_critical"] else ""
        )
        st.markdown(
            f"""
            <div style="
                background:white;
                border:1px solid {COLOR_BORDER};
                border-radius:12px;
                padding:20px 24px;
                margin-bottom:16px;
            ">
                <div style="color:{COLOR_TEXT_MED}; font-size:12px;">
                    {sk['family_name']} · {sk['sub_family_name']}
                </div>
                <h3 style="margin:6px 0 0 0; color:{COLOR_NAVY};">
                    #{int(sk['skill_id']):03d} · {sk['skill_name']}{critical_badge}
                </h3>
            </div>
            """,
            unsafe_allow_html=True,
        )

        # Level Criteria 표 (이 Skill이 속한 Sub-family 기준)
        st.markdown(f"<h5 style='color:{COLOR_NAVY};'>Level Criteria</h5>", unsafe_allow_html=True)
        lc = (
            criteria_df[criteria_df["sub_family_id"] == sk["sub_family_id"]]
            .sort_values("level", ascending=False)
            .copy()
        )
        lc["Level"] = lc["level"].map(lambda lv: f"L{lv} · {LEVEL_NAMES[lv]}")
        lc = lc.rename(columns={
            "expertise_criteria": "전문성 (Expertise)",
            "impact_criteria": "영향력 (Impact)",
        })[["Level", "전문성 (Expertise)", "영향력 (Impact)"]]
        st.dataframe(lc, hide_index=True, use_container_width=True)

        st.caption(
            f"※ Level 기준은 Sub-family '{sk['sub_family_name']}' 단위로 정의됩니다. "
            "HR Admin은 시스템 설정에서 편집 가능 (Step 11 예정)."
        )

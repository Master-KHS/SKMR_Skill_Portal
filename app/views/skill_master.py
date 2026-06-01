# Skill Library - 130개 Skill 카탈로그 조회 + HR Admin 편집 (CRUD).
# 좌측 트리 + 우측 상세·Level Criteria. HR Admin일 때 신규 등록/편집/삭제 가능.
import pandas as pd
import streamlit as st

from config import COLOR_BORDER, COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header


def _load_all():
    conn = get_connection()
    try:
        skills = pd.read_sql_query(
            """SELECT s.skill_id, s.skill_name, s.description, s.is_critical,
                      sf.sub_family_id, sf.sub_family_name,
                      f.family_id, f.family_name
               FROM skill s
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               JOIN skill_family f      ON sf.family_id    = f.family_id
               ORDER BY f.family_id, sf.sub_family_id, s.skill_id""",
            conn,
        )
        criteria = pd.read_sql_query(
            "SELECT sub_family_id, level, expertise_criteria, impact_criteria FROM level_criteria",
            conn,
        )
        subs = pd.read_sql_query(
            """SELECT sf.sub_family_id, sf.sub_family_name, f.family_id, f.family_name
               FROM sub_skill_family sf JOIN skill_family f ON sf.family_id = f.family_id
               ORDER BY sf.sub_family_id""",
            conn,
        )
    finally:
        conn.close()
    return skills, criteria, subs


def _next_skill_id() -> int:
    conn = get_connection()
    try:
        row = conn.execute("SELECT MAX(skill_id) FROM skill").fetchone()
        return (row[0] or 0) + 1
    finally:
        conn.close()


def _insert_skill(sub_family_id: str, name: str, description: str, is_critical: int) -> int:
    new_id = _next_skill_id()
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO skill (skill_id, sub_family_id, skill_name, description, is_critical) VALUES (?,?,?,?,?)",
            (new_id, sub_family_id, name, description, is_critical),
        )
        conn.commit()
    finally:
        conn.close()
    return new_id


def _update_skill(skill_id: int, sub_family_id: str, name: str, description: str, is_critical: int) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE skill SET sub_family_id=?, skill_name=?, description=?, is_critical=? WHERE skill_id=?",
            (sub_family_id, name, description, is_critical, skill_id),
        )
        conn.commit()
    finally:
        conn.close()


def _delete_skill(skill_id: int) -> dict:
    """삭제 전 참조 무결성 체크. profile/required/assessment/evidence에 있으면 차단."""
    conn = get_connection()
    try:
        n_prof = conn.execute("SELECT COUNT(*) FROM skill_profile WHERE skill_id=?", (skill_id,)).fetchone()[0]
        n_req = conn.execute("SELECT COUNT(*) FROM required_skill WHERE skill_id=?", (skill_id,)).fetchone()[0]
        n_asm = conn.execute("SELECT COUNT(*) FROM assessment WHERE skill_id=?", (skill_id,)).fetchone()[0]
        n_ev = conn.execute("SELECT COUNT(*) FROM evidence_skill_link WHERE skill_id=?", (skill_id,)).fetchone()[0]
        refs = {"profile": n_prof, "required": n_req, "assessment": n_asm, "evidence_link": n_ev}
        if sum(refs.values()) > 0:
            return {"deleted": False, "refs": refs}
        conn.execute("DELETE FROM skill WHERE skill_id=?", (skill_id,))
        conn.commit()
    finally:
        conn.close()
    return {"deleted": True, "refs": {}}


# ---------- 페이지 시작 ----------
persona = st.session_state.get("current_persona", "hr_admin")
render_persona_badge(persona)
page_header(
    "Skill Library",
    "Family → Sub-family → Skill 계층 + Level Criteria · HR Admin 편집 가능",
)

is_admin = persona == "hr_admin"

skills_df, criteria_df, subs_df = _load_all()

# ===== HR Admin: 새 Skill 등록 폼 =====
if is_admin:
    with st.expander("새 Skill 등록", expanded=False):
        with st.form("new_skill", clear_on_submit=True):
            ncol1, ncol2 = st.columns(2)
            with ncol1:
                fam_opt = subs_df["family_name"].drop_duplicates().tolist()
                sel_f = st.selectbox("Family", fam_opt)
                sub_pool = subs_df[subs_df["family_name"] == sel_f]
                sub_choice = st.selectbox(
                    "Sub-family",
                    options=sub_pool["sub_family_id"].tolist(),
                    format_func=lambda sid: sub_pool[sub_pool["sub_family_id"] == sid].iloc[0]["sub_family_name"],
                )
            with ncol2:
                new_name = st.text_input("Skill 이름 *")
                new_critical = st.checkbox("Critical Skill", value=False)
            new_desc = st.text_area("설명 (선택)", height=80)
            if st.form_submit_button("Skill 등록", type="primary"):
                if not new_name.strip():
                    st.error("Skill 이름은 필수입니다.")
                else:
                    new_id = _insert_skill(sub_choice, new_name.strip(), new_desc.strip(),
                                            1 if new_critical else 0)
                    st.success(f"#{new_id:03d} '{new_name}' 등록 완료")
                    st.rerun()

# ===== 필터 =====
filter_col1, filter_col2, filter_col3 = st.columns([2, 2, 3])
with filter_col1:
    family_opts = ["전체"] + skills_df["family_name"].drop_duplicates().tolist()
    sel_family = st.selectbox("Family", family_opts, key="sm_fam")
with filter_col2:
    if sel_family == "전체":
        sub_pool = skills_df["sub_family_name"].drop_duplicates().tolist()
    else:
        sub_pool = skills_df[skills_df["family_name"] == sel_family]["sub_family_name"].drop_duplicates().tolist()
    sub_opts = ["전체"] + sub_pool
    sel_sub = st.selectbox("Sub-family", sub_opts, key="sm_sub")
with filter_col3:
    keyword = st.text_input("Skill 이름 검색", placeholder="예: OLED, Canister, 설계 …", key="sm_kw")

view_df = skills_df.copy()
if sel_family != "전체":
    view_df = view_df[view_df["family_name"] == sel_family]
if sel_sub != "전체":
    view_df = view_df[view_df["sub_family_name"] == sel_sub]
if keyword.strip():
    view_df = view_df[view_df["skill_name"].str.contains(keyword.strip(), case=False, na=False)]

mcol1, mcol2, mcol3 = st.columns(3)
mcol1.metric("필터 결과", f"{len(view_df)} / {len(skills_df)} Skill")
mcol2.metric("Sub-family", f"{view_df['sub_family_name'].nunique()} / {skills_df['sub_family_name'].nunique()}")
mcol3.metric("Critical Skill", int(view_df["is_critical"].sum()))

st.divider()

# ===== 좌 트리 + 우 상세 =====
left, right = st.columns([1, 1.4])

with left:
    st.markdown(f"<h5 style='color:{COLOR_NAVY};'>Skill Tree</h5>", unsafe_allow_html=True)
    if view_df.empty:
        st.info("조건에 맞는 Skill이 없습니다.")
        selected_skill_id = None
    else:
        if "sm_selected_id" not in st.session_state:
            st.session_state.sm_selected_id = int(view_df.iloc[0]["skill_id"])

        for fname, f_group in view_df.groupby("family_name", sort=False):
            with st.expander(f"{fname}  ({len(f_group)})", expanded=True):
                for sfname, sf_group in f_group.groupby("sub_family_name", sort=False):
                    st.markdown(
                        f"<p style='color:{COLOR_TEXT_MED}; font-size:13px; margin:6px 0 4px 4px;'>"
                        f"└ {sfname} ({len(sf_group)})</p>",
                        unsafe_allow_html=True,
                    )
                    for _, row in sf_group.iterrows():
                        sid = int(row["skill_id"])
                        is_sel = sid == st.session_state.sm_selected_id
                        prefix = "▶ " if is_sel else "  "
                        critical_tag = "  [CRT]" if row["is_critical"] else ""
                        if st.button(
                            f"{prefix}#{sid:03d}  {row['skill_name']}{critical_tag}",
                            key=f"sk_{sid}",
                            use_container_width=True,
                            type="primary" if is_sel else "secondary",
                        ):
                            st.session_state.sm_selected_id = sid
                            st.rerun()
        selected_skill_id = st.session_state.sm_selected_id

with right:
    st.markdown(f"<h5 style='color:{COLOR_NAVY};'>Skill 상세</h5>", unsafe_allow_html=True)
    if selected_skill_id is None or selected_skill_id not in skills_df["skill_id"].values:
        st.info("좌측에서 Skill을 선택하세요.")
    else:
        sk = skills_df[skills_df["skill_id"] == selected_skill_id].iloc[0]
        critical_badge = (
            f"<span style='background:{COLOR_SK_RED}; color:white; padding:2px 8px; "
            f"border-radius:3px; font-size:11px; font-weight:600; letter-spacing:0.04em; "
            f"margin-left:8px; vertical-align:middle;'>CRITICAL</span>"
            if sk["is_critical"] else ""
        )
        st.markdown(
            f"""
            <div style="background:white; border:1px solid {COLOR_BORDER};
                        border-radius:4px; padding:18px 22px; margin-bottom:14px;">
                <div style="color:{COLOR_TEXT_MED}; font-size:12px;">
                    {sk['family_name']} · {sk['sub_family_name']}
                </div>
                <h3 style="margin:6px 0 0 0; color:{COLOR_NAVY};">
                    #{int(sk['skill_id']):03d} · {sk['skill_name']}{critical_badge}
                </h3>
                {f'<p style="color:{COLOR_TEXT_MED}; font-size:13px; margin:8px 0 0 0;">{sk["description"]}</p>' if sk.get("description") else ''}
            </div>
            """,
            unsafe_allow_html=True,
        )

        # HR Admin이면 편집·삭제 영역
        if is_admin:
            with st.expander("이 Skill 편집·삭제", expanded=False):
                ecol1, ecol2 = st.columns(2)
                with ecol1:
                    cur_fam = sk["family_name"]
                    fam_opts = subs_df["family_name"].drop_duplicates().tolist()
                    new_fam = st.selectbox(
                        "Family", fam_opts,
                        index=fam_opts.index(cur_fam) if cur_fam in fam_opts else 0,
                        key=f"e_fam_{selected_skill_id}",
                    )
                    sub_pool = subs_df[subs_df["family_name"] == new_fam]
                    cur_sub_id = sk["sub_family_id"]
                    sub_options = sub_pool["sub_family_id"].tolist()
                    new_sub = st.selectbox(
                        "Sub-family",
                        options=sub_options,
                        index=sub_options.index(cur_sub_id) if cur_sub_id in sub_options else 0,
                        format_func=lambda sid: sub_pool[sub_pool["sub_family_id"] == sid].iloc[0]["sub_family_name"],
                        key=f"e_sub_{selected_skill_id}",
                    )
                with ecol2:
                    new_name = st.text_input("Skill 이름", value=sk["skill_name"],
                                              key=f"e_name_{selected_skill_id}")
                    new_critical = st.checkbox("Critical Skill", value=bool(sk["is_critical"]),
                                                key=f"e_crit_{selected_skill_id}")
                new_desc = st.text_area("설명", value=sk.get("description") or "",
                                          key=f"e_desc_{selected_skill_id}", height=80)

                bcol1, bcol2 = st.columns(2)
                with bcol1:
                    if st.button("변경사항 저장", type="primary",
                                  use_container_width=True, key=f"e_save_{selected_skill_id}"):
                        _update_skill(int(selected_skill_id), new_sub, new_name.strip(),
                                       new_desc.strip(), 1 if new_critical else 0)
                        st.success("저장됨")
                        st.rerun()
                with bcol2:
                    if st.button("Skill 삭제", use_container_width=True,
                                  key=f"e_del_{selected_skill_id}"):
                        res = _delete_skill(int(selected_skill_id))
                        if res["deleted"]:
                            st.success("삭제됨")
                            st.session_state.sm_selected_id = int(skills_df.iloc[0]["skill_id"])
                            st.rerun()
                        else:
                            refs = res["refs"]
                            st.error(
                                f"삭제 차단: 참조 존재 — "
                                f"Profile {refs['profile']}건 / Required {refs['required']}건 / "
                                f"Assessment {refs['assessment']}건 / Evidence-Link {refs['evidence_link']}건"
                            )

        # Level Criteria 표
        st.markdown(f"<h5 style='color:{COLOR_NAVY};'>Level Criteria</h5>", unsafe_allow_html=True)
        lc = (criteria_df[criteria_df["sub_family_id"] == sk["sub_family_id"]]
              .sort_values("level", ascending=False).copy())
        lc["Level"] = lc["level"].map(lambda lv: f"L{lv} · {LEVEL_NAMES[lv]}")
        lc = lc.rename(columns={
            "expertise_criteria": "전문성 (Expertise)",
            "impact_criteria": "영향력 (Impact)",
        })[["Level", "전문성 (Expertise)", "영향력 (Impact)"]]
        st.dataframe(lc, hide_index=True, use_container_width=True)

        st.caption(
            f"※ Level 기준은 Sub-family '{sk['sub_family_name']}' 단위로 정의됩니다. "
            "운영 정책 관리 화면에서 편집 가능."
        )

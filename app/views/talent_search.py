# Talent Search - 다중 조건 필터형 인재 검색.
# Skill 보유 + Level 조건 + 팀/직종/R/L 필터로 인원 추출.
import pandas as pd
import streamlit as st

from config import COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_MED
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
render_persona_badge(persona)
page_header("Talent Search", "다중 조건 필터로 인재 검색 (Skill 보유 + Level + 조직)")

# 마스터 데이터
conn = get_connection()
try:
    members_df = pd.read_sql_query(
        """SELECT employee_id, name, division, team, role_level, position, job_type
           FROM member WHERE job_type IN ('사무직','기술직','연구직')""",
        conn,
    )
    skills_df = pd.read_sql_query(
        """SELECT s.skill_id, s.skill_name, sf.sub_family_name, f.family_name, s.is_critical
           FROM skill s
           JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
           JOIN skill_family f      ON sf.family_id    = f.family_id
           ORDER BY s.skill_id""",
        conn,
    )
finally:
    conn.close()

# ===== 필터 =====
st.markdown(
    f"<h5 style='color:{COLOR_NAVY};'>검색 조건</h5>",
    unsafe_allow_html=True,
)

fcol1, fcol2, fcol3, fcol4 = st.columns(4)
with fcol1:
    div_opts = ["전체"] + sorted(members_df["division"].dropna().unique().tolist())
    sel_div = st.selectbox("담당", div_opts)
with fcol2:
    job_opts = ["전체"] + sorted(members_df["job_type"].dropna().unique().tolist())
    sel_job = st.selectbox("직종", job_opts)
with fcol3:
    rl_opts = ["전체"] + sorted(members_df["role_level"].dropna().unique().tolist())
    sel_rl = st.selectbox("R/L", rl_opts)
with fcol4:
    pos_opts = ["전체"] + sorted(members_df["position"].dropna().unique().tolist())
    sel_pos = st.selectbox("직책", pos_opts)

st.markdown(
    f"<p style='color:{COLOR_TEXT_MED}; font-size:13px; margin-top:10px;'>"
    "보유 Skill 조건 (AND 결합 — 모두 만족하는 인원만 추출)</p>",
    unsafe_allow_html=True,
)

# 동적으로 Skill 조건 N개 추가 가능
if "talent_conditions" not in st.session_state:
    st.session_state.talent_conditions = [{"skill_id": None, "min_level": 2}]

cc1, cc2 = st.columns([1, 1])
with cc1:
    if st.button("+ Skill 조건 추가"):
        st.session_state.talent_conditions.append({"skill_id": None, "min_level": 2})
        st.rerun()
with cc2:
    if st.button("− 조건 비우기"):
        st.session_state.talent_conditions = [{"skill_id": None, "min_level": 2}]
        st.rerun()

skill_id_options = skills_df["skill_id"].astype(int).tolist()
skill_label_map = {
    int(r["skill_id"]): f"#{int(r['skill_id']):03d} {r['skill_name']} ({r['sub_family_name']})"
    for _, r in skills_df.iterrows()
}

for i, cond in enumerate(st.session_state.talent_conditions):
    rcol1, rcol2, rcol3 = st.columns([4, 1, 1])
    with rcol1:
        sid = st.selectbox(
            f"Skill {i+1}",
            options=[None] + skill_id_options,
            format_func=lambda x: "(선택)" if x is None else skill_label_map.get(x, str(x)),
            key=f"talent_skill_{i}",
        )
    with rcol2:
        lv = st.number_input(
            f"최소 Level {i+1}",
            min_value=1, max_value=4, value=cond["min_level"], step=1,
            key=f"talent_lv_{i}",
        )
    with rcol3:
        if st.button("삭제", key=f"talent_del_{i}"):
            st.session_state.talent_conditions.pop(i)
            st.rerun()
    st.session_state.talent_conditions[i]["skill_id"] = sid
    st.session_state.talent_conditions[i]["min_level"] = lv

st.divider()

# ===== 결과 =====
view = members_df.copy()
if sel_div != "전체":
    view = view[view["division"] == sel_div]
if sel_job != "전체":
    view = view[view["job_type"] == sel_job]
if sel_rl != "전체":
    view = view[view["role_level"] == sel_rl]
if sel_pos != "전체":
    view = view[view["position"] == sel_pos]

# Skill 조건 적용 — 모든 조건을 AND로 만족
active_conds = [c for c in st.session_state.talent_conditions if c["skill_id"] is not None]
matched_ids = set(view["employee_id"].tolist())
conn = get_connection()
try:
    for cond in active_conds:
        rows = conn.execute(
            """SELECT member_id FROM skill_profile
               WHERE skill_id=? AND current_level >= ?""",
            (int(cond["skill_id"]), int(cond["min_level"])),
        ).fetchall()
        holders = {r[0] for r in rows}
        matched_ids &= holders
finally:
    conn.close()

view = view[view["employee_id"].isin(matched_ids)]

# 추가 정보 join — 평균 Level, 보유 Skill 수
if not view.empty:
    conn = get_connection()
    try:
        stats = pd.read_sql_query(
            """SELECT member_id, COUNT(*) AS n_skills, AVG(current_level) AS avg_lv
               FROM skill_profile GROUP BY member_id""",
            conn,
        )
    finally:
        conn.close()
    view = view.merge(stats, left_on="employee_id", right_on="member_id", how="left")
    view["n_skills"] = view["n_skills"].fillna(0).astype(int)
    view["avg_lv"] = view["avg_lv"].fillna(0).round(2)

st.markdown(
    f"<h5 style='color:{COLOR_NAVY};'>검색 결과 — {len(view)}명</h5>",
    unsafe_allow_html=True,
)

if active_conds:
    cond_text = " · ".join([
        f"{skill_label_map.get(c['skill_id'], '?').split(' ', 1)[1] if c['skill_id'] in skill_label_map else '?'} ≥ L{c['min_level']}"
        for c in active_conds
    ])
    st.caption(f"Skill 조건: {cond_text}")

if view.empty:
    st.info("조건에 맞는 인원이 없습니다.")
else:
    display = view[[
        "employee_id", "name", "division", "team", "role_level",
        "position", "job_type", "n_skills", "avg_lv",
    ]].rename(columns={
        "employee_id": "사번", "name": "이름", "division": "담당", "team": "팀",
        "role_level": "R/L", "position": "직책", "job_type": "직종",
        "n_skills": "보유 Skill", "avg_lv": "평균 Level",
    })
    st.dataframe(display, hide_index=True, use_container_width=True, height=520)

    # CSV 다운로드
    csv = display.to_csv(index=False).encode("utf-8-sig")
    st.download_button("검색 결과 CSV 다운로드", csv, file_name="talent_search.csv")

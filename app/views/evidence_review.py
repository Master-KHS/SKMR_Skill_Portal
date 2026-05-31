# Evidence 검토 - Team Leader는 본인 팀, HR Admin은 전체.
# 사람·유형·Skill 필터 + Evidence 내용 확인.
import pandas as pd
import streamlit as st

from config import COLOR_NAVY, COLOR_TEXT_MED
from db import get_connection
from persona_switch import render_persona_badge
from seed.evidence_seed import EVIDENCE_TYPES, TYPE_LABELS
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("Evidence Review",
            "팀원·구성원의 Evidence를 검토 (Skill·유형별 필터)")

# 검토 범위 결정
conn = get_connection()
try:
    if persona == "team_leader" and member:
        scope_filter = "AND m.team = ?"
        scope_param = (member.get("team", ""),)
        st.caption(f"검토 범위: **{member['team']}** (팀 전체)")
    else:  # hr_admin
        scope_filter = "AND m.job_type IN ('사무직','기술직','연구직')"
        scope_param = ()
        st.caption("검토 범위: **전사 평가 대상자 전체** (HR Admin)")

    members_df = pd.read_sql_query(
        f"""SELECT employee_id, name, team, role_level FROM member m
            WHERE 1=1 {scope_filter} ORDER BY team, role_level DESC, name""",
        conn, params=scope_param,
    )

    evidences = pd.read_sql_query(
        f"""SELECT e.evidence_id, e.member_id, m.name, m.team, m.role_level,
                   e.evidence_type, e.title, e.description, e.created_date,
                   GROUP_CONCAT(esl.skill_id) AS skill_ids,
                   GROUP_CONCAT(s.skill_name, ' | ') AS skill_names
            FROM evidence e
            JOIN member m ON e.member_id = m.employee_id
            LEFT JOIN evidence_skill_link esl ON e.evidence_id = esl.evidence_id
            LEFT JOIN skill s ON esl.skill_id = s.skill_id
            WHERE 1=1 {scope_filter}
            GROUP BY e.evidence_id
            ORDER BY e.created_date DESC""",
        conn, params=scope_param,
    )
finally:
    conn.close()

# KPI
k1, k2, k3 = st.columns(3)
k1.metric("검토 대상 인원", len(members_df))
k2.metric("총 Evidence", len(evidences))
k3.metric("인당 평균", f"{len(evidences)/max(len(members_df),1):.1f}건")

st.divider()

# --- 필터 ---
fcol1, fcol2, fcol3 = st.columns([2, 2, 3])
with fcol1:
    member_opts = ["전체"] + members_df["employee_id"].tolist()
    sel_member = st.selectbox(
        "구성원",
        options=member_opts,
        format_func=lambda eid: (
            "전체" if eid == "전체" else
            f"{members_df[members_df['employee_id']==eid].iloc[0]['name']} "
            f"({members_df[members_df['employee_id']==eid].iloc[0]['team']})"
        ),
        key="rev_member",
    )
with fcol2:
    type_filter = st.selectbox(
        "유형",
        options=["전체"] + EVIDENCE_TYPES,
        format_func=lambda t: t if t == "전체" else TYPE_LABELS[t],
        key="rev_type",
    )
with fcol3:
    keyword = st.text_input(
        "제목·설명·Skill 검색",
        key="rev_keyword",
        placeholder="예: OLED, SPC, 자격",
    )

# 필터 적용
view = evidences.copy()
if sel_member != "전체":
    view = view[view["member_id"] == sel_member]
if type_filter != "전체":
    view = view[view["evidence_type"] == type_filter]
if keyword.strip():
    kw = keyword.strip().lower()
    mask = (
        view["title"].str.lower().str.contains(kw, na=False)
        | view["description"].str.lower().str.contains(kw, na=False)
        | view["skill_names"].fillna("").str.lower().str.contains(kw, na=False)
    )
    view = view[mask]

st.markdown(
    f"<h4 style='color:{COLOR_NAVY};'>Evidence ({len(view)} / {len(evidences)})</h4>",
    unsafe_allow_html=True,
)

if view.empty:
    st.info("조건에 맞는 Evidence가 없습니다.")
else:
    # 가로로 길게 한 줄씩
    for _, row in view.iterrows():
        with st.container(border=True):
            c1, c2 = st.columns([3, 1])
            with c1:
                st.markdown(
                    f"""
                    <div style='color:{COLOR_TEXT_MED}; font-size:12px;'>
                        {TYPE_LABELS.get(row['evidence_type'], row['evidence_type'])} · {row['created_date']}
                    </div>
                    <h5 style='margin:4px 0 4px 0; color:{COLOR_NAVY};'>{row['title']}</h5>
                    <p style='color:{COLOR_TEXT_MED}; font-size:13px; margin:0;'>
                        {row['description'] or '(설명 없음)'}
                    </p>
                    """,
                    unsafe_allow_html=True,
                )
                if row["skill_names"]:
                    chips = "".join([
                        f"<span style='display:inline-block; background:#F5F5F7; "
                        f"color:{COLOR_NAVY}; padding:2px 8px; border-radius:8px; "
                        f"font-size:11px; margin:6px 4px 0 0;'>{s}</span>"
                        for s in str(row["skill_names"]).split(" | ")
                    ])
                    st.markdown(f"<div>{chips}</div>", unsafe_allow_html=True)
            with c2:
                st.markdown(
                    f"<b style='color:{COLOR_NAVY};'>{row['name']}</b><br>"
                    f"<span style='color:{COLOR_TEXT_MED}; font-size:12px;'>"
                    f"{row['team']} · {row['role_level']}</span>",
                    unsafe_allow_html=True,
                )

# Calibration - Leader 단계 완료 항목을 부서장이 비교·조정.
# Self·Leader 두 결과를 나란히 보고 Calibration proposed_level 입력 → submit
import pandas as pd
import streamlit as st

from assessment_logic import get_proposed_level, submit_assessment
from config import COLOR_NAVY, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("Calibration",
            "Leader 단계 완료 항목 비교 + 부서장이 조정 (4단계 평가의 3단계)")

# 담당 단위로 운영
conn = get_connection()
try:
    divs_df = pd.read_sql_query(
        "SELECT DISTINCT division FROM member WHERE job_type IN ('사무직','기술직','연구직') ORDER BY division",
        conn,
    )
finally:
    conn.close()

# 페르소나별 범위
if persona == "calibration" and member:
    target_div = member.get("division")
    st.caption(f"담당: **{target_div}**")
elif persona == "team_leader" and member:
    target_div = member.get("division")
    st.caption(f"담당: **{target_div}** (Team Leader 권한, 본인 담당 한정)")
else:  # hr_admin
    div_opts = divs_df["division"].tolist()
    target_div = st.selectbox("담당 선택 (운영용)", div_opts, key="calib_div_select")

if not target_div:
    st.warning("대상 담당이 없습니다.")
    st.stop()

# 해당 담당 Leader submitted - Calibration 미진행 항목 조회
conn = get_connection()
try:
    pending = pd.read_sql_query(
        """
        WITH leader_done AS (
            SELECT a.member_id, a.skill_id, MAX(a.assessment_id) AS aid, MAX(a.proposed_level) AS leader_lv
            FROM assessment a
            JOIN member m ON a.member_id = m.employee_id
            WHERE a.stage='leader' AND a.status='submitted' AND m.division = ?
            GROUP BY a.member_id, a.skill_id
        ),
        calib_done AS (
            SELECT DISTINCT member_id, skill_id FROM assessment
            WHERE stage='calibration' AND status='submitted'
        )
        SELECT ld.member_id, ld.skill_id, ld.leader_lv,
               m.name, m.team, m.role_level,
               s.skill_name, sf.sub_family_name, f.family_name, s.is_critical
        FROM leader_done ld
        JOIN member m ON ld.member_id = m.employee_id
        JOIN skill s  ON ld.skill_id  = s.skill_id
        JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
        JOIN skill_family f      ON sf.family_id    = f.family_id
        LEFT JOIN calib_done cd ON ld.member_id = cd.member_id AND ld.skill_id = cd.skill_id
        WHERE cd.member_id IS NULL
        ORDER BY s.skill_id, m.team, m.name
        """,
        conn, params=(target_div,),
    )
    done_count = pd.read_sql_query(
        """SELECT COUNT(DISTINCT a.member_id || '_' || a.skill_id) AS cnt
           FROM assessment a JOIN member m ON a.member_id = m.employee_id
           WHERE a.stage='calibration' AND a.status='submitted' AND m.division=?""",
        conn, params=(target_div,),
    )
finally:
    conn.close()

k1, k2 = st.columns(2)
k1.metric("Calibration 대기", len(pending))
k2.metric("Calibration 완료", int(done_count.iloc[0]["cnt"]))

st.divider()

if pending.empty:
    st.success("Calibration 대기 항목이 없습니다.")
    st.stop()

st.caption("같은 Skill 묶음으로 부서 인원을 한눈에 비교하면서 조정 의견을 입력하세요.")

assessor_id = member["employee_id"] if member else ""

# Skill 단위로 그룹핑
for sid, group in pending.groupby("skill_id"):
    skill_name = group.iloc[0]["skill_name"]
    sub_family = group.iloc[0]["sub_family_name"]
    family = group.iloc[0]["family_name"]
    is_critical = group.iloc[0]["is_critical"]

    with st.container(border=True):
        critical_tag = (
            f"<span style='background:{COLOR_SK_RED}; color:white; padding:1px 6px; "
            f"border-radius:3px; font-size:10px; font-weight:600; "
            f"letter-spacing:0.04em; margin-left:8px; vertical-align:middle;'>CRITICAL</span>"
            if is_critical else ""
        )
        st.markdown(
            f"""
            <div style='color:{COLOR_TEXT_MED}; font-size:12px;'>{family} · {sub_family}</div>
            <h4 style='margin:4px 0 10px 0; color:{COLOR_NAVY};'>
                #{int(sid):03d} {skill_name}{critical_tag}
            </h4>
            """,
            unsafe_allow_html=True,
        )

        # 인원별 입력
        for _, row in group.iterrows():
            mid = row["member_id"]
            self_lv = get_proposed_level(mid, int(sid), "self")
            leader_lv = int(row["leader_lv"])

            cols = st.columns([2.5, 1, 1, 1.5, 1.5])
            cols[0].markdown(
                f"**{row['name']}** <span style='color:{COLOR_TEXT_MED};'>"
                f"({row['team']} · {row['role_level']})</span>",
                unsafe_allow_html=True,
            )
            cols[1].markdown(f"Self: <b>L{self_lv}</b>", unsafe_allow_html=True)
            cols[2].markdown(f"Leader: <b>L{leader_lv}</b>", unsafe_allow_html=True)
            default_idx = leader_lv - 1
            lv = cols[3].selectbox(
                "Calib",
                options=[1, 2, 3, 4],
                index=default_idx,
                format_func=lambda x: f"L{x}",
                key=f"calib_lv_{mid}_{sid}",
                label_visibility="collapsed",
            )
            if cols[4].button("Submit", key=f"calib_sub_{mid}_{sid}",
                              type="primary", use_container_width=True):
                submit_assessment(
                    member_id=mid, skill_id=int(sid), stage="calibration",
                    assessor_id=assessor_id, proposed_level=lv,
                )
                st.success(f"{row['name']} #{int(sid):03d} Calibration 제출 (L{lv})")
                st.rerun()

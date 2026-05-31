# Skill Committee - Calibration 완료 항목을 임원 위원이 최종 의결.
# 확정 시 assessment(stage='committee', status='confirmed') + skill_profile.current_level 자동 갱신.
import pandas as pd
import streamlit as st

from assessment_logic import confirm_final, get_proposed_level
from config import COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("Skill Committee",
            "Calibration 완료 후 최종 Level 의결 + skill_profile 갱신 (4단계 평가의 4단계)")

# 전사 단위 운영 - Committee는 전사 위원회
conn = get_connection()
try:
    pending = pd.read_sql_query(
        """
        WITH calib_done AS (
            SELECT member_id, skill_id, MAX(assessment_id) AS aid, MAX(proposed_level) AS calib_lv
            FROM assessment
            WHERE stage='calibration' AND status='submitted'
            GROUP BY member_id, skill_id
        ),
        commit_done AS (
            SELECT DISTINCT member_id, skill_id FROM assessment
            WHERE stage='committee' AND status='confirmed'
        )
        SELECT cd.member_id, cd.skill_id, cd.calib_lv,
               m.name, m.division, m.team, m.role_level,
               s.skill_name, sf.sub_family_name, f.family_name, s.is_critical
        FROM calib_done cd
        JOIN member m ON cd.member_id = m.employee_id
        JOIN skill s  ON cd.skill_id  = s.skill_id
        JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
        JOIN skill_family f      ON sf.family_id    = f.family_id
        LEFT JOIN commit_done co ON cd.member_id = co.member_id AND cd.skill_id = co.skill_id
        WHERE co.member_id IS NULL
        ORDER BY s.is_critical DESC, s.skill_id, m.name
        """,
        conn,
    )
    confirmed_count = pd.read_sql_query(
        "SELECT COUNT(*) AS cnt FROM assessment WHERE stage='committee' AND status='confirmed'",
        conn,
    )
finally:
    conn.close()

k1, k2 = st.columns(2)
k1.metric("Committee 의결 대기", len(pending))
k2.metric("최종 확정 누적", int(confirmed_count.iloc[0]["cnt"]))

st.divider()

if pending.empty:
    st.success("Committee 의결 대기 항목이 없습니다.")
    st.stop()

st.caption(
    "Self · Leader · Calibration 결과를 비교하면서 최종 Level을 확정하세요. "
    "확정 시 해당 구성원의 **Skill Profile current_level이 자동 갱신**됩니다."
)

assessor_id = member["employee_id"] if member else ""

# Skill 단위로 그룹핑
for sid, group in pending.groupby("skill_id"):
    sk0 = group.iloc[0]
    with st.container(border=True):
        critical_badge = ""
        if sk0["is_critical"]:
            critical_badge = (
                f"<span style='background:{COLOR_SK_RED}; color:white; padding:2px 8px; "
                f"border-radius:10px; font-size:11px; margin-left:8px;'>CRITICAL</span>"
            )
        st.markdown(
            f"""
            <div style='color:{COLOR_TEXT_MED}; font-size:12px;'>
                {sk0['family_name']} · {sk0['sub_family_name']}
            </div>
            <h4 style='margin:4px 0 10px 0; color:{COLOR_NAVY};'>
                #{int(sid):03d} {sk0['skill_name']}{critical_badge}
            </h4>
            """,
            unsafe_allow_html=True,
        )

        for _, row in group.iterrows():
            mid = row["member_id"]
            self_lv = get_proposed_level(mid, int(sid), "self")
            leader_lv = get_proposed_level(mid, int(sid), "leader")
            calib_lv = int(row["calib_lv"])

            cols = st.columns([2.5, 1, 1, 1, 1.5, 1.5])
            cols[0].markdown(
                f"**{row['name']}** <span style='color:{COLOR_TEXT_MED};'>"
                f"({row['team']} · {row['role_level']})</span>",
                unsafe_allow_html=True,
            )
            cols[1].markdown(f"Self <b>L{self_lv}</b>", unsafe_allow_html=True)
            cols[2].markdown(f"Leader <b>L{leader_lv}</b>", unsafe_allow_html=True)
            cols[3].markdown(f"Calib <b>L{calib_lv}</b>", unsafe_allow_html=True)
            default_idx = calib_lv - 1
            final_lv = cols[4].selectbox(
                "Final",
                options=[1, 2, 3, 4],
                index=default_idx,
                format_func=lambda x: f"L{x}",
                key=f"comm_lv_{mid}_{sid}",
                label_visibility="collapsed",
            )
            if cols[5].button("최종 확정", key=f"comm_sub_{mid}_{sid}",
                              type="primary", use_container_width=True):
                confirm_final(
                    member_id=mid, skill_id=int(sid),
                    assessor_id=assessor_id,
                    confirmed_level=final_lv,
                )
                st.success(f"{row['name']} #{int(sid):03d} 최종 L{final_lv} 확정 + Profile 갱신")
                st.rerun()

# Leader Assessment - 팀원이 Self 제출한 항목을 팀장이 평가.
# Self submitted 인 (member, skill)만 표시 → Leader proposed_level 입력 → submit
import pandas as pd
import streamlit as st

from assessment_logic import (
    STAGE_LABELS,
    get_proposed_level,
    submit_assessment,
)
from config import COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("리더 진단", "팀원이 자가 진단 제출한 항목을 팀장이 리뷰·Lv2 결과 확정")

# 팀 결정: Team Leader면 본인 팀, HR Admin이면 팀 선택
conn = get_connection()
try:
    teams_df = pd.read_sql_query(
        "SELECT DISTINCT team FROM member WHERE job_type IN ('사무직','기술직','연구직') ORDER BY team",
        conn,
    )
finally:
    conn.close()

if persona == "team_leader" and member:
    target_team = member.get("team")
    st.caption(f"팀: **{target_team}**")
else:  # hr_admin 운영
    team_opts = teams_df["team"].tolist()
    target_team = st.selectbox("팀 선택 (운영용)", team_opts, key="leader_team_select")

if not target_team:
    st.warning("대상 팀이 없습니다.")
    st.stop()

# 해당 팀의 Self submitted - Leader 미진행 항목 조회
conn = get_connection()
try:
    # team 인원 + Self 제출 + Leader 미제출인 (member, skill) 페어
    pending = pd.read_sql_query(
        """
        WITH self_done AS (
            SELECT a.member_id, a.skill_id, MAX(a.assessment_id) AS aid
            FROM assessment a
            JOIN member m ON a.member_id = m.employee_id
            WHERE a.stage='self' AND a.status='submitted' AND m.team = ?
            GROUP BY a.member_id, a.skill_id
        ),
        leader_done AS (
            SELECT DISTINCT member_id, skill_id FROM assessment
            WHERE stage='leader' AND status='submitted'
        )
        SELECT sd.member_id, sd.skill_id, sd.aid,
               m.name, m.role_level,
               s.skill_name, sf.sub_family_name, f.family_name, s.is_critical
        FROM self_done sd
        JOIN member m ON sd.member_id = m.employee_id
        JOIN skill s ON sd.skill_id = s.skill_id
        JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
        JOIN skill_family f      ON sf.family_id    = f.family_id
        LEFT JOIN leader_done ld ON sd.member_id = ld.member_id AND sd.skill_id = ld.skill_id
        WHERE ld.member_id IS NULL
        ORDER BY m.role_level DESC, m.name, sd.skill_id
        """,
        conn, params=(target_team,),
    )
    # 처리한 항목도 같이 카운트
    done_count = pd.read_sql_query(
        """SELECT COUNT(DISTINCT a.member_id || '_' || a.skill_id) AS cnt
           FROM assessment a JOIN member m ON a.member_id = m.employee_id
           WHERE a.stage='leader' AND a.status='submitted' AND m.team=?""",
        conn, params=(target_team,),
    )
finally:
    conn.close()

# KPI
k1, k2 = st.columns(2)
k1.metric("Leader 처리 대기", len(pending))
k2.metric("Leader 처리 완료", int(done_count.iloc[0]["cnt"]))

st.divider()

if pending.empty:
    st.success("처리 대기 항목이 없습니다.")
    st.stop()

# 평가자 ID = 현재 페르소나의 사람 (HR Admin은 본인 ID)
assessor_id = member["employee_id"] if member else ""

# Skill별로 묶지 말고 (member, skill) 단위로 카드 표시
for _, row in pending.iterrows():
    mid = row["member_id"]
    sid = int(row["skill_id"])
    self_lv = get_proposed_level(mid, sid, "self")

    with st.container(border=True):
        head_col, lv_col = st.columns([3, 2])
        with head_col:
            critical_badge = (
                f"<span style='background:{COLOR_SK_RED}; color:white; padding:1px 6px; "
                f"border-radius:3px; font-size:10px; font-weight:600; margin-left:6px;'>CRITICAL</span>"
                if row["is_critical"] else ""
            )
            st.markdown(
                f"""
                <div style='color:{COLOR_TEXT_MED}; font-size:12px;'>
                    {row['family_name']} · {row['sub_family_name']}
                </div>
                <h4 style='margin:4px 0 4px 0; color:{COLOR_NAVY};'>
                    #{sid:03d} {row['skill_name']}{critical_badge}
                </h4>
                <p style='margin:0; color:{COLOR_TEXT_MED}; font-size:13px;'>
                    구성원: <b>{row['name']}</b> ({row['role_level']}) ·
                    Self 평가: <b style='color:{COLOR_NAVY};'>L{self_lv}</b>
                </p>
                """,
                unsafe_allow_html=True,
            )

        with lv_col:
            default_idx = (self_lv - 1) if self_lv else 1
            lv = st.selectbox(
                "Leader Level",
                options=[1, 2, 3, 4],
                index=default_idx,
                format_func=lambda x: f"L{x} · {LEVEL_NAMES[x]}",
                key=f"leader_lv_{mid}_{sid}",
            )
            rationale = st.text_input(
                "근거 (선택)",
                placeholder="예: 직접 관찰 결과 L3 수준",
                key=f"leader_rat_{mid}_{sid}",
                label_visibility="collapsed",
            )
            if st.button("Leader 제출", key=f"leader_sub_{mid}_{sid}",
                         type="primary", use_container_width=True):
                submit_assessment(
                    member_id=mid, skill_id=sid, stage="leader",
                    assessor_id=assessor_id,
                    proposed_level=lv, rationale=rationale,
                )
                st.success(f"{row['name']} #{sid:03d} 제출 완료 (L{lv})")
                st.rerun()

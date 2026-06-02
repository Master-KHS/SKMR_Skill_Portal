# Skill Committee - Calibration 완료 항목을 임원 위원이 최종 의결.
# 확정 시 assessment(stage='committee', status='confirmed') + skill_profile.current_level 자동 갱신.
import pandas as pd
import streamlit as st

from assessment_logic import confirm_final, get_proposed_level
from config import COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_DARK, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header
from views._candidate_compare import render_candidate_compare_table
from views._evidence_block import render_evidence_block

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("Skill Committee",
            "Lv4 후보자에 대한 최종 의결 + skill_profile 갱신")

# 전사 단위 운영 - Committee는 전사 위원회
conn = get_connection()
try:
    pending = pd.read_sql_query(
        """
        WITH calib_done AS (
            SELECT member_id, skill_id, MAX(assessment_id) AS aid,
                   MAX(proposed_level) AS calib_lv,
                   MAX(narrative) AS narrative
            FROM assessment
            WHERE stage='calibration' AND status='submitted' AND proposed_level=4
            GROUP BY member_id, skill_id
        ),
        commit_done AS (
            SELECT DISTINCT member_id, skill_id FROM assessment
            WHERE stage='committee' AND status='confirmed'
        )
        SELECT cd.member_id, cd.skill_id, cd.calib_lv, cd.narrative,
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

        # === Lv4 후보자 자동 산출 비교 ===
        st.markdown(
            f"<p style='color:{COLOR_TEXT_MED}; font-size:12px; margin:4px 0;'>"
            f"Lv4 후보자 {len(group)}명 비교 — 자동 산출 지표</p>",
            unsafe_allow_html=True,
        )
        candidates = []
        for _, row in group.iterrows():
            mid = row["member_id"]
            candidates.append({
                "employee_id": mid,
                "name": row["name"],
                "team": row["team"],
                "role_level": row["role_level"],
                "self_lv": get_proposed_level(mid, int(sid), "self"),
                "leader_lv": get_proposed_level(mid, int(sid), "leader"),
                "calib_lv": int(row["calib_lv"]),
            })
        render_candidate_compare_table(candidates)

        st.markdown(
            f"<h6 style='color:{COLOR_NAVY}; margin:14px 0 6px 0;'>최종 의결 입력</h6>",
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
            # Committee는 Lv4 후보 의결. 확정 또는 Lv3으로 하향 가능.
            final_lv = cols[4].selectbox(
                "Final",
                options=[3, 4],
                index=1,  # 기본 L4 확정
                format_func=lambda x: f"L{x}",
                key=f"comm_lv_{mid}_{sid}",
                label_visibility="collapsed",
            )
            if cols[5].button("최종 확정", key=f"comm_sub_{mid}_{sid}",
                              type="primary", use_container_width=True):
                confirm_final(
                    member_id=mid, skill_id=int(sid), stage="committee",
                    assessor_id=assessor_id, confirmed_level=final_lv,
                )
                st.success(f"{row['name']} #{int(sid):03d} 최종 L{final_lv} 확정 + Profile 갱신")
                st.rerun()

        # Skill 그룹 내 Narrative (인원별) — Committee 의결 자료
        with st.expander("Narrative (인원별) — Committee 의결 자료", expanded=True):
            for _, row in group.iterrows():
                narr = (row["narrative"] or "").strip()
                if narr:
                    st.markdown(
                        f"""
                        <div style='border-left:3px solid {COLOR_NAVY};
                                    background:#F5F7FA; padding:10px 14px; margin-bottom:8px;'>
                            <b style='color:{COLOR_NAVY};'>{row['name']}</b>
                            <span style='color:{COLOR_TEXT_MED}; font-size:11px; margin-left:6px;'>
                                ({row['team']} · {row['role_level']})</span>
                            <p style='color:{COLOR_TEXT_DARK}; font-size:13px; margin:6px 0 0 0; line-height:1.5;'>{narr}</p>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )
                else:
                    st.markdown(
                        f"<div style='color:{COLOR_TEXT_MED}; font-size:12px; padding:6px 10px;'>"
                        f"<b>{row['name']}</b> — Narrative 미작성 (Narrative 작성 메뉴에서 입력)</div>",
                        unsafe_allow_html=True,
                    )

        with st.expander("이 Skill 관련 Evidence (인원별)", expanded=False):
            for _, row in group.iterrows():
                st.markdown(f"**{row['name']}**", unsafe_allow_html=True)
                render_evidence_block(
                    row["member_id"], int(sid),
                    allow_add=False,
                    key_suffix=f"comm_{row['member_id']}_{sid}",
                )

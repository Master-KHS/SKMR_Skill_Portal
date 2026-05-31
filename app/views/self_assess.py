# Self Assessment - 본인이 본인의 Required + 보유 Skill에 대해 Level 자가 진단.
# 각 Skill에 대해 proposed_level 입력 → submit → assessment(stage='self', status='submitted')
import pandas as pd
import streamlit as st

from assessment_logic import (
    STAGE_LABELS,
    get_latest_stage,
    get_skill_workflow_state,
    submit_assessment,
)
from config import COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_MED, LEVEL_NAMES
from persona_switch import render_persona_badge
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("📝 Self Assessment", "본인 보유·요구 Skill에 대해 Level을 직접 평가하고 제출")

if not member:
    st.warning("현재 페르소나에 매핑된 인원이 없습니다.")
    st.stop()

st.markdown(
    f"<p style='color:{COLOR_TEXT_MED};'>평가 대상: <b>{member['name']}</b> "
    f"({member['team']} · {member['role_level']})</p>",
    unsafe_allow_html=True,
)

state = get_skill_workflow_state(member["employee_id"], member.get("team"))

if state.empty:
    st.info("평가할 Skill이 없습니다 (Required Skill·보유 Skill 모두 비어 있음).")
    st.stop()

# 상단 KPI
total = len(state)
done = state["self_lv"].notna().sum()
core_total = int(state["req_is_core"].sum())
core_done = int(((state["self_lv"].notna()) & (state["req_is_core"] == 1)).sum())

k1, k2, k3 = st.columns(3)
k1.metric("평가 대상 Skill", total)
k2.metric("Self 제출 완료", f"{done} / {total}")
k3.metric("Core Skill 제출", f"{core_done} / {core_total}")

st.divider()

# 필터: 미제출만 / 전체
view_mode = st.radio(
    "보기",
    ["미제출만", "전체"],
    horizontal=True,
    key="self_view_mode",
)
filtered = state[state["self_lv"].isna()] if view_mode == "미제출만" else state

if filtered.empty:
    st.success("🎉 미제출 Skill이 없습니다. 모두 제출 완료!")
    st.stop()

st.caption(f"{len(filtered)}건 표시 · Core(★)는 우선 평가 대상")

# Skill별 평가 카드
for _, row in filtered.iterrows():
    sid = int(row["skill_id"])
    with st.container(border=True):
        head_col, lv_col = st.columns([3, 2])
        with head_col:
            core_badge = (
                f"<span style='background:{COLOR_SK_RED}; color:white; padding:2px 8px; "
                f"border-radius:10px; font-size:11px; margin-left:6px;'>★ CORE</span>"
                if row["req_is_core"] else ""
            )
            critical_badge = " 🔴" if row["is_critical"] else ""
            st.markdown(
                f"""
                <div style='color:{COLOR_TEXT_MED}; font-size:12px;'>
                    {row['family_name']} · {row['sub_family_name']}
                </div>
                <h4 style='margin:4px 0 8px 0; color:{COLOR_NAVY};'>
                    #{sid:03d} {row['skill_name']}{critical_badge}{core_badge}
                </h4>
                """,
                unsafe_allow_html=True,
            )

            cur = row.get("current_level")
            req = row.get("required_level")
            info_parts = []
            if pd.notna(cur):
                info_parts.append(f"현재 Profile: <b>L{int(cur)}</b>")
            if pd.notna(req):
                info_parts.append(f"요구 Level: <b>L{int(req)}</b>")
            if info_parts:
                st.markdown(
                    f"<p style='color:{COLOR_TEXT_MED}; font-size:13px;'>{' · '.join(info_parts)}</p>",
                    unsafe_allow_html=True,
                )

        with lv_col:
            default_lv = int(row["current_level"]) if pd.notna(row["current_level"]) else 2
            lv = st.selectbox(
                "Self Level",
                options=[1, 2, 3, 4],
                index=default_lv - 1,
                format_func=lambda x: f"L{x} · {LEVEL_NAMES[x]}",
                key=f"self_lv_{sid}",
            )
            rationale = st.text_input(
                "근거 (선택)",
                placeholder="예: 작년 OLED 프로젝트 리드",
                key=f"self_rat_{sid}",
                label_visibility="collapsed",
            )
            if st.button("Self 제출", key=f"self_sub_{sid}", type="primary", use_container_width=True):
                submit_assessment(
                    member_id=member["employee_id"],
                    skill_id=sid,
                    stage="self",
                    assessor_id=member["employee_id"],
                    proposed_level=lv,
                    rationale=rationale,
                )
                st.success(f"#{sid:03d} 제출 완료 (L{lv})")
                st.rerun()

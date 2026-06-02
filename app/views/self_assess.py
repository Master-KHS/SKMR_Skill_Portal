# 자가 진단 - 본인이 평가받을 Skill 구성 + Level 자가 진단을 한 화면에서.
# 흐름:
#   ① 평가 대상 Skill 구성 — Required Skill(Core/Non-Core 자동 포함) + 추가 Individual 신청
#   ② Level 자가 진단 — 위에서 구성된 Skill에 대해 한 건씩 제출
import pandas as pd
import streamlit as st

from assessment_logic import (
    get_skill_workflow_state,
    submit_assessment,
)
from config import COLOR_BORDER, COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_DARK, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header
from views._evidence_block import render_evidence_block

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("자가 진단",
            "평가 대상 Skill 구성 + 본인이 직접 Level 자가 진단")

if not member:
    st.warning("현재 페르소나에 매핑된 인원이 없습니다.")
    st.stop()

st.markdown(
    f"<p style='color:{COLOR_TEXT_MED};'>평가 대상: <b>{member['name']}</b> "
    f"({member['team']} · {member['role_level']})</p>",
    unsafe_allow_html=True,
)

# ========== ① 평가 대상 Skill 구성 ==========
with st.container(border=True):
    st.markdown(
        f"<h5 style='color:{COLOR_NAVY}; margin-top:0;'>① 평가 대상 Skill 구성</h5>",
        unsafe_allow_html=True,
    )
    st.caption(
        "본인의 필요 Skill(Required)은 자동 포함됩니다. "
        "추가 평가받고 싶은 Skill이 있다면 아래에서 신청하세요 (팀장 승인 후 평가 대상에 포함)."
    )

    # 본인 Required Skill 로드 — 전사 + 팀 + 개인(approved)
    conn = get_connection()
    try:
        req_df = pd.read_sql_query(
            """SELECT r.skill_id, r.target_level, r.is_core, r.org_or_individual,
                      s.skill_name, sf.sub_family_name
               FROM required_skill r
               JOIN skill s             ON r.skill_id = s.skill_id
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               WHERE (r.org_or_individual='company' AND r.target_id='ALL')
                  OR (r.org_or_individual='department' AND r.target_id=?)
                  OR (r.org_or_individual='individual' AND r.target_id=?
                       AND r.status='approved')""",
            conn, params=(member.get("team", ""), member["employee_id"]),
        )
        pending_df = pd.read_sql_query(
            """SELECT r.skill_id, r.target_level, s.skill_name, sf.sub_family_name
               FROM required_skill r
               JOIN skill s             ON r.skill_id = s.skill_id
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               WHERE r.org_or_individual='individual' AND r.target_id=?
                 AND r.status='pending'""",
            conn, params=(member["employee_id"],),
        )
        # 미매핑 Skill (신청 가능 목록)
        all_skills = pd.read_sql_query(
            """SELECT s.skill_id, s.skill_name, sf.sub_family_name, sf.family_id, f.family_name
               FROM skill s
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               JOIN skill_family f      ON sf.family_id    = f.family_id
               ORDER BY s.skill_id""",
            conn,
        )
    finally:
        conn.close()

    # Core / Non-Core 카운트
    if not req_df.empty:
        n_core = int((req_df["is_core"] == 1).sum())
        n_nc = int((req_df["is_core"] == 0).sum())
        n_company = int((req_df["org_or_individual"] == "company").sum())
        n_dept = int((req_df["org_or_individual"] == "department").sum())
        n_indv = int((req_df["org_or_individual"] == "individual").sum())
    else:
        n_core = n_nc = n_company = n_dept = n_indv = 0

    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Core", n_core)
    k2.metric("Non-Core", n_nc)
    k3.metric("개인 추가 (승인)", n_indv)
    k4.metric("승인 대기", len(pending_df))

    # 자동 포함된 Required Skill 표시 (요약 테이블)
    if req_df.empty:
        st.info("매핑된 Required Skill이 없습니다. 팀장이 필요 Skill 정의 화면에서 설정해야 합니다.")
    else:
        show = req_df.copy()
        ORG_LABEL = {"company": "전사", "department": "팀", "individual": "개인"}
        show["출처"] = show["org_or_individual"].map(ORG_LABEL)
        show["구분"] = show["is_core"].map(lambda b: "CORE" if b else "Non-Core")
        show["요구"] = show["target_level"].map(lambda x: f"L{int(x)}")
        show = show[["출처", "구분", "skill_id", "skill_name", "sub_family_name", "요구"]].rename(
            columns={"skill_id": "ID", "skill_name": "Skill", "sub_family_name": "Sub-family"}
        )
        st.dataframe(show, hide_index=True, use_container_width=True, height=240)

    # 승인 대기 표시
    if not pending_df.empty:
        st.markdown(
            f"<p style='color:{COLOR_TEXT_MED}; font-size:13px; margin-top:8px;'>"
            f"<b style='color:{COLOR_NAVY};'>승인 대기 중인 신청 {len(pending_df)}건</b> — "
            "팀장 승인 전까지 자가 진단 대상에 포함되지 않습니다.</p>",
            unsafe_allow_html=True,
        )
        for _, r in pending_df.iterrows():
            st.markdown(
                f"<div style='padding:4px 10px; border-left:2px solid {COLOR_TEXT_MED};'>"
                f"#{int(r['skill_id']):03d} {r['skill_name']} "
                f"<span style='color:{COLOR_TEXT_MED}; font-size:12px;'>({r['sub_family_name']}) · "
                f"요구 L{int(r['target_level'])}</span></div>",
                unsafe_allow_html=True,
            )

    # 신청 폼
    st.markdown(
        f"<h6 style='color:{COLOR_NAVY}; margin-top:16px;'>추가 Skill 신청 (Individual)</h6>",
        unsafe_allow_html=True,
    )
    existing_ids = set()
    if not req_df.empty:
        existing_ids.update(req_df["skill_id"].tolist())
    if not pending_df.empty:
        existing_ids.update(pending_df["skill_id"].tolist())
    avail = all_skills[~all_skills["skill_id"].isin(existing_ids)]

    with st.form("self_req_new", clear_on_submit=True):
        fcol1, fcol2, fcol3 = st.columns([4, 1, 1])
        with fcol1:
            if avail.empty:
                st.caption("추가 신청 가능한 Skill이 없습니다.")
                sel_sid = None
            else:
                sel_sid = st.selectbox(
                    "추가할 Skill",
                    options=avail["skill_id"].astype(int).tolist(),
                    format_func=lambda x: (
                        f"#{x:03d} {avail[avail['skill_id']==x].iloc[0]['skill_name']} "
                        f"({avail[avail['skill_id']==x].iloc[0]['sub_family_name']})"
                    ),
                    label_visibility="collapsed",
                )
        with fcol2:
            target_lv = st.number_input("요구 Lv", min_value=1, max_value=4, value=2, step=1,
                                          label_visibility="collapsed")
        with fcol3:
            req_submit = st.form_submit_button("신청", type="primary", use_container_width=True)
        if req_submit and sel_sid is not None:
            conn = get_connection()
            try:
                # HR Admin은 자동 승인, 그 외는 pending
                auto_approve = persona == "hr_admin"
                status = "approved" if auto_approve else "pending"
                conn.execute(
                    """INSERT INTO required_skill
                       (org_or_individual, target_id, skill_id, target_level, is_core, status)
                       VALUES ('individual', ?, ?, ?, 0, ?)""",
                    (member["employee_id"], int(sel_sid), int(target_lv), status),
                )
                conn.commit()
                if auto_approve:
                    st.success(f"#{int(sel_sid):03d} 추가 (HR Admin 자동 승인)")
                else:
                    st.success(f"#{int(sel_sid):03d} 신청 완료 — 팀장 승인 대기")
            finally:
                conn.close()
            st.rerun()

# ========== ② Level 자가 진단 ==========
st.markdown("<br>", unsafe_allow_html=True)
st.markdown(
    f"<h5 style='color:{COLOR_NAVY};'>② Level 자가 진단</h5>",
    unsafe_allow_html=True,
)
st.caption("위에서 구성된 평가 대상 Skill에 대해 본인 Level을 입력하고 제출합니다.")

state = get_skill_workflow_state(member["employee_id"], member.get("team"))

if state.empty:
    st.info("평가할 Skill이 없습니다. 위 ①에서 Required Skill을 구성하세요.")
    st.stop()

total = len(state)
done = state["self_lv"].notna().sum()
core_total = int(state["req_is_core"].sum())
core_done = int(((state["self_lv"].notna()) & (state["req_is_core"] == 1)).sum())

k1, k2, k3 = st.columns(3)
k1.metric("평가 대상 Skill", total)
k2.metric("Self 제출 완료", f"{done} / {total}")
k3.metric("Core 제출", f"{core_done} / {core_total}")

st.divider()

view_mode = st.radio(
    "보기",
    ["미제출만", "전체"], horizontal=True, key="self_view_mode",
)
filtered = state[state["self_lv"].isna()] if view_mode == "미제출만" else state

if filtered.empty:
    st.success("미제출 Skill이 없습니다. 모두 제출 완료.")
    st.stop()

st.caption(f"{len(filtered)}건 표시 · Core 표시 항목은 우선 평가 대상")

for _, row in filtered.iterrows():
    sid = int(row["skill_id"])
    with st.container(border=True):
        head_col, lv_col = st.columns([3, 2])
        with head_col:
            core_badge = (
                f"<span style='background:{COLOR_SK_RED}; color:white; padding:1px 6px; "
                f"border-radius:3px; font-size:10px; font-weight:600; "
                f"letter-spacing:0.04em; margin-left:6px; vertical-align:middle;'>CORE</span>"
                if row["req_is_core"] else ""
            )
            critical_badge = (
                f"<span style='border:1px solid {COLOR_SK_RED}; color:{COLOR_SK_RED}; "
                f"padding:1px 5px; border-radius:3px; font-size:10px; font-weight:600; "
                f"letter-spacing:0.04em; margin-left:6px; vertical-align:middle;'>CRITICAL</span>"
                if row["is_critical"] else ""
            )
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

        # Evidence 첨부·조회
        render_evidence_block(
            member["employee_id"], sid,
            allow_add=True, key_suffix="self",
        )

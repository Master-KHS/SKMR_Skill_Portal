# 자가 진단 - 좌측 Required Skill 표(선택) ↔ 우측 진단 카드 인터랙티브 레이아웃.
import pandas as pd
import streamlit as st

from assessment_logic import get_skill_workflow_state, submit_assessment
from config import COLOR_BORDER, COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_DARK, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header
from views._evidence_block import render_evidence_block

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("자가 진단",
            "조직별 자동 포함된 Required Skill에서 진단할 항목 선택 → 우측에서 Level 입력")

if not member:
    st.warning("현재 페르소나에 매핑된 인원이 없습니다.")
    st.stop()

st.markdown(
    f"<p style='color:{COLOR_TEXT_MED};'>평가 대상: <b>{member['name']}</b> "
    f"({member['team']} · {member['role_level']})</p>",
    unsafe_allow_html=True,
)

# ===== 데이터 로드 =====
state = get_skill_workflow_state(member["employee_id"], member.get("team"))

# 추가 데이터: 출처(전사/팀/개인) 표시용
conn = get_connection()
try:
    req_origin = pd.read_sql_query(
        """SELECT r.skill_id, r.org_or_individual
           FROM required_skill r
           WHERE (r.org_or_individual='company' AND r.target_id='ALL')
              OR (r.org_or_individual='department' AND r.target_id=?)
              OR (r.org_or_individual='individual' AND r.target_id=?
                   AND r.status='approved')""",
        conn, params=(member.get("team", ""), member["employee_id"]),
    )
    # 같은 skill_id가 여러 출처에 있으면 가장 좁은 범위 우선 (individual > department > company)
    PRIORITY = {"individual": 3, "department": 2, "company": 1}
    if not req_origin.empty:
        req_origin["pri"] = req_origin["org_or_individual"].map(PRIORITY)
        req_origin = req_origin.sort_values("pri", ascending=False).drop_duplicates("skill_id")
        req_origin = req_origin[["skill_id", "org_or_individual"]]

    pending_df = pd.read_sql_query(
        """SELECT r.skill_id, r.target_level, s.skill_name, sf.sub_family_name
           FROM required_skill r
           JOIN skill s ON r.skill_id = s.skill_id
           JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
           WHERE r.org_or_individual='individual' AND r.target_id=? AND r.status='pending'""",
        conn, params=(member["employee_id"],),
    )
    all_skills = pd.read_sql_query(
        "SELECT skill_id, skill_name FROM skill ORDER BY skill_id", conn,
    )
finally:
    conn.close()

if state.empty:
    st.info("평가 대상 Skill이 없습니다. 팀장이 필요 Skill 정의 화면에서 설정해야 합니다.")
    st.stop()

# 출처 합쳐넣기
state = state.merge(req_origin, on="skill_id", how="left")
state["org_or_individual"] = state["org_or_individual"].fillna("—")

# session_state - 선택된 Skill 추적
if "self_selected" not in st.session_state:
    # 기본값: 미제출 항목 전체 선택 (자주 쓰는 패턴)
    st.session_state.self_selected = set(
        state[state["self_lv"].isna()]["skill_id"].astype(int).tolist()
    )

ORG_LABEL = {"company": "전사", "department": "팀", "individual": "개인", "—": "—"}

# ===== 좌우 Split =====
left, right = st.columns([1.1, 1.9])

with left:
    st.markdown(
        f"<h5 style='color:{COLOR_NAVY}; margin-top:0;'>① 평가 대상 Skill</h5>",
        unsafe_allow_html=True,
    )

    # 필터 + KPI
    only_pending = st.checkbox("자가 진단 미제출만", value=True, key="self_filter_pending")

    if only_pending:
        view = state[state["self_lv"].isna()].copy()
    else:
        view = state.copy()

    # 표 구성
    view = view.sort_values(
        ["req_is_core", "skill_id"], ascending=[False, True],
    ).copy()
    view["진단"] = view["skill_id"].astype(int).isin(st.session_state.self_selected)
    view["출처"] = view["org_or_individual"].map(ORG_LABEL)
    view["구분"] = view["req_is_core"].map(lambda b: "CORE" if b else "Non-Core")
    view["요구"] = view["required_level"].apply(
        lambda x: f"L{int(x)}" if pd.notna(x) else "—"
    )
    view["상태"] = view["self_lv"].apply(
        lambda x: "제출됨" if pd.notna(x) else "미진행"
    )

    display = view[[
        "진단", "skill_id", "skill_name", "출처", "구분", "요구", "상태",
    ]].rename(columns={"skill_id": "ID", "skill_name": "Skill"})

    edited = st.data_editor(
        display,
        hide_index=True,
        use_container_width=True,
        num_rows="fixed",
        height=440,
        column_config={
            "진단":  st.column_config.CheckboxColumn("진단", width="small"),
            "ID":    st.column_config.NumberColumn("ID", disabled=True, width="small"),
            "Skill": st.column_config.TextColumn("Skill", disabled=True),
            "출처":  st.column_config.TextColumn("출처", disabled=True, width="small"),
            "구분":  st.column_config.TextColumn("구분", disabled=True, width="small"),
            "요구":  st.column_config.TextColumn("요구", disabled=True, width="small"),
            "상태":  st.column_config.TextColumn("상태", disabled=True, width="small"),
        },
        key="self_select_editor",
    )

    # 선택 상태 동기화
    selected_now = set(edited[edited["진단"]]["ID"].astype(int).tolist())
    unselected_now = set(edited[~edited["진단"]]["ID"].astype(int).tolist())
    st.session_state.self_selected = (
        st.session_state.self_selected - unselected_now
    ) | selected_now

    # 좌측 하단: KPI + 전체선택/해제 버튼
    bcol1, bcol2 = st.columns(2)
    if bcol1.button("표시 전체 선택", use_container_width=True, key="self_sel_all"):
        st.session_state.self_selected |= set(display["ID"].astype(int).tolist())
        st.rerun()
    if bcol2.button("표시 전체 해제", use_container_width=True, key="self_sel_none"):
        st.session_state.self_selected -= set(display["ID"].astype(int).tolist())
        st.rerun()

    st.caption(
        f"선택 {len(st.session_state.self_selected)}건 · 표시 {len(display)}건 / 전체 {len(state)}건"
    )

    # === 좌측 하단: 추가 Skill 신청 ===
    with st.expander("추가 Skill 신청 (Individual)", expanded=False):
        if not pending_df.empty:
            st.caption(f"승인 대기 {len(pending_df)}건 — 팀장 승인 후 평가 대상에 포함됩니다.")
            for _, r in pending_df.iterrows():
                st.markdown(
                    f"<div style='padding:3px 8px; color:{COLOR_TEXT_MED}; font-size:12px;'>"
                    f"#{int(r['skill_id']):03d} {r['skill_name']} · 요구 L{int(r['target_level'])}</div>",
                    unsafe_allow_html=True,
                )

        existing_ids = set(state["skill_id"].astype(int).tolist())
        if not pending_df.empty:
            existing_ids |= set(pending_df["skill_id"].astype(int).tolist())
        avail = all_skills[~all_skills["skill_id"].isin(existing_ids)]

        with st.form("self_req_new", clear_on_submit=True):
            if avail.empty:
                st.caption("추가 신청 가능한 Skill이 없습니다.")
                sel_sid = None
            else:
                sel_sid = st.selectbox(
                    "Skill",
                    options=avail["skill_id"].astype(int).tolist(),
                    format_func=lambda x: (
                        f"#{x:03d} {avail[avail['skill_id']==x].iloc[0]['skill_name']}"
                    ),
                )
            target_lv = st.number_input("요구 Lv", 1, 4, 2, 1)
            if st.form_submit_button("신청", type="primary", use_container_width=True) \
               and sel_sid is not None:
                conn = get_connection()
                try:
                    auto_approve = persona == "hr_admin"
                    status = "approved" if auto_approve else "pending"
                    conn.execute(
                        """INSERT INTO required_skill
                           (org_or_individual, target_id, skill_id, target_level, is_core, status)
                           VALUES ('individual', ?, ?, ?, 0, ?)""",
                        (member["employee_id"], int(sel_sid), int(target_lv), status),
                    )
                    conn.commit()
                finally:
                    conn.close()
                if auto_approve:
                    st.success(f"#{int(sel_sid):03d} 추가 (HR Admin 자동 승인)")
                else:
                    st.success(f"#{int(sel_sid):03d} 신청 완료 — 팀장 승인 대기")
                st.rerun()


# ===== 우측: 선택된 Skill 진단 카드 =====
with right:
    st.markdown(
        f"<h5 style='color:{COLOR_NAVY}; margin-top:0;'>② Level 자가 진단</h5>",
        unsafe_allow_html=True,
    )

    selected_ids = sorted(st.session_state.self_selected)
    sel_state = state[state["skill_id"].astype(int).isin(selected_ids)]

    if sel_state.empty:
        st.info("좌측 표에서 자가 진단할 Skill을 선택하세요.")
    else:
        sel_done = int(sel_state["self_lv"].notna().sum())
        st.caption(f"선택 {len(sel_state)}건 · 제출 완료 {sel_done}건")

        for _, row in sel_state.iterrows():
            sid = int(row["skill_id"])
            already = pd.notna(row["self_lv"])
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
                    done_chip = (
                        f"<span style='background:#1B8A50; color:white; padding:1px 6px; "
                        f"border-radius:3px; font-size:10px; font-weight:600; margin-left:6px;'>"
                        f"제출됨 L{int(row['self_lv'])}</span>" if already else ""
                    )
                    st.markdown(
                        f"""
                        <div style='color:{COLOR_TEXT_MED}; font-size:12px;'>
                            {row['family_name']} · {row['sub_family_name']}
                        </div>
                        <h5 style='margin:4px 0 6px 0; color:{COLOR_NAVY};'>
                            #{sid:03d} {row['skill_name']}{critical_badge}{core_badge}{done_chip}
                        </h5>
                        """,
                        unsafe_allow_html=True,
                    )

                    cur = row.get("current_level")
                    req = row.get("required_level")
                    info_parts = []
                    if pd.notna(cur):
                        info_parts.append(f"현재: <b>L{int(cur)}</b>")
                    if pd.notna(req):
                        info_parts.append(f"요구: <b>L{int(req)}</b>")
                    if info_parts:
                        st.markdown(
                            f"<p style='color:{COLOR_TEXT_MED}; font-size:12px; margin:0;'>"
                            f"{' · '.join(info_parts)}</p>",
                            unsafe_allow_html=True,
                        )

                with lv_col:
                    default_lv = (
                        int(row["self_lv"]) if pd.notna(row["self_lv"])
                        else (int(row["current_level"]) if pd.notna(row["current_level"]) else 2)
                    )
                    lv = st.selectbox(
                        "Self Level",
                        options=[1, 2, 3, 4],
                        index=default_lv - 1,
                        format_func=lambda x: f"L{x} · {LEVEL_NAMES[x]}",
                        key=f"self_lv_{sid}",
                    )
                    rationale = st.text_input(
                        "근거 (선택)", key=f"self_rat_{sid}",
                        label_visibility="collapsed",
                        placeholder="근거 (선택)",
                    )
                    btn_label = "재제출" if already else "Self 제출"
                    if st.button(btn_label, key=f"self_sub_{sid}",
                                  type="primary", use_container_width=True):
                        submit_assessment(
                            member_id=member["employee_id"],
                            skill_id=sid, stage="self",
                            assessor_id=member["employee_id"],
                            proposed_level=lv, rationale=rationale,
                        )
                        st.success(f"#{sid:03d} 제출 완료 (L{lv})")
                        st.rerun()

                render_evidence_block(
                    member["employee_id"], sid,
                    allow_add=True, key_suffix="self",
                )

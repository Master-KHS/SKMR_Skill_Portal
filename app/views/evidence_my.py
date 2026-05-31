# Evidence (내 자료) - 본인 평가 근거 자료 등록·목록·삭제 + Skill 연결.
# 권한 분기: 본인 데이터만 보임. HR Admin은 모든 사람 선택 가능 (운영용).
import pandas as pd
import streamlit as st

from config import COLOR_BORDER, COLOR_NAVY, COLOR_TEXT_MED
from db import get_connection
from persona_switch import render_persona_badge
from seed.evidence_seed import EVIDENCE_TYPES, TYPE_LABELS
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("My Evidence",
            "본인 평가 근거 자료 등록·관리 (프로젝트·자격증·교육·산출물·특허)")

if not member:
    st.warning("현재 페르소나에 매핑된 인원이 없습니다.")
    st.stop()

# HR Admin이면 다른 사람의 Evidence도 조회·편집 가능 (운영 목적)
conn = get_connection()
try:
    if persona == "hr_admin":
        all_members = pd.read_sql_query(
            """SELECT employee_id, name, team, role_level FROM member
               WHERE job_type IN ('사무직','기술직','연구직')
               ORDER BY team, role_level DESC, name""",
            conn,
        )
finally:
    conn.close()

if persona == "hr_admin":
    opts = all_members["employee_id"].tolist()
    default_idx = opts.index(member["employee_id"]) if member["employee_id"] in opts else 0
    sel_emp = st.selectbox(
        "구성원 선택 (HR Admin 운영용)",
        options=opts,
        index=default_idx,
        format_func=lambda eid: (
            f"{all_members[all_members['employee_id']==eid].iloc[0]['name']} "
            f"({all_members[all_members['employee_id']==eid].iloc[0]['team']} · "
            f"{all_members[all_members['employee_id']==eid].iloc[0]['role_level']})"
        ),
        key="evidence_emp_select",
    )
    target_emp = sel_emp
else:
    target_emp = member["employee_id"]
    st.caption(f"대상: **{member['name']}** ({member['team']} · {member['role_level']})")

# Skill 풀 (등록 시 연결할 Skill 선택용)
conn = get_connection()
try:
    skills = pd.read_sql_query(
        """SELECT s.skill_id, s.skill_name, sf.sub_family_name, f.family_name
           FROM skill s
           JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
           JOIN skill_family f      ON sf.family_id    = f.family_id
           ORDER BY s.skill_id""",
        conn,
    )
    evidences = pd.read_sql_query(
        """SELECT e.evidence_id, e.evidence_type, e.title, e.description,
                  e.created_date,
                  GROUP_CONCAT(esl.skill_id) AS skill_ids
           FROM evidence e
           LEFT JOIN evidence_skill_link esl ON e.evidence_id = esl.evidence_id
           WHERE e.member_id = ?
           GROUP BY e.evidence_id
           ORDER BY e.created_date DESC""",
        conn, params=(target_emp,),
    )
finally:
    conn.close()

# 상단 KPI - 유형별 카운트
st.markdown(f"<h4 style='color:{COLOR_NAVY};'>유형별 등록 현황</h4>", unsafe_allow_html=True)
cols = st.columns(len(EVIDENCE_TYPES))
type_counts = evidences["evidence_type"].value_counts() if not evidences.empty else pd.Series()
for i, etype in enumerate(EVIDENCE_TYPES):
    cols[i].metric(TYPE_LABELS[etype], int(type_counts.get(etype, 0)))

st.divider()

# --- 새 Evidence 등록 폼 ---
with st.expander("➕ 새 Evidence 등록", expanded=False):
    with st.form("new_evidence", clear_on_submit=True):
        c1, c2 = st.columns([2, 1])
        title = c1.text_input("제목 *", placeholder="예: OLED HTL 합성 Recipe 도출 프로젝트")
        ev_type = c2.selectbox(
            "유형 *",
            options=EVIDENCE_TYPES,
            format_func=lambda t: TYPE_LABELS[t],
        )
        description = st.text_area("설명", placeholder="활동·성과·역할 등을 자유롭게 기록")
        created_date = st.date_input("일자 *")

        # 연결할 Skill 다중 선택
        skill_options = skills["skill_id"].astype(int).tolist()
        skill_label_map = {
            int(r["skill_id"]): f"#{int(r['skill_id']):03d} {r['skill_name']} ({r['sub_family_name']})"
            for _, r in skills.iterrows()
        }
        linked_skills = st.multiselect(
            "관련 Skill (다중 선택)",
            options=skill_options,
            format_func=lambda sid: skill_label_map.get(sid, str(sid)),
        )

        submitted = st.form_submit_button("등록", type="primary", use_container_width=True)
        if submitted:
            if not title.strip():
                st.error("제목은 필수입니다.")
            else:
                conn = get_connection()
                try:
                    cur = conn.cursor()
                    cur.execute(
                        """INSERT INTO evidence
                           (member_id, evidence_type, title, description, file_path, created_date)
                           VALUES (?,?,?,?,NULL,?)""",
                        (target_emp, ev_type, title.strip(), description.strip(), str(created_date)),
                    )
                    new_id = cur.lastrowid
                    for sid in linked_skills:
                        cur.execute(
                            "INSERT OR IGNORE INTO evidence_skill_link VALUES (?,?)",
                            (new_id, int(sid)),
                        )
                    conn.commit()
                finally:
                    conn.close()
                st.success(f"Evidence 등록 완료 (ID {new_id})")
                st.rerun()

# --- 목록 + 필터 ---
st.markdown(f"<h4 style='color:{COLOR_NAVY};'>등록된 Evidence</h4>", unsafe_allow_html=True)

if evidences.empty:
    st.info("등록된 Evidence가 없습니다. 위 ➕ 버튼으로 추가하세요.")
else:
    fcol1, fcol2 = st.columns([2, 4])
    with fcol1:
        type_filter = st.selectbox(
            "유형 필터",
            options=["전체"] + EVIDENCE_TYPES,
            format_func=lambda t: t if t == "전체" else TYPE_LABELS[t],
            key="evidence_type_filter",
        )
    with fcol2:
        keyword = st.text_input("제목 검색", key="evidence_keyword")

    view = evidences.copy()
    if type_filter != "전체":
        view = view[view["evidence_type"] == type_filter]
    if keyword.strip():
        view = view[view["title"].str.contains(keyword.strip(), case=False, na=False)]

    st.caption(f"{len(view)} / {len(evidences)} 건")

    for _, row in view.iterrows():
        with st.container(border=True):
            head_col, action_col = st.columns([5, 1])
            with head_col:
                st.markdown(
                    f"""
                    <div style='color:{COLOR_TEXT_MED}; font-size:12px;'>
                        {TYPE_LABELS.get(row['evidence_type'], row['evidence_type'])} · {row['created_date']}
                    </div>
                    <h5 style='margin:4px 0 6px 0; color:{COLOR_NAVY};'>{row['title']}</h5>
                    <p style='color:{COLOR_TEXT_MED}; font-size:13px; margin:0;'>
                        {row['description'] or '(설명 없음)'}
                    </p>
                    """,
                    unsafe_allow_html=True,
                )
                # 연결된 Skill 태그
                if row["skill_ids"]:
                    sids = [int(s) for s in str(row["skill_ids"]).split(",")]
                    chips = "".join([
                        f"<span style='display:inline-block; background:#F5F5F7; "
                        f"color:{COLOR_NAVY}; padding:2px 8px; border-radius:8px; "
                        f"font-size:11px; margin:6px 4px 0 0;'>#{sid:03d} "
                        f"{skill_label_map.get(sid, '?').split(' ', 1)[1] if sid in skill_label_map else '?'}"
                        f"</span>"
                        for sid in sids
                    ])
                    st.markdown(f"<div>{chips}</div>", unsafe_allow_html=True)

            with action_col:
                if st.button("삭제", key=f"del_ev_{row['evidence_id']}",
                             use_container_width=True):
                    conn = get_connection()
                    try:
                        cur = conn.cursor()
                        cur.execute("DELETE FROM evidence_skill_link WHERE evidence_id=?",
                                    (int(row["evidence_id"]),))
                        cur.execute("DELETE FROM evidence WHERE evidence_id=?",
                                    (int(row["evidence_id"]),))
                        conn.commit()
                    finally:
                        conn.close()
                    st.success(f"#{row['evidence_id']} 삭제됨")
                    st.rerun()

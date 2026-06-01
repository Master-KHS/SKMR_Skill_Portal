# 운영 정책 관리 - Skill Architecture(Family·Sub-family) + Level 체계 + Level Criteria 편집.
# 정책 변경 시 시스템 개편 없이 화면에서 직접 대응.
import pandas as pd
import streamlit as st

from config import COLOR_NAVY, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
render_persona_badge(persona)
page_header(
    "운영 정책 관리",
    "Skill Architecture · Level 체계 — 정책 변경을 시스템에서 직접 (HR Admin 전용)",
)

if persona not in ("hr_admin", "hr_viewer"):
    st.error("이 화면은 HR Admin / HR Viewer 권한에서만 접근 가능합니다.")
    st.stop()

read_only = persona != "hr_admin"
if read_only:
    st.info("HR Viewer는 조회 전용입니다.")


def _load_families():
    conn = get_connection()
    try:
        return pd.read_sql_query("SELECT * FROM skill_family ORDER BY family_id", conn)
    finally:
        conn.close()


def _load_subs():
    conn = get_connection()
    try:
        return pd.read_sql_query(
            """SELECT sf.sub_family_id, sf.sub_family_name, sf.description,
                      sf.family_id, f.family_name
               FROM sub_skill_family sf JOIN skill_family f ON sf.family_id = f.family_id
               ORDER BY sf.family_id, sf.sub_family_id""",
            conn,
        )
    finally:
        conn.close()


def _load_criteria():
    conn = get_connection()
    try:
        return pd.read_sql_query(
            """SELECT lc.sub_family_id, sf.sub_family_name, lc.level,
                      lc.expertise_criteria, lc.impact_criteria
               FROM level_criteria lc
               JOIN sub_skill_family sf ON lc.sub_family_id = sf.sub_family_id
               ORDER BY sf.sub_family_id, lc.level""",
            conn,
        )
    finally:
        conn.close()


def _ref_count_family(family_id: str) -> int:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT COUNT(*) FROM sub_skill_family WHERE family_id=?", (family_id,)
        ).fetchone()[0]
    finally:
        conn.close()


def _ref_count_sub(sub_family_id: str) -> int:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT COUNT(*) FROM skill WHERE sub_family_id=?", (sub_family_id,)
        ).fetchone()[0]
    finally:
        conn.close()


tab1, tab2, tab3, tab4 = st.tabs([
    "Family", "Sub-family", "Level 체계", "Level Criteria",
])

# ===== Family =====
with tab1:
    st.caption("대분류 (Family). 추가·이름·설명 변경 가능. 하위 Sub-family가 있으면 삭제 차단.")
    families = _load_families()

    if not read_only:
        with st.expander("새 Family 추가", expanded=False):
            with st.form("new_family", clear_on_submit=True):
                ncol1, ncol2 = st.columns([1, 3])
                new_id = ncol1.text_input("Family ID (3자리, 예: NEW)")
                new_name = ncol2.text_input("이름 *")
                new_desc = st.text_area("설명", height=70)
                if st.form_submit_button("Family 추가", type="primary"):
                    if not (new_id.strip() and new_name.strip()):
                        st.error("ID와 이름은 필수입니다.")
                    else:
                        conn = get_connection()
                        try:
                            try:
                                conn.execute(
                                    "INSERT INTO skill_family VALUES (?,?,?)",
                                    (new_id.strip().upper(), new_name.strip(), new_desc.strip()),
                                )
                                conn.commit()
                                st.success(f"'{new_name}' 추가됨")
                                st.rerun()
                            except Exception as e:
                                st.error(f"실패: {e}")
                        finally:
                            conn.close()

    edited = st.data_editor(
        families.rename(columns={
            "family_id": "ID", "family_name": "이름", "description": "설명",
        }),
        hide_index=True, use_container_width=True,
        disabled=("ID",) if not read_only else True,
        num_rows="fixed",
        column_config={
            "ID": st.column_config.TextColumn("ID", width="small"),
        },
        key="fam_editor",
    )

    if not read_only:
        bcol1, bcol2 = st.columns([1, 1])
        with bcol1:
            if st.button("Family 변경사항 저장", type="primary", key="fam_save"):
                conn = get_connection()
                try:
                    cur = conn.cursor()
                    for _, r in edited.iterrows():
                        cur.execute(
                            "UPDATE skill_family SET family_name=?, description=? WHERE family_id=?",
                            (r["이름"], r["설명"] or "", r["ID"]),
                        )
                    conn.commit()
                finally:
                    conn.close()
                st.success("저장됨")
                st.rerun()
        with bcol2:
            del_id = st.selectbox(
                "삭제할 Family",
                options=[""] + families["family_id"].tolist(),
                key="fam_del_sel",
                label_visibility="collapsed",
                format_func=lambda fid: "(선택)" if fid == "" else f"{fid} · "
                  f"{families[families['family_id']==fid].iloc[0]['family_name']}",
            )
            if st.button("Family 삭제", key="fam_del_btn", disabled=(del_id == "")):
                ref = _ref_count_family(del_id)
                if ref > 0:
                    st.error(f"삭제 차단: 하위 Sub-family {ref}건 존재")
                else:
                    conn = get_connection()
                    try:
                        conn.execute("DELETE FROM skill_family WHERE family_id=?", (del_id,))
                        conn.commit()
                    finally:
                        conn.close()
                    st.success("삭제됨")
                    st.rerun()


# ===== Sub-family =====
with tab2:
    st.caption("중분류 (Sub-family). 소속 Family·이름·설명 변경. 하위 Skill이 있으면 삭제 차단.")
    subs = _load_subs()
    families = _load_families()
    fam_id_to_name = dict(zip(families["family_id"], families["family_name"]))

    if not read_only:
        with st.expander("새 Sub-family 추가", expanded=False):
            with st.form("new_sub", clear_on_submit=True):
                ncol1, ncol2, ncol3 = st.columns([1, 2, 2])
                new_id = ncol1.text_input("Sub-family ID (3-4자리)")
                new_fam = ncol2.selectbox("소속 Family", families["family_id"].tolist(),
                                            format_func=lambda fid: f"{fid} · {fam_id_to_name.get(fid,'')}")
                new_name = ncol3.text_input("이름 *")
                new_desc = st.text_area("설명", height=70)
                if st.form_submit_button("Sub-family 추가", type="primary"):
                    if not (new_id.strip() and new_name.strip()):
                        st.error("ID와 이름은 필수입니다.")
                    else:
                        conn = get_connection()
                        try:
                            try:
                                conn.execute(
                                    "INSERT INTO sub_skill_family VALUES (?,?,?,?)",
                                    (new_id.strip().upper(), new_fam, new_name.strip(),
                                     new_desc.strip()),
                                )
                                conn.commit()
                                st.success("추가됨")
                                st.rerun()
                            except Exception as e:
                                st.error(f"실패: {e}")
                        finally:
                            conn.close()

    # 인라인 편집
    edit_df = subs[["sub_family_id", "sub_family_name", "description", "family_id"]].copy()
    edit_df = edit_df.rename(columns={
        "sub_family_id": "ID", "sub_family_name": "이름",
        "description": "설명", "family_id": "Family",
    })
    fam_options = families["family_id"].tolist()

    edited_subs = st.data_editor(
        edit_df,
        hide_index=True, use_container_width=True,
        num_rows="fixed",
        disabled=("ID",) if not read_only else True,
        column_config={
            "ID": st.column_config.TextColumn("ID", width="small"),
            "Family": st.column_config.SelectboxColumn("Family", options=fam_options, width="small"),
        },
        key="sub_editor",
    )

    if not read_only:
        bcol1, bcol2 = st.columns(2)
        with bcol1:
            if st.button("Sub-family 변경사항 저장", type="primary", key="sub_save"):
                conn = get_connection()
                try:
                    cur = conn.cursor()
                    for _, r in edited_subs.iterrows():
                        cur.execute(
                            "UPDATE sub_skill_family SET sub_family_name=?, description=?, family_id=? WHERE sub_family_id=?",
                            (r["이름"], r["설명"] or "", r["Family"], r["ID"]),
                        )
                    conn.commit()
                finally:
                    conn.close()
                st.success("저장됨")
                st.rerun()
        with bcol2:
            del_sid = st.selectbox(
                "삭제할 Sub-family",
                options=[""] + subs["sub_family_id"].tolist(),
                key="sub_del_sel",
                label_visibility="collapsed",
                format_func=lambda sid: "(선택)" if sid == "" else
                  f"{sid} · {subs[subs['sub_family_id']==sid].iloc[0]['sub_family_name']}",
            )
            if st.button("Sub-family 삭제", key="sub_del_btn", disabled=(del_sid == "")):
                ref = _ref_count_sub(del_sid)
                if ref > 0:
                    st.error(f"삭제 차단: 하위 Skill {ref}건 존재")
                else:
                    conn = get_connection()
                    try:
                        conn.execute("DELETE FROM sub_skill_family WHERE sub_family_id=?", (del_sid,))
                        conn.execute("DELETE FROM level_criteria WHERE sub_family_id=?", (del_sid,))
                        conn.commit()
                    finally:
                        conn.close()
                    st.success("삭제됨")
                    st.rerun()


# ===== Level 체계 =====
with tab3:
    st.caption("Level 단계 명칭. 현재 4단계 (L1~L4) 고정. 명칭만 변경 가능.")
    st.markdown(
        f"<p style='color:{COLOR_TEXT_MED};'>※ Level 단계 수 변경(예: 5단계)은 시스템 구조 영향이 크므로 추후 별도 작업.</p>",
        unsafe_allow_html=True,
    )

    # config.LEVEL_NAMES는 코드에 박혀있음. 화면에서는 표시만 + DB에 저장 가능한 별도 테이블 도입은 추후.
    # 현재는 LEVEL_NAMES 매핑을 read-only로 표시
    lv_df = pd.DataFrame([
        {"Level": f"L{lv}", "현재 명칭": name}
        for lv, name in LEVEL_NAMES.items()
    ])
    st.dataframe(lv_df, hide_index=True, use_container_width=True)
    st.caption(
        "명칭 변경 기능은 다음 단계에서 추가 예정 (별도 level_name 테이블 도입). "
        "임시로는 app/config.py의 LEVEL_NAMES dict를 직접 편집하면 즉시 반영."
    )


# ===== Level Criteria =====
with tab4:
    st.caption("Sub-family × Level 전문성(Expertise)·영향력(Impact) 기준 텍스트. Sub-family 선택 후 4단계 편집.")
    criteria = _load_criteria()
    subs = _load_subs()

    sel_sub_id = st.selectbox(
        "Sub-family 선택",
        options=subs["sub_family_id"].tolist(),
        format_func=lambda sid: f"{sid} · {subs[subs['sub_family_id']==sid].iloc[0]['sub_family_name']}",
        key="crit_sub_sel",
    )

    sub_crit = criteria[criteria["sub_family_id"] == sel_sub_id].sort_values("level", ascending=False).copy()
    sub_crit["Level"] = sub_crit["level"].map(lambda lv: f"L{int(lv)} · {LEVEL_NAMES.get(int(lv),'')}")
    edit_crit = sub_crit[["Level", "expertise_criteria", "impact_criteria"]].rename(columns={
        "expertise_criteria": "전문성 (Expertise)", "impact_criteria": "영향력 (Impact)",
    })

    edited_crit = st.data_editor(
        edit_crit,
        hide_index=True, use_container_width=True, num_rows="fixed",
        disabled=("Level",) if not read_only else True,
        key=f"crit_editor_{sel_sub_id}",
    )

    if not read_only:
        if st.button("Level Criteria 저장", type="primary", key=f"crit_save_{sel_sub_id}"):
            conn = get_connection()
            try:
                cur = conn.cursor()
                for _, r in edited_crit.iterrows():
                    lv = int(r["Level"].split("·")[0].replace("L", "").strip())
                    cur.execute(
                        """UPDATE level_criteria
                           SET expertise_criteria=?, impact_criteria=?
                           WHERE sub_family_id=? AND level=?""",
                        (r["전문성 (Expertise)"], r["영향력 (Impact)"], sel_sub_id, lv),
                    )
                conn.commit()
            finally:
                conn.close()
            st.success("저장됨")
            st.rerun()

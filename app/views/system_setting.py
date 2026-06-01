# Settings - HR Admin 전용 관리 화면.
# - 시스템 정보 (DB 위치·카운트·로고 상태)
# - Skill Critical 지정 (전사 Critical Skill 토글)
# - 시드 재적재 (개별·전체)
# - DB 리셋 (확인 절차 포함)
import pandas as pd
import streamlit as st

from config import COLOR_BORDER, COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_MED, DB_PATH, LOGO_PATH
from db import get_connection
from persona_switch import render_persona_badge
from schema import init_db
from seed.evidence_seed import seed_evidences
from seed.members_loader import sync_members_from_xlsx
from seed.required_skill_seed import seed_required_skills
from seed.simulation_seed import (
    generate_simulation_data,
    get_simulation_count,
    is_simulation_active,
    remove_simulation_data,
)
from seed.skill_profile_seed import seed_skill_profiles
from seed.skill_taxonomy import seed_skill_taxonomy
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
render_persona_badge(persona)
page_header("Settings", "시스템 관리 — DB·시드·Critical Skill 지정 (HR Admin 전용)")

# 권한 가드
if persona != "hr_admin":
    st.error("이 화면은 HR Admin 권한에서만 접근 가능합니다.")
    st.stop()

# ===== 시스템 정보 =====
st.markdown(
    f"<h5 style='color:{COLOR_NAVY};'>시스템 정보</h5>",
    unsafe_allow_html=True,
)

conn = get_connection()
try:
    counts = {
        "member":            conn.execute("SELECT COUNT(*) FROM member").fetchone()[0],
        "skill":             conn.execute("SELECT COUNT(*) FROM skill").fetchone()[0],
        "skill_profile":     conn.execute("SELECT COUNT(*) FROM skill_profile").fetchone()[0],
        "required_skill":    conn.execute("SELECT COUNT(*) FROM required_skill").fetchone()[0],
        "assessment":        conn.execute("SELECT COUNT(*) FROM assessment").fetchone()[0],
        "evidence":          conn.execute("SELECT COUNT(*) FROM evidence").fetchone()[0],
        "critical_skill":    conn.execute("SELECT COUNT(*) FROM skill WHERE is_critical=1").fetchone()[0],
    }
finally:
    conn.close()

c1, c2, c3, c4 = st.columns(4)
c1.metric("구성원", counts["member"])
c2.metric("Skill", counts["skill"])
c3.metric("Profile", counts["skill_profile"])
c4.metric("Critical 지정", counts["critical_skill"])

c5, c6, c7, c8 = st.columns(4)
c5.metric("Required 매핑", counts["required_skill"])
c6.metric("Assessment 이력", counts["assessment"])
c7.metric("Evidence", counts["evidence"])
c8.metric("DB 파일 (KB)", f"{DB_PATH.stat().st_size / 1024:.0f}" if DB_PATH.exists() else "—")

with st.expander("파일 경로"):
    st.code(f"DB:   {DB_PATH}", language=None)
    st.code(f"Logo: {LOGO_PATH} ({'OK' if LOGO_PATH.exists() else '없음'})", language=None)

st.divider()

# ===== 시뮬레이션 데이터 =====
st.markdown(
    f"<h5 style='color:{COLOR_NAVY};'>시뮬레이션 데이터</h5>",
    unsafe_allow_html=True,
)
st.caption(
    "시연·검증용 가상 인원 약 125명(5담당 × 3팀 × 9명 + 담당 5명)을 마스터에 추가합니다. "
    "활성화 시 Dashboard·Reporting에서 더 풍부한 분포를 볼 수 있습니다. "
    "비활성화하면 가상 인원과 그들의 평가·Profile·Evidence가 모두 제거됩니다."
)

sim_active = is_simulation_active()
sim_count = get_simulation_count()

simcol1, simcol2 = st.columns([3, 1])
with simcol1:
    if sim_active:
        st.markdown(
            f"<div style='padding:10px; background:#F0F7EF; border-left:3px solid #1B8A50;'>"
            f"<b style='color:#1B8A50;'>활성</b> · 가상 인원 {sim_count}명 추가 상태</div>",
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            f"<div style='padding:10px; background:#F5F5F7; border-left:3px solid {COLOR_TEXT_MED};'>"
            f"<b style='color:{COLOR_TEXT_MED};'>비활성</b> · 실명·초기 시드 마스터만</div>",
            unsafe_allow_html=True,
        )

with simcol2:
    if sim_active:
        if st.button("시뮬 데이터 제거", use_container_width=True, key="sim_off"):
            info = remove_simulation_data()
            st.success(f"{info['removed']}명 제거됨 · 잔여 {info['remaining']}명")
            st.rerun()
    else:
        if st.button("시뮬 데이터 생성", type="primary", use_container_width=True, key="sim_on"):
            with st.spinner("가상 인원 생성 중..."):
                info = generate_simulation_data()
            if info.get("skipped"):
                st.info(f"이미 {info['existing']}건 존재")
            else:
                st.success(f"{info['added']}명 추가 · 총 {info['total_members']}명")
                st.warning("Skill Profile·Evidence를 새 인원에 맞춰 재생성하려면 아래 시드 재적재를 실행하세요.")
            st.rerun()

st.divider()

# ===== Critical Skill 지정 =====
st.markdown(
    f"<h5 style='color:{COLOR_NAVY};'>Critical Skill 지정</h5>",
    unsafe_allow_html=True,
)
st.caption(
    "전사 Critical Skill을 토글합니다. Dashboard의 'Critical Skill 현황' 위젯과 "
    "Top Holders의 Critical 보유 수치에 자동 반영됩니다."
)

conn = get_connection()
try:
    skills_df = pd.read_sql_query(
        """SELECT s.skill_id, s.skill_name, s.is_critical,
                  sf.sub_family_name, f.family_name
           FROM skill s
           JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
           JOIN skill_family f      ON sf.family_id    = f.family_id
           ORDER BY s.is_critical DESC, s.skill_id""",
        conn,
    )
finally:
    conn.close()

# 필터
fcol1, fcol2, fcol3 = st.columns([2, 2, 4])
with fcol1:
    fam_opts = ["전체"] + skills_df["family_name"].drop_duplicates().tolist()
    sel_fam = st.selectbox("Family", fam_opts, key="set_fam")
with fcol2:
    pool = skills_df if sel_fam == "전체" else skills_df[skills_df["family_name"] == sel_fam]
    sub_opts = ["전체"] + pool["sub_family_name"].drop_duplicates().tolist()
    sel_sub = st.selectbox("Sub-family", sub_opts, key="set_sub")
with fcol3:
    only_critical = st.checkbox("Critical만 보기", value=False, key="set_only_crit")
    keyword = st.text_input("Skill 검색", key="set_keyword", label_visibility="collapsed",
                              placeholder="Skill 이름 검색")

view = skills_df.copy()
if sel_fam != "전체":
    view = view[view["family_name"] == sel_fam]
if sel_sub != "전체":
    view = view[view["sub_family_name"] == sel_sub]
if only_critical:
    view = view[view["is_critical"] == 1]
if keyword.strip():
    view = view[view["skill_name"].str.contains(keyword.strip(), case=False, na=False)]

view = view.copy()
view["Critical"] = view["is_critical"].astype(bool)
view_for_editor = view[["Critical", "skill_id", "skill_name",
                          "sub_family_name", "family_name"]].rename(columns={
    "skill_id": "ID", "skill_name": "Skill",
    "sub_family_name": "Sub-family", "family_name": "Family",
})

edited = st.data_editor(
    view_for_editor,
    hide_index=True,
    use_container_width=True,
    height=420,
    column_config={
        "Critical": st.column_config.CheckboxColumn("Critical", width="small"),
        "ID":         st.column_config.NumberColumn("ID", disabled=True, width="small"),
        "Skill":      st.column_config.TextColumn("Skill", disabled=True),
        "Sub-family": st.column_config.TextColumn("Sub-family", disabled=True, width="small"),
        "Family":     st.column_config.TextColumn("Family", disabled=True, width="small"),
    },
    key="critical_editor",
)

if st.button("Critical 변경사항 저장", type="primary", key="save_critical"):
    conn = get_connection()
    try:
        cur = conn.cursor()
        # 변경된 행만 업데이트
        n_changed = 0
        for _, row in edited.iterrows():
            sid = int(row["ID"])
            new_val = 1 if row["Critical"] else 0
            old_val = int(skills_df[skills_df["skill_id"] == sid].iloc[0]["is_critical"])
            if new_val != old_val:
                cur.execute("UPDATE skill SET is_critical=? WHERE skill_id=?", (new_val, sid))
                n_changed += 1
        conn.commit()
    finally:
        conn.close()
    if n_changed > 0:
        st.success(f"{n_changed}건 변경사항 저장됨")
    else:
        st.info("변경사항이 없습니다.")
    st.rerun()

st.divider()

# ===== 시드 재적재 =====
st.markdown(
    f"<h5 style='color:{COLOR_NAVY};'>시드 재적재</h5>",
    unsafe_allow_html=True,
)
st.caption(
    "각 시드는 해당 테이블이 비어있을 때만 적재됩니다. "
    "Skill Profile·Evidence는 강제 재적재(force) 옵션 제공."
)

sc1, sc2, sc3 = st.columns(3)
with sc1:
    if st.button("Skill Taxonomy 적재", use_container_width=True, key="seed_skill"):
        conn = get_connection()
        try:
            r = seed_skill_taxonomy(conn)
        finally:
            conn.close()
        st.success(f"Skill: {r}")
with sc2:
    if st.button("Required Skill 적재", use_container_width=True, key="seed_req"):
        conn = get_connection()
        try:
            r = seed_required_skills(conn)
        finally:
            conn.close()
        st.success(f"Required: {r}")
with sc3:
    if st.button("Members 엑셀 동기화", use_container_width=True, key="seed_mem"):
        r = sync_members_from_xlsx()
        st.success(f"Members: {r['loaded']}명")

sc4, sc5 = st.columns(2)
with sc4:
    if st.button("Skill Profile 강제 재생성", use_container_width=True, key="seed_prof"):
        conn = get_connection()
        try:
            r = seed_skill_profiles(conn, force=True)
        finally:
            conn.close()
        st.success(f"Skill Profile: {r}")
        st.caption("기존 평가 결과로 갱신된 current_level도 같이 초기화됩니다.")
with sc5:
    if st.button("Evidence 강제 재생성", use_container_width=True, key="seed_ev"):
        conn = get_connection()
        try:
            r = seed_evidences(conn, force=True)
        finally:
            conn.close()
        st.success(f"Evidence: {r}")

st.divider()

# ===== DB 리셋 (위험 작업) =====
st.markdown(
    f"<h5 style='color:{COLOR_SK_RED};'>위험 영역 — DB 전체 리셋</h5>",
    unsafe_allow_html=True,
)
st.caption(
    "모든 평가 이력·Evidence·Skill Profile이 시드 초기 상태로 돌아갑니다. "
    "Member 엑셀은 보존됩니다."
)

with st.container(border=True):
    confirm = st.checkbox("위 내용 확인했음 (체크해야 버튼 활성화)", key="reset_confirm")
    if st.button("DB 전체 리셋 실행", type="primary", disabled=not confirm, key="reset_btn"):
        import os
        if DB_PATH.exists():
            os.remove(DB_PATH)
        # 재초기화
        init_db()
        conn = get_connection()
        try:
            seed_skill_taxonomy(conn)
            seed_required_skills(conn)
        finally:
            conn.close()
        sync_members_from_xlsx()
        conn = get_connection()
        try:
            seed_skill_profiles(conn)
            seed_evidences(conn)
        finally:
            conn.close()
        st.success("DB 전체 리셋 + 시드 재적재 완료")
        st.rerun()

# Member 관리 - 마스터(엑셀) 조회·필터·다운로드·업로드·새로고침.
# 엑셀(=data/members.xlsx)이 정답. 화면은 조회 + 엑셀 동기화 UI 제공.
from io import BytesIO

import pandas as pd
import streamlit as st

from config import COLOR_NAVY, COLOR_TEXT_MED
from persona_switch import render_persona_badge
from seed.members_loader import (
    MEMBERS_XLSX,
    load_members_df_from_db,
    save_df_to_xlsx_and_db,
    save_uploaded_xlsx,
    sync_members_from_xlsx,
)
from permissions import PERSONA_LABELS
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
render_persona_badge(persona)
page_header(
    "구성원 관리",
    "마스터 데이터 (HRIS 대체) — 엑셀이 정답, 화면은 조회·동기화",
)

# --- 엑셀 경로 + 동기화 버튼 영역 ---
with st.container(border=True):
    st.markdown(
        f"<p style='color:{COLOR_TEXT_MED}; font-size:13px; margin:0;'>마스터 엑셀 파일</p>"
        f"<code style='font-size:12px;'>{MEMBERS_XLSX}</code>",
        unsafe_allow_html=True,
    )
    st.caption(
        "탐색기에서 위 파일을 직접 열어 편집 → 저장 → 아래 **🔄 엑셀 새로고침** 누르면 시스템에 반영됩니다. "
        "필수 컬럼(9개) 외 임의 컬럼은 자유롭게 추가 가능 (자동 인식)."
    )

    bcol1, bcol2, bcol3 = st.columns(3)

    with bcol1:
        if st.button("🔄 엑셀 새로고침", use_container_width=True, type="primary"):
            try:
                info = sync_members_from_xlsx()
                st.success(f"동기화 완료: {info['loaded']}명")
                if info["extra_columns"]:
                    st.caption(f"인식된 추가 컬럼: {', '.join(info['extra_columns'])}")
                st.rerun()
            except Exception as e:
                st.error(f"동기화 실패: {e}")

    with bcol2:
        # 엑셀 파일을 그대로 다운로드 (백업 또는 다른 PC에서 작업용)
        if MEMBERS_XLSX.exists():
            with open(MEMBERS_XLSX, "rb") as f:
                st.download_button(
                    "📥 엑셀 다운로드",
                    data=f.read(),
                    file_name="members.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    use_container_width=True,
                )

    with bcol3:
        uploaded = st.file_uploader(
            "📤 엑셀 업로드 (기존 덮어쓰기)",
            type=["xlsx"],
            label_visibility="collapsed",
            key="member_xlsx_upload",
        )
        if uploaded is not None:
            try:
                info = save_uploaded_xlsx(uploaded.getvalue())
                st.success(f"업로드 + 동기화 완료: {info['loaded']}명")
                st.rerun()
            except Exception as e:
                st.error(f"업로드 실패: {e}")

st.divider()

# --- 마스터 조회 ---
df = load_members_df_from_db()

# 상단 요약 KPI
mcol1, mcol2, mcol3, mcol4 = st.columns(4)
mcol1.metric("총 인원", len(df))
mcol2.metric("평가 대상", int((df["job_type"].isin(["사무직", "기술직", "연구직"])).sum()))
mcol3.metric("팀 수", df["team"].nunique())
mcol4.metric("HR Admin", int((df["persona_role"] == "hr_admin").sum()))

# 필터
fcol1, fcol2, fcol3, fcol4 = st.columns(4)
with fcol1:
    div_opts = ["전체"] + sorted(df["division"].dropna().unique().tolist())
    sel_div = st.selectbox("담당", div_opts)
with fcol2:
    pool = df if sel_div == "전체" else df[df["division"] == sel_div]
    team_opts = ["전체"] + sorted(pool["team"].dropna().unique().tolist())
    sel_team = st.selectbox("팀", team_opts)
with fcol3:
    job_opts = ["전체"] + sorted(df["job_type"].dropna().unique().tolist())
    sel_job = st.selectbox("직종", job_opts)
with fcol4:
    rl_opts = ["전체"] + sorted(df["role_level"].dropna().unique().tolist())
    sel_rl = st.selectbox("R/L", rl_opts)

# 필터 적용
view = df.copy()
if sel_div != "전체":
    view = view[view["division"] == sel_div]
if sel_team != "전체":
    view = view[view["team"] == sel_team]
if sel_job != "전체":
    view = view[view["job_type"] == sel_job]
if sel_rl != "전체":
    view = view[view["role_level"] == sel_rl]

st.markdown(
    f"<h4 style='color:{COLOR_NAVY};'>구성원 목록 ({len(view)} / {len(df)})</h4>",
    unsafe_allow_html=True,
)

# 컬럼 표시 순서 - 필수 9개를 먼저, 그 다음 추가 컬럼
PRIMARY_ORDER = [
    "employee_id", "name", "corporation", "division", "team",
    "role_level", "position", "job_type", "persona_role",
]
COL_LABELS = {
    "employee_id":  "사번",
    "name":         "이름",
    "corporation":  "법인",
    "division":     "담당",
    "team":         "팀",
    "role_level":   "R/L",
    "position":     "직책",
    "job_type":     "직종",
    "persona_role": "페르소나",
}
ordered_cols = [c for c in PRIMARY_ORDER if c in view.columns] + \
               [c for c in view.columns if c not in PRIMARY_ORDER]

# --- HR Admin이면 화면에서 직접 편집, 그 외엔 조회 전용 ---
is_editor = persona == "hr_admin"

if is_editor:
    st.caption(
        "✏️ **편집 모드** — 셀을 클릭해 수정 / 표 맨 아래 **+** 버튼으로 행 추가 / 행 선택 후 **Delete** 키로 삭제. "
        "변경 후 아래 **💾 변경사항 저장** 버튼을 눌러야 엑셀·DB에 반영됩니다."
    )

    # 필터된 view가 아니라 **전체 df**를 편집해야 안전 (필터 상태로 저장하면 행 사라짐)
    if sel_div != "전체" or sel_team != "전체" or sel_job != "전체" or sel_rl != "전체":
        st.warning("⚠️ 편집 모드는 **전체 인원**을 대상으로 합니다. 필터를 '전체'로 두고 편집하세요. "
                   "(현재 필터 결과만 보고 있어도 저장 시 모든 인원이 반영됩니다.)")

    edit_df = df[ordered_cols].copy()
    edited = st.data_editor(
        edit_df,
        hide_index=True,
        use_container_width=True,
        num_rows="dynamic",  # 행 추가/삭제 허용
        height=520,
        key="member_editor",
        column_config={
            "employee_id":  st.column_config.TextColumn("사번", required=True, width="small"),
            "name":         st.column_config.TextColumn("이름", required=True, width="small"),
            "corporation":  st.column_config.TextColumn("법인"),
            "division":     st.column_config.TextColumn("담당"),
            "team":         st.column_config.TextColumn("팀"),
            "role_level":   st.column_config.SelectboxColumn(
                "R/L",
                options=["L6", "L5", "L4", "L3", "L2", "임원"],
                width="small",
            ),
            "position":     st.column_config.SelectboxColumn(
                "직책",
                options=["팀장", "팀원", "위원", "대표"],
                width="small",
            ),
            "job_type":     st.column_config.SelectboxColumn(
                "직종",
                options=["사무직", "기술직", "연구직", "경영"],
                width="small",
            ),
            "persona_role": st.column_config.SelectboxColumn(
                "페르소나",
                options=[""] + list(PERSONA_LABELS.keys()),
                help="비워두면 페르소나 selectbox에 안 뜸. hr_viewer 값으로 HRBP 매핑 가능.",
                width="medium",
            ),
        },
    )

    save_col, info_col = st.columns([1, 3])
    with save_col:
        save_clicked = st.button("💾 변경사항 저장", type="primary", use_container_width=True)
    with info_col:
        st.caption("저장 시 자동으로 엑셀 파일도 갱신됩니다.")

    if save_clicked:
        try:
            info = save_df_to_xlsx_and_db(edited)
            st.success(f"저장 완료 · {info['loaded']}명 반영됨")
            st.rerun()
        except (KeyError, ValueError) as e:
            st.error(f"저장 실패: {e}")
else:
    # 조회 전용
    view_display = view[ordered_cols].rename(columns=COL_LABELS)
    st.dataframe(view_display, hide_index=True, use_container_width=True, height=500)
    st.caption("ℹ️ 편집은 HR Admin 권한에서만 가능합니다.")

# --- 페르소나 매핑 현황 ---
st.divider()
st.markdown(f"<h4 style='color:{COLOR_NAVY};'>페르소나 매핑 현황</h4>", unsafe_allow_html=True)
st.caption(
    "엑셀의 `persona_role` 컬럼 값으로 매핑됩니다. "
    "비워두면 매핑 없음 — 그 권한 페르소나로 전환 시 매핑 인원 없다는 안내가 뜹니다."
)
persona_counts = (
    df["persona_role"].value_counts(dropna=False)
    .rename_axis("persona_role").reset_index(name="인원수")
)
st.dataframe(persona_counts, hide_index=True, use_container_width=True)

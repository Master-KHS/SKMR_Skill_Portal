# Required Skill 화면 - 전사 / 조직별 / 개인별 3탭.
# 페르소나별 데이터 범위 + 편집 권한 분기:
#   HR Admin : 전사·조직·개인 모두 편집
#   Team Leader : 본인 팀의 조직 매핑 + 팀원 개인 매핑 편집
#   기타 : 본인 범위만 조회
import pandas as pd
import streamlit as st

from config import COLOR_BORDER, COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header


def _load_skills() -> pd.DataFrame:
    conn = get_connection()
    try:
        return pd.read_sql_query(
            """SELECT s.skill_id, s.skill_name, sf.sub_family_id, sf.sub_family_name,
                      f.family_id, f.family_name
               FROM skill s
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               JOIN skill_family f      ON sf.family_id   = f.family_id
               ORDER BY s.skill_id""",
            conn,
        )
    finally:
        conn.close()


def _load_required(org_kind: str, target_id: str | None = None) -> pd.DataFrame:
    conn = get_connection()
    try:
        if target_id is None:
            return pd.read_sql_query(
                "SELECT * FROM required_skill WHERE org_or_individual = ?",
                conn, params=(org_kind,),
            )
        return pd.read_sql_query(
            "SELECT * FROM required_skill WHERE org_or_individual = ? AND target_id = ?",
            conn, params=(org_kind, target_id),
        )
    finally:
        conn.close()


def _save_required(org_kind: str, target_id: str, df: pd.DataFrame) -> int:
    """해당 (org_kind, target_id)의 required_skill을 통째로 교체. 반환: 적재 행 수."""
    rows = []
    for _, r in df.iterrows():
        if pd.isna(r.get("skill_id")) or r.get("skill_id") == "":
            continue
        rows.append((
            org_kind,
            target_id,
            int(r["skill_id"]),
            int(r["target_level"]) if not pd.isna(r["target_level"]) else 2,
            int(bool(r.get("is_core", 0))),
        ))
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM required_skill WHERE org_or_individual = ? AND target_id = ?",
            (org_kind, target_id),
        )
        cur.executemany(
            """INSERT INTO required_skill
               (org_or_individual, target_id, skill_id, target_level, is_core)
               VALUES (?,?,?,?,?)""",
            rows,
        )
        conn.commit()
    finally:
        conn.close()
    return len(rows)


def _enrich(req_df: pd.DataFrame, skills_df: pd.DataFrame) -> pd.DataFrame:
    """required_skill 행에 skill_name·family 정보를 붙임."""
    if req_df.empty:
        return pd.DataFrame(columns=[
            "skill_id", "skill_name", "family_name", "sub_family_name",
            "target_level", "is_core"
        ])
    merged = req_df.merge(skills_df, on="skill_id", how="left")
    merged["is_core"] = merged["is_core"].astype(bool)
    return merged[[
        "skill_id", "skill_name", "family_name", "sub_family_name",
        "target_level", "is_core"
    ]]


def _editor(df: pd.DataFrame, skills_df: pd.DataFrame, *, editable: bool, key: str):
    """공통 표 위젯. editable=True면 data_editor, False면 dataframe."""
    if df.empty:
        if editable:
            df = pd.DataFrame(columns=[
                "skill_id", "skill_name", "family_name", "sub_family_name",
                "target_level", "is_core"
            ])
        else:
            st.info("매핑된 Required Skill이 없습니다.")
            return None

    skill_id_options = skills_df["skill_id"].astype(int).tolist()
    skill_name_map = dict(zip(skills_df["skill_id"], skills_df["skill_name"]))

    if editable:
        edited = st.data_editor(
            df.sort_values(["is_core", "skill_id"], ascending=[False, True]).reset_index(drop=True),
            hide_index=True,
            use_container_width=True,
            num_rows="dynamic",
            key=key,
            column_config={
                "skill_id":    st.column_config.SelectboxColumn(
                    "Skill ID", options=skill_id_options, required=True, width="small",
                ),
                "skill_name":  st.column_config.TextColumn("Skill 이름", disabled=True, width="large"),
                "family_name": st.column_config.TextColumn("Family", disabled=True, width="small"),
                "sub_family_name": st.column_config.TextColumn("Sub-family", disabled=True, width="small"),
                "target_level": st.column_config.NumberColumn(
                    "Target Level", min_value=1, max_value=4, step=1, required=True, width="small",
                ),
                "is_core":     st.column_config.CheckboxColumn(
                    "Core",
                    width="small",
                    help="체크 = Core (필수), 비활성 = Non-Core (권장)",
                ),
            },
        )
        # skill_id를 바꾸면 skill_name 자동 갱신 (저장 시점에 다시 표시되도록)
        if "skill_id" in edited.columns:
            edited["skill_name"] = edited["skill_id"].map(skill_name_map)
        return edited
    else:
        view = df.copy()
        view["L"] = view["target_level"].map(lambda lv: f"L{int(lv)}")
        view["Core"] = view["is_core"].map(lambda b: "★" if b else "")
        view = view[["Core", "skill_id", "skill_name", "family_name", "sub_family_name", "L"]]
        view = view.sort_values(["Core", "skill_id"], ascending=[False, True])
        st.dataframe(view, hide_index=True, use_container_width=True, height=420)
        return None


# ---------- 페이지 시작 ----------
persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header(
    "🎯 Required Skill",
    "전사 / 조직 / 개인 단위로 요구 Skill·Target Level·Core 지정",
)

skills_df = _load_skills()

# 페르소나별 권한
can_edit_company = persona == "hr_admin"
can_edit_org = persona in ("hr_admin", "team_leader")
can_edit_individual = persona in ("hr_admin", "team_leader", "employee")

tab_company, tab_org, tab_indv = st.tabs(["🏢 전사", "🏗️ 조직별", "👤 개인별"])

# ---------- 전사 ----------
with tab_company:
    st.markdown(
        f"<p style='color:{COLOR_TEXT_MED};'>모든 평가 대상자가 공통으로 갖춰야 하는 기본 Required Skill입니다.</p>",
        unsafe_allow_html=True,
    )
    company_df = _enrich(_load_required("company", "ALL"), skills_df)

    edited = _editor(
        company_df, skills_df,
        editable=can_edit_company, key="req_company",
    )

    if can_edit_company:
        if st.button("💾 전사 Required Skill 저장", type="primary", key="save_company"):
            try:
                n = _save_required("company", "ALL", edited)
                st.success(f"저장 완료 · {n}건")
                st.rerun()
            except Exception as e:
                st.error(f"저장 실패: {e}")
    else:
        st.caption("ℹ️ 전사 Required Skill 편집은 HR Admin만 가능합니다.")


# ---------- 조직별 ----------
with tab_org:
    # 팀 목록 가져오기
    conn = get_connection()
    try:
        teams_df = pd.read_sql_query(
            "SELECT DISTINCT division, team FROM member WHERE job_type IN ('사무직','기술직','연구직') ORDER BY division, team",
            conn,
        )
    finally:
        conn.close()

    # 페르소나별 보이는 팀 범위
    visible_teams = teams_df["team"].tolist()
    if persona == "team_leader" and member:
        # Team Leader는 본인 팀만
        visible_teams = [member["team"]] if member.get("team") in teams_df["team"].values else []
    elif persona in ("calibration", "committee", "hr_viewer") and member:
        # 본인 담당 범위 (단순화: 본인 팀만 정렬 1순위로)
        pass

    if not visible_teams:
        st.warning("조회 가능한 팀이 없습니다.")
    else:
        col1, col2 = st.columns([2, 3])
        with col1:
            sel_team = st.selectbox("팀 선택", visible_teams, key="org_team_select")
        with col2:
            div = teams_df[teams_df["team"] == sel_team]["division"].iloc[0] if sel_team else ""
            st.markdown(
                f"<div style='padding-top:28px;'><span style='color:{COLOR_TEXT_MED};'>담당:</span> "
                f"<b style='color:{COLOR_NAVY};'>{div}</b></div>",
                unsafe_allow_html=True,
            )

        team_req = _enrich(_load_required("department", sel_team), skills_df)

        # KPI 카드
        kcol1, kcol2, kcol3, kcol4 = st.columns(4)
        n_core = int(team_req["is_core"].sum()) if not team_req.empty else 0
        n_total = len(team_req)
        kcol1.metric("매핑 Skill 수", n_total)
        kcol2.metric("Core", n_core)
        kcol3.metric("Non-Core", n_total - n_core)
        kcol4.metric("평균 Target Level", f"L{team_req['target_level'].mean():.1f}" if not team_req.empty else "—")

        edited_org = _editor(
            team_req, skills_df,
            editable=can_edit_org, key=f"req_org_{sel_team}",
        )

        if can_edit_org:
            if st.button("💾 조직 Required Skill 저장", type="primary", key=f"save_org_{sel_team}"):
                try:
                    n = _save_required("department", sel_team, edited_org)
                    st.success(f"[{sel_team}] 저장 완료 · {n}건")
                    st.rerun()
                except Exception as e:
                    st.error(f"저장 실패: {e}")


# ---------- 개인별 ----------
with tab_indv:
    # 인원 목록
    conn = get_connection()
    try:
        members_df = pd.read_sql_query(
            """SELECT employee_id, name, division, team, role_level, job_type
               FROM member
               WHERE job_type IN ('사무직','기술직','연구직')
               ORDER BY division, team, role_level DESC, name""",
            conn,
        )
    finally:
        conn.close()

    # 페르소나별 보이는 인원
    if persona == "employee" and member:
        visible = members_df[members_df["employee_id"] == member["employee_id"]]
    elif persona == "team_leader" and member:
        visible = members_df[members_df["team"] == member.get("team", "")]
    else:
        visible = members_df  # HR Admin·HR Viewer·Calibration·Committee는 전체

    if visible.empty:
        st.warning("조회 가능한 인원이 없습니다.")
    else:
        opts = visible["employee_id"].tolist()
        default_idx = 0
        if member and member["employee_id"] in opts:
            default_idx = opts.index(member["employee_id"])

        sel_emp = st.selectbox(
            "구성원 선택",
            options=opts,
            index=default_idx,
            format_func=lambda eid: (
                f"{members_df[members_df['employee_id']==eid].iloc[0]['name']} "
                f"({members_df[members_df['employee_id']==eid].iloc[0]['team']} · "
                f"{members_df[members_df['employee_id']==eid].iloc[0]['role_level']})"
            ),
            key="indv_select",
        )

        # 본인이 아닌데 employee 권한이면 편집 막기
        editable_indv = can_edit_individual
        if persona == "employee" and member and sel_emp != member["employee_id"]:
            editable_indv = False

        sel_row = members_df[members_df["employee_id"] == sel_emp].iloc[0]

        # 조직 상속 Required + 개인 Required 통합 표시
        st.markdown(
            f"<h5 style='color:{COLOR_NAVY};'>조직 상속 ({sel_row['team']})</h5>",
            unsafe_allow_html=True,
        )
        org_req = _enrich(_load_required("department", sel_row["team"]), skills_df)
        company_req = _enrich(_load_required("company", "ALL"), skills_df)
        inherited = pd.concat([company_req, org_req], ignore_index=True).drop_duplicates("skill_id")
        if inherited.empty:
            st.caption("상속된 Required Skill이 없습니다.")
        else:
            st.caption(f"전사 공통 {len(company_req)}건 + 팀 {len(org_req)}건 = 총 {len(inherited)}건 (조직에서 자동 상속)")
            _editor(inherited, skills_df, editable=False, key=f"req_inherit_{sel_emp}")

        st.markdown(
            f"<h5 style='color:{COLOR_NAVY}; margin-top:24px;'>개인 추가 Required Skill</h5>",
            unsafe_allow_html=True,
        )
        st.caption("조직 매핑 외에 이 구성원에게 추가로 요구되는 Skill (개인별 직무·과제 특성)")
        indv_req = _enrich(_load_required("individual", sel_emp), skills_df)

        edited_indv = _editor(
            indv_req, skills_df,
            editable=editable_indv, key=f"req_indv_{sel_emp}",
        )

        if editable_indv:
            if st.button("💾 개인 Required Skill 저장", type="primary", key=f"save_indv_{sel_emp}"):
                try:
                    n = _save_required("individual", sel_emp, edited_indv)
                    st.success(f"[{sel_row['name']}] 저장 완료 · {n}건")
                    st.rerun()
                except Exception as e:
                    st.error(f"저장 실패: {e}")
        else:
            st.caption("ℹ️ 이 구성원의 개인 Required Skill은 편집 권한이 없습니다.")

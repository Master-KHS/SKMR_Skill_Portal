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


def _load_required(org_kind: str, target_id: str | None = None,
                    status: str | None = None) -> pd.DataFrame:
    """status=None이면 전체, 'approved'/'pending' 지정하면 해당 status만."""
    conn = get_connection()
    try:
        where = ["org_or_individual = ?"]
        params: list = [org_kind]
        if target_id is not None:
            where.append("target_id = ?")
            params.append(target_id)
        if status is not None:
            where.append("status = ?")
            params.append(status)
        sql = f"SELECT * FROM required_skill WHERE {' AND '.join(where)}"
        return pd.read_sql_query(sql, conn, params=tuple(params))
    finally:
        conn.close()


def _request_individual_skill(member_id: str, skill_id: int, target_level: int) -> bool:
    """개인 Skill 신청 — status=pending으로 추가. 이미 같은 행 있으면 False."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        existing = cur.execute(
            """SELECT status FROM required_skill
               WHERE org_or_individual='individual' AND target_id=? AND skill_id=?""",
            (member_id, skill_id),
        ).fetchone()
        if existing:
            return False
        cur.execute(
            """INSERT INTO required_skill
               (org_or_individual, target_id, skill_id, target_level, is_core, status)
               VALUES ('individual', ?, ?, ?, 0, 'pending')""",
            (member_id, skill_id, target_level),
        )
        conn.commit()
        return True
    finally:
        conn.close()


def _approve_individual(member_id: str, skill_id: int) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """UPDATE required_skill SET status='approved'
               WHERE org_or_individual='individual' AND target_id=? AND skill_id=?""",
            (member_id, skill_id),
        )
        conn.commit()
    finally:
        conn.close()


def _reject_individual(member_id: str, skill_id: int) -> None:
    """반려 = 행 삭제 (이력 보관 필요해지면 추후 status='rejected'로 전환)."""
    conn = get_connection()
    try:
        conn.execute(
            """DELETE FROM required_skill
               WHERE org_or_individual='individual' AND target_id=? AND skill_id=? AND status='pending'""",
            (member_id, skill_id),
        )
        conn.commit()
    finally:
        conn.close()


def _cancel_pending(member_id: str, skill_id: int) -> None:
    """본인이 자기 pending 신청 취소."""
    _reject_individual(member_id, skill_id)


def _remove_approved(member_id: str, skill_id: int) -> None:
    """승인된 개인 Skill 제거 (팀장·HR Admin 권한)."""
    conn = get_connection()
    try:
        conn.execute(
            """DELETE FROM required_skill
               WHERE org_or_individual='individual' AND target_id=? AND skill_id=? AND status='approved'""",
            (member_id, skill_id),
        )
        conn.commit()
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
        view["Core"] = view["is_core"].map(lambda b: "CORE" if b else "")
        view = view[["Core", "skill_id", "skill_name", "family_name", "sub_family_name", "L"]]
        view = view.sort_values(["Core", "skill_id"], ascending=[False, True])
        st.dataframe(view, hide_index=True, use_container_width=True, height=420)
        return None


# ---------- 페이지 시작 ----------
persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header(
    "필요 Skill 정의",
    "전사 / 조직 / 개인 단위로 요구 Skill · Target Level · Core/Non-Core 지정",
)

skills_df = _load_skills()

# 페르소나별 권한
can_edit_company = persona == "hr_admin"
can_edit_org = persona in ("hr_admin", "team_leader")
can_edit_individual = persona in ("hr_admin", "team_leader", "employee")

tab_company, tab_org, tab_indv = st.tabs(["전사", "조직별", "개인별"])

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
    st.caption(
        "팀 단위 Required Skill 정의. 1차로 **Required** 체크 → 2차로 Required 중에서 **Core** 5개 선택. "
        "Core는 반드시 5개여야 저장됩니다 (Enabler·전사 Required는 자동 포함되어 별도 카운트 안 됨)."
    )

    conn = get_connection()
    try:
        teams_df = pd.read_sql_query(
            "SELECT DISTINCT division, team FROM member WHERE job_type IN ('사무직','기술직','연구직') ORDER BY division, team",
            conn,
        )
    finally:
        conn.close()

    visible_teams = teams_df["team"].tolist()
    if persona == "team_leader" and member:
        visible_teams = [member["team"]] if member.get("team") in teams_df["team"].values else []

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

        # 현재 팀의 Required (Enabler 제외)
        team_req = _load_required("department", sel_team)

        # 전체 Skill (Enabler 제외 — 전사 자동 포함)
        skills_no_enb = skills_df[skills_df["family_id"] != "ENB"].copy()

        # 매트릭스: 모든 Skill을 row로, Required·Core·Target 컬럼
        is_req_map = dict(zip(team_req["skill_id"], [True] * len(team_req)))
        is_core_map = dict(zip(team_req["skill_id"], team_req["is_core"].astype(bool)))
        target_map = dict(zip(team_req["skill_id"], team_req["target_level"].astype(int)))

        matrix = pd.DataFrame({
            "Required":  skills_no_enb["skill_id"].map(lambda s: is_req_map.get(s, False)),
            "Core":      skills_no_enb["skill_id"].map(lambda s: is_core_map.get(s, False)),
            "ID":        skills_no_enb["skill_id"],
            "Skill":     skills_no_enb["skill_name"],
            "Family":    skills_no_enb["family_name"],
            "Sub-family": skills_no_enb["sub_family_name"],
            "Target":    skills_no_enb["skill_id"].map(lambda s: target_map.get(s, 2)),
        })

        # 현황 KPI
        n_req_now = int(matrix["Required"].sum())
        n_core_now = int(matrix["Core"].sum())

        kcol1, kcol2, kcol3, kcol4 = st.columns(4)
        kcol1.metric("팀 Required (현재)", n_req_now)
        # Core 5개 강제 — 현재값과 목표(5)를 같이 표시
        delta = n_core_now - 5
        delta_str = (f"+{delta}" if delta > 0 else (f"{delta}" if delta < 0 else "OK"))
        kcol2.metric("Core (필요 5개)", f"{n_core_now} / 5", delta=delta_str if delta != 0 else None)
        kcol3.metric("Non-Core", n_req_now - n_core_now)
        kcol4.metric("전사 Enabler (자동)", 4)

        st.divider()

        # 필터
        fcol1, fcol2, fcol3 = st.columns(3)
        with fcol1:
            fam_opts = ["전체"] + matrix["Family"].drop_duplicates().tolist()
            sel_fam = st.selectbox("Family", fam_opts, key=f"org_fam_{sel_team}")
        with fcol2:
            pool = matrix if sel_fam == "전체" else matrix[matrix["Family"] == sel_fam]
            sub_opts = ["전체"] + pool["Sub-family"].drop_duplicates().tolist()
            sel_sub_filter = st.selectbox("Sub-family", sub_opts, key=f"org_sub_{sel_team}")
        with fcol3:
            only_required = st.checkbox("Required만 보기", value=False, key=f"org_only_req_{sel_team}")

        view = matrix.copy()
        if sel_fam != "전체":
            view = view[view["Family"] == sel_fam]
        if sel_sub_filter != "전체":
            view = view[view["Sub-family"] == sel_sub_filter]
        if only_required:
            view = view[view["Required"]]

        # 정렬: Required → Core → ID
        view = view.sort_values(["Required", "Core", "ID"], ascending=[False, False, True])

        st.markdown(
            f"<p style='color:{COLOR_TEXT_MED}; font-size:13px;'>"
            f"{len(view)} / {len(matrix)} Skill 표시</p>",
            unsafe_allow_html=True,
        )

        edited = st.data_editor(
            view,
            hide_index=True,
            use_container_width=True,
            num_rows="fixed",
            height=520,
            disabled=(["ID", "Skill", "Family", "Sub-family"]
                       if can_edit_org else
                       ["Required", "Core", "ID", "Skill", "Family", "Sub-family", "Target"]),
            column_config={
                "Required": st.column_config.CheckboxColumn("Required", width="small"),
                "Core":     st.column_config.CheckboxColumn("Core (필요 5개)", width="small"),
                "ID":       st.column_config.NumberColumn("ID", width="small"),
                "Skill":    st.column_config.TextColumn("Skill"),
                "Family":   st.column_config.TextColumn("Family", width="small"),
                "Sub-family": st.column_config.TextColumn("Sub-family", width="small"),
                "Target":   st.column_config.NumberColumn(
                    "Target Lv", min_value=1, max_value=4, step=1, width="small",
                ),
            },
            key=f"req_org_matrix_{sel_team}",
        )

        # Core 체크 시 Required 자동 ON 보정 + 표시 영역 외 행은 원래 matrix 값 유지
        # 편집된 행만 matrix에 반영
        edited_indexed = edited.set_index("ID")
        for sid in edited_indexed.index:
            matrix.loc[matrix["ID"] == sid, "Required"] = bool(edited_indexed.loc[sid, "Required"])
            matrix.loc[matrix["ID"] == sid, "Core"] = bool(edited_indexed.loc[sid, "Core"])
            matrix.loc[matrix["ID"] == sid, "Target"] = int(edited_indexed.loc[sid, "Target"])

        # Core=True인데 Required=False면 Required 강제 ON
        matrix.loc[matrix["Core"], "Required"] = True

        n_req_after = int(matrix["Required"].sum())
        n_core_after = int(matrix["Core"].sum())

        if can_edit_org:
            save_col, hint_col = st.columns([1, 3])
            with save_col:
                save_clicked = st.button(
                    f"저장 (Core {n_core_after}/5)",
                    type="primary",
                    use_container_width=True,
                    disabled=(n_core_after != 5),
                    key=f"org_save_{sel_team}",
                )
            with hint_col:
                if n_core_after != 5:
                    st.warning(f"Core가 {n_core_after}개입니다. 정확히 **5개**여야 저장 가능합니다.")
                else:
                    st.success(
                        f"Core 5개 충족 — 저장 가능 (Required 총 {n_req_after} = Core 5 + Non-Core {n_req_after - 5})"
                    )

            if save_clicked and n_core_after == 5:
                save_df = matrix[matrix["Required"]][["ID", "Target", "Core"]].rename(
                    columns={"ID": "skill_id", "Target": "target_level", "Core": "is_core"}
                )
                save_df["is_core"] = save_df["is_core"].astype(int)
                save_df["skill_name"] = ""  # _save_required는 사용 안 함
                try:
                    n = _save_required("department", sel_team, save_df)
                    st.success(f"[{sel_team}] 저장 완료 · Required {n}건 (Core 5 + Non-Core {n-5})")
                    st.rerun()
                except Exception as e:
                    st.error(f"저장 실패: {e}")


# ---------- 개인별 (신청 · 승인 워크플로) ----------
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

    # ===== 팀장 승인 대기 박스 (team_leader / hr_admin) =====
    if persona in ("team_leader", "hr_admin"):
        if persona == "team_leader" and member:
            team_pending_filter = members_df["team"] == member.get("team", "")
            scope_label = f"본인 팀 ({member.get('team','')})"
        else:
            team_pending_filter = pd.Series([True] * len(members_df))
            scope_label = "전사 (HR Admin)"

        pending_members = members_df[team_pending_filter]["employee_id"].tolist()
        pending_rows = []
        if pending_members:
            placeholders = ",".join("?" for _ in pending_members)
            conn = get_connection()
            try:
                pending_rows = conn.execute(
                    f"""SELECT r.target_id, r.skill_id, r.target_level,
                               m.name, m.team, m.role_level,
                               s.skill_name, sf.sub_family_name, f.family_name
                        FROM required_skill r
                        JOIN member m ON r.target_id = m.employee_id
                        JOIN skill s  ON r.skill_id = s.skill_id
                        JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
                        JOIN skill_family f      ON sf.family_id    = f.family_id
                        WHERE r.org_or_individual='individual' AND r.status='pending'
                          AND r.target_id IN ({placeholders})
                        ORDER BY r.target_id, r.skill_id""",
                    pending_members,
                ).fetchall()
            finally:
                conn.close()

        with st.container(border=True):
            head = st.columns([4, 1])
            head[0].markdown(
                f"<h5 style='color:{COLOR_NAVY}; margin:0;'>승인 대기 — {scope_label}</h5>",
                unsafe_allow_html=True,
            )
            head[1].metric("Pending", len(pending_rows))

            if not pending_rows:
                st.caption("승인 대기 중인 개인 Skill 신청이 없습니다.")
            else:
                for r in pending_rows:
                    pcols = st.columns([3, 1, 1, 1])
                    pcols[0].markdown(
                        f"<b>{r['name']}</b> <span style='color:{COLOR_TEXT_MED};'>"
                        f"({r['team']} · {r['role_level']})</span><br>"
                        f"<span style='color:{COLOR_TEXT_MED}; font-size:12px;'>"
                        f"{r['family_name']} · {r['sub_family_name']}</span><br>"
                        f"#{int(r['skill_id']):03d} {r['skill_name']}",
                        unsafe_allow_html=True,
                    )
                    pcols[1].markdown(
                        f"<div style='padding-top:12px;'>요구 <b>L{int(r['target_level'])}</b></div>",
                        unsafe_allow_html=True,
                    )
                    if pcols[2].button("승인", key=f"approve_{r['target_id']}_{r['skill_id']}",
                                        type="primary", use_container_width=True):
                        _approve_individual(r["target_id"], int(r["skill_id"]))
                        st.success(f"승인됨: {r['name']} #{int(r['skill_id']):03d}")
                        st.rerun()
                    if pcols[3].button("반려", key=f"reject_{r['target_id']}_{r['skill_id']}",
                                        use_container_width=True):
                        _reject_individual(r["target_id"], int(r["skill_id"]))
                        st.warning(f"반려됨: {r['name']} #{int(r['skill_id']):03d}")
                        st.rerun()
        st.markdown("<br>", unsafe_allow_html=True)

    # ===== 구성원 선택 =====
    if persona == "employee" and member:
        visible = members_df[members_df["employee_id"] == member["employee_id"]]
    elif persona == "team_leader" and member:
        visible = members_df[members_df["team"] == member.get("team", "")]
    else:
        visible = members_df

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

        sel_row = members_df[members_df["employee_id"] == sel_emp].iloc[0]
        is_self = bool(member and sel_emp == member["employee_id"])
        is_leader_of_target = (persona == "team_leader" and member and
                                sel_row["team"] == member.get("team", ""))
        is_admin = persona == "hr_admin"

        # ----- 조직 상속 -----
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
            st.caption(f"전사 공통 {len(company_req)}건 + 팀 {len(org_req)}건 = 총 {len(inherited)}건")
            _editor(inherited, skills_df, editable=False, key=f"req_inherit_{sel_emp}")

        # ----- 개인 Skill (Approved) -----
        st.markdown(
            f"<h5 style='color:{COLOR_NAVY}; margin-top:24px;'>개인 Skill — 승인됨 (평가 대상에 포함)</h5>",
            unsafe_allow_html=True,
        )
        approved = _enrich(_load_required("individual", sel_emp, status="approved"), skills_df)
        if approved.empty:
            st.caption("승인된 개인 Skill이 없습니다.")
        else:
            for _, r in approved.iterrows():
                acols = st.columns([4, 1, 1])
                acols[0].markdown(
                    f"#{int(r['skill_id']):03d} <b>{r['skill_name']}</b> "
                    f"<span style='color:{COLOR_TEXT_MED}; font-size:12px;'>"
                    f"({r['family_name']} · {r['sub_family_name']})</span>",
                    unsafe_allow_html=True,
                )
                acols[1].markdown(
                    f"<div style='text-align:right;'>요구 <b>L{int(r['target_level'])}</b></div>",
                    unsafe_allow_html=True,
                )
                if is_leader_of_target or is_admin:
                    if acols[2].button("제거", key=f"rm_appr_{sel_emp}_{int(r['skill_id'])}",
                                       use_container_width=True):
                        _remove_approved(sel_emp, int(r["skill_id"]))
                        st.rerun()

        # ----- 개인 Skill (Pending) -----
        st.markdown(
            f"<h5 style='color:{COLOR_NAVY}; margin-top:24px;'>개인 Skill — 승인 대기 (Pending)</h5>",
            unsafe_allow_html=True,
        )
        pending = _enrich(_load_required("individual", sel_emp, status="pending"), skills_df)
        if pending.empty:
            st.caption("승인 대기 중인 신청이 없습니다.")
        else:
            for _, r in pending.iterrows():
                pcols = st.columns([4, 1, 1, 1])
                pcols[0].markdown(
                    f"#{int(r['skill_id']):03d} <b>{r['skill_name']}</b> "
                    f"<span style='color:{COLOR_TEXT_MED}; font-size:12px;'>"
                    f"({r['family_name']} · {r['sub_family_name']})</span>",
                    unsafe_allow_html=True,
                )
                pcols[1].markdown(
                    f"<div style='text-align:right;'>요구 <b>L{int(r['target_level'])}</b></div>",
                    unsafe_allow_html=True,
                )
                if is_leader_of_target or is_admin:
                    if pcols[2].button("승인", key=f"app_p_{sel_emp}_{int(r['skill_id'])}",
                                       type="primary", use_container_width=True):
                        _approve_individual(sel_emp, int(r["skill_id"]))
                        st.rerun()
                    if pcols[3].button("반려", key=f"rej_p_{sel_emp}_{int(r['skill_id'])}",
                                       use_container_width=True):
                        _reject_individual(sel_emp, int(r["skill_id"]))
                        st.rerun()
                elif is_self:
                    pcols[2].markdown(
                        f"<div style='text-align:right; color:{COLOR_TEXT_MED}; padding-top:6px;'>대기</div>",
                        unsafe_allow_html=True,
                    )
                    if pcols[3].button("취소", key=f"cancel_p_{sel_emp}_{int(r['skill_id'])}",
                                       use_container_width=True):
                        _cancel_pending(sel_emp, int(r["skill_id"]))
                        st.rerun()

        # ----- 새 신청 -----
        if is_self or is_leader_of_target or is_admin:
            st.markdown(
                f"<h5 style='color:{COLOR_NAVY}; margin-top:24px;'>"
                f"{'개인 Skill 신청' if is_self else '개인 Skill 추가 (대리)'}</h5>",
                unsafe_allow_html=True,
            )
            if is_self:
                st.caption("아래에서 추가 평가받고 싶은 Skill을 선택해 신청하세요. 팀장 승인 후 평가 대상에 포함됩니다.")
            else:
                st.caption("Team Leader / HR Admin은 직접 추가하면 자동 승인 처리됩니다.")

            # 이미 매핑되어 있거나 상속된 것은 제외
            existing_ids = set()
            if not inherited.empty:
                existing_ids.update(inherited["skill_id"].tolist())
            if not approved.empty:
                existing_ids.update(approved["skill_id"].tolist())
            if not pending.empty:
                existing_ids.update(pending["skill_id"].tolist())
            avail = skills_df[~skills_df["skill_id"].isin(existing_ids)]

            with st.form(f"req_new_{sel_emp}", clear_on_submit=True):
                fcol1, fcol2, fcol3 = st.columns([3, 1, 1])
                with fcol1:
                    sid = st.selectbox(
                        "Skill 선택",
                        options=avail["skill_id"].astype(int).tolist(),
                        format_func=lambda x: (
                            f"#{x:03d} {avail[avail['skill_id']==x].iloc[0]['skill_name']} "
                            f"({avail[avail['skill_id']==x].iloc[0]['sub_family_name']})"
                        ) if not avail.empty else "—",
                    )
                with fcol2:
                    target_lv = st.number_input("Target Level", min_value=1, max_value=4, value=2, step=1)
                with fcol3:
                    submit = st.form_submit_button(
                        "신청" if is_self else "직접 추가",
                        type="primary", use_container_width=True,
                    )
                if submit and avail.empty:
                    st.warning("더 추가할 Skill이 없습니다.")
                elif submit:
                    added = _request_individual_skill(sel_emp, int(sid), int(target_lv))
                    if added and (is_leader_of_target or is_admin):
                        # 팀장·HR Admin은 자동 승인
                        _approve_individual(sel_emp, int(sid))
                        st.success(f"#{int(sid):03d} 직접 추가 (자동 승인)")
                    elif added:
                        st.success(f"#{int(sid):03d} 신청 완료 (팀장 승인 대기)")
                    else:
                        st.error("이미 등록된 Skill입니다.")
                    st.rerun()

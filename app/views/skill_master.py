# Skill Library - 카탈로그 조회 + HR Admin CRUD.
# 우측 상세를 4박스 구성: Definition / Tool·Cert / Level Guideline / 보유 현황 도넛.
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from config import COLOR_BORDER, COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_DARK, COLOR_TEXT_MED, LEVEL_NAMES
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header


def _load_all():
    conn = get_connection()
    try:
        skills = pd.read_sql_query(
            """SELECT s.skill_id, s.skill_name, s.description, s.is_critical,
                      sf.sub_family_id, sf.sub_family_name,
                      f.family_id, f.family_name
               FROM skill s
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               JOIN skill_family f      ON sf.family_id    = f.family_id
               ORDER BY f.family_id, sf.sub_family_id, s.skill_id""",
            conn,
        )
        criteria = pd.read_sql_query(
            "SELECT sub_family_id, level, expertise_criteria, impact_criteria FROM level_criteria",
            conn,
        )
        subs = pd.read_sql_query(
            """SELECT sf.sub_family_id, sf.sub_family_name, f.family_id, f.family_name
               FROM sub_skill_family sf JOIN skill_family f ON sf.family_id = f.family_id
               ORDER BY sf.sub_family_id""",
            conn,
        )
    finally:
        conn.close()
    return skills, criteria, subs


def _load_holders(skill_id: int):
    """이 Skill 보유자 데이터 - 전사 보유율·평균 + 부서별 보유율·평균."""
    conn = get_connection()
    try:
        total = conn.execute(
            "SELECT COUNT(*) FROM member WHERE job_type IN ('사무직','기술직','연구직')"
        ).fetchone()[0]
        holders = conn.execute(
            """SELECT COUNT(*) AS n, AVG(current_level) AS avg_lv
               FROM skill_profile sp JOIN member m ON sp.member_id=m.employee_id
               WHERE sp.skill_id=? AND m.job_type IN ('사무직','기술직','연구직')""",
            (skill_id,),
        ).fetchone()
        # Level 분포 (전사)
        level_dist = pd.read_sql_query(
            """SELECT sp.current_level AS lv, COUNT(*) AS n
               FROM skill_profile sp JOIN member m ON sp.member_id=m.employee_id
               WHERE sp.skill_id=? AND m.job_type IN ('사무직','기술직','연구직')
               GROUP BY sp.current_level""",
            conn, params=(skill_id,),
        )
        # 팀 분포 (보유자가 어느 팀에)
        team_dist = pd.read_sql_query(
            """SELECT m.division AS div, COUNT(*) AS n
               FROM skill_profile sp JOIN member m ON sp.member_id=m.employee_id
               WHERE sp.skill_id=? AND m.job_type IN ('사무직','기술직','연구직')
               GROUP BY m.division ORDER BY n DESC""",
            conn, params=(skill_id,),
        )
    finally:
        conn.close()
    return {
        "total": total,
        "n_holders": holders["n"] or 0,
        "avg_lv": holders["avg_lv"] or 0,
        "level_dist": level_dist,
        "team_dist": team_dist,
    }


def _next_skill_id() -> int:
    conn = get_connection()
    try:
        row = conn.execute("SELECT MAX(skill_id) FROM skill").fetchone()
        return (row[0] or 0) + 1
    finally:
        conn.close()


def _insert_skill(sub_family_id, name, description, is_critical):
    new_id = _next_skill_id()
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO skill (skill_id, sub_family_id, skill_name, description, is_critical) VALUES (?,?,?,?,?)",
            (new_id, sub_family_id, name, description, is_critical),
        )
        conn.commit()
    finally:
        conn.close()
    return new_id


def _update_skill(skill_id, sub_family_id, name, description, is_critical):
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE skill SET sub_family_id=?, skill_name=?, description=?, is_critical=? WHERE skill_id=?",
            (sub_family_id, name, description, is_critical, skill_id),
        )
        conn.commit()
    finally:
        conn.close()


def _delete_skill(skill_id):
    conn = get_connection()
    try:
        n_prof = conn.execute("SELECT COUNT(*) FROM skill_profile WHERE skill_id=?", (skill_id,)).fetchone()[0]
        n_req = conn.execute("SELECT COUNT(*) FROM required_skill WHERE skill_id=?", (skill_id,)).fetchone()[0]
        n_asm = conn.execute("SELECT COUNT(*) FROM assessment WHERE skill_id=?", (skill_id,)).fetchone()[0]
        n_ev = conn.execute("SELECT COUNT(*) FROM evidence_skill_link WHERE skill_id=?", (skill_id,)).fetchone()[0]
        refs = {"profile": n_prof, "required": n_req, "assessment": n_asm, "evidence_link": n_ev}
        if sum(refs.values()) > 0:
            return {"deleted": False, "refs": refs}
        conn.execute("DELETE FROM skill WHERE skill_id=?", (skill_id,))
        conn.commit()
    finally:
        conn.close()
    return {"deleted": True}


def _box_header(title: str) -> str:
    """이미지 참고 — 파란 헤더 박스 (네이비 배경 + 흰 글자)."""
    return (
        f"<div style='background:{COLOR_NAVY}; color:white; padding:6px 14px; "
        f"border-radius:3px; display:inline-block; font-size:13px; font-weight:600; "
        f"letter-spacing:0.02em; margin-bottom:8px;'>{title}</div>"
    )


def _donut(value: float, total: float, label: str, color=COLOR_NAVY) -> go.Figure:
    """보유율 도넛 차트."""
    pct = (value / total * 100) if total > 0 else 0
    fig = go.Figure(go.Pie(
        values=[value, max(total - value, 0)],
        labels=[label, "기타"],
        hole=0.65,
        marker=dict(colors=[color, "#E8EEF5"]),
        textinfo="none",
        showlegend=False,
        sort=False,
    ))
    fig.add_annotation(
        text=f"<b>{pct:.0f}%</b>",
        showarrow=False, font=dict(size=22, color=COLOR_NAVY),
        x=0.5, y=0.5,
    )
    fig.update_layout(
        height=160, margin=dict(t=0, b=0, l=0, r=0),
        paper_bgcolor="white",
    )
    return fig


def _level_bar(avg: float) -> go.Figure:
    """평균 Level 가로 바 (1~4 스케일)."""
    fig = go.Figure(go.Bar(
        x=[avg], y=[""], orientation="h",
        marker=dict(color=COLOR_NAVY),
        text=[f"<b>{avg:.1f}</b>"], textposition="inside",
        textfont=dict(color="white"),
        hoverinfo="none",
    ))
    fig.update_layout(
        height=50, margin=dict(t=0, b=0, l=0, r=0),
        paper_bgcolor="white", plot_bgcolor="white",
        xaxis=dict(range=[0, 4], showgrid=False, showticklabels=True, dtick=1,
                   tickfont=dict(size=10, color=COLOR_TEXT_MED)),
        yaxis=dict(showgrid=False, showticklabels=False),
    )
    return fig


def _team_pie(team_dist: pd.DataFrame) -> go.Figure:
    """팀 분포 파이."""
    if team_dist.empty:
        fig = go.Figure()
        fig.update_layout(height=180, margin=dict(t=0, b=0, l=0, r=0))
        return fig
    colors = ["#0A1929", "#3D5A80", "#7A8FA8", "#A8B8C8", "#C7D0DA", "#E8EEF5"]
    fig = go.Figure(go.Pie(
        values=team_dist["n"], labels=team_dist["div"],
        marker=dict(colors=colors[:len(team_dist)]),
        textinfo="label+percent", textposition="outside",
        textfont=dict(size=10),
        showlegend=False,
    ))
    fig.update_layout(
        height=200, margin=dict(t=10, b=10, l=10, r=10),
        paper_bgcolor="white",
    )
    return fig


# ===== 페이지 시작 =====
persona = st.session_state.get("current_persona", "hr_admin")
render_persona_badge(persona)
page_header(
    "Skill Library",
    "Skill 카탈로그 — 정의·Tool·Level Guideline·보유 현황",
)

is_admin = persona == "hr_admin"
skills_df, criteria_df, subs_df = _load_all()

# 새 Skill 등록 (HR Admin)
if is_admin:
    with st.expander("새 Skill 등록", expanded=False):
        with st.form("new_skill", clear_on_submit=True):
            ncol1, ncol2 = st.columns(2)
            with ncol1:
                fam_opt = subs_df["family_name"].drop_duplicates().tolist()
                sel_f = st.selectbox("Family", fam_opt)
                sub_pool = subs_df[subs_df["family_name"] == sel_f]
                sub_choice = st.selectbox(
                    "Sub-family",
                    options=sub_pool["sub_family_id"].tolist(),
                    format_func=lambda sid: sub_pool[sub_pool["sub_family_id"] == sid].iloc[0]["sub_family_name"],
                )
            with ncol2:
                new_name = st.text_input("Skill 이름 *")
                new_critical = st.checkbox("Critical Skill", value=False)
            new_desc = st.text_area(
                "Skill 정의",
                height=100,
                placeholder="이 Skill이 무엇인지·언제 발휘되는지 명확하게",
            )
            if st.form_submit_button("Skill 등록", type="primary"):
                if not new_name.strip():
                    st.error("Skill 이름은 필수입니다.")
                else:
                    new_id = _insert_skill(sub_choice, new_name.strip(),
                                            new_desc.strip(), 1 if new_critical else 0)
                    st.success(f"#{new_id:03d} '{new_name}' 등록 완료")
                    st.rerun()

# 상단 필터
filter_col1, filter_col2, filter_col3 = st.columns([2, 2, 3])
with filter_col1:
    family_opts = ["전체"] + skills_df["family_name"].drop_duplicates().tolist()
    sel_family = st.selectbox("Family", family_opts, key="sm_fam")
with filter_col2:
    if sel_family == "전체":
        sub_pool = skills_df["sub_family_name"].drop_duplicates().tolist()
    else:
        sub_pool = skills_df[skills_df["family_name"] == sel_family]["sub_family_name"].drop_duplicates().tolist()
    sub_opts = ["전체"] + sub_pool
    sel_sub = st.selectbox("Sub-family", sub_opts, key="sm_sub")
with filter_col3:
    keyword = st.text_input("Skill 이름 검색", placeholder="예: OLED, Canister, 설계 …", key="sm_kw")

view_df = skills_df.copy()
if sel_family != "전체":
    view_df = view_df[view_df["family_name"] == sel_family]
if sel_sub != "전체":
    view_df = view_df[view_df["sub_family_name"] == sel_sub]
if keyword.strip():
    view_df = view_df[view_df["skill_name"].str.contains(keyword.strip(), case=False, na=False)]

mcol1, mcol2, mcol3 = st.columns(3)
mcol1.metric("필터 결과", f"{len(view_df)} / {len(skills_df)} Skill")
mcol2.metric("Sub-family", f"{view_df['sub_family_name'].nunique()} / {skills_df['sub_family_name'].nunique()}")
mcol3.metric("Critical Skill", int(view_df["is_critical"].sum()))

st.divider()

# 좌 트리 + 우 상세
left, right = st.columns([1, 2.3])

with left:
    st.markdown(f"<h5 style='color:{COLOR_NAVY};'>Skill Tree</h5>", unsafe_allow_html=True)
    if view_df.empty:
        st.info("조건에 맞는 Skill이 없습니다.")
        selected_skill_id = None
    else:
        if "sm_selected_id" not in st.session_state:
            st.session_state.sm_selected_id = int(view_df.iloc[0]["skill_id"])

        for fname, f_group in view_df.groupby("family_name", sort=False):
            with st.expander(f"{fname}  ({len(f_group)})", expanded=True):
                for sfname, sf_group in f_group.groupby("sub_family_name", sort=False):
                    st.markdown(
                        f"<p style='color:{COLOR_TEXT_MED}; font-size:13px; margin:6px 0 4px 4px;'>"
                        f"└ {sfname} ({len(sf_group)})</p>",
                        unsafe_allow_html=True,
                    )
                    for _, row in sf_group.iterrows():
                        sid = int(row["skill_id"])
                        is_sel = sid == st.session_state.sm_selected_id
                        critical_tag = "  [CRT]" if row["is_critical"] else ""
                        if st.button(
                            f"#{sid:03d}  {row['skill_name']}{critical_tag}",
                            key=f"sk_{sid}",
                            use_container_width=True,
                            type="primary" if is_sel else "secondary",
                        ):
                            st.session_state.sm_selected_id = sid
                            st.rerun()
        selected_skill_id = st.session_state.sm_selected_id

with right:
    if selected_skill_id is None or selected_skill_id not in skills_df["skill_id"].values:
        st.info("좌측에서 Skill을 선택하세요.")
    else:
        sk = skills_df[skills_df["skill_id"] == selected_skill_id].iloc[0]
        critical_badge = (
            f"<span style='background:{COLOR_SK_RED}; color:white; padding:2px 8px; "
            f"border-radius:3px; font-size:11px; font-weight:600; letter-spacing:0.04em; "
            f"margin-left:8px; vertical-align:middle;'>CRITICAL</span>"
            if sk["is_critical"] else ""
        )
        # Skill 명 (이미지 참고 — 흰 박스 라벨 + 네이비 박스 이름)
        st.markdown(
            f"""
            <div style='display:flex; align-items:center; gap:8px; margin-bottom:14px;'>
                <span style='border:1.5px solid {COLOR_NAVY}; color:{COLOR_NAVY};
                       padding:6px 14px; border-radius:3px; font-size:13px; font-weight:600;'>스킬 명</span>
                <span style='background:{COLOR_NAVY}; color:white; padding:7px 16px;
                       border-radius:3px; font-size:14px; font-weight:600;'>
                    #{int(sk['skill_id']):03d} · {sk['skill_name']}{critical_badge}
                </span>
                <span style='color:{COLOR_TEXT_MED}; font-size:12px; margin-left:6px;'>
                    {sk['family_name']} · {sk['sub_family_name']}
                </span>
            </div>
            """,
            unsafe_allow_html=True,
        )

        # 4 박스 그리드 — 좌측(Definition·보유 현황) / 우측(Level Guideline)
        bl, br = st.columns([1, 1.4])

        with bl:
            # Skill Definition
            st.markdown(_box_header("Skill Definition"), unsafe_allow_html=True)
            if sk.get("description") and sk["description"].strip():
                st.markdown(
                    f"<div style='background:#F1F5FA; border:1px solid {COLOR_BORDER}; "
                    f"border-radius:3px; padding:14px 16px; min-height:160px; "
                    f"color:{COLOR_TEXT_DARK}; font-size:13px; line-height:1.6;'>"
                    f"{sk['description']}</div>",
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    f"<div style='background:#FFFAF0; border:1px dashed #E0A030; "
                    f"border-radius:3px; padding:14px 16px; min-height:160px; "
                    f"color:#9B6B0F; font-size:12px;'>"
                    f"Skill 정의 미입력 — HR Admin이 아래 '편집' expander에서 입력하세요.</div>",
                    unsafe_allow_html=True,
                )

            # 보유 현황 (도넛 2개)
            h = _load_holders(int(sk["skill_id"]))
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown(_box_header("전사 내 Skill 보유 현황"), unsafe_allow_html=True)
            sub_h1, sub_h2 = st.columns([1, 1])
            with sub_h1:
                st.plotly_chart(
                    _donut(h["n_holders"], h["total"], "보유"),
                    use_container_width=True,
                )
            with sub_h2:
                st.markdown(
                    f"<p style='color:{COLOR_TEXT_MED}; font-size:11px; margin:4px 0 0 0;'>전사 평균 Level</p>",
                    unsafe_allow_html=True,
                )
                st.plotly_chart(_level_bar(h["avg_lv"]), use_container_width=True)
                st.markdown(
                    f"<p style='color:{COLOR_TEXT_MED}; font-size:11px; margin:4px 0 0 0;'>"
                    f"보유 {int(h['n_holders'])} / 평가 대상 {h['total']}명</p>",
                    unsafe_allow_html=True,
                )

        with br:
            # Level Definition / Guideline
            st.markdown(_box_header("Level Definition / Guideline"), unsafe_allow_html=True)
            lc = (criteria_df[criteria_df["sub_family_id"] == sk["sub_family_id"]]
                  .sort_values("level", ascending=False))
            for _, c in lc.iterrows():
                lv = int(c["level"])
                lvl_name = LEVEL_NAMES.get(lv, "")
                st.markdown(
                    f"""
                    <div style='display:flex; gap:12px; margin-bottom:8px;
                                background:#F1F5FA; border:1px solid {COLOR_BORDER};
                                border-radius:3px; padding:10px 14px;'>
                        <div style='min-width:90px;'>
                            <b style='color:{COLOR_NAVY}; font-size:13px;'>{lvl_name}</b>
                            <div style='color:{COLOR_TEXT_MED}; font-size:11px;'>L{lv}</div>
                        </div>
                        <div style='flex:1; color:{COLOR_TEXT_DARK}; font-size:12px; line-height:1.5;'>
                            <div style='color:{COLOR_TEXT_MED}; font-size:11px; font-weight:600; margin-bottom:2px;'>전문성</div>
                            {c['expertise_criteria'] or '—'}
                            <div style='color:{COLOR_TEXT_MED}; font-size:11px; font-weight:600; margin:6px 0 2px 0;'>영향력</div>
                            {c['impact_criteria'] or '—'}
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

            # 해당 레벨 보유자 분포 (담당 분포)
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown(_box_header("해당 Skill 보유자 분포"), unsafe_allow_html=True)
            sub_d1, sub_d2 = st.columns([1, 1])
            with sub_d1:
                st.markdown(
                    f"<p style='color:{COLOR_TEXT_MED}; font-size:11px;'>담당 분포</p>",
                    unsafe_allow_html=True,
                )
                st.plotly_chart(_team_pie(h["team_dist"]), use_container_width=True)
            with sub_d2:
                st.markdown(
                    f"<p style='color:{COLOR_TEXT_MED}; font-size:11px;'>Level 분포</p>",
                    unsafe_allow_html=True,
                )
                ld = h["level_dist"]
                if ld.empty:
                    st.caption("보유자 없음")
                else:
                    # Level별 가로 막대
                    lv_rows = []
                    for lv in [4, 3, 2, 1]:
                        cnt = int(ld[ld["lv"] == lv]["n"].sum()) if lv in ld["lv"].values else 0
                        lv_rows.append({"Level": f"L{lv}", "보유": cnt})
                    lv_df_show = pd.DataFrame(lv_rows)
                    fig = go.Figure(go.Bar(
                        y=lv_df_show["Level"], x=lv_df_show["보유"],
                        orientation="h",
                        marker=dict(color=["#0A1929", "#3D5A80", "#7A8FA8", "#A8B8C8"]),
                        text=lv_df_show["보유"], textposition="outside",
                    ))
                    fig.update_layout(
                        height=180, margin=dict(t=10, b=10, l=10, r=20),
                        paper_bgcolor="white", plot_bgcolor="white",
                        xaxis=dict(showgrid=False),
                        yaxis=dict(showgrid=False),
                    )
                    st.plotly_chart(fig, use_container_width=True)

        # HR Admin 편집 영역
        if is_admin:
            with st.expander("이 Skill 편집·삭제", expanded=False):
                ecol1, ecol2 = st.columns(2)
                with ecol1:
                    cur_fam = sk["family_name"]
                    fam_opts = subs_df["family_name"].drop_duplicates().tolist()
                    new_fam = st.selectbox(
                        "Family", fam_opts,
                        index=fam_opts.index(cur_fam) if cur_fam in fam_opts else 0,
                        key=f"e_fam_{selected_skill_id}",
                    )
                    sub_pool = subs_df[subs_df["family_name"] == new_fam]
                    cur_sub_id = sk["sub_family_id"]
                    sub_options = sub_pool["sub_family_id"].tolist()
                    new_sub = st.selectbox(
                        "Sub-family",
                        options=sub_options,
                        index=sub_options.index(cur_sub_id) if cur_sub_id in sub_options else 0,
                        format_func=lambda sid: sub_pool[sub_pool["sub_family_id"] == sid].iloc[0]["sub_family_name"],
                        key=f"e_sub_{selected_skill_id}",
                    )
                with ecol2:
                    new_name = st.text_input("Skill 이름", value=sk["skill_name"],
                                              key=f"e_name_{selected_skill_id}")
                    new_critical = st.checkbox("Critical Skill", value=bool(sk["is_critical"]),
                                                key=f"e_crit_{selected_skill_id}")
                new_desc = st.text_area(
                    "Skill 정의",
                    value=sk.get("description") or "",
                    key=f"e_desc_{selected_skill_id}", height=120,
                )
                bcol1, bcol2 = st.columns(2)
                with bcol1:
                    if st.button("변경사항 저장", type="primary", use_container_width=True,
                                  key=f"e_save_{selected_skill_id}"):
                        _update_skill(int(selected_skill_id), new_sub, new_name.strip(),
                                       new_desc.strip(), 1 if new_critical else 0)
                        st.success("저장됨")
                        st.rerun()
                with bcol2:
                    if st.button("Skill 삭제", use_container_width=True,
                                  key=f"e_del_{selected_skill_id}"):
                        res = _delete_skill(int(selected_skill_id))
                        if res["deleted"]:
                            st.success("삭제됨")
                            st.session_state.sm_selected_id = int(skills_df.iloc[0]["skill_id"])
                            st.rerun()
                        else:
                            r = res["refs"]
                            st.error(
                                f"삭제 차단 — Profile {r['profile']} / Required {r['required']} / "
                                f"Assessment {r['assessment']} / Evidence {r['evidence_link']}"
                            )

# Skill Profile - 개인 보유 Skill 통합 화면. 카드 + Radar + 테이블.
# 페르소나별 데이터 범위 분기 (구성원=본인, Leader=팀원, HR=전체).
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from config import (
    COLOR_BG_LIGHT,
    COLOR_BG_WHITE,
    COLOR_BORDER,
    COLOR_NAVY,
    COLOR_SK_RED,
    COLOR_TEXT_DARK,
    COLOR_TEXT_MED,
    LEVEL_NAMES,
)
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header


def _load_assessment_history(employee_id: str) -> pd.DataFrame:
    """본인 평가 이력 - assessment 테이블에서 모든 평가."""
    conn = get_connection()
    try:
        return pd.read_sql_query(
            """SELECT a.assessment_id, a.skill_id, a.stage, a.proposed_level,
                      a.confirmed_level, a.assessed_date, a.status, a.rationale,
                      s.skill_name, sf.sub_family_name, f.family_name,
                      m.name AS assessor_name
               FROM assessment a
               JOIN skill s ON a.skill_id = s.skill_id
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               JOIN skill_family f      ON sf.family_id = f.family_id
               LEFT JOIN member m ON a.assessor_id = m.employee_id
               WHERE a.member_id = ?
               ORDER BY a.assessment_id DESC""",
            conn, params=(employee_id,),
        )
    finally:
        conn.close()


def _load_skill_progress(employee_id: str) -> pd.DataFrame:
    """Skill별 평가 진행 현황 - 각 (Skill)이 어느 stage까지 갔는지."""
    conn = get_connection()
    try:
        # 본인 Required + 보유 Skill의 합집합에 대해 stage 추적
        df = pd.read_sql_query(
            """WITH all_skills AS (
                  SELECT skill_id FROM skill_profile WHERE member_id=?
                  UNION
                  SELECT r.skill_id FROM required_skill r, member m
                  WHERE m.employee_id=?
                    AND ((r.org_or_individual='company' AND r.target_id='ALL')
                      OR (r.org_or_individual='department' AND r.target_id=m.team)
                      OR (r.org_or_individual='individual' AND r.target_id=? AND r.status='approved'))
               )
               SELECT s.skill_id, s.skill_name, sf.sub_family_name,
                      sp.current_level,
                      MAX(CASE WHEN a.stage='self' THEN 1 ELSE 0 END) AS done_self,
                      MAX(CASE WHEN a.stage='leader' THEN 1 ELSE 0 END) AS done_leader,
                      MAX(CASE WHEN a.stage='calibration' THEN 1 ELSE 0 END) AS done_calib,
                      MAX(CASE WHEN a.stage='committee' THEN 1 ELSE 0 END) AS done_comm,
                      MAX(a.assessed_date) AS last_date
               FROM all_skills ak
               JOIN skill s ON ak.skill_id = s.skill_id
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               LEFT JOIN skill_profile sp ON sp.member_id=? AND sp.skill_id=s.skill_id
               LEFT JOIN assessment a ON a.member_id=? AND a.skill_id=s.skill_id
                   AND a.status IN ('submitted','confirmed')
               GROUP BY s.skill_id
               ORDER BY s.skill_id""",
            conn, params=(employee_id, employee_id, employee_id, employee_id, employee_id),
        )
    finally:
        conn.close()
    return df


def _load_member_options() -> pd.DataFrame:
    conn = get_connection()
    try:
        return pd.read_sql_query(
            """SELECT employee_id, name, division, team, role_level, position, job_type
               FROM member WHERE job_type IN ('사무직','기술직','연구직')
               ORDER BY division, team, role_level DESC, name""",
            conn,
        )
    finally:
        conn.close()


def _load_profile(employee_id: str) -> pd.DataFrame:
    conn = get_connection()
    try:
        return pd.read_sql_query(
            """SELECT sp.skill_id, sp.current_level, sp.target_level, sp.last_assessed_date,
                      s.skill_name, s.is_critical,
                      sf.sub_family_id, sf.sub_family_name,
                      f.family_id, f.family_name
               FROM skill_profile sp
               JOIN skill s             ON sp.skill_id = s.skill_id
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               JOIN skill_family f      ON sf.family_id = f.family_id
               WHERE sp.member_id = ?
               ORDER BY sp.current_level DESC, sp.skill_id""",
            conn, params=(employee_id,),
        )
    finally:
        conn.close()


def _load_required_for_member(employee_id: str, team: str) -> pd.DataFrame:
    """전사 + 팀 + 개인 매핑된 Required Skill을 합쳐서 반환 (중복 제거)."""
    conn = get_connection()
    try:
        df = pd.read_sql_query(
            """SELECT skill_id, target_level, is_core FROM required_skill
               WHERE (org_or_individual='company' AND target_id='ALL')
                  OR (org_or_individual='department' AND target_id=?)
                  OR (org_or_individual='individual' AND target_id=? AND status='approved')""",
            conn, params=(team, employee_id),
        )
    finally:
        conn.close()
    # 같은 skill_id면 가장 높은 target_level + is_core 합집합
    if df.empty:
        return df
    g = df.groupby("skill_id").agg(
        target_level=("target_level", "max"),
        is_core=("is_core", "max"),
    ).reset_index()
    return g


def _load_sub_families() -> pd.DataFrame:
    conn = get_connection()
    try:
        return pd.read_sql_query(
            "SELECT sub_family_id, sub_family_name, family_id FROM sub_skill_family ORDER BY family_id, sub_family_id",
            conn,
        )
    finally:
        conn.close()


def _build_radar(profile: pd.DataFrame, sub_families: pd.DataFrame) -> go.Figure:
    """9 Sub-family를 축으로 한 Radar Chart. 보유 Skill 평균 Level + Target."""
    # 9 Sub-family를 고정 순서로
    sub_order = sub_families["sub_family_name"].tolist()
    sub_id_to_name = dict(zip(sub_families["sub_family_id"], sub_families["sub_family_name"]))

    current_map = (
        profile.groupby("sub_family_name")["current_level"].mean()
        if not profile.empty else pd.Series(dtype=float)
    )
    target_map = (
        profile.groupby("sub_family_name")["target_level"].mean()
        if not profile.empty else pd.Series(dtype=float)
    )

    cur_values = [current_map.get(s, 0) for s in sub_order]
    tgt_values = [target_map.get(s, 0) for s in sub_order]

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=tgt_values + [tgt_values[0]],
        theta=sub_order + [sub_order[0]],
        fill="toself",
        name="Target",
        line=dict(color=COLOR_TEXT_MED, width=1, dash="dot"),
        fillcolor="rgba(110,110,115,0.10)",
    ))
    fig.add_trace(go.Scatterpolar(
        r=cur_values + [cur_values[0]],
        theta=sub_order + [sub_order[0]],
        fill="toself",
        name="Current",
        line=dict(color=COLOR_NAVY, width=2.5),
        fillcolor="rgba(10,25,41,0.18)",
    ))
    fig.update_layout(
        polar=dict(
            bgcolor=COLOR_BG_WHITE,
            radialaxis=dict(
                visible=True, range=[0, 4], tickvals=[1, 2, 3, 4],
                ticktext=["L1", "L2", "L3", "L4"],
                gridcolor=COLOR_BORDER, linecolor=COLOR_BORDER,
                tickfont=dict(size=10, color=COLOR_TEXT_MED),
            ),
            angularaxis=dict(
                gridcolor=COLOR_BORDER, linecolor=COLOR_BORDER,
                tickfont=dict(size=11, color=COLOR_NAVY),
            ),
        ),
        showlegend=True,
        legend=dict(orientation="h", y=-0.08, x=0.5, xanchor="center"),
        margin=dict(t=20, b=20, l=20, r=20),
        height=420,
        paper_bgcolor=COLOR_BG_WHITE,
    )
    return fig


# ---------- 페이지 시작 ----------
persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("최종 결과 확인",
            "나의 Skill Level 확인 + 평가 History — Radar / Gap / 상세 테이블")

members_df = _load_member_options()

# 페르소나별 선택 가능 범위
if persona == "employee" and member:
    visible = members_df[members_df["employee_id"] == member["employee_id"]]
elif persona == "team_leader" and member:
    visible = members_df[members_df["team"] == member.get("team", "")]
else:
    visible = members_df

if visible.empty:
    st.warning("조회 가능한 인원이 없습니다.")
    st.stop()

# 사람 선택
opts = visible["employee_id"].tolist()
default_idx = 0
if member and member["employee_id"] in opts:
    default_idx = opts.index(member["employee_id"])

sel_emp = st.selectbox(
    "구성원 선택",
    options=opts,
    index=default_idx,
    format_func=lambda eid: (
        f"{visible[visible['employee_id']==eid].iloc[0]['name']} "
        f"({visible[visible['employee_id']==eid].iloc[0]['team']} · "
        f"{visible[visible['employee_id']==eid].iloc[0]['role_level']})"
    ),
    key="profile_select",
)

sel = visible[visible["employee_id"] == sel_emp].iloc[0]
profile_df = _load_profile(sel_emp)
required_df = _load_required_for_member(sel_emp, sel["team"])
sub_families = _load_sub_families()

# --- 상단 정보 카드 ---
st.markdown(
    f"""
    <div style="
        background: {COLOR_BG_WHITE};
        border: 1px solid {COLOR_BORDER};
        border-radius: 14px;
        padding: 18px 24px;
        margin-bottom: 18px;
    ">
        <div style="color:{COLOR_TEXT_MED}; font-size:12px;">{sel['division']} · {sel['team']}</div>
        <div style="display:flex; align-items:center; gap:14px; margin-top:4px;">
            <h2 style="margin:0; color:{COLOR_NAVY};">{sel['name']}</h2>
            <span style="background:{COLOR_NAVY}; color:white; padding:3px 10px;
                   border-radius:12px; font-size:12px;">{sel['role_level']} · {sel['position']}</span>
            <span style="background:#F5F5F7; color:{COLOR_TEXT_MED}; padding:3px 10px;
                   border-radius:12px; font-size:12px;">{sel['job_type']}</span>
            <span style="color:{COLOR_TEXT_MED}; font-size:13px;">사번 {sel['employee_id']}</span>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# --- 좌측 KPI 카드 + 우측 Radar Chart ---
left, right = st.columns([1, 1.4])

with left:
    st.markdown(f"<h4 style='color:{COLOR_NAVY}; margin-top:0;'>요약</h4>", unsafe_allow_html=True)

    total = len(profile_df)
    avg_lv = profile_df["current_level"].mean() if total else 0
    critical_held = int(profile_df["is_critical"].sum()) if total else 0

    # Required 충족률
    if not required_df.empty:
        merged = required_df.merge(
            profile_df[["skill_id", "current_level"]],
            on="skill_id", how="left",
        ).fillna(0)
        met = (merged["current_level"] >= merged["target_level"]).sum()
        fulfill_rate = met / len(required_df) * 100
    else:
        fulfill_rate = 0
        merged = pd.DataFrame()

    c1, c2 = st.columns(2)
    c1.metric("보유 Skill", f"{total} 개")
    c2.metric("평균 Level", f"L{avg_lv:.2f}" if total else "—")
    c3, c4 = st.columns(2)
    c3.metric("Critical 보유", f"{critical_held} 개")
    c4.metric("Required 충족", f"{fulfill_rate:.0f}%" if not required_df.empty else "—",
              help="요구 Skill 중 현재 Level ≥ Target Level 비율")

    # Level별 분포 막대
    if total:
        st.markdown(
            f"<p style='color:{COLOR_TEXT_MED}; font-size:13px; margin-top:14px; margin-bottom:4px;'>Level 분포</p>",
            unsafe_allow_html=True,
        )
        dist = profile_df["current_level"].value_counts().reindex([1, 2, 3, 4]).fillna(0).astype(int)
        for lv in [4, 3, 2, 1]:
            count = int(dist[lv])
            pct = count / total * 100 if total else 0
            bar_width = max(2, int(pct * 1.8))
            st.markdown(
                f"""
                <div style="display:flex; align-items:center; gap:8px; margin:3px 0;">
                    <span style="width:60px; color:{COLOR_NAVY}; font-size:12px;">L{lv} · {LEVEL_NAMES[lv]}</span>
                    <div style="flex:1; background:#F5F5F7; border-radius:4px; height:14px; position:relative;">
                        <div style="width:{bar_width}px; max-width:100%; background:{COLOR_NAVY};
                                    height:14px; border-radius:4px;"></div>
                    </div>
                    <span style="width:60px; text-align:right; color:{COLOR_TEXT_MED}; font-size:12px;">
                        {count}개 ({pct:.0f}%)
                    </span>
                </div>
                """,
                unsafe_allow_html=True,
            )

with right:
    st.markdown(
        f"<h4 style='color:{COLOR_NAVY}; margin-top:0;'>Sub-family Radar</h4>",
        unsafe_allow_html=True,
    )
    fig = _build_radar(profile_df, sub_families)
    st.plotly_chart(fig, use_container_width=True)

st.divider()

# --- 하단: 보유 Skill 테이블 ---
st.markdown(f"<h4 style='color:{COLOR_NAVY};'>보유 Skill 상세</h4>", unsafe_allow_html=True)

if profile_df.empty:
    st.info("보유 Skill이 없습니다.")
else:
    # 필터
    fcol1, fcol2, fcol3 = st.columns([2, 2, 4])
    with fcol1:
        fam_opts = ["전체"] + profile_df["family_name"].drop_duplicates().tolist()
        sel_fam = st.selectbox("Family", fam_opts, key="prof_fam")
    with fcol2:
        pool = profile_df if sel_fam == "전체" else profile_df[profile_df["family_name"] == sel_fam]
        sub_opts = ["전체"] + pool["sub_family_name"].drop_duplicates().tolist()
        sel_sub = st.selectbox("Sub-family", sub_opts, key="prof_sub")
    with fcol3:
        only_required = st.checkbox("Required Skill만", value=False, key="prof_req_only")

    v = profile_df.copy()
    if sel_fam != "전체":
        v = v[v["family_name"] == sel_fam]
    if sel_sub != "전체":
        v = v[v["sub_family_name"] == sel_sub]
    if only_required and not required_df.empty:
        v = v[v["skill_id"].isin(required_df["skill_id"])]

    # Required·Gap 정보 join
    if not required_df.empty:
        v = v.merge(
            required_df.rename(columns={"target_level": "req_level", "is_core": "req_core"}),
            on="skill_id", how="left",
        )
        v["req_level"] = v["req_level"].fillna(0).astype(int)
        v["Gap"] = (v["req_level"] - v["current_level"]).where(v["req_level"] > 0, 0).astype(int)
    else:
        v["req_level"] = 0
        v["Gap"] = 0
        v["req_core"] = 0

    # 표시용
    v["L"] = v["current_level"].map(lambda lv: f"L{int(lv)} · {LEVEL_NAMES[int(lv)]}")
    v["목표"] = v["target_level"].map(lambda lv: f"L{int(lv)}")
    v["요구"] = v.apply(
        lambda r: (f"L{int(r['req_level'])}" + (" (Core)" if r.get('req_core') else "")) if r["req_level"] > 0 else "—",
        axis=1,
    )
    v["Critical"] = v["is_critical"].map(lambda b: "CRT" if b else "")
    v["Gap표시"] = v["Gap"].map(lambda g: f"+{g}" if g > 0 else ("OK" if g == 0 else ""))

    display = v[[
        "skill_id", "skill_name", "family_name", "sub_family_name",
        "L", "목표", "요구", "Gap표시", "Critical",
    ]].rename(columns={
        "skill_id": "ID", "skill_name": "Skill", "family_name": "Family",
        "sub_family_name": "Sub-family", "L": "현재", "Gap표시": "Gap",
    })

    st.dataframe(display, hide_index=True, use_container_width=True, height=440)
    st.caption(
        f"필터 결과 {len(v)} / 보유 전체 {len(profile_df)} · "
        "Gap = Required Target - 현재 Level (요구 있는 Skill만)"
    )

# ========== 평가 진행 현황 ==========
st.divider()
st.markdown(
    f"<h4 style='color:{COLOR_NAVY};'>평가 진행 현황</h4>",
    unsafe_allow_html=True,
)
st.caption("각 Skill이 4단계 평가 워크플로의 어디까지 진행됐는지 한눈에. ●=완료 ○=미진행")

progress_df = _load_skill_progress(sel_emp)
if progress_df.empty:
    st.info("평가 대상 Skill이 없습니다.")
else:
    p_total = len(progress_df)
    p_done_self = int(progress_df["done_self"].sum())
    p_done_leader = int(progress_df["done_leader"].sum())
    p_done_calib = int(progress_df["done_calib"].sum())
    p_done_comm = int(progress_df["done_comm"].sum())

    pk1, pk2, pk3, pk4, pk5 = st.columns(5)
    pk1.metric("대상 Skill", p_total)
    pk2.metric("자가 진단", f"{p_done_self} / {p_total}")
    pk3.metric("리더 진단", f"{p_done_leader} / {p_total}")
    pk4.metric("Calibration", f"{p_done_calib} / {p_total}")
    pk5.metric("Committee", f"{p_done_comm} / {p_total}")

    # 필터: 미진행만 / 전체
    only_pending = st.checkbox("평가 미진행 Skill만 보기", value=False, key="prof_only_pending")
    prog_view = progress_df.copy()
    if only_pending:
        prog_view = prog_view[prog_view["done_self"] == 0]

    if prog_view.empty:
        st.success("필터 조건의 Skill이 없습니다.")
    else:
        def _mark(v):
            return "●" if v else "○"
        disp = pd.DataFrame({
            "ID":         prog_view["skill_id"],
            "Skill":      prog_view["skill_name"],
            "Sub-family": prog_view["sub_family_name"],
            "현재 Lv":    prog_view["current_level"].apply(
                lambda x: f"L{int(x)}" if pd.notna(x) else "—"),
            "Self":       prog_view["done_self"].map(_mark),
            "Leader":     prog_view["done_leader"].map(_mark),
            "Calib":      prog_view["done_calib"].map(_mark),
            "Comm.":      prog_view["done_comm"].map(_mark),
            "최근 평가":   prog_view["last_date"].fillna("—"),
        })
        st.dataframe(disp, hide_index=True, use_container_width=True, height=360)

# ========== 평가 이력 타임라인 ==========
st.divider()
st.markdown(
    f"<h4 style='color:{COLOR_NAVY};'>평가 이력 (History)</h4>",
    unsafe_allow_html=True,
)
st.caption("본인이 받은 모든 평가 이력 — 최근 순")

hist_df = _load_assessment_history(sel_emp)
if hist_df.empty:
    st.info("평가 이력이 없습니다.")
else:
    # 필터
    hf1, hf2 = st.columns([2, 4])
    with hf1:
        stage_opts = ["전체", "self", "leader", "calibration", "committee"]
        sel_stage = st.selectbox("Stage 필터", stage_opts, key="hist_stage")
    with hf2:
        hk = st.text_input("Skill 이름 검색", key="hist_kw")

    hv = hist_df.copy()
    if sel_stage != "전체":
        hv = hv[hv["stage"] == sel_stage]
    if hk.strip():
        hv = hv[hv["skill_name"].str.contains(hk.strip(), case=False, na=False)]

    STAGE_LABELS = {"self": "자가", "leader": "리더",
                      "calibration": "Calib", "committee": "Committee"}
    STAGE_COLORS = {"self": "#7A8FA8", "leader": "#3D5A80",
                      "calibration": "#2C4865", "committee": COLOR_NAVY}

    st.caption(f"{len(hv)} / {len(hist_df)} 건")
    for _, r in hv.iterrows():
        stg = r["stage"]
        color = STAGE_COLORS.get(stg, COLOR_NAVY)
        lv = r["confirmed_level"] if pd.notna(r["confirmed_level"]) else r["proposed_level"]
        status_chip = (
            f"<span style='background:#1B8A50; color:white; padding:1px 5px; "
            f"border-radius:3px; font-size:9px; font-weight:600;'>CONFIRMED</span>"
            if r["status"] == "confirmed" else
            f"<span style='border:1px solid {COLOR_TEXT_MED}; color:{COLOR_TEXT_MED}; padding:0 5px; "
            f"border-radius:3px; font-size:9px; font-weight:500;'>SUBMITTED</span>"
        )
        rat = (r['rationale'] or '').strip()
        rat_html = (f"<div style='color:{COLOR_TEXT_MED}; font-size:12px; margin-top:4px;'>"
                    f"근거: {rat}</div>") if rat else ""
        st.markdown(
            f"""
            <div style='border-left:3px solid {color}; padding:8px 12px; margin-bottom:8px;
                        background:{COLOR_BG_WHITE}; border-radius:0 4px 4px 0;'>
                <div style='display:flex; justify-content:space-between; align-items:baseline;'>
                    <div>
                        <span style='background:{color}; color:white; padding:1px 7px;
                               border-radius:3px; font-size:10px; font-weight:600;
                               letter-spacing:0.04em;'>{STAGE_LABELS.get(stg, stg).upper()}</span>
                        <b style='color:{COLOR_NAVY}; margin-left:8px;'>
                            #{int(r['skill_id']):03d} {r['skill_name']}</b>
                        <span style='color:{COLOR_TEXT_MED}; font-size:11px; margin-left:6px;'>
                            ({r['sub_family_name']})</span>
                    </div>
                    <div>
                        {status_chip}
                        <b style='color:{COLOR_NAVY}; margin-left:10px;'>L{int(lv) if pd.notna(lv) else "—"}</b>
                    </div>
                </div>
                <div style='color:{COLOR_TEXT_MED}; font-size:12px; margin-top:3px;'>
                    {r['assessed_date']} · 평가자 {r['assessor_name'] or '—'}
                </div>
                {rat_html}
            </div>
            """,
            unsafe_allow_html=True,
        )

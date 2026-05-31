# Gap Analytics - 전사 / 조직 / 개인 3탭. 5종 차트.
# Stack Bar (Level 분포) / Heatmap (팀×Sub-family) / Bubble (보유vs요구) /
# Priority Matrix (Gap × Scarcity) / Radar (Required·Current·Peer)
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from config import (
    COLOR_BG_WHITE,
    COLOR_BORDER,
    COLOR_NAVY,
    COLOR_SK_RED,
    COLOR_TEXT_DARK,
    COLOR_TEXT_MED,
)
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header


# ---------- 데이터 로더 ----------
def _load_profiles() -> pd.DataFrame:
    """skill_profile + member + skill·sub_family 통합."""
    conn = get_connection()
    try:
        return pd.read_sql_query(
            """SELECT sp.member_id, sp.skill_id, sp.current_level, sp.target_level,
                      m.name, m.division, m.team, m.role_level, m.job_type,
                      s.skill_name, s.is_critical,
                      sf.sub_family_id, sf.sub_family_name, f.family_name
               FROM skill_profile sp
               JOIN member m ON sp.member_id = m.employee_id
               JOIN skill s  ON sp.skill_id  = s.skill_id
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               JOIN skill_family f      ON sf.family_id    = f.family_id
               WHERE m.job_type IN ('사무직','기술직','연구직')""",
            conn,
        )
    finally:
        conn.close()


def _load_required_for_team(team: str) -> pd.DataFrame:
    """전사 + 해당 팀 Required 합집합."""
    conn = get_connection()
    try:
        df = pd.read_sql_query(
            """SELECT r.skill_id, r.target_level, r.is_core,
                      s.skill_name, sf.sub_family_id, sf.sub_family_name
               FROM required_skill r
               JOIN skill s             ON r.skill_id = s.skill_id
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               WHERE (r.org_or_individual='company' AND r.target_id='ALL')
                  OR (r.org_or_individual='department' AND r.target_id=?)""",
            conn, params=(team,),
        )
    finally:
        conn.close()
    if df.empty:
        return df
    return df.groupby(["skill_id", "skill_name", "sub_family_id", "sub_family_name"]).agg(
        target_level=("target_level", "max"),
        is_core=("is_core", "max"),
    ).reset_index()


def _load_required_for_member(member_id: str, team: str) -> pd.DataFrame:
    conn = get_connection()
    try:
        df = pd.read_sql_query(
            """SELECT r.skill_id, r.target_level, r.is_core, s.skill_name,
                      sf.sub_family_id, sf.sub_family_name
               FROM required_skill r
               JOIN skill s             ON r.skill_id = s.skill_id
               JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
               WHERE (r.org_or_individual='company' AND r.target_id='ALL')
                  OR (r.org_or_individual='department' AND r.target_id=?)
                  OR (r.org_or_individual='individual' AND r.target_id=? AND r.status='approved')""",
            conn, params=(team, member_id),
        )
    finally:
        conn.close()
    if df.empty:
        return df
    return df.groupby(["skill_id", "skill_name", "sub_family_id", "sub_family_name"]).agg(
        target_level=("target_level", "max"),
        is_core=("is_core", "max"),
    ).reset_index()


# ---------- 차트 ----------
LEVEL_COLORS = {  # 단색 톤 - Navy 계열 (사용자 가이드라인)
    1: "#C7D0DA",  # 연한 회청
    2: "#7A8FA8",
    3: "#3D5A80",
    4: COLOR_NAVY,  # 진한 네이비
}


def fig_stack_bar_by_sub(profile: pd.DataFrame) -> go.Figure:
    """Sub-family별 보유 Skill의 Level 누적 막대."""
    if profile.empty:
        return go.Figure()
    pivot = profile.groupby(["sub_family_name", "current_level"]).size().unstack(fill_value=0)
    # Level 1~4 컬럼 보장
    for lv in [1, 2, 3, 4]:
        if lv not in pivot.columns:
            pivot[lv] = 0
    pivot = pivot[[1, 2, 3, 4]]
    pivot = pivot.reindex(pivot.sum(axis=1).sort_values(ascending=False).index)

    fig = go.Figure()
    for lv in [1, 2, 3, 4]:
        fig.add_trace(go.Bar(
            x=pivot.index, y=pivot[lv],
            name=f"L{lv}", marker_color=LEVEL_COLORS[lv],
        ))
    fig.update_layout(
        barmode="stack",
        height=380,
        margin=dict(t=10, b=10, l=10, r=10),
        paper_bgcolor=COLOR_BG_WHITE,
        plot_bgcolor=COLOR_BG_WHITE,
        legend=dict(orientation="h", y=-0.18),
        yaxis=dict(gridcolor=COLOR_BORDER, title="보유 Skill 건수"),
        xaxis=dict(title=None),
    )
    return fig


def fig_heatmap_team_sub(profile: pd.DataFrame) -> go.Figure:
    """팀 × Sub-family 평균 current_level Heatmap."""
    if profile.empty:
        return go.Figure()
    pivot = profile.groupby(["team", "sub_family_name"])["current_level"].mean().unstack()
    pivot = pivot.fillna(0)

    fig = go.Figure(data=go.Heatmap(
        z=pivot.values,
        x=pivot.columns, y=pivot.index,
        colorscale=[[0, "#F5F5F7"], [0.5, "#7A8FA8"], [1, COLOR_NAVY]],
        zmin=0, zmax=4,
        text=[[f"{v:.1f}" if v > 0 else "" for v in row] for row in pivot.values],
        texttemplate="%{text}",
        textfont=dict(size=11, color="white"),
        colorbar=dict(title="평균 L", tickvals=[0, 1, 2, 3, 4]),
    ))
    fig.update_layout(
        height=360,
        margin=dict(t=10, b=10, l=10, r=10),
        paper_bgcolor=COLOR_BG_WHITE,
        xaxis=dict(side="top", tickangle=-30),
    )
    return fig


def fig_bubble_team(profile: pd.DataFrame, req: pd.DataFrame, team: str) -> go.Figure:
    """팀의 Required Skill에 대해 (현재 평균, 요구 Level) 버블 - 크기=보유 인원수."""
    team_prof = profile[profile["team"] == team]
    n_team = team_prof["member_id"].nunique()

    if req.empty:
        return go.Figure(), 0

    rows = []
    for _, r in req.iterrows():
        sid = int(r["skill_id"])
        holders = team_prof[team_prof["skill_id"] == sid]
        avg_cur = holders["current_level"].mean() if len(holders) else 0
        n_holders = holders["member_id"].nunique()
        rows.append({
            "Skill": f"#{sid:03d} {r['skill_name'][:18]}",
            "현재 평균": avg_cur,
            "요구 Level": r["target_level"],
            "보유 인원": n_holders,
            "Sub-family": r["sub_family_name"],
            "Core": "★ Core" if r["is_core"] else "일반",
        })
    df = pd.DataFrame(rows)

    fig = px.scatter(
        df, x="현재 평균", y="요구 Level",
        size="보유 인원", color="Sub-family",
        hover_name="Skill",
        size_max=40,
        symbol="Core",
        symbol_map={"★ Core": "star", "일반": "circle"},
    )
    # 대각선 (이상선) 추가 - 현재 = 요구 인 경우
    fig.add_shape(
        type="line", x0=0, y0=0, x1=4, y1=4,
        line=dict(color=COLOR_TEXT_MED, dash="dot", width=1),
    )
    fig.update_layout(
        height=420,
        margin=dict(t=10, b=10, l=10, r=10),
        paper_bgcolor=COLOR_BG_WHITE,
        plot_bgcolor=COLOR_BG_WHITE,
        xaxis=dict(range=[0, 4.5], gridcolor=COLOR_BORDER, dtick=1),
        yaxis=dict(range=[0, 4.5], gridcolor=COLOR_BORDER, dtick=1),
        legend=dict(orientation="v", y=1, x=1.02),
    )
    return fig, n_team


def fig_priority_matrix(profile: pd.DataFrame, req: pd.DataFrame, team: str) -> go.Figure:
    """Priority Matrix - x=Gap(요구-현재 평균), y=Scarcity(미보유율). 우상단=우선순위."""
    team_prof = profile[profile["team"] == team]
    n_team = max(team_prof["member_id"].nunique(), 1)

    if req.empty:
        return go.Figure()

    rows = []
    for _, r in req.iterrows():
        sid = int(r["skill_id"])
        holders = team_prof[team_prof["skill_id"] == sid]
        n_holders = holders["member_id"].nunique()
        avg_cur = holders["current_level"].mean() if n_holders else 0
        gap = max(r["target_level"] - avg_cur, 0)
        scarcity = 1 - (n_holders / n_team)  # 0 ~ 1
        rows.append({
            "Skill": f"#{sid:03d} {r['skill_name'][:20]}",
            "Gap": gap, "Scarcity": scarcity,
            "Core": bool(r["is_core"]),
            "Sub-family": r["sub_family_name"],
        })
    df = pd.DataFrame(rows)

    fig = go.Figure()
    # Core / 일반 두 그룹으로
    for is_core, label, color, symbol in [
        (True, "★ Core", COLOR_SK_RED, "star"),
        (False, "일반", COLOR_NAVY, "circle"),
    ]:
        sub = df[df["Core"] == is_core]
        if not sub.empty:
            fig.add_trace(go.Scatter(
                x=sub["Gap"], y=sub["Scarcity"],
                mode="markers", name=label,
                marker=dict(size=14, color=color, symbol=symbol,
                            line=dict(color="white", width=1)),
                text=sub["Skill"],
                hovertemplate="<b>%{text}</b><br>Gap=%{x:.2f}<br>Scarcity=%{y:.0%}<extra></extra>",
            ))
    # 사분면 점선 (중심선)
    fig.add_shape(type="line", x0=1, y0=0, x1=1, y1=1,
                  line=dict(color=COLOR_BORDER, dash="dot"))
    fig.add_shape(type="line", x0=0, y0=0.5, x1=4, y1=0.5,
                  line=dict(color=COLOR_BORDER, dash="dot"))
    # 우상단 라벨
    fig.add_annotation(x=3.5, y=0.95, text="<b>최우선</b>",
                       showarrow=False, font=dict(color=COLOR_SK_RED, size=12))
    fig.update_layout(
        height=420,
        margin=dict(t=10, b=10, l=10, r=10),
        paper_bgcolor=COLOR_BG_WHITE,
        plot_bgcolor=COLOR_BG_WHITE,
        xaxis=dict(title="Gap (요구 − 현재 평균)", range=[-0.2, 4], gridcolor=COLOR_BORDER),
        yaxis=dict(title="Scarcity (팀 내 미보유율)", range=[-0.05, 1.05],
                   gridcolor=COLOR_BORDER, tickformat=".0%"),
    )
    return fig


def fig_radar_individual(member_prof: pd.DataFrame, req: pd.DataFrame,
                          peer_prof: pd.DataFrame, sub_families: pd.DataFrame) -> go.Figure:
    """Radar - Required vs Current vs Peer(팀 평균)."""
    sub_order = sub_families["sub_family_name"].tolist()

    def _avg(df, col):
        if df.empty:
            return [0] * len(sub_order)
        m = df.groupby("sub_family_name")[col].mean()
        return [m.get(s, 0) for s in sub_order]

    current = _avg(member_prof, "current_level")
    peer = _avg(peer_prof, "current_level")
    required = _avg(req.rename(columns={"target_level": "lv"}), "lv")

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=required + [required[0]],
        theta=sub_order + [sub_order[0]],
        name="Required",
        line=dict(color=COLOR_SK_RED, width=1.5, dash="dot"),
        fill="toself", fillcolor="rgba(230,0,18,0.08)",
    ))
    fig.add_trace(go.Scatterpolar(
        r=peer + [peer[0]],
        theta=sub_order + [sub_order[0]],
        name="Peer 평균",
        line=dict(color=COLOR_TEXT_MED, width=1.5, dash="dash"),
        fill="toself", fillcolor="rgba(110,110,115,0.06)",
    ))
    fig.add_trace(go.Scatterpolar(
        r=current + [current[0]],
        theta=sub_order + [sub_order[0]],
        name="현재",
        line=dict(color=COLOR_NAVY, width=2.5),
        fill="toself", fillcolor="rgba(10,25,41,0.20)",
    ))
    fig.update_layout(
        polar=dict(
            bgcolor=COLOR_BG_WHITE,
            radialaxis=dict(range=[0, 4], tickvals=[1, 2, 3, 4],
                             gridcolor=COLOR_BORDER, tickfont=dict(size=10)),
            angularaxis=dict(gridcolor=COLOR_BORDER,
                              tickfont=dict(size=11, color=COLOR_NAVY)),
        ),
        showlegend=True, legend=dict(orientation="h", y=-0.08, x=0.5, xanchor="center"),
        margin=dict(t=20, b=20, l=20, r=20),
        height=440, paper_bgcolor=COLOR_BG_WHITE,
    )
    return fig


# ---------- 페이지 ----------
persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header("📈 Gap Analytics", "전사·조직·개인 단위 Skill Gap 분석")

profile = _load_profiles()

if profile.empty:
    st.info("Skill Profile 데이터가 없습니다.")
    st.stop()

tab_co, tab_org, tab_ind = st.tabs(["🏢 전사", "🏗️ 조직", "👤 개인"])

# ---------- 전사 ----------
with tab_co:
    # 경영진은 요약만 (사양 5-A.4)
    is_exec = persona == "executive"

    k1, k2, k3, k4 = st.columns(4)
    k1.metric("평가 대상 인원", profile["member_id"].nunique())
    k2.metric("총 보유 Skill", len(profile))
    k3.metric("평균 Level", f"L{profile['current_level'].mean():.2f}")
    k4.metric("Critical Skill 보유", int(profile["is_critical"].sum()))

    st.divider()

    c1, c2 = st.columns([1.2, 1])
    with c1:
        st.markdown(
            f"<h5 style='color:{COLOR_NAVY};'>Sub-family별 Level 분포</h5>",
            unsafe_allow_html=True,
        )
        st.plotly_chart(fig_stack_bar_by_sub(profile), use_container_width=True)
    with c2:
        st.markdown(
            f"<h5 style='color:{COLOR_NAVY};'>팀 × Sub-family Heatmap</h5>",
            unsafe_allow_html=True,
        )
        st.plotly_chart(fig_heatmap_team_sub(profile), use_container_width=True)

    if is_exec:
        st.caption("ℹ️ 경영진 권한: 전사 요약 차트만 제공 (개인 식별 정보 제외).")

# ---------- 조직 ----------
with tab_org:
    teams = sorted(profile["team"].dropna().unique())

    # 페르소나별 팀 범위
    if persona == "team_leader" and member:
        teams = [member["team"]] if member.get("team") in teams else []
    elif persona == "executive":
        st.info("경영진 권한은 전사 탭만 제공됩니다.")
        teams = []

    if not teams:
        st.warning("표시 가능한 팀이 없습니다.")
    else:
        sel_team = st.selectbox("팀 선택", teams, key="gap_team")
        team_prof = profile[profile["team"] == sel_team]
        team_req = _load_required_for_team(sel_team)

        n_team = team_prof["member_id"].nunique()
        n_req = len(team_req)
        n_core = int(team_req["is_core"].sum()) if not team_req.empty else 0

        k1, k2, k3, k4 = st.columns(4)
        k1.metric("팀 인원", n_team)
        k2.metric("요구 Skill", n_req)
        k3.metric("Core", n_core)
        k4.metric("평균 보유 Level", f"L{team_prof['current_level'].mean():.2f}" if not team_prof.empty else "—")

        st.divider()

        c1, c2 = st.columns(2)
        with c1:
            st.markdown(
                f"<h5 style='color:{COLOR_NAVY};'>Required Skill 보유 vs 요구</h5>",
                unsafe_allow_html=True,
            )
            bubble, _ = fig_bubble_team(profile, team_req, sel_team)
            st.plotly_chart(bubble, use_container_width=True)
            st.caption("점 크기 = 팀 내 보유 인원수 / 별 = Core / 점선 = 요구·현재 일치선")
        with c2:
            st.markdown(
                f"<h5 style='color:{COLOR_NAVY};'>Priority Matrix (Gap × Scarcity)</h5>",
                unsafe_allow_html=True,
            )
            pm = fig_priority_matrix(profile, team_req, sel_team)
            st.plotly_chart(pm, use_container_width=True)
            st.caption("우상단(Gap↑·Scarcity↑) = 가장 시급한 육성 영역")

# ---------- 개인 ----------
with tab_ind:
    if persona == "executive":
        st.info("경영진 권한은 전사 탭만 제공됩니다.")
        st.stop()

    members_df = profile[["member_id", "name", "team", "role_level"]].drop_duplicates()

    # 페르소나별 범위
    if persona == "employee" and member:
        members_df = members_df[members_df["member_id"] == member["employee_id"]]
    elif persona == "team_leader" and member:
        members_df = members_df[members_df["team"] == member.get("team", "")]

    if members_df.empty:
        st.warning("표시 가능한 인원이 없습니다.")
        st.stop()

    opts = members_df["member_id"].tolist()
    default_idx = opts.index(member["employee_id"]) if member and member["employee_id"] in opts else 0

    sel_emp = st.selectbox(
        "구성원 선택",
        options=opts,
        index=default_idx,
        format_func=lambda eid: (
            f"{members_df[members_df['member_id']==eid].iloc[0]['name']} "
            f"({members_df[members_df['member_id']==eid].iloc[0]['team']} · "
            f"{members_df[members_df['member_id']==eid].iloc[0]['role_level']})"
        ),
        key="gap_emp",
    )

    sel_row = members_df[members_df["member_id"] == sel_emp].iloc[0]
    my_prof = profile[profile["member_id"] == sel_emp]
    peer_prof = profile[(profile["team"] == sel_row["team"]) & (profile["member_id"] != sel_emp)]
    req_df = _load_required_for_member(sel_emp, sel_row["team"])

    # Sub-family 목록
    conn = get_connection()
    try:
        sub_families = pd.read_sql_query(
            "SELECT sub_family_id, sub_family_name FROM sub_skill_family ORDER BY sub_family_id",
            conn,
        )
    finally:
        conn.close()

    # KPI
    n_skills = len(my_prof)
    avg_cur = my_prof["current_level"].mean() if n_skills else 0
    n_req = len(req_df)
    if n_req > 0:
        merged = req_df.merge(my_prof[["skill_id", "current_level"]], on="skill_id", how="left").fillna(0)
        met = (merged["current_level"] >= merged["target_level"]).sum()
        fulfill = met / n_req * 100
        gap_count = (merged["current_level"] < merged["target_level"]).sum()
    else:
        fulfill = 0; gap_count = 0

    k1, k2, k3, k4 = st.columns(4)
    k1.metric("보유 Skill", n_skills)
    k2.metric("평균 Level", f"L{avg_cur:.2f}" if n_skills else "—")
    k3.metric("Required 충족", f"{fulfill:.0f}%" if n_req else "—")
    k4.metric("Gap 항목", int(gap_count))

    st.divider()

    st.markdown(
        f"<h5 style='color:{COLOR_NAVY};'>Required · Current · Peer Radar</h5>",
        unsafe_allow_html=True,
    )
    st.plotly_chart(
        fig_radar_individual(my_prof, req_df, peer_prof, sub_families),
        use_container_width=True,
    )
    st.caption("빨강(점선)=요구 / 회색(점선)=팀 평균 / 네이비=본인 현재")

    # Gap 상위 항목 테이블
    if n_req > 0:
        st.markdown(
            f"<h5 style='color:{COLOR_NAVY}; margin-top:20px;'>Gap 상위 항목</h5>",
            unsafe_allow_html=True,
        )
        merged["Gap"] = (merged["target_level"] - merged["current_level"]).astype(int)
        merged = merged[merged["Gap"] > 0].sort_values(["is_core", "Gap"], ascending=[False, False])
        if merged.empty:
            st.success("🎉 모든 Required Skill이 충족되었습니다!")
        else:
            view = merged[["skill_id", "skill_name", "sub_family_name",
                            "target_level", "current_level", "Gap", "is_core"]].copy()
            view["Core"] = view["is_core"].map(lambda b: "★" if b else "")
            view["요구"] = view["target_level"].map(lambda x: f"L{int(x)}")
            view["현재"] = view["current_level"].map(lambda x: f"L{int(x)}" if x > 0 else "—")
            view["Gap"] = view["Gap"].map(lambda g: f"+{g}")
            view = view.rename(columns={"skill_id": "ID", "skill_name": "Skill",
                                          "sub_family_name": "Sub-family"})[
                ["Core", "ID", "Skill", "Sub-family", "요구", "현재", "Gap"]
            ]
            st.dataframe(view, hide_index=True, use_container_width=True, height=360)

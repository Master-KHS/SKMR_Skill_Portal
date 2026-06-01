# Dashboard - 권한별 Skill 현황 통합 뷰.
# 위젯 카탈로그: 1) 조직별 필수 스킬 (메인) 2) 상위 보유자 Top 5 3) 평가 진행 Funnel
#               4) 팀별 비교 5) Sub-family 평균 6) 부족 Skill Top 5 7) Critical 현황 8) 최근 평가
# 페르소나별로 위젯·데이터 범위 자동 분기.
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


# ---------- 스코프 ----------
def _scope_filter(persona: str, member: dict | None) -> tuple[str, tuple]:
    if persona == "employee" and member:
        return "AND m.employee_id = ?", (member["employee_id"],)
    if persona == "team_leader" and member:
        return "AND m.team = ?", (member.get("team", ""),)
    if persona in ("calibration", "committee") and member:
        return "AND m.division = ?", (member.get("division", ""),)
    return "AND m.job_type IN ('사무직','기술직','연구직')", ()


def _scope_label(persona: str, member: dict | None) -> str:
    if persona == "employee" and member:
        return f"본인 ({member['name']})"
    if persona == "team_leader" and member:
        return f"본인 팀 ({member['team']})"
    if persona in ("calibration", "committee") and member:
        return f"담당 ({member.get('division','')})"
    return "전사"


def _visible_teams(persona: str, member: dict | None) -> list[str]:
    """페르소나에 따라 위젯에서 다룰 팀 목록."""
    conn = get_connection()
    try:
        all_teams = [r[0] for r in conn.execute(
            "SELECT DISTINCT team FROM member WHERE job_type IN ('사무직','기술직','연구직') ORDER BY team"
        ).fetchall()]
    finally:
        conn.close()
    if persona == "employee" and member:
        return [member.get("team", "")] if member.get("team") in all_teams else []
    if persona == "team_leader" and member:
        return [member.get("team", "")] if member.get("team") in all_teams else []
    if persona in ("calibration", "committee") and member:
        div = member.get("division", "")
        conn = get_connection()
        try:
            div_teams = [r[0] for r in conn.execute(
                "SELECT DISTINCT team FROM member WHERE division=? AND job_type IN ('사무직','기술직','연구직')",
                (div,),
            ).fetchall()]
        finally:
            conn.close()
        return div_teams
    return all_teams


# ---------- 데이터 로더 ----------
def load_summary(scope_sql: str, params: tuple) -> dict:
    conn = get_connection()
    try:
        cur = conn.cursor()
        n_members = cur.execute(
            f"SELECT COUNT(*) FROM member m WHERE 1=1 {scope_sql}", params
        ).fetchone()[0]
        n_skills_total = cur.execute("SELECT COUNT(*) FROM skill").fetchone()[0]
        n_profile = cur.execute(
            f"""SELECT COUNT(*) FROM skill_profile sp JOIN member m ON sp.member_id = m.employee_id
                WHERE 1=1 {scope_sql}""", params
        ).fetchone()[0]
        n_assessed = cur.execute(
            f"""SELECT COUNT(DISTINCT a.member_id || '_' || a.skill_id)
                FROM assessment a JOIN member m ON a.member_id = m.employee_id
                WHERE 1=1 {scope_sql}""", params
        ).fetchone()[0]
        assess_rate = (n_assessed / n_profile * 100) if n_profile > 0 else 0
        crit_total = cur.execute(
            f"""SELECT COUNT(*) FROM skill_profile sp
                JOIN skill s  ON sp.skill_id = s.skill_id
                JOIN member m ON sp.member_id = m.employee_id
                WHERE s.is_critical = 1 {scope_sql}""", params
        ).fetchone()[0]
        crit_rate = (crit_total / n_profile * 100) if n_profile > 0 else 0
    finally:
        conn.close()
    return {
        "members": n_members, "skills_total": n_skills_total,
        "profile_total": n_profile, "assessed": n_assessed,
        "assess_rate": assess_rate,
        "critical_held": crit_total, "critical_rate": crit_rate,
    }


def load_team_required_status(team: str) -> pd.DataFrame:
    """팀별 필수 스킬 현황 — 각 Core/Non-Core 스킬의 보유 인원수·평균 Level."""
    conn = get_connection()
    try:
        team_members = [r[0] for r in conn.execute(
            "SELECT employee_id FROM member WHERE team=? AND job_type IN ('사무직','기술직','연구직')",
            (team,),
        ).fetchall()]
        if not team_members:
            return pd.DataFrame()
        # 전사+팀+개인(approved) Required
        ph = ",".join("?" for _ in team_members)
        req = pd.read_sql_query(
            f"""SELECT r.skill_id, MAX(r.target_level) AS target_level,
                       MAX(r.is_core) AS is_core, s.skill_name, sf.sub_family_name
                FROM required_skill r
                JOIN skill s ON r.skill_id = s.skill_id
                JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
                WHERE (r.org_or_individual='company' AND r.target_id='ALL')
                   OR (r.org_or_individual='department' AND r.target_id=?)
                   OR (r.org_or_individual='individual' AND r.target_id IN ({ph})
                       AND r.status='approved')
                GROUP BY r.skill_id""",
            conn, params=(team, *team_members),
        )
        # 각 Skill의 보유 인원·평균 Level (해당 팀 안)
        ph2 = ",".join("?" for _ in team_members)
        prof = pd.read_sql_query(
            f"""SELECT skill_id, COUNT(*) AS holders, AVG(current_level) AS avg_lv
                FROM skill_profile WHERE member_id IN ({ph2})
                GROUP BY skill_id""",
            conn, params=team_members,
        )
    finally:
        conn.close()

    if req.empty:
        return pd.DataFrame()
    n_team = len(team_members)
    df = req.merge(prof, on="skill_id", how="left")
    df["holders"] = df["holders"].fillna(0).astype(int)
    df["avg_lv"] = df["avg_lv"].fillna(0)
    df["coverage"] = df["holders"] / n_team
    df["met_pct"] = df.apply(
        lambda r: 100 if r["avg_lv"] >= r["target_level"] else (r["avg_lv"] / r["target_level"] * 100),
        axis=1,
    )
    df["is_core"] = df["is_core"].astype(bool)
    df["n_team"] = n_team
    return df.sort_values(["is_core", "skill_id"], ascending=[False, True]).reset_index(drop=True)


def load_top_holders(scope_sql: str, params: tuple, top_n: int = 5) -> pd.DataFrame:
    """상위 보유자 — 평균 Level · 보유 Skill 수 · Critical 보유."""
    conn = get_connection()
    try:
        df = pd.read_sql_query(
            f"""SELECT m.employee_id, m.name, m.team, m.role_level, m.job_type,
                       COUNT(sp.skill_id) AS n_skills,
                       AVG(sp.current_level) AS avg_lv,
                       SUM(CASE WHEN s.is_critical=1 THEN 1 ELSE 0 END) AS critical_held
                FROM member m
                LEFT JOIN skill_profile sp ON m.employee_id = sp.member_id
                LEFT JOIN skill s ON sp.skill_id = s.skill_id
                WHERE 1=1 {scope_sql}
                GROUP BY m.employee_id
                HAVING n_skills > 0
                ORDER BY avg_lv DESC, n_skills DESC
                LIMIT ?""",
            conn, params=(*params, top_n),
        )
    finally:
        conn.close()
    return df


def load_assessment_funnel(scope_sql: str, params: tuple) -> pd.DataFrame:
    """Self → Leader → Calibration → Committee 단계별 unique 처리 건수."""
    conn = get_connection()
    try:
        df = pd.read_sql_query(
            f"""SELECT a.stage,
                       COUNT(DISTINCT a.member_id || '_' || a.skill_id) AS cnt
                FROM assessment a JOIN member m ON a.member_id = m.employee_id
                WHERE 1=1 {scope_sql}
                GROUP BY a.stage""",
            conn, params=params,
        )
    finally:
        conn.close()
    return df


def load_team_comparison() -> pd.DataFrame:
    """전사 팀별 비교 — 인원·평균 Level·Required 충족률 (HR Admin/경영진 전용)."""
    conn = get_connection()
    try:
        df = pd.read_sql_query(
            """SELECT m.team, m.division,
                      COUNT(DISTINCT m.employee_id) AS n,
                      AVG(sp.current_level) AS avg_lv,
                      SUM(CASE WHEN sp.skill_id IS NOT NULL AND s.is_critical=1 THEN 1 ELSE 0 END) AS crit_held
               FROM member m
               LEFT JOIN skill_profile sp ON m.employee_id = sp.member_id
               LEFT JOIN skill s ON sp.skill_id = s.skill_id
               WHERE m.job_type IN ('사무직','기술직','연구직')
               GROUP BY m.team, m.division
               ORDER BY m.division, m.team""",
            conn,
        )
    finally:
        conn.close()
    return df


def load_sub_family_avg(scope_sql: str, params: tuple) -> pd.DataFrame:
    conn = get_connection()
    try:
        return pd.read_sql_query(
            f"""SELECT sf.sub_family_name, AVG(sp.current_level) AS avg_lv, COUNT(*) AS cnt
                FROM skill_profile sp
                JOIN skill s             ON sp.skill_id = s.skill_id
                JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
                JOIN member m            ON sp.member_id = m.employee_id
                WHERE 1=1 {scope_sql}
                GROUP BY sf.sub_family_name
                ORDER BY avg_lv DESC""",
            conn, params=params,
        )
    finally:
        conn.close()


def load_top_gaps(scope_sql: str, params: tuple, top_n: int = 5) -> pd.DataFrame:
    conn = get_connection()
    try:
        teams_df = pd.read_sql_query(
            f"SELECT DISTINCT m.team FROM member m WHERE 1=1 {scope_sql}",
            conn, params=params,
        )
        if teams_df.empty:
            return pd.DataFrame()
        teams = teams_df["team"].tolist()
        placeholders = ",".join("?" for _ in teams)
        req = pd.read_sql_query(
            f"""SELECT skill_id, MAX(target_level) AS target_level, MAX(is_core) AS is_core
                FROM required_skill
                WHERE (org_or_individual='company' AND target_id='ALL')
                   OR (org_or_individual='department' AND target_id IN ({placeholders}))
                GROUP BY skill_id""",
            conn, params=tuple(teams),
        )
        if req.empty:
            return pd.DataFrame()
        prof = pd.read_sql_query(
            f"""SELECT sp.skill_id, AVG(sp.current_level) AS avg_cur, COUNT(*) AS n_holders
                FROM skill_profile sp JOIN member m ON sp.member_id = m.employee_id
                WHERE 1=1 {scope_sql}
                GROUP BY sp.skill_id""",
            conn, params=params,
        )
        n_scope = pd.read_sql_query(
            f"SELECT COUNT(*) AS n FROM member m WHERE 1=1 {scope_sql}",
            conn, params=params,
        ).iloc[0]["n"]
        skills = pd.read_sql_query("SELECT skill_id, skill_name FROM skill", conn)
    finally:
        conn.close()

    if n_scope == 0:
        return pd.DataFrame()
    df = req.merge(prof, on="skill_id", how="left").merge(skills, on="skill_id", how="left")
    df["avg_cur"] = df["avg_cur"].fillna(0)
    df["n_holders"] = df["n_holders"].fillna(0).astype(int)
    df["gap"] = (df["target_level"] - df["avg_cur"]).clip(lower=0)
    df["scarcity"] = 1 - df["n_holders"] / n_scope
    df["priority"] = df["gap"] * (1 + df["scarcity"]) * df["is_core"].map(lambda x: 1.5 if x else 1.0)
    df = df.sort_values("priority", ascending=False).head(top_n)
    return df[["skill_id", "skill_name", "target_level", "avg_cur", "gap", "scarcity", "is_core", "n_holders"]]


def load_critical_status(scope_sql: str, params: tuple) -> pd.DataFrame:
    """전사 Critical Skill (skill.is_critical=1) 현황."""
    conn = get_connection()
    try:
        df = pd.read_sql_query(
            f"""SELECT s.skill_id, s.skill_name, sf.sub_family_name,
                       COUNT(DISTINCT sp.member_id) AS holders,
                       AVG(sp.current_level) AS avg_lv,
                       (SELECT COUNT(*) FROM member m WHERE 1=1 {scope_sql}) AS n_total
                FROM skill s
                JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
                LEFT JOIN skill_profile sp ON s.skill_id = sp.skill_id
                LEFT JOIN member m         ON sp.member_id = m.employee_id AND 1=1 {scope_sql}
                WHERE s.is_critical = 1
                GROUP BY s.skill_id
                ORDER BY holders DESC""",
            conn, params=(*params, *params),
        )
    finally:
        conn.close()
    if df.empty:
        return df
    df["coverage"] = df.apply(
        lambda r: (r["holders"] / r["n_total"]) if r["n_total"] > 0 else 0, axis=1,
    )
    df["avg_lv"] = df["avg_lv"].fillna(0)
    return df


def load_recent_assessments(scope_sql: str, params: tuple, limit: int = 6) -> pd.DataFrame:
    conn = get_connection()
    try:
        return pd.read_sql_query(
            f"""SELECT a.assessed_date, a.stage, a.proposed_level, a.confirmed_level, a.status,
                       m.name, s.skill_name
                FROM assessment a
                JOIN member m ON a.member_id = m.employee_id
                JOIN skill  s ON a.skill_id  = s.skill_id
                WHERE 1=1 {scope_sql}
                ORDER BY a.assessment_id DESC LIMIT ?""",
            conn, params=(*params, limit),
        )
    finally:
        conn.close()


# ---------- 차트 ----------
def fig_funnel(funnel_df: pd.DataFrame) -> go.Figure:
    stages = ["self", "leader", "calibration", "committee"]
    labels = ["Self", "Leader", "Calibration", "Committee"]
    cnt_map = dict(zip(funnel_df["stage"], funnel_df["cnt"])) if not funnel_df.empty else {}
    values = [cnt_map.get(s, 0) for s in stages]
    fig = go.Figure(go.Funnel(
        y=labels, x=values,
        textposition="inside", textinfo="value+percent initial",
        marker=dict(color=["#C7D0DA", "#7A8FA8", "#3D5A80", COLOR_NAVY]),
    ))
    fig.update_layout(
        height=240, margin=dict(t=10, b=10, l=10, r=10),
        paper_bgcolor=COLOR_BG_WHITE, plot_bgcolor=COLOR_BG_WHITE,
        showlegend=False,
    )
    return fig


def fig_sub_family_bar(df: pd.DataFrame) -> go.Figure:
    if df.empty:
        return go.Figure()
    fig = go.Figure(go.Bar(
        x=df["avg_lv"], y=df["sub_family_name"], orientation="h",
        marker=dict(color=COLOR_NAVY),
        text=[f"L{v:.2f}" for v in df["avg_lv"]],
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>평균 L%{x:.2f}<extra></extra>",
    ))
    fig.update_layout(
        height=320, margin=dict(t=10, b=10, l=10, r=60),
        paper_bgcolor=COLOR_BG_WHITE, plot_bgcolor=COLOR_BG_WHITE,
        xaxis=dict(range=[0, 4.5], gridcolor=COLOR_BORDER, dtick=1, title="평균 Level"),
        yaxis=dict(title=None, autorange="reversed"),
    )
    return fig


# ---------- 위젯 렌더링 헬퍼 ----------
def _section_header(title: str) -> None:
    st.markdown(
        f"<h5 style='color:{COLOR_NAVY}; margin:18px 0 8px 0;'>{title}</h5>",
        unsafe_allow_html=True,
    )


def _team_required_card(team: str, df: pd.DataFrame) -> None:
    """팀별 필수 스킬 현황 카드 — 한 팀당 한 카드. 가로 컬럼으로 쌓아 호출."""
    if df.empty:
        st.markdown(
            f"<div style='background:{COLOR_BG_WHITE}; border:1px solid {COLOR_BORDER}; "
            f"border-radius:4px; padding:14px 16px;'>"
            f"<b style='color:{COLOR_NAVY};'>{team}</b>"
            f"<p style='color:{COLOR_TEXT_MED}; font-size:12px; margin:4px 0 0 0;'>"
            f"매핑된 필수 스킬이 없습니다.</p></div>",
            unsafe_allow_html=True,
        )
        return

    core = df[df["is_core"]]
    noncore = df[~df["is_core"]]
    n_team = int(df.iloc[0]["n_team"])

    # 충족률 = 모든 필수 스킬의 met_pct 평균
    overall = df["met_pct"].mean() if len(df) > 0 else 0
    if overall >= 80:
        color_pct = "#1B8A50"  # 녹색
    elif overall >= 60:
        color_pct = "#C9A227"  # 황색
    else:
        color_pct = COLOR_SK_RED

    inner_rows = []
    for label, sub_df, badge_html in [
        ("Core", core,
         f"<span style='background:{COLOR_SK_RED}; color:white; padding:1px 5px; "
         f"border-radius:3px; font-size:9px; font-weight:600; letter-spacing:0.04em;'>CORE</span>"),
        ("Non-Core", noncore,
         f"<span style='border:1px solid {COLOR_TEXT_MED}; color:{COLOR_TEXT_MED}; padding:0 5px; "
         f"border-radius:3px; font-size:9px; font-weight:500; letter-spacing:0.04em;'>NON-CORE</span>"),
    ]:
        for _, r in sub_df.iterrows():
            bar_pct = min(r["met_pct"], 100)
            inner_rows.append(
                f"<div style='margin:6px 0;'>"
                f"<div style='display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px;'>"
                f"<span style='color:{COLOR_TEXT_DARK};'>{badge_html} "
                f"#{int(r['skill_id']):03d} {r['skill_name'][:24]}</span>"
                f"<span style='color:{COLOR_TEXT_MED};'>"
                f"L{r['avg_lv']:.1f}/L{int(r['target_level'])} · {r['holders']}/{n_team}명</span>"
                f"</div>"
                f"<div style='background:{COLOR_BG_LIGHT}; height:5px; border-radius:2px; overflow:hidden;'>"
                f"<div style='background:{COLOR_NAVY}; height:5px; width:{bar_pct}%;'></div>"
                f"</div></div>"
            )
    body = "".join(inner_rows) or f"<p style='color:{COLOR_TEXT_MED}; font-size:12px;'>매핑된 필수 스킬이 없습니다.</p>"

    st.markdown(
        f"""
        <div style='background:{COLOR_BG_WHITE}; border:1px solid {COLOR_BORDER};
                    border-radius:4px; padding:14px 16px;'>
            <div style='display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;'>
                <div>
                    <b style='color:{COLOR_NAVY}; font-size:14px;'>{team}</b>
                    <span style='color:{COLOR_TEXT_MED}; font-size:11px; margin-left:6px;'>· {n_team}명</span>
                </div>
                <div style='color:{color_pct}; font-weight:700; font-size:16px;'>{overall:.0f}%</div>
            </div>
            {body}
        </div>
        """,
        unsafe_allow_html=True,
    )


# ---------- 페이지 ----------
persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header(
    "진단 결과 확인",
    f"권한별 Skill 현황 통합 · 조회 범위: {_scope_label(persona, member)}",
)

scope_sql, params = _scope_filter(persona, member)
summary = load_summary(scope_sql, params)

# ===== 1. 4 KPI =====
k1, k2, k3, k4 = st.columns(4)
k1.metric("구성원" if persona != "employee" else "본인", f"{summary['members']} 명")
k2.metric("등록 Skill", f"{summary['skills_total']} 개",
          help="시스템 전체 Skill 카탈로그 (모든 페르소나 공통)")
k3.metric("평가 진행률", f"{summary['assess_rate']:.0f}%",
          delta=f"{summary['assessed']} / {summary['profile_total']} 항목", delta_color="off")
k4.metric("Critical 보유율", f"{summary['critical_rate']:.0f}%",
          delta=f"{summary['critical_held']} 건", delta_color="off")

st.divider()

# ===== 2. 메인 위젯 — 조직별 필수 스킬 현황 =====
_section_header("조직별 필수 스킬 현황")
teams = _visible_teams(persona, member)
if not teams:
    st.info("표시할 팀이 없습니다.")
else:
    # 4팀까지는 가로로, 그 이상은 2단으로
    if len(teams) <= 4:
        cols = st.columns(len(teams))
        for i, t in enumerate(teams):
            with cols[i]:
                _team_required_card(t, load_team_required_status(t))
    else:
        for i in range(0, len(teams), 2):
            chunk = teams[i:i + 2]
            cols = st.columns(len(chunk))
            for j, t in enumerate(chunk):
                with cols[j]:
                    _team_required_card(t, load_team_required_status(t))

# ===== 3. 좌: 평가 진행 Funnel · 우: 상위 보유자 Top 5 =====
show_funnel = persona in ("hr_admin", "executive", "hr_viewer", "team_leader",
                          "calibration", "committee")
show_top_holders = persona in ("hr_admin", "executive", "hr_viewer", "team_leader")

if show_funnel or show_top_holders:
    st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)
    left, right = st.columns(2)

    if show_funnel:
        with left:
            _section_header("평가 진행 Funnel")
            funnel_df = load_assessment_funnel(scope_sql, params)
            if funnel_df.empty or funnel_df["cnt"].sum() == 0:
                st.caption("아직 평가 활동이 없습니다.")
            else:
                st.plotly_chart(fig_funnel(funnel_df), use_container_width=True)

    if show_top_holders:
        with right:
            _section_header("상위 보유자 Top 5")
            holders = load_top_holders(scope_sql, params, 5)
            if holders.empty:
                st.caption("표시할 보유자가 없습니다.")
            else:
                for i, (_, r) in enumerate(holders.iterrows(), start=1):
                    st.markdown(
                        f"""
                        <div style='display:flex; align-items:center; padding:8px 10px;
                                    background:{COLOR_BG_WHITE}; border:1px solid {COLOR_BORDER};
                                    border-radius:4px; margin-bottom:6px;'>
                            <div style='width:24px; color:{COLOR_TEXT_MED}; font-weight:600;'>{i}</div>
                            <div style='flex:1;'>
                                <b style='color:{COLOR_NAVY};'>{r['name']}</b>
                                <span style='color:{COLOR_TEXT_MED}; font-size:12px; margin-left:6px;'>
                                    {r['team']} · {r['role_level']}
                                </span>
                            </div>
                            <div style='text-align:right; font-size:12px;'>
                                <b style='color:{COLOR_NAVY};'>L{r['avg_lv']:.2f}</b>
                                <span style='color:{COLOR_TEXT_MED};'> · {r['n_skills']}개</span>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )

# ===== 4. 좌: Sub-family 평균 · 우: 팀별 비교 (HR Admin/CEO만) =====
show_team_comparison = persona in ("hr_admin", "executive", "hr_viewer")

st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)
left, right = st.columns(2)
with left:
    _section_header("Sub-family별 평균 Level")
    sub_df = load_sub_family_avg(scope_sql, params)
    if sub_df.empty:
        st.caption("표시할 데이터가 없습니다.")
    else:
        st.plotly_chart(fig_sub_family_bar(sub_df), use_container_width=True)

with right:
    if show_team_comparison:
        _section_header("팀별 비교")
        cmp_df = load_team_comparison()
        if cmp_df.empty:
            st.caption("표시할 팀이 없습니다.")
        else:
            for _, r in cmp_df.iterrows():
                avg = r["avg_lv"] if pd.notna(r["avg_lv"]) else 0
                st.markdown(
                    f"""
                    <div style='display:flex; align-items:center; padding:8px 12px;
                                background:{COLOR_BG_WHITE}; border:1px solid {COLOR_BORDER};
                                border-radius:4px; margin-bottom:6px;'>
                        <div style='flex:1;'>
                            <b style='color:{COLOR_NAVY};'>{r['team']}</b>
                            <span style='color:{COLOR_TEXT_MED}; font-size:11px; margin-left:6px;'>
                                {r['division']}
                            </span>
                        </div>
                        <div style='text-align:right; font-size:12px;'>
                            <span style='color:{COLOR_TEXT_MED};'>{int(r['n'])}명 · </span>
                            <b style='color:{COLOR_NAVY};'>L{avg:.2f}</b>
                            <span style='color:{COLOR_TEXT_MED};'> · CRT {int(r['crit_held'])}</span>
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

# ===== 5. 부족 Skill Top 5 =====
_section_header("부족 Skill Top 5 — 우선 육성 대상")
gaps = load_top_gaps(scope_sql, params, top_n=5)
if gaps.empty:
    st.success("부족한 Required Skill이 없습니다.")
else:
    cols = st.columns(5)
    for i, (_, r) in enumerate(gaps.iterrows()):
        with cols[i]:
            badge = (
                f"<span style='background:{COLOR_SK_RED}; color:white; padding:1px 5px; "
                f"border-radius:3px; font-size:9px; font-weight:600; "
                f"letter-spacing:0.04em; margin-right:4px;'>CORE</span>" if r["is_core"] else ""
            )
            st.markdown(
                f"""
                <div style='background:{COLOR_BG_WHITE}; border:1px solid {COLOR_BORDER};
                            border-radius:4px; padding:12px 14px; height:140px;'>
                    <div style='color:{COLOR_TEXT_MED}; font-size:11px;'>{badge}#{int(r['skill_id']):03d}</div>
                    <div style='color:{COLOR_NAVY}; font-weight:600; font-size:13px;
                                margin:6px 0 8px 0; min-height:36px; line-height:1.3;'>
                        {r['skill_name'][:30]}
                    </div>
                    <div style='font-size:12px; color:{COLOR_TEXT_DARK};'>
                        요구 <b>L{int(r['target_level'])}</b> · 현재 <b>L{r['avg_cur']:.1f}</b>
                    </div>
                    <div style='font-size:11px; color:{COLOR_TEXT_MED}; margin-top:4px;'>
                        Gap <b style='color:{COLOR_SK_RED};'>+{r['gap']:.1f}</b> ·
                        보유 {r['n_holders']}명
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
st.caption("우선도 = Gap × (1 + Scarcity) × Core 가중치(1.5) 기준 정렬")

# ===== 6. 전사 Critical Skill 현황 =====
_section_header("전사 Critical Skill 현황")
crit_df = load_critical_status(scope_sql, params)
if crit_df.empty:
    st.info(
        "아직 Critical Skill로 지정된 항목이 없습니다. "
        "HR Admin이 Skill Master에서 Critical 토글로 지정 가능 (시스템 설정 / Step 11-C 예정)."
    )
else:
    cols = st.columns(min(len(crit_df), 5))
    for i, (_, r) in enumerate(crit_df.iterrows()):
        with cols[i % len(cols)]:
            cov = r["coverage"] * 100
            st.markdown(
                f"""
                <div style='background:{COLOR_BG_WHITE}; border:1px solid {COLOR_BORDER};
                            border-radius:4px; padding:12px 14px; margin-bottom:6px;'>
                    <span style='border:1px solid {COLOR_SK_RED}; color:{COLOR_SK_RED};
                          padding:0 5px; border-radius:3px; font-size:9px; font-weight:600;
                          letter-spacing:0.04em;'>CRITICAL</span>
                    <div style='color:{COLOR_NAVY}; font-weight:600; font-size:13px; margin:6px 0;'>
                        #{int(r['skill_id']):03d} {r['skill_name'][:24]}
                    </div>
                    <div style='font-size:12px; color:{COLOR_TEXT_DARK};'>
                        보유 {int(r['holders'])}명 · 평균 L{r['avg_lv']:.1f} · Coverage {cov:.0f}%
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

# ===== 7. 최근 평가 활동 (작은 위젯) =====
if persona in ("hr_admin", "executive", "hr_viewer", "team_leader"):
    with st.expander("최근 평가 활동 (펼치기)", expanded=False):
        rec = load_recent_assessments(scope_sql, params, limit=8)
        if rec.empty:
            st.caption("평가 활동이 없습니다.")
        else:
            STAGE_SHORT = {"self": "Self", "leader": "Leader",
                           "calibration": "Calib", "committee": "Committee"}
            STAGE_COLORS = {"self": "#7A8FA8", "leader": "#3D5A80",
                            "calibration": "#2C4865", "committee": COLOR_NAVY}
            for _, r in rec.iterrows():
                stg = r["stage"]; color = STAGE_COLORS.get(stg, COLOR_NAVY)
                lv = r["confirmed_level"] if pd.notna(r["confirmed_level"]) else r["proposed_level"]
                st.markdown(
                    f"""
                    <div style='border-left:3px solid {color}; padding:4px 10px; margin-bottom:6px;'>
                        <div style='color:{COLOR_TEXT_MED}; font-size:11px;'>
                            {r['assessed_date']} ·
                            <span style='background:{color}; color:white; padding:1px 5px;
                                         border-radius:3px; font-size:10px;'>{STAGE_SHORT.get(stg, stg)}</span>
                        </div>
                        <div style='font-size:13px; color:{COLOR_TEXT_DARK};'>
                            <b>{r['name']}</b> · {r['skill_name'][:30]}
                            → <b style='color:{COLOR_NAVY};'>L{int(lv)}</b>
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

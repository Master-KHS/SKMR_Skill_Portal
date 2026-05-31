# Dashboard - 홈 화면. 4 KPI + Sub-family 평균 바차트 + 최근 평가 활동 + 부족 Skill Top 5.
# 페르소나별 시야 범위 자동 분기 (구성원=본인, Leader=팀, HR/경영=전사).
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from config import (
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


# ---------- 데이터 로더 ----------
def _scope_filter(persona: str, member: dict | None) -> tuple[str, tuple]:
    """페르소나별 SQL WHERE 절 + params 반환 (member 테이블 alias = m)."""
    if persona == "employee" and member:
        return "AND m.employee_id = ?", (member["employee_id"],)
    if persona == "team_leader" and member:
        return "AND m.team = ?", (member.get("team", ""),)
    if persona in ("calibration", "committee") and member:
        return "AND m.division = ?", (member.get("division", ""),)
    # hr_admin, hr_viewer, executive = 전사
    return "AND m.job_type IN ('사무직','기술직','연구직')", ()


def _scope_label(persona: str, member: dict | None) -> str:
    if persona == "employee" and member:
        return f"본인 ({member['name']})"
    if persona == "team_leader" and member:
        return f"본인 팀 ({member['team']})"
    if persona in ("calibration", "committee") and member:
        return f"담당 ({member.get('division','')})"
    return "전사"


def load_summary(scope_sql: str, params: tuple) -> dict:
    conn = get_connection()
    try:
        cur = conn.cursor()
        n_members = cur.execute(
            f"SELECT COUNT(*) FROM member m WHERE 1=1 {scope_sql}", params
        ).fetchone()[0]
        n_skills_total = cur.execute("SELECT COUNT(*) FROM skill").fetchone()[0]

        # 평가 진행률 = (assessment에 1건이라도 있는 (member, skill) 수) / (skill_profile 전체)
        n_profile = cur.execute(
            f"""SELECT COUNT(*) FROM skill_profile sp
                JOIN member m ON sp.member_id = m.employee_id
                WHERE 1=1 {scope_sql}""", params
        ).fetchone()[0]
        n_assessed = cur.execute(
            f"""SELECT COUNT(DISTINCT a.member_id || '_' || a.skill_id)
                FROM assessment a
                JOIN member m ON a.member_id = m.employee_id
                WHERE 1=1 {scope_sql}""", params
        ).fetchone()[0]
        assess_rate = (n_assessed / n_profile * 100) if n_profile > 0 else 0

        # Critical Skill 보유율 = (Critical Skill 중 보유한 인원수 평균) / 전체 인원
        # 단순화: 보유 Skill 중 critical 비중
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


def load_sub_family_avg(scope_sql: str, params: tuple) -> pd.DataFrame:
    conn = get_connection()
    try:
        return pd.read_sql_query(
            f"""SELECT sf.sub_family_name, f.family_name,
                       AVG(sp.current_level) AS avg_lv, COUNT(*) AS cnt
                FROM skill_profile sp
                JOIN skill s             ON sp.skill_id = s.skill_id
                JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
                JOIN skill_family f      ON sf.family_id = f.family_id
                JOIN member m            ON sp.member_id = m.employee_id
                WHERE 1=1 {scope_sql}
                GROUP BY sf.sub_family_name
                ORDER BY avg_lv DESC""",
            conn, params=params,
        )
    finally:
        conn.close()


def load_recent_assessments(scope_sql: str, params: tuple, limit: int = 10) -> pd.DataFrame:
    conn = get_connection()
    try:
        return pd.read_sql_query(
            f"""SELECT a.assessed_date, a.stage, a.proposed_level, a.confirmed_level, a.status,
                       m.name, m.team, s.skill_name, s.skill_id
                FROM assessment a
                JOIN member m ON a.member_id = m.employee_id
                JOIN skill  s ON a.skill_id  = s.skill_id
                WHERE 1=1 {scope_sql}
                ORDER BY a.assessment_id DESC LIMIT ?""",
            conn, params=(*params, limit),
        )
    finally:
        conn.close()


def load_top_gaps(scope_sql: str, params: tuple, top_n: int = 5) -> pd.DataFrame:
    """부족 Skill Top N: Required 대비 평균 Gap이 큰 Skill 순."""
    conn = get_connection()
    try:
        # 1. 해당 scope의 인원들이 속한 팀 목록
        teams_df = pd.read_sql_query(
            f"SELECT DISTINCT m.team FROM member m WHERE 1=1 {scope_sql}",
            conn, params=params,
        )
        if teams_df.empty:
            return pd.DataFrame()
        teams = teams_df["team"].tolist()
        placeholders = ",".join("?" for _ in teams)

        # 2. 해당 팀들의 Required Skill (전사 + 팀)
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

        # 3. 해당 scope 인원의 skill_profile 평균
        prof = pd.read_sql_query(
            f"""SELECT sp.skill_id, AVG(sp.current_level) AS avg_cur, COUNT(*) AS n_holders
                FROM skill_profile sp JOIN member m ON sp.member_id = m.employee_id
                WHERE 1=1 {scope_sql}
                GROUP BY sp.skill_id""",
            conn, params=params,
        )

        # 4. scope 인원수
        n_scope = pd.read_sql_query(
            f"SELECT COUNT(*) AS n FROM member m WHERE 1=1 {scope_sql}",
            conn, params=params,
        ).iloc[0]["n"]

        # 5. Skill 이름
        skills = pd.read_sql_query(
            "SELECT skill_id, skill_name FROM skill", conn,
        )
    finally:
        conn.close()

    if n_scope == 0:
        return pd.DataFrame()

    df = req.merge(prof, on="skill_id", how="left").merge(skills, on="skill_id", how="left")
    df["avg_cur"] = df["avg_cur"].fillna(0)
    df["n_holders"] = df["n_holders"].fillna(0).astype(int)
    df["gap"] = (df["target_level"] - df["avg_cur"]).clip(lower=0)
    df["scarcity"] = 1 - df["n_holders"] / n_scope
    # 우선도 = gap × (1 + scarcity) — Core는 가중치 1.5
    df["priority"] = df["gap"] * (1 + df["scarcity"]) * df["is_core"].map(lambda x: 1.5 if x else 1.0)
    df = df.sort_values("priority", ascending=False).head(top_n)
    return df[["skill_id", "skill_name", "target_level", "avg_cur", "gap", "scarcity", "is_core", "n_holders"]]


# ---------- 차트 ----------
def fig_sub_family_bar(df: pd.DataFrame) -> go.Figure:
    """Sub-family별 평균 Level 가로 막대."""
    if df.empty:
        return go.Figure()
    fig = go.Figure(go.Bar(
        x=df["avg_lv"], y=df["sub_family_name"],
        orientation="h",
        marker=dict(color=COLOR_NAVY),
        text=[f"L{v:.2f} · {n}건" for v, n in zip(df["avg_lv"], df["cnt"])],
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>평균 L%{x:.2f}<extra></extra>",
    ))
    fig.update_layout(
        height=340,
        margin=dict(t=10, b=10, l=10, r=80),
        paper_bgcolor=COLOR_BG_WHITE,
        plot_bgcolor=COLOR_BG_WHITE,
        xaxis=dict(range=[0, 4.5], gridcolor=COLOR_BORDER, dtick=1, title="평균 Level"),
        yaxis=dict(title=None, autorange="reversed"),
    )
    return fig


# ---------- 페이지 ----------
persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header(
    "📊 Dashboard",
    f"한눈에 보는 Skill 현황 · 조회 범위: {_scope_label(persona, member)}",
)

scope_sql, params = _scope_filter(persona, member)
summary = load_summary(scope_sql, params)

# --- 4 KPI 카드 ---
k1, k2, k3, k4 = st.columns(4)
k1.metric(
    "구성원" if persona != "employee" else "본인",
    f"{summary['members']} 명",
)
k2.metric(
    "등록 Skill",
    f"{summary['skills_total']} 개",
    help="시스템 전체 Skill 카탈로그 (모든 페르소나 공통)",
)
k3.metric(
    "평가 진행률",
    f"{summary['assess_rate']:.0f}%",
    delta=f"{summary['assessed']} / {summary['profile_total']} 항목",
    delta_color="off",
)
k4.metric(
    "Critical Skill 보유",
    f"{summary['critical_rate']:.0f}%",
    delta=f"{summary['critical_held']} 건",
    delta_color="off",
)

st.divider()

# --- 좌: Sub-family 평균 바차트 / 우: 최근 평가 활동 ---
left, right = st.columns([1.2, 1])
with left:
    st.markdown(
        f"<h5 style='color:{COLOR_NAVY};'>Sub-family별 평균 Level</h5>",
        unsafe_allow_html=True,
    )
    sub_df = load_sub_family_avg(scope_sql, params)
    if sub_df.empty:
        st.info("표시할 데이터가 없습니다.")
    else:
        st.plotly_chart(fig_sub_family_bar(sub_df), use_container_width=True)

with right:
    st.markdown(
        f"<h5 style='color:{COLOR_NAVY};'>최근 평가 활동</h5>",
        unsafe_allow_html=True,
    )
    rec = load_recent_assessments(scope_sql, params, limit=8)
    if rec.empty:
        st.info("평가 활동이 없습니다. Self / Leader / Calibration / Committee 화면에서 평가를 진행해보세요.")
    else:
        STAGE_LABELS_SHORT = {"self": "Self", "leader": "Leader",
                              "calibration": "Calib", "committee": "Committee"}
        STAGE_COLORS = {"self": "#7A8FA8", "leader": "#3D5A80",
                        "calibration": "#2C4865", "committee": COLOR_NAVY}
        for _, r in rec.iterrows():
            stg = r["stage"]
            badge_color = STAGE_COLORS.get(stg, COLOR_NAVY)
            lv = r["confirmed_level"] if pd.notna(r["confirmed_level"]) else r["proposed_level"]
            st.markdown(
                f"""
                <div style="border-left:3px solid {badge_color}; padding:6px 10px; margin-bottom:8px;">
                    <div style="color:{COLOR_TEXT_MED}; font-size:11px;">
                        {r['assessed_date']} ·
                        <span style="background:{badge_color}; color:white; padding:1px 6px;
                                     border-radius:8px; font-size:10px;">{STAGE_LABELS_SHORT.get(stg, stg)}</span>
                    </div>
                    <div style="font-size:13px; color:{COLOR_TEXT_DARK};">
                        <b>{r['name']}</b> · {r['skill_name'][:30]}
                        → <b style="color:{COLOR_NAVY};">L{int(lv)}</b>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

st.divider()

# --- 부족 Skill Top 5 ---
st.markdown(
    f"<h5 style='color:{COLOR_NAVY};'>부족 Skill Top 5 — 우선 육성 대상</h5>",
    unsafe_allow_html=True,
)
gaps = load_top_gaps(scope_sql, params, top_n=5)
if gaps.empty:
    st.success("🎉 부족한 Required Skill이 없습니다.")
else:
    cols = st.columns(5)
    for i, (_, r) in enumerate(gaps.iterrows()):
        with cols[i]:
            badge = (
                f"<span style='background:{COLOR_SK_RED}; color:white; padding:1px 6px; "
                f"border-radius:8px; font-size:10px;'>★</span> " if r["is_core"] else ""
            )
            st.markdown(
                f"""
                <div style="background:{COLOR_BG_WHITE}; border:1px solid {COLOR_BORDER};
                            border-radius:12px; padding:12px 14px; height:140px;">
                    <div style="color:{COLOR_TEXT_MED}; font-size:11px;">{badge}#{int(r['skill_id']):03d}</div>
                    <div style="color:{COLOR_NAVY}; font-weight:600; font-size:13px;
                                margin:6px 0 8px 0; min-height:36px; line-height:1.3;">
                        {r['skill_name'][:30]}
                    </div>
                    <div style="font-size:12px; color:{COLOR_TEXT_DARK};">
                        요구 <b>L{int(r['target_level'])}</b> · 현재 <b>L{r['avg_cur']:.1f}</b>
                    </div>
                    <div style="font-size:11px; color:{COLOR_TEXT_MED}; margin-top:4px;">
                        Gap <b style="color:{COLOR_SK_RED};">+{r['gap']:.1f}</b> ·
                        보유 {r['n_holders']}명
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

st.caption("우선도 = Gap × (1 + Scarcity) × Core 가중치(1.5) 기준 정렬")

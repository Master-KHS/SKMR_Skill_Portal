# Eval Lines - 구성원별 평가자 매핑 (N+1 팀장 / N+2 담당) 조회·확인.
# 기본은 직책 기반 자동 매핑. Phase 3에서 수동 오버라이드 기능 추가 예정.
import pandas as pd
import streamlit as st

from assessment_logic import get_evaluators
from config import COLOR_NAVY, COLOR_TEXT_MED
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header(
    "Eval Lines",
    "구성원별 평가자 자동 매핑 — N+1 (팀장) / N+2 (담당)",
)

st.caption(
    "직책 기반 자동 매핑: 팀원 → 팀의 팀장 + 담당의 담당 / "
    "팀장 → 담당의 담당 + 임원 / 담당 → 임원. "
    "수동 오버라이드는 Phase 3에서 추가 예정."
)

# 페르소나별 보이는 인원
conn = get_connection()
try:
    if persona == "team_leader" and member:
        sql = "WHERE team = ?"
        params = (member.get("team", ""),)
    elif persona == "calibration" and member:
        sql = "WHERE division = ?"
        params = (member.get("division", ""),)
    elif persona == "employee" and member:
        sql = "WHERE employee_id = ?"
        params = (member.get("employee_id", ""),)
    else:
        sql = "WHERE job_type IN ('사무직','기술직','연구직')"
        params = ()
    members_df = pd.read_sql_query(
        f"""SELECT employee_id, name, division, team, role_level, position, job_type
            FROM member {sql} ORDER BY division, team, role_level DESC, name""",
        conn, params=params,
    )
finally:
    conn.close()

if members_df.empty:
    st.warning("표시할 인원이 없습니다.")
    st.stop()

# 평가자 자동 매핑 (전체 한 번에 계산)
rows = []
for _, m in members_df.iterrows():
    ev = get_evaluators(m["employee_id"])
    rows.append({
        "사번": m["employee_id"],
        "이름": m["name"],
        "담당": m["division"],
        "팀": m["team"],
        "R/L": m["role_level"],
        "직책": m["position"],
        "N+1 평가자": f"{ev['n1_name']} ({ev['n1']})" if ev["n1"] else "—",
        "N+2 평가자": f"{ev['n2_name']} ({ev['n2']})" if ev["n2"] else "—",
    })
result = pd.DataFrame(rows)

# 필터
fcol1, fcol2 = st.columns([2, 4])
with fcol1:
    div_opts = ["전체"] + sorted(result["담당"].dropna().unique().tolist())
    sel_div = st.selectbox("담당", div_opts)
with fcol2:
    keyword = st.text_input("이름·사번 검색", placeholder="예: 김현수, EMP005")

view = result.copy()
if sel_div != "전체":
    view = view[view["담당"] == sel_div]
if keyword.strip():
    kw = keyword.strip().lower()
    view = view[
        view["이름"].str.lower().str.contains(kw, na=False)
        | view["사번"].str.lower().str.contains(kw, na=False)
    ]

st.markdown(
    f"<h5 style='color:{COLOR_NAVY};'>평가자 매핑 ({len(view)} / {len(result)})</h5>",
    unsafe_allow_html=True,
)
st.dataframe(view, hide_index=True, use_container_width=True, height=520)

# 매핑 누락 카운트
n_no_n1 = (view["N+1 평가자"] == "—").sum()
n_no_n2 = (view["N+2 평가자"] == "—").sum()
if n_no_n1 or n_no_n2:
    st.caption(
        f"⚠ 매핑 누락 — N+1: {n_no_n1}건 / N+2: {n_no_n2}건. "
        "팀에 팀장이 없거나 담당에 담당자가 없는 경우. Members에서 직책을 확인하세요."
    )

# Narrative 작성 - Calibration에서 Lv4 후보로 승격된 인원에 대해 Committee 의결 자료 작성.
# 흐름: Calibration(proposed_level=4, submitted) → Narrative 작성 → Committee
import pandas as pd
import streamlit as st

from assessment_logic import get_candidate_stats, get_proposed_level
from config import COLOR_BORDER, COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_DARK, COLOR_TEXT_MED
from db import get_connection
from persona_switch import render_persona_badge
from theme import page_header
from views._candidate_compare import render_candidate_compare_table

persona = st.session_state.get("current_persona", "hr_admin")
member = st.session_state.get("current_member")
render_persona_badge(persona)
page_header(
    "Narrative 작성",
    "Calibration → Committee 사이의 의결 자료 작성 — Lv4 후보자 대상",
)

st.caption(
    "Calibration에서 Lv4 후보로 승격된 인원에 대해 Committee 의결 자료(narrative)를 작성합니다. "
    "후보자 카드를 클릭하면 작성 창이 열립니다."
)

# Lv4 후보 = Calibration submitted, Committee 미진행, proposed_level=4
conn = get_connection()
try:
    candidates = pd.read_sql_query(
        """
        WITH calib_done AS (
            SELECT member_id, skill_id, MAX(assessment_id) AS aid,
                   MAX(proposed_level) AS calib_lv,
                   MAX(narrative) AS narrative
            FROM assessment
            WHERE stage='calibration' AND status='submitted' AND proposed_level=4
            GROUP BY member_id, skill_id
        ),
        commit_done AS (
            SELECT DISTINCT member_id, skill_id FROM assessment
            WHERE stage='committee' AND status='confirmed'
        )
        SELECT cd.member_id, cd.skill_id, cd.aid, cd.calib_lv, cd.narrative,
               m.name, m.division, m.team, m.role_level,
               s.skill_name, sf.sub_family_name, f.family_name, s.is_critical
        FROM calib_done cd
        JOIN member m ON cd.member_id = m.employee_id
        JOIN skill s  ON cd.skill_id  = s.skill_id
        JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
        JOIN skill_family f      ON sf.family_id    = f.family_id
        LEFT JOIN commit_done co ON cd.member_id = co.member_id AND cd.skill_id = co.skill_id
        WHERE co.member_id IS NULL
        ORDER BY s.skill_id, m.name
        """,
        conn,
    )
finally:
    conn.close()

# KPI
n_total = len(candidates)
n_written = int(candidates["narrative"].notna().sum() & (candidates["narrative"].fillna("").str.len() > 0).sum()) if not candidates.empty else 0
n_pending = n_total - n_written

k1, k2, k3 = st.columns(3)
k1.metric("Lv4 후보자", n_total)
k2.metric("Narrative 작성 완료", n_written)
k3.metric("미작성", n_pending)

st.divider()

if candidates.empty:
    st.success("Lv4 후보자가 없습니다 — Calibration에서 후보 승격되어야 표시됩니다.")
    st.stop()

# 필터
fcol1, fcol2 = st.columns([2, 4])
with fcol1:
    only_pending = st.checkbox("미작성만 보기", value=True, key="narr_pending")
with fcol2:
    keyword = st.text_input("이름·Skill 검색", key="narr_kw")

view = candidates.copy()
if only_pending:
    view = view[view["narrative"].fillna("").str.len() == 0]
if keyword.strip():
    kw = keyword.strip().lower()
    view = view[
        view["name"].str.lower().str.contains(kw, na=False)
        | view["skill_name"].str.lower().str.contains(kw, na=False)
    ]

st.caption(f"{len(view)} / {len(candidates)} 건")

# Skill 단위 그룹핑
for sid, group in view.groupby("skill_id"):
    sk0 = group.iloc[0]
    critical_badge = ""
    if sk0["is_critical"]:
        critical_badge = (
            f"<span style='background:{COLOR_SK_RED}; color:white; padding:2px 8px; "
            f"border-radius:3px; font-size:11px; font-weight:600; letter-spacing:0.04em; "
            f"margin-left:8px; vertical-align:middle;'>CRITICAL</span>"
        )

    with st.container(border=True):
        st.markdown(
            f"""
            <div style='color:{COLOR_TEXT_MED}; font-size:12px;'>
                {sk0['family_name']} · {sk0['sub_family_name']}
            </div>
            <h4 style='margin:4px 0 12px 0; color:{COLOR_NAVY};'>
                #{int(sid):03d} {sk0['skill_name']}{critical_badge}
                <span style='color:{COLOR_TEXT_MED}; font-size:13px; font-weight:400; margin-left:8px;'>
                    Lv4 후보 {len(group)}명
                </span>
            </h4>
            """,
            unsafe_allow_html=True,
        )

        # Skill별 후보자 비교 (자동 지표)
        comp_data = []
        for _, row in group.iterrows():
            mid = row["member_id"]
            comp_data.append({
                "employee_id": mid, "name": row["name"], "team": row["team"],
                "role_level": row["role_level"],
                "self_lv": get_proposed_level(mid, int(sid), "self"),
                "leader_lv": get_proposed_level(mid, int(sid), "leader"),
                "calib_lv": int(row["calib_lv"]),
            })
        render_candidate_compare_table(comp_data)

        # 각 후보자 Narrative 작성 영역 (expander)
        st.markdown(
            f"<h6 style='color:{COLOR_NAVY}; margin:14px 0 6px 0;'>인원별 Narrative</h6>",
            unsafe_allow_html=True,
        )

        for _, row in group.iterrows():
            mid = row["member_id"]
            current_narr = row["narrative"] or ""
            has_text = len(current_narr.strip()) > 0
            badge = (
                f"<span style='background:#1B8A50; color:white; padding:1px 6px; "
                f"border-radius:3px; font-size:10px; font-weight:600; margin-left:6px;'>작성됨</span>"
                if has_text else
                f"<span style='border:1px solid {COLOR_SK_RED}; color:{COLOR_SK_RED}; "
                f"padding:0 6px; border-radius:3px; font-size:10px; font-weight:600; margin-left:6px;'>미작성</span>"
            )
            head_md = (
                f"<b>{row['name']}</b> "
                f"<span style='color:{COLOR_TEXT_MED}; font-size:12px;'>"
                f"({row['team']} · {row['role_level']})</span>{badge}"
            )

            with st.expander(
                f"{row['name']} ({row['team']} · {row['role_level']}) — "
                f"{'작성됨' if has_text else '미작성'}",
                expanded=not has_text,
            ):
                st.markdown(head_md, unsafe_allow_html=True)
                st.caption(
                    "Committee 의결을 위한 자료. 후보자의 Lv4 적격성 — "
                    "기여·성과·역량 발휘 사례·향후 기대 등을 명료하게."
                )
                new_narr = st.text_area(
                    "Narrative",
                    value=current_narr,
                    height=180,
                    key=f"narr_{mid}_{sid}",
                    label_visibility="collapsed",
                    placeholder=(
                        "예) 2025년 OLED 신규 호스트 화합물 합성 Recipe 도출 프로젝트를 단독 리드. "
                        "비정형 제약 하에 Trade-Off를 조율하여 양산 안정성과 신규 특성을 동시 확보. "
                        "사내 학회 발표 2건, 특허 1건 출원. 향후 신소재 영역의 표준 방법론 수립자로 기대."
                    ),
                )

                bcol1, bcol2 = st.columns([1, 4])
                with bcol1:
                    if st.button("저장", type="primary",
                                  use_container_width=True,
                                  key=f"narr_save_{mid}_{sid}"):
                        conn = get_connection()
                        try:
                            conn.execute(
                                "UPDATE assessment SET narrative=? WHERE assessment_id=?",
                                (new_narr.strip(), int(row["aid"])),
                            )
                            conn.commit()
                        finally:
                            conn.close()
                        st.success(f"{row['name']} · #{int(sid):03d} Narrative 저장됨")
                        st.rerun()
                with bcol2:
                    if has_text:
                        st.caption(f"마지막 저장: {len(current_narr)}자")

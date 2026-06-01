# Calibration·Committee 화면에서 쓰는 후보자 비교 카드.
# 각 후보자의 자동 산출 지표를 한눈에 보여줘 평가자가 비교할 수 있도록.
import streamlit as st

from assessment_logic import get_candidate_stats
from config import COLOR_BORDER, COLOR_NAVY, COLOR_SK_RED, COLOR_TEXT_DARK, COLOR_TEXT_MED


def render_candidate_compare_table(candidates: list[dict]) -> None:
    """Skill 그룹 상단에 후보자 N명을 가로로 펼친 비교 테이블.
    candidates: [{employee_id, name, team, role_level, self_lv, leader_lv, calib_lv (optional)}]"""
    if not candidates:
        return

    # 자동 지표를 한 번에 산출
    rows = []
    for c in candidates:
        stats = get_candidate_stats(c["employee_id"])
        rows.append({**c, **stats})

    # 가로 비교 — 컬럼 수에 따라 카드 폭 조정
    n = len(rows)
    cols = st.columns(min(n, 4))  # 한 줄에 최대 4명, 넘으면 2번째 줄

    for i, r in enumerate(rows):
        with cols[i % len(cols)]:
            stage_info = ""
            if "calib_lv" in r and r["calib_lv"] is not None:
                stage_info = (
                    f"Self <b>L{r.get('self_lv','?')}</b> · "
                    f"Leader <b>L{r.get('leader_lv','?')}</b> · "
                    f"Calib <b>L{r['calib_lv']}</b>"
                )
            else:
                stage_info = (
                    f"Self <b>L{r.get('self_lv','?')}</b> · "
                    f"Leader <b>L{r.get('leader_lv','?')}</b>"
                )

            # 충족률 색상
            ff = r["required_fulfill"]
            if ff >= 80:
                ff_color = "#1B8A50"
            elif ff >= 60:
                ff_color = "#C9A227"
            else:
                ff_color = COLOR_SK_RED

            top_sf = r["top_sub_family"] or "—"

            st.markdown(
                f"""
                <div style='background:white; border:1px solid {COLOR_BORDER};
                            border-radius:4px; padding:12px 14px; margin-bottom:8px; min-height:200px;'>
                    <div style='display:flex; justify-content:space-between; align-items:baseline;'>
                        <b style='color:{COLOR_NAVY}; font-size:14px;'>{r['name']}</b>
                        <span style='color:{COLOR_TEXT_MED}; font-size:11px;'>{r['role_level']}</span>
                    </div>
                    <div style='color:{COLOR_TEXT_MED}; font-size:11px;'>{r['team']}</div>
                    <div style='color:{COLOR_NAVY}; font-size:12px; margin-top:8px;
                                padding:5px 8px; background:#F5F5F7; border-radius:3px;'>
                        {stage_info}
                    </div>
                    <table style='width:100%; margin-top:8px; font-size:12px;
                                  border-collapse:collapse;'>
                        <tr><td style='color:{COLOR_TEXT_MED}; padding:2px 0;'>평균 Level</td>
                            <td style='text-align:right; color:{COLOR_NAVY}; font-weight:600;'>
                                L{r['avg_lv']:.2f}</td></tr>
                        <tr><td style='color:{COLOR_TEXT_MED}; padding:2px 0;'>L3+ 보유</td>
                            <td style='text-align:right; color:{COLOR_TEXT_DARK};'>
                                {r['n_l3_plus']}개 (L4 {r['n_l4']})</td></tr>
                        <tr><td style='color:{COLOR_TEXT_MED}; padding:2px 0;'>Critical 보유</td>
                            <td style='text-align:right; color:{COLOR_TEXT_DARK};'>
                                {r['critical_held']}개</td></tr>
                        <tr><td style='color:{COLOR_TEXT_MED}; padding:2px 0;'>Required 충족</td>
                            <td style='text-align:right; color:{ff_color}; font-weight:600;'>
                                {r['required_fulfill']:.0f}% ({r['n_required']}건)</td></tr>
                        <tr><td style='color:{COLOR_TEXT_MED}; padding:2px 0;'>Evidence</td>
                            <td style='text-align:right; color:{COLOR_TEXT_DARK};'>
                                {r['n_evidence']}건</td></tr>
                        <tr><td style='color:{COLOR_TEXT_MED}; padding:2px 0;'>최근 6M 평가</td>
                            <td style='text-align:right; color:{COLOR_TEXT_DARK};'>
                                {r['n_recent_assess']}건</td></tr>
                    </table>
                    <div style='color:{COLOR_TEXT_MED}; font-size:11px; margin-top:6px;
                                padding-top:6px; border-top:1px solid {COLOR_BORDER};'>
                        강점 영역: <b style='color:{COLOR_NAVY};'>{top_sf}</b>
                        {f' (L{r["top_sub_avg"]:.1f})' if r['top_sub_family'] else ''}
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

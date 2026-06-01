# 평가 화면에 끼우는 Evidence 블록 - 등록·조회 expander.
# 각 평가 카드에서 같은 (member, skill)에 연결된 Evidence를 같은 자리에서 확인·추가.
import streamlit as st

from assessment_logic import add_evidence_for_skill, get_evidence_for_skill
from config import COLOR_BORDER, COLOR_NAVY, COLOR_TEXT_MED
from seed.evidence_seed import EVIDENCE_TYPES, TYPE_LABELS


def render_evidence_block(member_id: str, skill_id: int, *,
                           allow_add: bool = True, key_suffix: str = "") -> None:
    """평가 카드 내부에 펼쳐쓰는 Evidence 블록. 등록 권한은 allow_add로 제어."""
    ev_df = get_evidence_for_skill(member_id, skill_id)
    n = len(ev_df)
    with st.expander(f"Evidence ({n}건)", expanded=False):
        if ev_df.empty:
            st.caption("연결된 Evidence가 없습니다.")
        else:
            for _, r in ev_df.iterrows():
                st.markdown(
                    f"""
                    <div style='border-left:2px solid {COLOR_BORDER}; padding:4px 10px; margin-bottom:6px;'>
                        <div style='color:{COLOR_TEXT_MED}; font-size:11px;'>
                            {TYPE_LABELS.get(r['evidence_type'], r['evidence_type'])} · {r['created_date']}
                        </div>
                        <div style='color:{COLOR_NAVY}; font-size:13px; font-weight:500;'>{r['title']}</div>
                        {f'<div style="color:{COLOR_TEXT_MED}; font-size:12px;">{r["description"]}</div>' if r.get('description') else ''}
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

        if allow_add:
            st.markdown(
                f"<p style='color:{COLOR_TEXT_MED}; font-size:12px; margin:6px 0 2px 0;'>새 Evidence 추가</p>",
                unsafe_allow_html=True,
            )
            with st.form(f"ev_add_{member_id}_{skill_id}_{key_suffix}", clear_on_submit=True):
                fcol1, fcol2 = st.columns([3, 1])
                title = fcol1.text_input("제목", label_visibility="collapsed",
                                            placeholder="예: OLED 신규 합성 프로젝트 리드")
                ev_type = fcol2.selectbox(
                    "유형", options=EVIDENCE_TYPES,
                    format_func=lambda t: TYPE_LABELS.get(t, t),
                    label_visibility="collapsed",
                )
                desc = st.text_area("설명 (선택)", height=60, label_visibility="collapsed",
                                      placeholder="기여·성과·역할 등")
                if st.form_submit_button("등록", use_container_width=True):
                    if not title.strip():
                        st.error("제목 필수")
                    else:
                        add_evidence_for_skill(
                            member_id=member_id, skill_id=skill_id,
                            evidence_type=ev_type, title=title.strip(),
                            description=desc.strip(),
                        )
                        st.success("등록됨")
                        st.rerun()

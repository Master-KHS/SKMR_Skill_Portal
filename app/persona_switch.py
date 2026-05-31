# 사이드바 페르소나 전환 (2단: 권한 → 사람) + 페이지 상단 배지.
# 1단에서 권한 선택 → 2단에 그 권한 가진 마스터 인원 목록이 자동으로 뜸.
# 인원이 0명이면 "(미배정)" 안내.
import streamlit as st

from config import COLOR_NAVY, COLOR_TEXT_MED
from permissions import PERSONA_LABELS, get_members_for_persona

# 시연 시 처음 떴을 때 누가 보이게 할지 - HR Admin · 김현수(EMP005)가 사용자 본인
DEFAULT_PERSONA = "hr_admin"
DEFAULT_EMPLOYEE_ID = "EMP005"  # 김현수


def render_persona_switch() -> tuple[str, dict | None]:
    """사이드바 최상단: 권한 selectbox + 사람 selectbox.
    반환: (persona_code, member_dict 또는 None)"""
    if "current_persona" not in st.session_state:
        st.session_state.current_persona = DEFAULT_PERSONA

    with st.sidebar:
        st.markdown(
            f"<p style='color:{COLOR_TEXT_MED}; font-size:12px; margin-bottom:4px;'>"
            "현재 보기 (페르소나 전환)</p>",
            unsafe_allow_html=True,
        )
        # 1단: 권한
        persona = st.selectbox(
            label="권한",
            options=list(PERSONA_LABELS.keys()),
            format_func=lambda code: PERSONA_LABELS[code],
            key="current_persona",
            label_visibility="collapsed",
        )

        # 2단: 그 권한 가진 인원
        members = get_members_for_persona(persona)
        member = None
        if not members:
            st.caption(f"⚠️ 이 권한({PERSONA_LABELS[persona]})으로 매핑된 인원이 마스터에 없습니다. "
                       "Member 관리에서 엑셀의 persona_role 컬럼을 확인하세요.")
        else:
            # 기본 선택 - DEFAULT_EMPLOYEE_ID가 명단에 있으면 그걸로, 아니면 첫 번째
            default_idx = 0
            for i, m in enumerate(members):
                if m["employee_id"] == DEFAULT_EMPLOYEE_ID:
                    default_idx = i
                    break

            if len(members) == 1:
                member = members[0]
                st.caption(f"👤 {member['name']} ({member['team']} · {member['role_level']})")
            else:
                idx = st.selectbox(
                    label="사람",
                    options=list(range(len(members))),
                    format_func=lambda i: f"{members[i]['name']} ({members[i]['team']} · {members[i]['role_level']})",
                    index=default_idx,
                    key=f"current_member_{persona}",
                    label_visibility="collapsed",
                )
                member = members[idx]

        st.divider()

    # 페이지에서 쓰기 좋게 session_state에도 저장
    st.session_state["current_member"] = member
    return persona, member


def render_persona_badge(persona: str) -> None:
    """페이지 상단 배지. session_state.current_member 사용."""
    member = st.session_state.get("current_member")
    label = PERSONA_LABELS.get(persona, persona)
    if member:
        body = f"👤 현재 보기: <b>{label}</b> ({member['name']}, {member['team']} · {member['role_level']})"
    else:
        body = f"👤 현재 보기: <b>{label}</b> (매핑된 인원 없음)"
    st.markdown(
        f"""
        <div style="
            display:inline-block;
            background-color:{COLOR_NAVY};
            color:white;
            padding:6px 14px;
            border-radius:20px;
            font-size:13px;
            margin-bottom:12px;
        ">{body}</div>
        """,
        unsafe_allow_html=True,
    )

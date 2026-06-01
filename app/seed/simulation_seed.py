# 시뮬레이션 데이터 - 가상 인원 ~125명을 추가해 총 ~150명 규모로 확장.
# Settings 화면에서 ON/OFF 토글. 비활성화 시 SIM 사번 인원과 자식 데이터(Profile·평가·Evidence) 모두 제거.
import random
from pathlib import Path

import pandas as pd

from db import get_connection
from seed.members_loader import (
    MEMBERS_XLSX,
    REQUIRED_COLUMNS,
    load_xlsx_to_df,
    save_df_to_xlsx_and_db,
)

SIM_PREFIX = "SIM"
CORPORATION = "SK머티리얼즈"

# 가상 조직 구조 — (담당명, 직종, 팀 리스트). 기존 24명 마스터와 겹치지 않는 새 팀들로.
SIM_ORG = [
    ("응용기술담당", "연구직", ["응용소재팀", "차세대소재팀", "공정연구팀"]),
    ("제조기술담당", "기술직", ["설비기술팀", "품질기술팀", "자동화팀"]),
    ("생산담당",     "기술직", ["생산1팀", "생산2팀", "생산기획팀"]),
    ("영업담당",     "사무직", ["국내영업팀", "해외영업팀", "마케팅팀"]),
    ("경영지원담당", "사무직", ["재무팀", "법무팀", "전략기획팀"]),
]

# 팀당 R/L 분포 (사양 4.4 기반)
TEAM_LEVELS = [
    ("L6", 1, "팀장"),
    ("L5", 2, "팀원"),
    ("L4", 3, "팀원"),
    ("L3", 2, "팀원"),
    ("L2", 1, "팀원"),
]  # 팀당 9명

SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
            "한", "오", "서", "신", "권", "황", "안", "송", "전", "홍",
            "유", "고", "문", "양", "손", "배", "백", "허", "남", "심"]
GIVEN_NAMES = ["민준", "서연", "도윤", "지우", "현우", "지호", "서윤", "수아",
               "예린", "지원", "준서", "예준", "서아", "하준", "지유", "건우",
               "유진", "서진", "다은", "민서", "준영", "현서", "윤서", "지환",
               "성민", "동현", "재훈", "예지", "수빈", "은채", "나래", "소율",
               "지환", "도현", "윤지", "지영", "수현", "현지", "민지", "은지"]


def _gen_name(seen: set) -> str:
    """중복 방지 한국 이름 생성."""
    for _ in range(100):
        n = random.choice(SURNAMES) + random.choice(GIVEN_NAMES)
        if n not in seen:
            seen.add(n)
            return n
    # fallback
    return random.choice(SURNAMES) + random.choice(GIVEN_NAMES) + str(random.randint(1, 99))


def _persona_for(position: str) -> str:
    """직책에 따라 자동 페르소나 매핑."""
    if position == "담당":
        return "calibration"
    if position == "팀장":
        return "team_leader"
    return "employee"


def build_simulation_rows(existing_names: set | None = None) -> list[dict]:
    """시뮬 인원 행 생성. 결과: 담당 5명 + 팀당 9명 × 15팀 = 140명 (= 합계 150명 근처)."""
    random.seed(20260601)
    seen_names = existing_names.copy() if existing_names else set()
    rows = []
    counter = 1

    for division, job_type, teams in SIM_ORG:
        # 담당 1명 (division 책임자)
        sid = f"{SIM_PREFIX}{counter:03d}"
        rows.append({
            "employee_id": sid, "name": _gen_name(seen_names),
            "corporation": CORPORATION,
            "division": division, "team": "(담당 직속)",
            "role_level": "L6", "position": "담당",
            "job_type": job_type, "persona_role": _persona_for("담당"),
        })
        counter += 1

        # 팀별 인원
        for team in teams:
            for rl, n, default_pos in TEAM_LEVELS:
                for _ in range(n):
                    sid = f"{SIM_PREFIX}{counter:03d}"
                    rows.append({
                        "employee_id": sid, "name": _gen_name(seen_names),
                        "corporation": CORPORATION,
                        "division": division, "team": team,
                        "role_level": rl, "position": default_pos,
                        "job_type": job_type, "persona_role": _persona_for(default_pos),
                    })
                    counter += 1
    return rows


def is_simulation_active() -> bool:
    """엑셀에 SIM 사번이 1건이라도 있으면 활성."""
    if not MEMBERS_XLSX.exists():
        return False
    df = load_xlsx_to_df()
    return df["employee_id"].astype(str).str.startswith(SIM_PREFIX).any()


def get_simulation_count() -> int:
    if not MEMBERS_XLSX.exists():
        return 0
    df = load_xlsx_to_df()
    return int(df["employee_id"].astype(str).str.startswith(SIM_PREFIX).sum())


def generate_simulation_data() -> dict:
    """시뮬레이션 인원을 엑셀+DB에 추가. 이미 있으면 skip."""
    df_existing = load_xlsx_to_df()
    if df_existing["employee_id"].astype(str).str.startswith(SIM_PREFIX).any():
        return {"skipped": True, "existing": int(
            df_existing["employee_id"].astype(str).str.startswith(SIM_PREFIX).sum()
        )}

    existing_names = set(df_existing["name"].astype(str).tolist())
    new_rows = build_simulation_rows(existing_names)
    new_df = pd.DataFrame(new_rows)
    merged = pd.concat([df_existing, new_df], ignore_index=True)
    info = save_df_to_xlsx_and_db(merged)
    return {"skipped": False, "added": len(new_rows), "total_members": info["loaded"]}


def remove_simulation_data() -> dict:
    """SIM 인원과 그 자식 데이터(profile·assessment·evidence·individual required) 모두 제거."""
    df = load_xlsx_to_df()
    sim_ids = df[df["employee_id"].astype(str).str.startswith(SIM_PREFIX)]["employee_id"].tolist()
    if not sim_ids:
        return {"removed": 0, "remaining": len(df)}

    # 자식 데이터 먼저 정리 (FK 우회)
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys = OFF")
        ph = ",".join("?" for _ in sim_ids)
        # Evidence link → Evidence 순서
        cur.execute(
            f"DELETE FROM evidence_skill_link WHERE evidence_id IN "
            f"(SELECT evidence_id FROM evidence WHERE member_id IN ({ph}))",
            sim_ids,
        )
        cur.execute(f"DELETE FROM evidence WHERE member_id IN ({ph})", sim_ids)
        cur.execute(f"DELETE FROM skill_profile WHERE member_id IN ({ph})", sim_ids)
        # assessment의 member_id 또는 assessor_id가 SIM이면 삭제
        cur.execute(
            f"DELETE FROM assessment WHERE member_id IN ({ph}) OR assessor_id IN ({ph})",
            (*sim_ids, *sim_ids),
        )
        cur.execute(
            f"DELETE FROM required_skill WHERE org_or_individual='individual' "
            f"AND target_id IN ({ph})",
            sim_ids,
        )
        cur.execute("PRAGMA foreign_keys = ON")
        conn.commit()
    finally:
        conn.close()

    # 엑셀에서 SIM 행 제거 후 sync
    df_clean = df[~df["employee_id"].astype(str).str.startswith(SIM_PREFIX)]
    info = save_df_to_xlsx_and_db(df_clean)
    return {"removed": len(sim_ids), "remaining": info["loaded"]}

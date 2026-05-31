# 가상 Skill Profile 자동 생성 - 직종·R/L 특성을 반영한 그럴듯한 분포로.
# DB의 skill_profile이 비어 있을 때만 적재. 이후 평가 진행되면 그 결과로 갱신됨.
import random

# Sub-family 가중치 (직종별) - 높을수록 그 Sub-family에서 더 많은 Skill 보유 확률
WEIGHTS_BY_JOB_TYPE = {
    "연구직": {
        "DOM": 4, "BIZ": 1, "PRS": 1, "REG": 1,
        "PLN": 1, "DES": 4, "ANA": 4, "MGT": 1, "OPS": 1,
    },
    "기술직": {
        "DOM": 1, "BIZ": 1, "PRS": 3, "REG": 2,
        "PLN": 3, "DES": 3, "ANA": 3, "MGT": 3, "OPS": 2,
    },
    "사무직": {
        "DOM": 0, "BIZ": 1, "PRS": 0, "REG": 1,
        "PLN": 3, "DES": 0, "ANA": 1, "MGT": 3, "OPS": 0,
    },
}

# R/L별 스킬 개수 범위 (min, max)
SKILL_COUNT_BY_RL = {
    "L6": (12, 15),  # 팀장
    "L5": (10, 14),
    "L4": (9, 12),
    "L3": (8, 11),
    "L2": (7, 10),
}

# R/L별 Level 분포 (L1, L2, L3, L4 확률) - 팀장으로 갈수록 상위 Level 비율↑
LEVEL_DIST_BY_RL = {
    "L6": [0.05, 0.20, 0.40, 0.35],
    "L5": [0.10, 0.30, 0.45, 0.15],
    "L4": [0.20, 0.40, 0.30, 0.10],
    "L3": [0.30, 0.45, 0.22, 0.03],
    "L2": [0.40, 0.45, 0.13, 0.02],
}


def _choose_skills(skill_pool: list[dict], weights: dict, n: int) -> list[int]:
    """가중치에 비례해서 n개 Skill을 비복원 추출. 가중치 0인 Sub-family는 제외."""
    candidates = [s for s in skill_pool if weights.get(s["sub_family_id"], 0) > 0]
    if not candidates:
        return []
    w = [weights.get(s["sub_family_id"], 0) for s in candidates]
    chosen_ids: list[int] = []
    pool = list(zip(candidates, w))
    for _ in range(min(n, len(pool))):
        total = sum(x[1] for x in pool)
        if total <= 0:
            break
        r = random.random() * total
        acc = 0.0
        for i, (s, ww) in enumerate(pool):
            acc += ww
            if r <= acc:
                chosen_ids.append(s["skill_id"])
                pool.pop(i)
                break
    return chosen_ids


def _pick_level(rl: str) -> int:
    """R/L에 맞는 분포로 Level 1~4 추출."""
    probs = LEVEL_DIST_BY_RL.get(rl, [0.30, 0.40, 0.25, 0.05])
    r = random.random()
    acc = 0.0
    for lv, p in enumerate(probs, start=1):
        acc += p
        if r <= acc:
            return lv
    return 2


def seed_skill_profiles(conn, *, force: bool = False) -> dict:
    """평가 대상자(사무·기술·연구직) 전원에 대해 가상 Skill Profile 적재.
    skill_profile이 이미 있으면 skip (force=True면 통째로 재생성)."""
    random.seed(2026)  # 재현 가능한 분포

    cur = conn.cursor()
    existing = cur.execute("SELECT COUNT(*) FROM skill_profile").fetchone()[0]
    if existing > 0 and not force:
        return {"skipped": True, "count": existing}

    if force:
        cur.execute("DELETE FROM skill_profile")

    # Skill 풀
    skill_rows = cur.execute(
        "SELECT skill_id, sub_family_id FROM skill"
    ).fetchall()
    skill_pool = [dict(r) for r in skill_rows]

    # 평가 대상자
    members = cur.execute(
        """SELECT employee_id, job_type, role_level
           FROM member
           WHERE job_type IN ('사무직','기술직','연구직')"""
    ).fetchall()

    rows = []
    for m in members:
        weights = WEIGHTS_BY_JOB_TYPE.get(m["job_type"], {})
        if not any(weights.values()):
            continue
        n_min, n_max = SKILL_COUNT_BY_RL.get(m["role_level"], (8, 12))
        n = random.randint(n_min, n_max)
        chosen = _choose_skills(skill_pool, weights, n)
        for sid in chosen:
            cur_lv = _pick_level(m["role_level"])
            # target_level: 50% 현재 유지, 50% +1 (단 L4 초과 금지)
            target_lv = cur_lv if random.random() < 0.5 else min(cur_lv + 1, 4)
            rows.append((m["employee_id"], sid, cur_lv, target_lv, "2026-01-15"))

    cur.executemany(
        """INSERT INTO skill_profile
           (member_id, skill_id, current_level, target_level, last_assessed_date)
           VALUES (?,?,?,?,?)""",
        rows,
    )
    conn.commit()
    return {"skipped": False, "count": len(rows), "members": len(members)}

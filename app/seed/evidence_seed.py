# 가상 Evidence 자동 생성 - 5개 유형, 직종별 분포 차등.
# DB의 evidence가 비어 있을 때만 적재.
import random

EVIDENCE_TYPES = ["project", "certificate", "training", "output", "patent"]
TYPE_LABELS = {
    "project":     "프로젝트",
    "certificate": "자격증",
    "training":    "교육",
    "output":      "산출물",
    "patent":      "특허",
}

# 직종별 유형 가중치 (사양 4.7 - project 40 / cert 20 / training 20 / output 15 / patent 5 기준 변형)
TYPE_WEIGHTS_BY_JOB = {
    "연구직": {"project": 35, "patent": 20, "output": 25, "training": 15, "certificate": 5},
    "기술직": {"project": 45, "training": 20, "certificate": 20, "output": 10, "patent": 5},
    "사무직": {"project": 30, "training": 35, "certificate": 25, "output": 10, "patent": 0},
}

# 유형별 제목 템플릿
TITLE_TEMPLATES = {
    "project": [
        "OLED HTL 신규 합성 Recipe 도출 프로젝트",
        "고객 A사 Precursor 품질 개선 과제",
        "Wet Chemical Particle 저감 TF",
        "Pilot Line CIP 자동화 프로젝트",
        "양산 수율 개선 6 Sigma 과제",
        "신규 Customer Application 평가 프로젝트",
        "고객 Spec In 대응 과제",
        "분석 장비 신규 도입·이관 프로젝트",
        "공정 SPC 시스템 구축 과제",
        "OLED Encapsulation 신규 공정 개발",
        "Canister Valve 적합성 표준화 TF",
        "CMMS 도입·정비 데이터 체계화 과제",
    ],
    "certificate": [
        "위험물기능사", "공정안전관리(PSM) 전문가",
        "Six Sigma Black Belt", "PMP",
        "TRIZ Level 3", "ISO 9001 심사원",
        "산업안전기사", "화공기사", "환경기사",
        "데이터분석 준전문가(ADsP)",
    ],
    "training": [
        "OLED 소재 디자인 심화 과정",
        "DoE 실습 워크숍",
        "공정 안전 관리 직무 교육",
        "사내 SK Univ. - Leadership Track",
        "통계적 공정관리(SPC) 실무",
        "RCA·8D 문제해결 워크숍",
        "Tableau/Power BI 데이터 시각화",
        "AI/ML for Engineers 기초",
        "SK 가치관·SKMS 이해 과정",
        "MOC/MOI 변경 관리 교육",
    ],
    "output": [
        "사내 기술 보고서: OLED HTL 특성 비교",
        "분석 SOP v2.0 작성",
        "공정 트러블슈팅 사례집 기여",
        "사내 학회 발표: Precursor 신규 합성",
        "Best Practice 사내 발표",
        "팀 내 Onboarding 가이드 작성",
        "기술 표준서 개정",
    ],
    "patent": [
        "OLED 호스트 화합물 및 그 제조방법 (특허출원)",
        "박막 형성용 전구체 조성물 (등록특허)",
        "고순도 정제 방법 (특허출원)",
        "Canister Valve 누설 검출 장치 (등록특허)",
        "유기 반도체 소재 개선 (특허출원)",
    ],
}


def _weighted_choice(weights: dict) -> str:
    total = sum(weights.values())
    if total <= 0:
        return random.choice(list(weights.keys()))
    r = random.random() * total
    acc = 0
    for k, w in weights.items():
        acc += w
        if r <= acc:
            return k
    return list(weights.keys())[-1]


def _random_date_2024_2026() -> str:
    """2024~2026년 사이 무작위 날짜 (YYYY-MM-DD)."""
    y = random.choice([2024, 2025, 2026])
    m = random.randint(1, 12)
    d = random.randint(1, 28)
    return f"{y}-{m:02d}-{d:02d}"


def seed_evidences(conn, *, force: bool = False) -> dict:
    """평가 대상자별 가상 Evidence 2~5건 생성 + Skill 1~3개 연결.
    이미 있으면 skip."""
    random.seed(20260530)
    cur = conn.cursor()
    existing = cur.execute("SELECT COUNT(*) FROM evidence").fetchone()[0]
    if existing > 0 and not force:
        return {"skipped": True, "count": existing}
    if force:
        cur.execute("DELETE FROM evidence_skill_link")
        cur.execute("DELETE FROM evidence")

    members = cur.execute(
        """SELECT employee_id, job_type FROM member
           WHERE job_type IN ('사무직','기술직','연구직')"""
    ).fetchall()

    total_ev = 0
    for m in members:
        n = random.randint(2, 5)
        # 본인 Profile에 있는 Skill 풀
        sk_pool = [r["skill_id"] for r in cur.execute(
            "SELECT skill_id FROM skill_profile WHERE member_id=?",
            (m["employee_id"],)
        ).fetchall()]

        weights = TYPE_WEIGHTS_BY_JOB.get(m["job_type"], TYPE_WEIGHTS_BY_JOB["사무직"])
        for _ in range(n):
            ev_type = _weighted_choice(weights)
            title = random.choice(TITLE_TEMPLATES[ev_type])
            desc = f"({TYPE_LABELS[ev_type]}) {title} 관련 활동·성과."
            date = _random_date_2024_2026()
            cur.execute(
                """INSERT INTO evidence
                   (member_id, evidence_type, title, description, file_path, created_date)
                   VALUES (?,?,?,?,NULL,?)""",
                (m["employee_id"], ev_type, title, desc, date),
            )
            eid = cur.lastrowid
            # Skill 1~3개 연결 (본인 Profile 내에서)
            if sk_pool:
                k = random.randint(1, min(3, len(sk_pool)))
                for sid in random.sample(sk_pool, k):
                    cur.execute(
                        "INSERT OR IGNORE INTO evidence_skill_link VALUES (?,?)",
                        (eid, sid),
                    )
            total_ev += 1

    conn.commit()
    return {"skipped": False, "count": total_ev, "members": len(members)}

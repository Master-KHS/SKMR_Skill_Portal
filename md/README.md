# SKMR Skill Portal

**Skill 기반 인재관리 플랫폼 — 로컬 + 클라우드 프로토타입**

조건 중심의 인재관리(직급·연차·자격증)에서 **Skill 중심 인재관리**로 전환하기 위한 HR 기획 프로토타입입니다.
HR팀 내부 검토 및 임원 시연용으로 제작되었습니다.

---

## 라이브 데모

**https://skmrskillapp.streamlit.app**

별도 설치 없이 브라우저에서 바로 사용 가능합니다.

---

## 기술 스택

| 항목 | 내용 |
|---|---|
| 언어 | Python 3.11 |
| 프레임워크 | Streamlit 1.36+ |
| 데이터베이스 | SQLite (파일 기반) |
| 차트 | Plotly |
| 데이터 | pandas + openpyxl |
| 배포 | Streamlit Community Cloud |

---

## 로컬 실행 방법

### 최초 1회 — 환경 세팅
```
scripts\setup.bat 더블클릭
```
가상환경(.venv) 생성 + 패키지 자동 설치

### 매번 실행
```
scripts\run.bat 더블클릭   (또는 바탕화면 아이콘)
```
브라우저가 자동으로 열립니다. 종료: 검은 창에서 `Ctrl+C`

---

## Skill 체계

| 구분 | 내용 |
|---|---|
| Family | 전문지식(EXP) / 업무기술(WRK) / Enabler(ENB) |
| Sub-family | 11개 (Domain / BIZ / PRS / REG / PLN / DES / ANA / MGT / OPS / AIT / TMS) |
| Skill | 134개 (EXP·WRK 130개 + Enabler 4개) |
| Level | L1 Youngling → L2 Padawan → L3 Jedi Knight → L4 Jedi Master |

Enabler 4개(데이터 분석 / 생성형 AI Literacy / 디지털 협업 / PM)는 **전사 Required 자동 포함**됩니다.

---

## 메뉴 구조

```
Foundation (운영 기반)
  · 운영 정책 관리     — Family / Sub-family / Level 편집
  · Skill Library      — 134개 Skill + 4박스 상세 + CRUD
  · 구성원 Master Data — 엑셀 기반 마스터 편집
  · Assessment 라인 관리 — N+1 / N+2 평가자 자동 매핑
  · Admin 권한 관리    — 시뮬 데이터 / Critical Skill / DB 리셋

Assessment (평가 워크플로)
  · 필요 Skill 정의    — Required 체크 + Core 5개 강제
  · 자가 진단          — Required 선택 ↔ 진단 카드 (좌우 split)
  · 리더 진단          — Lv≤2 즉시 확정 / Lv3+ Calibration 진입
  · Calibration        — Lv3 확정 / Lv4 Committee 후보
  · Narrative 작성     — Lv4 후보 의결 자료 작성
  · Committee          — Lv4 최종 의결 + Narrative 표시
  · 최종 결과 확인     — Radar + 평가 현황 + History

Reporting (결과 조회)
  · 진단 결과 확인     — KPI 카드 + 조직별 필수 Skill 현황
  · Talent Search      — 다중 조건 필터 인재 검색
```

---

## 평가 워크플로

```
자가 진단 → 리더 진단
                ├─ Lv 1~2  →  즉시 확정
                ├─ Lv 3    →  Calibration → 확정
                └─ Lv 4    →  Calibration → Narrative 작성 → Committee → 확정
```

---

## 페르소나 (권한) 체계

| 코드 | 명칭 | 접근 범위 |
|---|---|---|
| hr_admin | HR Admin | 전체 메뉴 (14개) |
| hr_viewer | HR Viewer | 조회 7개 |
| team_leader | Team Leader | 9개 |
| calibration | Calibration 참여자 | 9개 |
| committee | Skill Committee 위원 | 7개 |
| executive | 경영진 | 4개 |
| employee | 구성원 | 6개 |

사이드바 상단에서 권한과 인원을 바꾸면 **메뉴·데이터 범위가 즉시 전환**됩니다.

---

## 구성원 마스터

- 정답 파일: `data/members.xlsx`
- HR팀 8명 (가상 이름) + 가상 인원 24명 + 시뮬레이션 140명 (ON/OFF 가능)
- 엑셀 직접 편집 또는 화면 내 편집 모두 지원

---

## 폴더 구조

```
SKMR_Skill_Portal/
├─ app/
│  ├─ main.py               # Streamlit 진입점 + 동적 네비게이션
│  ├─ config.py             # 경로·색상 토큰
│  ├─ theme.py              # 전역 CSS (Navy + 하늘색 디자인)
│  ├─ db.py                 # SQLite 커넥션 헬퍼
│  ├─ schema.py             # DB 10 테이블 + 멱등 마이그레이션
│  ├─ permissions.py        # 7 페르소나 × 14 메뉴 권한 매트릭스
│  ├─ persona_switch.py     # 사이드바 페르소나 전환 컴포넌트
│  ├─ assessment_logic.py   # 평가 4단계 분기 + Evidence 헬퍼
│  ├─ seed/                 # 멱등 시드 (taxonomy / members / required / profile / evidence / simulation)
│  └─ views/                # 화면 파일 14개
├─ data/
│  ├─ members.xlsx          # 구성원 마스터 (HR이 직접 편집)
│  ├─ company_logo.png      # SK 로고
│  └─ skmr.db               # SQLite DB (자동 생성, git 제외)
├─ scripts/
│  ├─ setup.bat             # 최초 환경 세팅
│  └─ run.bat               # 매번 실행
├─ .streamlit/
│  └─ config.toml           # Streamlit 서버 설정
├─ runtime.txt              # Streamlit Cloud Python 버전 지정 (3.11)
├─ requirements.txt         # 패키지 의존성
└─ 사용가이드.md
```

---

## DB 스키마 (10 테이블)

`skill_family` / `sub_skill_family` / `skill` / `level_criteria` / `member` /
`required_skill` / `skill_profile` / `assessment` / `evidence` / `evidence_skill_link`

---

## 디자인 원칙

- **주색**: Navy `#0A2147` — 헤더·강조
- **포인트**: 하늘색 `#E8F0F8` — 카드·배경
- **경고**: SK Red `#E60012` — Critical·Core 전용
- 흰색 카드 + 연한 하늘빛 페이지 배경
- 이모지 배제 / Pretendard 계열 폰트

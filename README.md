# SKMR Skill Portal

Skill 기반 인재관리 플랫폼 — 로컬 프로토타입 (Python + Streamlit + SQLite)

## 실행 방법

### 최초 1회
1. `scripts\setup.bat` 더블클릭 → 가상환경 생성 + 패키지 설치

### 매번 실행
1. `scripts\run.bat` 더블클릭 → 브라우저가 자동으로 열림
2. 종료: 검은 창에서 `Ctrl+C`

## 폴더 구조

```
SKMR_Skill_Portal/
├─ app/
│  ├─ main.py              # Streamlit 진입점
│  ├─ config.py            # 경로·색상 상수
│  ├─ theme.py             # Navy + SK Red 디자인 토큰
│  ├─ db.py                # SQLite 커넥션 헬퍼
│  ├─ schema.py            # 9개 테이블 정의 + 초기화
│  ├─ permissions.py       # 7개 페르소나 권한 매트릭스 (Step 2)
│  ├─ persona_switch.py    # 사이드바 페르소나 selectbox (Step 2)
│  ├─ seed/                # 시드 데이터 (Step 3 이후)
│  └─ pages/               # 화면 파일 (Step 3 이후)
├─ data/                   # skmr.db 저장 (자동 생성)
├─ scripts/
│  ├─ setup.bat            # 최초 환경 세팅
│  └─ run.bat              # 매번 실행
├─ reference/              # 사용자 자료
└─ requirements.txt
```

## Step 진행 현황

- [x] **Step 1** — 환경 세팅 + 프로젝트 구조 + DB 스키마 (10 테이블)
- [ ] Step 2 — 사이드바 페르소나 전환 + 권한 매트릭스
- [ ] Step 3 — Skill Master 130개 적재 + 화면
- [ ] Step 4 — Member 30명 + 관리 화면
- [ ] Step 5 — Required Skill
- [ ] Step 6 — Skill Profile
- [ ] Step 7 — Assessment 4단계
- [ ] Step 8 — Evidence
- [ ] Step 9 — Gap Analytics
- [ ] Step 10 — Dashboard
- [ ] Step 11 — 디자인 다듬기 + 바탕화면 .bat

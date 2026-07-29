# SKMR Skill Portal

**Skill 기반 인재관리 플랫폼 — HR 기획 프로토타입 + AI 인재검색 Agent**

조건 중심의 인재관리(직급·연차·자격증)에서 **Skill 중심 인재관리**로 전환하기 위한 HR 기획 프로토타입입니다.
Skill 진단·평가 워크플로와, 로컬 데이터(엑셀)를 근거로 답하는 **AI 인재검색 챗봇**을 함께 제공합니다.

> 원래 Streamlit으로 만들었던 프로토타입을 **Next.js로 전체 재구축**한 버전입니다.
> Streamlit 버전은 `app/` 폴더에 참고용으로 그대로 남아있습니다.

---

## 기술 스택

| 항목 | 내용 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) + React 19 + TypeScript |
| 스타일 | Tailwind CSS (SK Red `#EA002C` 기반 디자인 시스템) |
| 데이터베이스 | `node:sqlite` (Node 내장, 별도 설치 불필요) — **조회용 캐시** |
| 데이터 원본 | 로컬 엑셀 파일 (`web/data/*.xlsx`) — **Source of Truth** |
| AI | Gemini API (`gemini-2.5-flash`), 추후 Bedrock 전환 대비 추상화 |
| 배포 | `output: standalone` — npm install 없이 오프라인 실행 가능 |

---

## 핵심 아키텍처 원칙

**데이터의 원본(Source of Truth)은 항상 로컬 엑셀 파일이고, SQLite는 조회 성능을 위한 내부 캐시일 뿐입니다.**

- 앱 부팅 시 엑셀 내용을 SQLite에 자동 동기화
- 화면에서 수정하면 엑셀 파일에 저장 + DB도 함께 갱신
- 이유: ① 시연 시 원본 엑셀을 그대로 열어 "AI가 지어낸 데이터가 아님"을 증명 ② 담당자가 엑셀로 직접 데이터 수정 가능

```
로컬 엑셀(members.xlsx 등)  ──부팅 시 동기화──▶  SQLite 캐시  ──조회──▶  Next.js API  ──▶  화면
```

---

## 로컬 실행 방법

### 요구 사항
- Node.js 20 이상 (24+ 권장, 플래그 불필요)

### 실행
```bash
cd web
npm install
npm run build
npm start
```
브라우저에서 `http://localhost:3000` 접속

### AI 인재검색 활성화 (선택)
`web/.env.local` 파일 생성 후:
```
GEMINI_API_KEY=발급받은_키
GEMINI_MODEL=gemini-2.5-flash
```
키가 없어도 나머지 기능은 정상 동작하며, AI 챗봇만 비활성화됩니다.

### 오프라인 실행 파일 배포 시
`.next/standalone` + `data/` + `docs/` 폴더를 함께 복사해서 사용합니다.

---

## 화면 구성

```
Foundation (운영 기반)
  · 운영 정책 관리      — Family / Sub-family / Level 편집
  · Skill Library       — 134개 Skill + 4박스 상세 + CRUD
  · 구성원 Master Data  — 엑셀 다운로드/업로드 + 화면 편집
  · 필요 Skill 정의     — 전사/부서/개인 3탭 + 승인 워크플로우
  · Assessment 라인 관리 — 평가자 매핑
  · Admin 권한 관리     — Critical Skill 토글 / DB 리셋

Assessment (평가 워크플로)
  · 자가 진단 → 리더 진단 → Calibration → Narrative → Committee
  · Lv1~2: 리더 확정 / Lv3: Calibration 확정 / Lv4: Committee 확정

Reporting (결과 조회)
  · 대시보드           — 팀별 필수 Skill 보유율 · Gap
  · 최종 결과 확인      — Radar 차트 · 평가 이력
  · Talent Search      — 다중 조건 필터 인재 검색

AI
  · AI 인재검색 Agent (플로팅 챗봇) — 자연어 질문 → 근거 포함 후보 추천
```

---

## AI 인재검색 Agent 설계

```
자연어 질문
  → 의도 해석 (JSON 필터로 변환, Gemini)
  → Skill 이름 매칭 (정확/부분 일치)
  → 로컬 엑셀 데이터 검색·조합 (구성원 · 발령이력 · 평가이력 · KPI 과제 · 학력/직무)
  → 문서 RAG 결합 (docs/ 폴더, 파일 기반)
  → Grounded 검증 (pass / fail / review)
  → 근거 포함 최종 답변 생성
```

- 모든 답변은 **내부 데이터에 근거(grounded)** 하도록 설계 — 근거 없으면 결과를 `review`로 강등
- 매칭 실패 스킬은 `unresolved`로 별도 표시
- 모델 교체 대비: `web/lib/llm/provider.ts` 추상화 → Bedrock 등으로 손쉽게 전환 가능
- 외부(논문/Google Scholar 등) 조회는 개인정보 보호를 위해 **실제 API 호출 없이 검색 링크만 제공**하도록 의도적으로 제한

---

## 페르소나 (권한) 체계

| 코드 | 명칭 | 접근 범위 |
|---|---|---|
| hr_admin | HR Admin | 전체 메뉴 |
| hr_viewer | HR Viewer | 조회 중심 |
| team_leader | Team Leader | 본인 팀 범위 |
| calibration | Calibration 참여자 | 담당 범위 |
| committee | Skill Committee 위원 | 의결 관련 |
| executive | 경영진 | 요약 리포트 |
| employee | 구성원 | 본인 데이터 |

상단에서 **권한 → 사람** 2단으로 선택하면, 특정 1인이 로그인된 것처럼 메뉴·데이터 범위가 전환됩니다.

---

## 데이터 파일 (`web/data/`)

| 파일 | 내용 |
|---|---|
| `members.xlsx` | 구성원 마스터 (사번·이름·담당·팀·R/L·직책·직종·페르소나) |
| `appointments.xlsx` | 발령 이력 |
| `performance_reviews_3y.xlsx` | 3개년 평가 이력 |
| `pi_tasks_3y.xlsx` | 3개년 KPI 과제 |
| `education_job_profile.xlsx` | 학력/직무 프로필 |

전부 **더미(가상) 데이터**이며, 실제 인사 정보가 아닙니다.

---

## 폴더 구조

```
SKMR_Skill_Portal/
├─ web/                     # Next.js 앱 (현재 개발 대상)
│  ├─ app/                  # 화면 (App Router)
│  ├─ app/api/              # 서버 API 라우트
│  ├─ components/           # 공용 컴포넌트 (Shell, FloatingAssistant 등)
│  ├─ lib/                  # DB·엑셀·검색·AI 로직
│  ├─ lib/llm/              # AI Provider 추상화 (Gemini → Bedrock 전환 대비)
│  ├─ data/                 # 엑셀 원본 파일 (Source of Truth)
│  └─ docs/                 # AI RAG용 참고 문서
├─ app/                     # 원본 Streamlit 프로토타입 (참고용, 유지보수 안 함)
├─ AGENTS.md                # AI 코딩 에이전트(Codex 등) 공통 작업 규칙
├─ CLAUDE.md                # Claude Code 작업 규칙 (AGENTS.md 참조)
└─ data/members.xlsx        # Streamlit 버전용 구성원 마스터
```

---

## 협업 규칙

여러 사람/AI 에이전트가 함께 개발할 때는 **`AGENTS.md`** 를 먼저 읽어주세요.
데이터 아키텍처 원칙(엑셀=원본), xlsx 처리 시 주의사항, 커밋 컨벤션 등이 정리돼 있습니다.

---

## 디자인 원칙

- **주색**: SK Red `#EA002C`
- **포인트**: 오렌지 `#FF7A00`
- 각진(라운드 최소) 스타일, 색상만으로 상태를 전달하지 않고 항상 텍스트 라벨 동반
- 이모지 배제

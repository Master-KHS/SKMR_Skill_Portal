# SKMR Skill Agent Chatbot System

## 목적

이 챗봇은 단순 대화형 UI가 아니라 다음 2개 기능을 동시에 수행한다.

1. AI 인재검색
2. On-demand Skill Dashboard

사용자가 자연어로 질문하면 내부 Skill/Raw Data를 근거로 후보를 추천하고, 같은 질문 기준의 요약 대시보드를 함께 보여준다.

## 현재 구조

### UI

- 플로팅 진입점: `web/components/FloatingAssistant.tsx`
- API: `web/app/api/assistant/route.ts`
- 핵심 로직: `web/lib/assistant.ts`
- 응답 타입: `web/lib/assistant-types.ts`

챗봇은 전역 플로팅 컴포넌트로 동작한다.
현재는 다음을 지원한다.

- 로봇 아이콘 클릭으로 열기
- 패널 확대/축소
- 드래그로 위치 이동
- 위치 `localStorage` 저장
- 추천 후보, 요약 지표, 근거 데이터, 후속 질문 표시

## 데이터 소스

### 기본 소스

- `members.xlsx`
  - 인원 마스터 SSOT
- SQLite `skill_profile`
  - 개인 보유 Skill/Level
- SQLite `assessment`
  - 평가 이력
- SQLite `required_skill`
  - 전사/조직/개인 요구 Skill

### Raw Data

- `education_job_profile.xlsx`
- `pi_tasks_3y.xlsx`
- `performance_reviews_3y.xlsx`
- `appointments.xlsx`

### 현재 제외

- 외부 논문 검색
- Google Scholar 기반 실시간 근거
- 사용자 미정의 AI raw data 스키마

위 항목은 사용자가 별도 정의를 주기 전까지 구현하지 않는다.

## 검색/추천 규칙

`web/lib/assistant.ts` 기준:

- `job_type === "경영"` 구성원은 제외
- 질문에서 Skill 키워드, 팀, 담당, 직책, R/L을 파싱
- `skill_profile`의 현재 Level을 우선 반영
- KPI 과제, 학력/직무, 최근 평가/발령 데이터를 보조 근거로 사용
- 결과는 점수순 정렬

응답에는 다음이 포함된다.

- `answer`
- `filters`
- `results`
- `docEvidence`
- `dataSlots`
- `followUpSuggestions`
- `dashboard`

## On-demand Dashboard 구성

질문 1건마다 아래 항목을 즉시 생성한다.

- 추천 후보 수
- 후보 평균 Level
- KPI 과제 근거 수
- 팀별 후보 평균 Level
- 상위 후보 요약
- 적용 조건
- 추천 기준
- 주의 문구

## 권한/범위 원칙

- 챗봇 UI는 전역 노출
- 실제 데이터 범위 제한은 API/서버 규칙을 우선
- 인재검색 raw data 스키마는 임의로 확장하지 않음

## 남은 보완 과제

1. 질문 의도 파싱 정밀도 보강
2. Skill 설명/사전 연결
3. 조직/직무별 추천 근거 템플릿 정교화
4. 외부 근거 연동 정의 수신 후 확장
5. 결과 export 또는 후보 비교표 UX 보강

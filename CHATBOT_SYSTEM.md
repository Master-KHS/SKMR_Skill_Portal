# SKMR Skill Agent System

## 1. 목적

이 Agent는 단순 챗봇이 아니라 아래 2가지를 동시에 수행한다.

1. AI 인재검색
2. On-demand Skill Dashboard

사용자가 자연어로 질문하면 내부 Skill/Profile/Raw Data를 근거로 후보를 추천하고,
같은 질문 기준의 요약 대시보드를 즉시 함께 보여준다.

핵심 목적은 다음과 같다.

- 현재 보유 정보와 Skill 진단 결과만으로도 인재 검색이 가능해야 한다.
- 적재적소 배치 후보를 빠르게 찾을 수 있어야 한다.
- 개인/조직의 육성 포인트를 바로 확인할 수 있어야 한다.
- 향후 Skill 진단 제도 도입 전에 운영 흐름을 미리 구현하고 정착 시행착오를 줄여야 한다.

## 2. 구성

### UI

- 메인 진입: `web/components/FloatingAssistant.tsx`
- API: `web/app/api/assistant/route.ts`
- 핵심 로직: `web/lib/assistant.ts`
- 응답 타입: `web/lib/assistant-types.ts`

### UI 동작 원칙

- 우하단 로봇 아이콘 클릭 시 Agent 패널 오픈
- 로봇 아이콘은 투명 배경 이미지 사용
- 로봇 아이콘은 드래그로 위치 이동 가능
- 위치는 `localStorage`에 저장
- 질문 즉시 추천 결과, 요약, 근거, 후속 질문을 함께 표시
- 개인 조회 시 `Skill 요약` / `논문/학력 데이터` 탭 분리

## 3. 데이터 소스

### SSOT / 운영 데이터

- `web/data/members.xlsx`
  - 구성원 마스터 SSOT
- SQLite `member`
- SQLite `skill`
- SQLite `skill_profile`
- SQLite `required_skill`
- SQLite `assessment` 계열 데이터

### Raw Data

- `education_job_profile.xlsx`
  - 직무, 학력, 학교, 전공
- `pi_tasks_3y.xlsx`
  - 최근 3개년 KPI 과제
- `performance_reviews_3y.xlsx`
  - 최근 3개년 평가
- `appointments.xlsx`
  - 발령/이동 이력

### 원칙

- `members.xlsx`만 구성원 마스터 SSOT로 사용한다.
- 운영 테이블은 SQLite를 유지한다.
- AI raw schema는 사용자가 별도 정의하기 전까지 임의 확장하지 않는다.
- 외부 논문/Google Scholar 실검색 결과는 현재 기본 응답에 포함하지 않는다.

## 4. 검색/추천 규칙

### 기본 규칙

- `job_type === "경영"` 구성원은 추천 후보에서 제외
- Skill/Profile/Raw Data를 함께 사용
- 점수는 아래 요소를 합산해 계산
  - Skill 직접 매칭
  - KPI 과제 키워드 매칭
  - 직무/학력 키워드 매칭
  - 보유 Skill 평균 Level
  - 일부 핵심 인물 키워드 보정

### 질문 해석 규칙

질문에서 다음을 파싱한다.

- 구성원 이름
- 담당
- 팀
- 직종
- 직책
- R/L 직접 지정
- Skill 키워드
- 주니어/시니어 조건

### 현재 반영된 키워드 규칙

- `주니어` / `junior`
  - `L4 이하`
- `시니어` / `senior`
  - `L5 이상`
- `씬필름` / `thin film` / `thinfilm` / `박막`
  - `Photo`, `Photo Resist`, `Litho`, `Thickness`, `Film`, `Coating` 계열로 확장
- `Photo / Resist / Litho / PR / KrF`
  - Photo 평가/공정 계열 Skill 및 KPI와 연결
- `OLED / Blue / Dopant / TADF`
  - OLED/Blue Dopant 계열 Skill 및 KPI와 연결
- `GC / LC / HPLC / 분석`
  - 분석 계열 Skill과 연결

## 5. 임가영/김선재 처리 원칙

### 임가영

임가영은 다음 근거로 검색/추천에 걸릴 수 있다.

- `L3`라서 주니어 조건 충족
- `Photo 공정 평가 운영` 등 Skill Profile 보유
- `Photo Resist`, `Litho`, `Thickness` 관련 KPI 과제 존재
- 직무가 `소재평가`

즉 `씬필름 주니어 인력 추천` 같은 질문에서
박막/Photo 계열 키워드와 주니어 조건이 같이 해석되면 상위 후보로 노출될 수 있어야 한다.

### 김선재

김선재는 OLED/Blue Dopant 계열 키워드에서 강한 후보로 취급한다.

## 6. 개인 조회 응답 원칙

개인 조회는 추천 답변이 아니라 `구성원 Skill 요약`으로 응답한다.

포함 항목:

- 대상자 기본 정보
- 직무/학력
- 보유 Skill 개수
- 평균 Skill Level
- 상위 Skill
- 보유 Skill 전체 리스트
- 평가 흐름
- 최근 발령
- 강점 해석

### 금지/제외

- 개인 조회 메인 답변에 KPI 과제를 핵심 답변으로 전면 배치하지 않는다.
- `임가영, 김선재를 제외한 후보는...` 같은 전역 경고 문구를 메인 답변에 넣지 않는다.

### 논문/학력 데이터 탭

개인 조회에서는 별도 탭으로 `논문/학력 데이터`를 제공한다.

포함 항목:

- 이름
- 직무
- 최종학력
- 학교
- 전공
- 학술/외부 근거 안내 문구

안내 문구 원칙:

- 전역 공통 경고로 뿌리지 않는다.
- 개인 탭 안에서만 보여준다.
- 실명/학교명 매칭이 제한적이면 그 후보에 대해서만 설명한다.
- 외부 논문 근거는 실제 외부 검색 연동 시에만 확정 근거로 사용한다.

## 7. 추천 답변 원칙

추천 답변 기본 구조:

1. 검색 해석
2. 추천 후보
3. Gemini 보강

후보별 근거는 아래를 사용한다.

- Skill 근거
- KPI 과제 근거
- 평가 흐름
- 발령 이력
- 필요 시 직무/학력 근거

### 하지 말아야 할 것

- 모든 후보에 동일한 학술 제한 경고를 붙이지 않는다.
- 논문 데이터가 없는 후보를 전체 답변 수준에서 불리하게 만들지 않는다.
- 논문/학력 데이터는 후보별 또는 개인 탭 기준으로만 설명한다.

## 8. On-demand Dashboard

질문 1건마다 아래 대시보드를 즉시 생성한다.

- 추천 후보 수 또는 조회 대상 수
- 후보 평균 Level
- KPI 과제 근거 수
- 팀별 후보 평균 Level
- 상위 후보 요약
- 적용 조건
- 추천 기준

개인 조회인 경우:

- `구성원 Skill 요약` 제목 사용
- `조회 대상 1명` 기준 KPI/Level 요약
- 학력/논문 정보는 별도 탭으로 분리

## 9. Gemini / 외부 보강 원칙

- Gemini는 보조 요약 역할만 수행한다.
- 실제 외부 논문/Google Scholar를 확인하지 않았으면 확인한 것처럼 말하지 않는다.
- 내부 Raw Data와 Skill Profile이 기본 근거다.
- 외부 보강 실패, quota 초과, auth 실패 시에도 내부 추천은 정상 동작해야 한다.

## 10. 구현 원칙

- UI 제한만 두지 말고 서버/API 로직 기준으로 동작시킨다.
- 추천 조건은 문자열 표시가 아니라 실제 필터와 점수에 반영되어야 한다.
- 사용자 표현과 시스템 내부 조건이 일치해야 한다.
  - 예: `주니어 = L4 이하`
  - 예: `씬필름 = 박막/Photo 계열 키워드`
- 개인 조회와 추천 답변의 목적을 섞지 않는다.
- 메인 답변은 간결하게 유지하고, 세부 학술/학력 설명은 전용 탭으로 분리한다.

## 11. 현재 남은 보완 과제

1. `논문/학력 데이터` 탭을 실제 논문 메타데이터까지 확장
2. 외부 논문/Google Scholar 실연동 여부를 사용자 승인 기반으로 정리
3. Skill 설명/사전 연결 강화
4. 후보 비교표 / 결과 export UX 보강
5. 조직/직무별 추천 근거 템플릿 정교화

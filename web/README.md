# SKMR Skill Portal — Web (Next.js)

기존 Streamlit 프로토타입(`../app`)을 Next.js로 이식하는 작업의 기반입니다.
기존 Streamlit 버전은 그대로 보존됩니다.

## 실행

```bash
cd web
npm install
cp .env.local.example .env.local   # GEMINI_API_KEY 입력
npm run dev                          # http://localhost:3000
```

Gemini API 키는 [Google AI Studio](https://aistudio.google.com/apikey)에서 무료 발급.

## 구조

- `app/` — App Router 페이지 + API 라우트
  - `dashboard/` 진단 결과 확인 (완성)
  - `talent-search/` 다중 조건 인재 검색 (완성)
  - `assistant/` **AI 인재 검색 챗봇** (완성, Gemini 연동)
  - `[...slug]/` 아직 이식 안 된 메뉴용 플레이스홀더
  - `api/search`, `api/assistant` — 검색/챗봇 백엔드
- `lib/`
  - `data.ts` 시드 데이터 접근점 (현재 `data/seed.json`)
  - `search.ts` 인재 검색 엔진 (화면·챗봇 공유)
  - `nav.ts` 메뉴 + 페르소나 권한 매트릭스
  - `llm/` **LLM 추상화** — 현재 Gemini, 추후 Bedrock 전환 시 `provider.ts` 한 줄만 변경
- `data/seed.json` — 기존 Streamlit DB에서 추출한 더미 데이터

## 디자인

- SK Red `#EA002C` 기반 의미 색상 (색만으로 상태 전달하지 않고 텍스트 라벨 동반)
- 각진(라운드 없는) 깔끔한 형태 — `tailwind.config.ts` 토큰에서 일괄 관리

## AI 인재 검색 동작 (하이브리드 RAG)

1. Gemini가 자연어 질문 → 검색 조건(JSON)으로 해석 (스킬 카탈로그로 그라운딩)
2. 서버가 로컬 데이터에서 실제 검색 수행 — **개인 데이터는 LLM으로 넘기지 않고 코드로 처리**
3. Gemini가 검색 결과만 근거로 자연어 요약 (출처 = 사번/이름, 검증 결과 Pass/Fail/확인필요)

## 이식 현황

완성: 대시보드 · Talent Search · AI 인재 검색
이식 예정: 운영 정책, Skill Library, 자가/리더 진단, Calibration, Narrative, Committee 등

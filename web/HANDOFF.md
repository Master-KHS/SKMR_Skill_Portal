# SKMR Skill Portal (Next.js) — 개발 인수인계 노트

이 문서는 새 대화/새 도구(Codex 등)에서 이어서 개발할 때 빠르게 파악하기 위한 요약입니다.

## 저장 위치
- GitHub: `Master-KHS/SKMR_Skill_Portal`
- 브랜치: `claude/skmr-hr-planning-nmgtpl`
- 앱 경로: `web/` (Next.js). 원래 Streamlit 앱은 `app/`에 그대로 보존(삭제 안 됨).

## 핵심 아키텍처 원칙 (중요 — 반드시 지킬 것)

**데이터의 원본(Single Source of Truth)은 항상 로컬 엑셀 파일이고, SQLite는 조회 성능을 위한 내부 캐시일 뿐이다.**

이유:
1. 시연 시 "이게 진짜 원본 데이터"임을 엑셀 파일을 직접 열어 보여줄 수 있어야 함 (AI가 임의로 만든 더미가 아님을 증명)
2. 사용자가 엑셀에서 직접 값을 고칠 수 있어야 함 (앱/AI를 통하지 않고도)
3. SQLite는 여러 테이블 조인·빠른 조회를 위한 내부 구현일 뿐, 사람이 직접 들여다볼 대상이 아님

이미 구현된 예시: **`data/members.xlsx`** (구성원 마스터, 92명)
- `lib/members-xlsx.ts`: 순수 파일 I/O (읽기/쓰기), DB에 의존하지 않음
- `lib/db.ts`의 `applyMembersToDb()` / `syncMembersToDb()`: 엑셀 내용을 SQLite `member` 테이블에 반영
- `app/api/members/route.ts`: GET은 엑셀을 읽어 반환(+DB 동기화), POST는 화면 수정분을 엑셀 저장 + DB 동기화 모두 수행
- 앱 부팅 시(`getDb()` 내부) 엑셀이 있으면 자동으로 DB에 동기화됨

**⚠️ xlsx 라이브러리 주의사항**: `XLSX.readFile()` / `XLSX.writeFile()`을 Next.js standalone 번들에서 쓰면 내부 fs 감지가 깨져 `"Cannot access file"` 오류가 남. 반드시 `fs.readFileSync()` + `XLSX.read(buf, {type:"buffer"})`, `XLSX.write(wb, {type:"buffer"})` + `fs.writeFileSync()` 방식으로 우회할 것 (이미 `lib/members-xlsx.ts`, `lib/docs.ts`에 적용됨).

## 다음에 같은 패턴으로 추가해야 할 것 (형식 미확정 — 사용자가 컬럼 구조를 지정할 예정)

- `data/발령이력.xlsx` (또는 `appointments.xlsx`) — 인재검색 추천 근거용
- `data/평가이력.xlsx` — 인재검색/대시보드 근거용
- 각각 `lib/<name>-xlsx.ts` 로 동일 패턴 구현:
  - `read...FromXlsx()`, `write...ToXlsx()` (fs+버퍼 방식)
  - `lib/db.ts`에 해당 테이블 스키마 추가 + `applyXxxToDb()` 함수
  - `app/api/<name>/route.ts` GET/POST

**주의**: 사용자가 "형식은 내가 정한다"고 명시함 — 컬럼 구조를 임의로 추측해서 만들지 말고, 반드시 사용자에게 정확한 컬럼명/구조를 먼저 물어볼 것.

## AI 인재검색 관련
- 현재: `app/assistant/` — Gemini 연동, 브라우저에서 직접 API 호출(서버 아웃바운드 문제 우회)
- 목표: "SKILL 챗봇"으로 확장 — 인재 검색 + 스킬 설명 + 추천(발령이력+현재직무+보유스킬 근거) + 우하단 플로팅 UI
- `lib/docs.ts`: `docs/` 폴더의 txt/md/csv/xlsx 파일을 키워드 검색하는 파일 기반 RAG (이미 구현됨, 활용 가능)
- 아직 미완성: 발령이력/평가이력 엑셀을 추천 로직에 연결하는 부분 (형식 확정 후 진행)

## 실행 방법 (로컬 검증용)
```bash
cd web
export NODE_OPTIONS=--experimental-sqlite   # Node 20/22일 때만 필요 (Node 24+는 불필요)
npm run build
npm start   # 또는 standalone 빌드(.next/standalone) 를 패키징해 node server.js
```
- `GEMINI_API_KEY` 환경변수로 AI 인재검색 활성화 (없으면 해당 기능만 비활성)
- 배포용 실행 파일 패키징 시 `.next/standalone` + `data/members.xlsx` + `docs/` 폴더를 함께 복사해야 함

## 완성된 화면 (14개, 원본 Streamlit 기능 이식 완료)
대시보드(리치), Skill Library(CRUD), 구성원 Master Data(CRUD+엑셀), 필요Skill정의(3탭 CRUD),
운영정책(편집), 자가진단, 리더진단, Calibration, Committee, Narrative, 최종결과확인(Radar/Gap/이력),
Talent Search, AI 인재검색, Admin 권한관리, Assessment 라인관리

## 디자인
- SK Red(`#EA002C`) 기반 의미색상, 각진(라운드 없음) 스타일
- `tailwind.config.ts`에 토큰 정의

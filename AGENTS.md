# AGENTS.md — SKMR Skill Portal 공통 작업 규칙

> 이 파일은 **모든 AI 코딩 에이전트(OpenAI Codex, Claude Code 등)**가 공통으로 따르는 규칙입니다.
> Codex는 oh-my-codex가 이 파일을 읽고, Claude Code는 CLAUDE.md(이 파일 미러)를 읽습니다.
> **두 도구가 하나의 GitHub 저장소를 함께 사용하므로, 아래 협업 규칙을 반드시 지킵니다.**

## 0. 프로젝트 개요
- 저장소: `Master-KHS/SKMR_Skill_Portal`
- 개발 대상: **`web/` 폴더의 Next.js 앱** (원래 Streamlit 앱 `app/`은 참고용으로 보존, 건드리지 않음)
- 목적: SK머티리얼즈 Skill 진단/평가 포탈 시연용. 원본 Streamlit 기능을 Next.js로 100% 이식 + 깔끔한 디자인.

## 1. 협업 규칙 (충돌 방지 — 가장 중요)

두 에이전트가 동시에 하나의 저장소에서 작업하므로 다음을 지킨다.

1. **작업 시작 전 반드시 최신화**: `git fetch origin && git pull --ff-only` (또는 rebase).
2. **작은 단위로 자주 커밋·푸시**. 큰 덩어리로 오래 들고 있지 말 것 (충돌 위험 증가).
3. **커밋 메시지 접두사로 작성 주체를 표시**:
   - Claude: `feat(web): ...` 처럼 일반 접두사 + 본문에 `[claude]`
   - Codex: 본문에 `[codex]`
   (누가 뭘 했는지 이력에서 구분되도록)
4. **같은 파일을 동시에 대규모로 고치지 않는다.** 작업 전 이 파일의 "현재 담당" 섹션(§7)을 확인/갱신.
5. **푸시 전 항상 빌드 통과 확인**: `cd web && npm run build`. 깨진 상태로 푸시 금지.
6. **충돌 발생 시**: 임의로 한쪽을 버리지 말고, 양쪽 의도를 보존하는 방향으로 병합. 애매하면 사용자에게 질문.
7. 브랜치: 현재는 `claude/skmr-hr-planning-nmgtpl` 공용. 큰 실험은 별도 브랜치 후 PR.

## 2. 아키텍처 원칙 (반드시 준수)

- **데이터 원본(SoT)은 로컬 엑셀 파일**, SQLite는 조회용 내부 캐시일 뿐이다.
  - 구성원: `web/data/members.xlsx` (이미 구현). 발령이력·평가이력도 같은 패턴으로 확장.
  - 이유: 시연 시 원본 엑셀을 열어 "AI가 지어낸 게 아니라 원본 형식"임을 증명 + 사용자가 엑셀로 직접 수정 가능.
- **DB**: Node 내장 `node:sqlite` 사용 (네이티브 빌드 불필요). `web/lib/db.ts` 참조.
  - Node 24+는 플래그 불필요, Node 20/22는 `--experimental-sqlite` 필요.
- **LLM(AI 인재검색/챗봇)**: 현재 Gemini. 브라우저에서 직접 호출(사내망/서버 아웃바운드 이슈 우회). 추후 Bedrock 전환 대비해 `lib/llm/` 추상화 유지.
- **문서 RAG**: `web/docs/` 폴더의 txt/md/csv/xlsx를 실행 중 읽어 검색 (`lib/docs.ts`).

## 3. xlsx 라이브러리 주의 (중요 버그)
- Next.js standalone 번들에서 `XLSX.readFile()`/`XLSX.writeFile()`는 내부 fs 감지가 깨져 오류.
- **반드시** `fs.readFileSync` + `XLSX.read(buf, {type:"buffer"})`, `XLSX.write(wb,{type:"buffer"})` + `fs.writeFileSync` 사용.

## 4. 코딩 컨벤션
- **원본 기능을 임의로 축약하지 않는다.** Streamlit 원본(`app/views/*.py`)에 있는 기능은 전부 이식한다. 불확실하면 원본을 먼저 읽는다.
- **더미 데이터/형식을 임의로 만들지 않는다.** 발령이력·직무·평가이력 등의 형식은 사용자가 지정. 추측 금지, 먼저 질문.
- 디자인: SK Red(`#EA002C`) 기반 의미색상, 각진(라운드 최소) 스타일. `web/tailwind.config.ts` 토큰 사용. 색상만으로 상태 전달 금지 — 텍스트 라벨 동반.
- TypeScript strict. 빌드 경고/에러 남기지 않기.
- 주석·UI 텍스트는 한국어 기준(코드 식별자는 영어).

## 5. 페르소나 규칙 (원본 동일)
- 상단 "권한 → 사람" 2단 선택 = 특정 1인이 로그인된 것처럼 동작.
- employee: 본인만 / team_leader: 본인 팀 / calibration: 본인 담당 / hr_admin 등: 운영용 자유 선택.
- 각 화면이 독립적으로 "전체 인원 드롭다운"을 붙이지 말 것 (정체성 시스템 깨짐).

## 6. 실행/빌드
```bash
cd web
# Node 20/22: export NODE_OPTIONS=--experimental-sqlite
npm install
npm run build
npm start            # 또는 standalone: node .next/standalone/server.js
```
- 배포 패키징 시 `.next/standalone` + `data/members.xlsx` + `docs/` 함께 복사.
- 실행 런처: `web/run-server.bat` / standalone의 `시작-START.bat` (bat은 ASCII+CRLF, 괄호 이스케이프 주의).

## 7. 현재 작업 담당 (작업 시작/종료 시 갱신)
> 겹침 방지용. 자기가 만지는 영역을 여기 적고, 끝나면 지운다.

- (예) Claude: 페르소나/평가 워크플로우 화면
- (예) Codex: AI 어시스턴트/talent-search

## 8. 완성 현황 (참고)
14개 화면 이식 완료: 대시보드, Skill Library(CRUD), 구성원 Master Data(엑셀 SoT+CRUD),
필요 Skill 정의(3탭 CRUD), 운영 정책(편집), 자가진단, 리더진단, Calibration, Committee,
Narrative(Lv4 후보), 최종 결과 확인(Radar/Gap/이력), Talent Search, AI 인재검색, Admin 권한.

미완/진행중: 발령이력·평가이력 엑셀 연결(형식 대기), AI 챗봇 고도화(RAG), 세부 원본 대조.

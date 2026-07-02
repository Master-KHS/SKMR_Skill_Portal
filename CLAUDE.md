# CLAUDE.md — Claude Code 작업 규칙

> 이 프로젝트의 모든 공통 규칙은 **[AGENTS.md](./AGENTS.md)** 에 있습니다.
> Claude Code는 이 파일을, Codex(oh-my-codex)는 AGENTS.md를 각각 진입점으로 읽지만,
> **내용은 AGENTS.md 하나가 원본(Single Source of Truth)** 입니다.
> 규칙이 바뀌면 **AGENTS.md만** 수정하세요. 이 파일은 포인터입니다.

## 반드시 먼저 읽기
**→ [AGENTS.md](./AGENTS.md) 전체를 읽고 그대로 따른다.**

핵심만 다시 강조 (자세한 내용은 AGENTS.md):

1. **협업 (충돌 방지)**: 작업 전 `git fetch origin && git pull --ff-only`.
   작은 단위로 자주 커밋·푸시. 커밋 본문에 `[claude]` 표시.
   같은 파일을 Codex와 동시에 대규모로 고치지 말 것. AGENTS.md §7 "현재 작업 담당" 확인·갱신.
2. **데이터 원본은 로컬 엑셀**(`web/data/members.xlsx`), SQLite는 캐시. `syncMembersToDb()`로 부팅 시 반영.
3. **xlsx는 반드시 buffer 방식** (`fs.readFileSync` + `XLSX.read(buf,{type:"buffer"})`). `readFile/writeFile` 금지.
4. **원본 기능 축약 금지, 형식 임의 생성 금지.** 불확실하면 원본(`app/views/*.py`) 읽거나 사용자에게 질문.
5. **푸시 전 `cd web && npm run build` 통과 확인.**
6. 디자인: SK Red `#EA002C` 기반, 각진 스타일, 색상엔 항상 텍스트 라벨 동반.
7. 페르소나 2단(권한→사람) 정체성 시스템 유지. 화면마다 전체 인원 드롭다운 붙이지 말 것.

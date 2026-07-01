SKMR Skill Portal - Server Mode (local SQLite, data persists)
=============================================================

WHAT
  Full Next.js app with a local SQLite database (data/skmr.db).
  Everything you enter (self-assessment, leader/calibration/committee,
  narrative) is saved permanently to the local .db file - just like the
  Streamlit local version.

REQUIREMENTS
  - Node.js 24+ (uses built-in node:sqlite - no native build, no compiler needed).
    (Node 20/22 also OK if started with --experimental-sqlite.)
  - Python NOT required in this mode.
  - No native modules -> npm install will not try to compile anything.

WINDOWS - HOW TO RUN
  1) Unzip. You will see 'run-server.bat' and the project files.
  2) Double-click 'run-server.bat'.
     - First run: it installs packages and builds (a few minutes). Please wait.
     - Later runs: starts immediately.
  3) Browser opens at http://localhost:3000/
  4) To stop: close the black window.

RESET DATA
  - To start fresh, delete the file  data/skmr.db  and run again.
    It will re-seed from the built-in demo data.

AI TALENT SEARCH
  - Uses Gemini (key is in .env.local, kept server-side / not exposed to browser).
  - Model: gemini-2.5-flash. Internet required for AI calls.
  - After the demo, delete the key at https://aistudio.google.com/apikey

SCREENS (all working)
  Foundation : 운영 정책 관리, Skill Library, 구성원 Master Data,
               Assessment 라인 관리, Admin 권한 관리
  Assessment : 필요 Skill 정의, 자가 진단, 리더 진단, Calibration,
               Narrative 작성, Committee, 최종 결과 확인
  Reporting  : 진단 결과 확인, Talent Search, AI 인재 검색

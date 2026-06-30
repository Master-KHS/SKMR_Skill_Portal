#!/bin/bash
# SKMR Skill Portal (Next.js 정적 빌드) - Mac 로컬 실행 런처
# 더블클릭하면 브라우저가 자동으로 열립니다. (Python 필요 — Mac엔 기본 내장)
cd "$(dirname "$0")/out" || { echo "out 폴더를 찾을 수 없습니다."; exit 1; }
PORT=8765
echo "SKMR Skill Portal 실행 중... http://localhost:$PORT/  (종료: Ctrl+C)"
( sleep 1; open "http://localhost:$PORT/" ) &
python3 -m http.server $PORT

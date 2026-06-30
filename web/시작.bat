@echo off
REM SKMR Skill Portal (Next.js 정적 빌드) - 로컬 실행 런처
REM Python만 있으면 동작 (Node 불필요). 더블클릭하면 브라우저가 자동으로 열립니다.
chcp 65001 >nul
cd /d "%~dp0out"

if not exist "index.html" (
    echo [오류] out 폴더를 찾을 수 없습니다. 이 파일은 out 폴더와 같은 위치에 두세요.
    pause
    exit /b 1
)

set PORT=8765

echo ================================================
echo  SKMR Skill Portal 실행 중...
echo  브라우저가 자동으로 열립니다.
echo  주소: http://localhost:%PORT%/
echo  종료하려면 이 창에서 Ctrl+C 를 누르세요.
echo ================================================

start "" http://localhost:%PORT%/

where python >nul 2>&1
if %errorlevel%==0 (
    python -m http.server %PORT%
) else (
    where py >nul 2>&1
    if %errorlevel%==0 (
        py -m http.server %PORT%
    ) else (
        echo [오류] Python을 찾을 수 없습니다. python.org 에서 설치 후 다시 실행하세요.
        pause
    )
)

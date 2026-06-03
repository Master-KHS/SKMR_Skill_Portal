@echo off
REM SKMR Skill Portal - launch (double-click every time). Browser opens automatically.
setlocal
cd /d "%~dp0\.."

if not exist ".venv\Scripts\activate.bat" (
    echo [INFO] .venv not found. Run setup.bat first.
    pause
    exit /b 1
)

call ".venv\Scripts\activate.bat"

echo ================================================
echo  Launching SKMR Skill Portal...
echo  Your browser will open automatically.
echo  To stop: press Ctrl+C in this window.
echo ================================================

streamlit run app\main.py --server.headless false

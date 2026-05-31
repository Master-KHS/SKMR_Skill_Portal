@echo off
REM SKMR Skill Portal - first-time setup (venv + packages). Run once.
setlocal
cd /d "%~dp0\.."

echo ================================================
echo  SKMR Skill Portal - Setup Start
echo ================================================

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10+ from python.org first.
    pause
    exit /b 1
)

if not exist ".venv" (
    echo [1/3] Creating virtual environment .venv ...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create venv
        pause
        exit /b 1
    )
) else (
    echo [1/3] .venv already exists - skipping
)

echo [2/3] Upgrading pip ...
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip --quiet

echo [3/3] Installing packages (streamlit, pandas, plotly) ...
python -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Package install failed
    pause
    exit /b 1
)

echo.
echo ================================================
echo  Setup complete!
echo  Now double-click scripts\run.bat to launch.
echo ================================================
pause

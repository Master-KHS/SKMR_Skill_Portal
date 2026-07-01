@echo off
cd /d "%~dp0"
setlocal

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is required. Install it first.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\next.cmd" (
  echo Installing packages...
  call npm install --no-audit --no-fund
)

if not exist "node_modules\.bin\next.cmd" (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

set "PORT=3000"
set "EXISTING_APP="
for /f %%V in ('powershell -NoProfile -Command "$busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($busy) { try { $resp = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/ -TimeoutSec 3; if ($resp.StatusCode -eq 200) { '1' } } catch {} }"') do set "EXISTING_APP=%%V"

if "%EXISTING_APP%"=="1" (
  echo Existing SKMR Skill Agent instance detected at http://localhost:3000/
  start "" http://localhost:3000/
  exit /b 0
)

for /f %%P in ('powershell -NoProfile -Command "$port=3000; while (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { $port++ }; Write-Output $port"') do set "PORT=%%P"

if not "%PORT%"=="3000" (
  echo Port 3000 is already in use. Starting on port %PORT% instead.
)

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 6; Start-Process 'http://localhost:%PORT%/'"

echo ================================================
echo  SKMR Skill Agent running at http://localhost:%PORT%/
echo  mode: dev
echo  source: %CD%
echo  close this window to stop
echo ================================================

set CHOKIDAR_USEPOLLING=1
set WATCHPACK_POLLING=true
call npm run dev -- --hostname 0.0.0.0 --port %PORT%

pause

@echo off
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 ( echo [ERROR] Node.js required. Install from nodejs.org & pause & exit /b 1 )

echo Node version:
node -v
echo npm version:
call npm -v

if exist "node_modules\.bin\next.cmd" goto haveinstall

echo.
echo Installing packages (first run, may take a few minutes)...
call npm install --no-audit --no-fund
if exist "node_modules\.bin\next.cmd" goto haveinstall

echo.
echo First install failed. Cleaning cache and retrying...
call npm cache clean --force
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
call npm install --no-audit --no-fund

:haveinstall
if not exist "node_modules\.bin\next.cmd" (
  echo.
  echo [ERROR] Package install failed. Please copy the messages above and send them.
  pause
  exit /b 1
)

if not exist ".next" (
  echo.
  echo Building app, please wait...
  call npm run build
)

start "" cmd /c "timeout /t 6 >nul & start \"\" http://localhost:3000/"
echo.
echo ================================================
echo  SKMR Skill Portal running at http://localhost:3000/
echo  (close this window to stop)
echo ================================================
call npm run start
pause

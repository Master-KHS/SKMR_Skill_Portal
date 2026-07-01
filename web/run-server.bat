@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 ( echo [ERROR] Node.js required. Install from nodejs.org & pause & exit /b 1 )
if not exist node_modules ( echo Installing packages, please wait... & call npm install )
if not exist .next ( echo Building app, please wait... & call npm run build )
start "" cmd /c "timeout /t 6 >nul & start \"\" http://localhost:3000/"
echo SKMR Skill Portal running at http://localhost:3000/  (close window to stop)
call npm run start
pause

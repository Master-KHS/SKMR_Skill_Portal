@echo off
cd /d "%~dp0out"
start "" cmd /c "timeout /t 2 >nul & start "" http://localhost:8765/"
echo SKMR Skill Portal running... http://localhost:8765/  (close window to stop)
python -m http.server 8765 || py -m http.server 8765
pause

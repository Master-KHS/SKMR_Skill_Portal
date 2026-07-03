@echo off
cd /d "%~dp0"
setlocal

set "TARGET=http://127.0.0.1:3000"
set "CLOUDFLARED_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe"

echo ================================================
echo  SKMR Skill Agent tunnel launcher
echo  target: %TARGET%
echo ================================================

if exist "%CLOUDFLARED_EXE%" (
  echo cloudflared detected.
  echo Starting public tunnel...
  echo Share the https://*.trycloudflare.com URL shown below.
  "%CLOUDFLARED_EXE%" tunnel --url %TARGET%
  goto :eof
)

where cloudflared >nul 2>&1
if not errorlevel 1 (
  echo cloudflared detected.
  echo Starting public tunnel...
  echo Share the https://*.trycloudflare.com URL shown below.
  cloudflared tunnel --url %TARGET%
  goto :eof
)

where ngrok >nul 2>&1
if not errorlevel 1 (
  echo ngrok detected.
  echo Starting public tunnel...
  echo Share the forwarding URL shown below.
  ngrok http 3000
  goto :eof
)

echo [INFO] cloudflared or ngrok is not installed.
echo.
echo Option 1: install cloudflared
echo   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
echo.
echo Option 2: install ngrok
echo   https://ngrok.com/download
echo.
echo After installation, run this file again.
pause

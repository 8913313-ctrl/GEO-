@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1"
if errorlevel 1 pause & exit /b 1
start "" powershell -NoProfile -WindowStyle Hidden -File "%~dp0run-agent.ps1"
endlocal

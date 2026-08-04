@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\express" goto install
if not exist ".data\config.json" goto install
goto start

:install
  powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"
  if errorlevel 1 pause & exit /b 1

:start
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0run-agent.ps1"
exit /b %errorlevel%

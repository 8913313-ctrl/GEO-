@echo off
setlocal
cd /d "%~dp0"
if "%PUBLISHER_PORT%"=="" set "PUBLISHER_PORT=18180"
if not exist ".data" mkdir ".data"

:watch
  netstat -ano | findstr /R /C:":%PUBLISHER_PORT% .*LISTENING" >nul
  if not errorlevel 1 (
    timeout /t 5 /nobreak >nul
    goto watch
  )

  "C:\Program Files\nodejs\node.exe" "%~dp0server.mjs" >> "%~dp0.data\service.stdout.log" 2>> "%~dp0.data\service.stderr.log"
  timeout /t 3 /nobreak >nul
  goto watch

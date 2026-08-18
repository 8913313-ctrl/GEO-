@echo off
setlocal
cd /d "%~dp0"
echo.
echo ========================================
echo   桐灼 GEO 本地发布器一键安装
echo ========================================
echo.
where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo 未找到 Windows PowerShell，请联系管理员处理。
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-desktop.ps1" -InstallAutostart -StartAfterInstall
if errorlevel 1 (
  echo.
  echo 安装失败，请截图此窗口内容发给实施人员。
  pause
  exit /b 1
)
echo.
echo 安装完成，发布器已在后台运行。
echo 后台地址：http://127.0.0.1:19380
pause
endlocal

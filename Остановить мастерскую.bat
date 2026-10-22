@echo off
chcp 65001 >nul
rem ═══════════════════════════════════════════════════════════════════
rem  Остановка «Мастерской» (Windows).
rem ═══════════════════════════════════════════════════════════════════
cd /d "%~dp0"

set "PATH=%CD%\.node;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Не найден Node.js 20 или новее.
  echo Закройте окно приложения вручную и запустите эту программу ещё раз.
  echo.
  pause
  exit /b 1
)

node scripts\stop.mjs
echo.
pause

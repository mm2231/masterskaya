@echo off
chcp 65001 >nul
rem ═══════════════════════════════════════════════════════════════════
rem  Запуск «Мастерской» двойным щелчком (Windows).
rem
rem  Сервер поднимается в фоне, браузер открывается сам.
rem  Если не запустилось — в этом окне будет причина и журнал.
rem ═══════════════════════════════════════════════════════════════════
cd /d "%~dp0"

rem ── Node.js ─────────────────────────────────────────────────────────────
rem Локальная копия в .\.node (её ставит install.cmd) — в приоритете.
set "PATH=%CD%\.node;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Не найден Node.js 22 или новее.
  echo.
  echo Запустите в этой папке install.cmd - он поставит Node сам.
  echo.
  pause
  exit /b 1
)

rem Проверяем версию: для Node младше 22 у SQLite-модуля нет готовых
rem бинарников, и установка зависимостей падает с ошибкой сборки.
for /f "delims=" %%V in ('node -v') do set "NODE_VER=%%V"
echo| findstr /c:"v22." >nul && goto :run
echo| findstr /c:"v23." >nul && goto :run
echo| findstr /c:"v24." >nul && goto :run
echo| findstr /c:"v25." >nul && goto :run
echo| findstr /c:"v26." >nul && goto :run
echo.
echo Node.js %NODE_VER% слишком старый - нужно 22 или новее.
echo Запустите в этой папке install.cmd - он поставит подходящую версию.
echo.
pause
exit /b 1

rem ── Запуск ──────────────────────────────────────────────────────────────
:run
node scripts\launch.mjs
if errorlevel 1 (
  echo.
  echo Приложение не запустилось. Подробности — выше.
  echo Журнал: data\app.log
  echo.
  pause
  exit /b 1
)
exit /b 0

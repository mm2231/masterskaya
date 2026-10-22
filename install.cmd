@echo off
chcp 65001 >nul
rem ═══════════════════════════════════════════════════════════════════
rem  Установка «Мастерской» на новом компьютере (Windows)
rem
rem    git clone https://github.com/mm2231/masterskaya
rem    cd masterskaya
rem    install.cmd
rem
rem  Скрипт сам поставит Node.js (если его нет), зависимости и подготовит базу.
rem ═══════════════════════════════════════════════════════════════════
cd /d "%~dp0"

set "NODE_VER=v22.23.4"
set "LOCAL_NODE=%CD%\.node"

echo.
echo ═══ Установка «Мастерской» ═══
echo.

rem ── 1. Node.js ───────────────────────────────────────────────────────────
rem Локальная копия в .\.node всегда в приоритете: ею пользуется и запуск.
if exist "%LOCAL_NODE%\node.exe" (
  set "PATH=%LOCAL_NODE%;%PATH%"
  goto :deps
)

where node >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%V in ('node -v') do set "NODE_INSTALLED=%%V"
  echo Node.js %NODE_INSTALLED% найден.
  goto :deps
)

echo Node.js не найден - устанавливаю локально в .\.node
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$url='https://nodejs.org/dist/%NODE_VER%/node-%NODE_VER%-win-x64.zip';" ^
  "$tmp=Join-Path $env:TEMP ('node-'+[guid]::NewGuid().ToString('N'));" ^
  "New-Item -ItemType Directory -Force -Path $tmp | Out-Null;" ^
  "Write-Host '  Скачиваю Node.js...';" ^
  "$zip=Join-Path $tmp 'node.zip';" ^
  "Invoke-WebRequest -Uri $url -OutFile $zip;" ^
  "Write-Host '  Распаковываю...';" ^
  "Expand-Archive -Path $zip -DestinationPath $tmp -Force;" ^
  "New-Item -ItemType Directory -Force -Path '%LOCAL_NODE%' | Out-Null;" ^
  "Copy-Item -Path (Join-Path $tmp 'node-%NODE_VER%-win-x64\*') -Destination '%LOCAL_NODE%' -Recurse -Force;" ^
  "Remove-Item -Recurse -Force $tmp;" ^
  "Write-Host '  Node.js установлен в .\.node'"
if errorlevel 1 (
  echo.
  echo Не удалось установить Node.js автоматически.
  echo Скачайте Node.js 20+ с nodejs.org, перезапустите эту программу
  echo и запустите install.cmd снова.
  echo.
  pause
  exit /b 1
)
set "PATH=%LOCAL_NODE%;%PATH%"

rem ── 2. Зависимости ───────────────────────────────────────────────────────
:deps
echo.
echo Устанавливаю зависимости ^(нужен интернет^)...
if exist "package-lock.json" (
  call npm ci --no-audit --no-fund
) else (
  call npm install --no-audit --no-fund
)
if errorlevel 1 goto :err

rem ── 3. Настройка и сборка ─────────────────────────────────────────────────
echo.
echo Настраиваю приложение...
call node scripts\setup.mjs
if errorlevel 1 goto :err

echo.
echo ✔ Установка завершена.
echo.
echo Запустите мастерскую: «Запустить мастерскую.bat»
echo Страница откроется в браузере автоматически.
echo.
pause
exit /b 0

:err
echo.
echo Не удалось установить приложение. Подробности - в выводе выше.
echo Убедитесь, что есть интернет и Node.js 20+.
pause
exit /b 1

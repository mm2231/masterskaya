@echo off
chcp 65001 >nul
rem ═══════════════════════════════════════════════════════════════════
rem  Установка «Мастерской» на новом компьютере (Windows)
rem
rem    git clone https://github.com/mm2231/masterskaya
rem    cd masterskaya
rem    install.cmd
rem
rem  Скрипт сам поставит Node.js 22 (если его нет или версия не подходит),
rem  зависимости и подготовит базу.
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

rem Проверяем версию системного Node. Нужен 22 или новее: только для этих
rem версий у SQLite-модуля есть готовые бинарники (под 24 их тоже нет,
rem поэтому 22 - самый надёжный выбор).
set "NODE_MAJOR="
for /f "delims=" %%V in ('node -v 2^>nul') do set "NODE_MAJOR=%%V"
if defined NODE_MAJOR (
  echo Найден системный Node.js %NODE_MAJOR%.
  echo| findstr /c:"v22." >nul && goto :deps
  echo| findstr /c:"v23." >nul && goto :deps
  echo| findstr /c:"v24." >nul && goto :deps
  echo| findstr /c:"v25." >nul && goto :deps
  echo| findstr /c:"v26." >nul && goto :deps
  echo Эта версия не подходит - ставлю свою, Node.js %NODE_VER%.
) else (
  echo Node.js не найден - ставлю его сам, версия %NODE_VER%.
)

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
  echo Скачайте Node.js 22 LTS с nodejs.org, перезапустите эту программу
  echo и запустите install.cmd снова.
  echo.
  pause
  exit /b 1
)
set "PATH=%LOCAL_NODE%;%PATH%"
for /f "delims=" %%V in ('node -v') do set "NODE_MAJOR=%%V"
echo Готово: Node.js %NODE_MAJOR% ^(в папке .\.node^)

rem ── 2. Зависимости ───────────────────────────────────────────────────────
:deps
echo.
echo Устанавливаю зависимости ^(нужен интернет^)...
if exist "package-lock.json" (
  call npm ci --no-audit --no-fund
) else (
  call npm install --no-audit --no-fund
)
if errorlevel 1 (
  echo.
  echo Установка зависимостей не удалась. Пробую ещё раз обычным npm install...
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
echo.
echo Если в ошибке есть EPERM или "operation not permitted" -
echo значит антивирус или защита Windows держит файлы в папке node_modules.
echo Закройте антивирус, удалите папку node_modules и запустите install.cmd снова.
echo.
echo Убедитесь, что есть интернет и Node.js 22 или новее.
pause
exit /b 1

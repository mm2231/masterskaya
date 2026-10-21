@echo off
chcp 65001 >nul
rem Запуск «Мастерской» двойным щелчком (Windows) — без команд в консоли.
cd /d "%~dp0"

rem Порт берём из .env, иначе 8080.
set "PORT=8080"
if exist ".env" for /f "usebackq tokens=1,* delims==" %%A in (".env") do if /i "%%A"=="PORT" set "PORT=%%B"

rem Node должен быть установлен.
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Не найден Node.js 20 или новее.
  echo Установите его с nodejs.org и откройте этот файл ещё раз.
  echo.
  pause
  exit /b 1
)

rem Первый запуск — ставим зависимости.
if not exist "node_modules" (
  echo Первый запуск: устанавливаем зависимости ^(нужен интернет^)...
  call npm install || goto :err
)

rem Собираем интерфейс, если он ещё не собран.
if not exist "apps\web\dist\index.html" (
  echo Собираем интерфейс...
  call npm run build || goto :err
)

rem Запускаем сервер в фоне и открываем браузер.
start "" /b cmd /c "set PORT=%PORT% && npm start > "%TEMP%\masterskaya.log" 2>&1"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/"
exit /b 0

:err
echo.
echo Не удалось подготовить приложение. Подробности — в выводе выше.
echo Убедитесь, что Node.js установлен и команда npm доступна в PATH.
pause
exit /b 1

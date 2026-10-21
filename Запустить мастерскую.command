#!/bin/bash
# Запуск «Мастерской» двойным щелчком в Finder (macOS) — без команд в консоли.
cd "$(dirname "$0")" || exit 1

HERE="$(pwd)"
LOG="/tmp/topset_$(basename "$HERE").log"

# Порт берём из .env, иначе 8080.
PORT="$(sed -n 's/^PORT=//p' .env 2>/dev/null | tr -d '\r')"
[ -z "$PORT" ] && PORT=8080

# Node должен быть установлен.
if ! command -v node >/dev/null 2>&1; then
  # Пробуем локальную установку в ~/.local/node (её делает install-node.sh).
  if [ -x "$HOME/.local/node/bin/node" ]; then
    export PATH="$HOME/.local/node/bin:$PATH"
  else
    osascript -e 'display dialog "Не найден Node.js 20 или новее.

Установите его с nodejs.org или запустите в папке проекта:
  ./install-node.sh
После установки откройте этот файл ещё раз." buttons {"Понятно"} default button 1 with icon caution' 2>/dev/null
    exit 1
  fi
fi

# Зависимости: ставим при первом запуске.
if [ ! -d "node_modules" ]; then
  echo "Устанавливаю зависимости (первый запуск)…" > "$LOG"
  npm install >> "$LOG" 2>&1
  if [ $? -ne 0 ]; then
    osascript -e "display dialog \"Не удалось установить зависимости. Подробности в логе:
$LOG\" buttons {\"Понятно\"} default button 1 with icon caution" 2>/dev/null
    exit 1
  fi
fi

# Сборка фронта: нужна, если исходники изменились.
if [ ! -f "apps/web/dist/index.html" ] || [ -n "$(find apps/web/src -newer apps/web/dist/index.html 2>/dev/null | head -1)" ]; then
  echo "Собираю интерфейс…" > "$LOG"
  npm run build >> "$LOG" 2>&1
fi

# Если порт занят — выясняем, откуда работает запущенный сервер.
if PID="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)" && [ -n "$PID" ]; then
  RUN_CWD="$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  if [ "$RUN_CWD" = "$HERE" ]; then
    # Запущена именно эта копия — просто открываем браузер.
    open "http://127.0.0.1:$PORT/"
    exit 0
  fi
  MSG="Порт $PORT уже занят другой копией «Мастерской»:
$RUN_CWD

Открыть работающую версию или перезапустить её из этой папки?"
  BUTTONS='{"Открыть работающую","Перезапустить из этой папки","Отмена"}'
  CHOICE="$(osascript -e "display dialog \"$MSG\" buttons {$BUTTONS} default button 2 with icon caution" 2>/dev/null)"
  case "$CHOICE" in
    "Открыть работающую")
      open "http://127.0.0.1:$PORT/"
      exit 0
      ;;
    "Перезапустить из этой папки")
      kill "$PID" 2>/dev/null
      sleep 1.5
      ;;
    *)
      exit 0
      ;;
  esac
fi

# Запускаем сервер в фоне и открываем браузер.
PORT="$PORT" nohup npm start > "$LOG" 2>&1 &
sleep 2
open "http://127.0.0.1:$PORT/"

echo "Сервер запущен. Лог: $LOG"
echo "Остановить: pkill -f 'masterskaya'"

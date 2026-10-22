#!/bin/bash
# Запуск «Мастерской» двойным щелчком в Finder (macOS) — без команд в консоли.
cd "$(dirname "$0")" || exit 1

# Локальная копия Node (её ставит install.sh) — в приоритете.
export PATH="$PWD/.node:$PATH"

if ! command -v node >/dev/null 2>&1; then
  if [ -x "$HOME/.local/node/bin/node" ]; then
    export PATH="$HOME/.local/node/bin:$PATH"
  else
    osascript -e 'display dialog "Не найден Node.js 22 или новее.

Запустите в папке проекта:
  ./install.sh
Он поставит нужную версию Node сам." buttons {"Понятно"} default button 1 with icon caution' 2>/dev/null
    exit 1
  fi
fi

# Для Node младше 22 у SQLite-модуля нет готовых бинарников — установка
# зависимостей падает с ошибкой сборки из исходников.
NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 22 ]; then
  osascript -e "display dialog \"Node.js $(node -v) слишком старый - нужно 22 или новее.

Запустите в папке проекта:
  ./install.sh\"" buttons {"Понятно"} default button 1 with icon caution 2>/dev/null
  exit 1
fi

# Скрипт запуска сам поднимет сервер, дождётся его готовности
# и откроет браузер. Если что-то пойдёт не так — покажет причину.
node scripts/launch.mjs
STATUS=$?

if [ $STATUS -ne 0 ]; then
  osascript -e 'display dialog "Приложение не запустилось. Подробности — в окне терминала." buttons {"Понятно"} default button 1 with icon caution' 2>/dev/null
  echo ""
  read -r -p "Нажмите Enter, чтобы закрыть окно…" _
fi
exit $STATUS

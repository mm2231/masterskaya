#!/bin/bash
# Остановка «Мастерской» (macOS) — двойной щелчок в Finder.
cd "$(dirname "$0")" || exit 1

export PATH="$PWD/.node:$PATH"

if ! command -v node >/dev/null 2>&1; then
  if [ -x "$HOME/.local/node/bin/node" ]; then
    export PATH="$HOME/.local/node/bin:$PATH"
  else
    osascript -e 'display dialog "Не найден Node.js 20 или новее." buttons {"Понятно"} default button 1 with icon caution' 2>/dev/null
    exit 1
  fi
fi

node scripts/stop.mjs

echo ""
read -r -p "Нажмите Enter, чтобы закрыть окно…" _

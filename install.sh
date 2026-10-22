#!/bin/bash
# Установка «Мастерской» на новом компьютере (macOS / Linux).
#
#   git clone https://github.com/mm2231/masterskaya
#   cd masterskaya
#   ./install.sh
#
# Скрипт сам поставит Node.js (если его нет), зависимости и подготовит базу.
set -e

cd "$(dirname "$0")"

NODE_MIN_MAJOR=22
LOCAL_NODE_DIR="$PWD/.node"

say() { printf '%s\n' "$*"; }
fail() { printf '\n✖ %s\n' "$*" >&2; exit 1; }

say "═══ Установка «Мастерской» ═══"

# ── 1. Node.js ────────────────────────────────────────────────────────────
have_node() {
  command -v node >/dev/null 2>&1 && node -v 2>/dev/null
}

node_is_enough() {
  local v="$1"
  local major
  major="$(echo "$v" | sed 's/^v//' | cut -d. -f1)"
  [ -n "$major" ] || return 1
  [ "$major" -ge "$NODE_MIN_MAJOR" ]
}

if [ -x "$LOCAL_NODE_DIR/bin/node" ]; then
  export PATH="$LOCAL_NODE_DIR/bin:$PATH"
fi

CURRENT="$(have_node || true)"
if [ -n "$CURRENT" ] && node_is_enough "$CURRENT"; then
  say "▸ Node.js $CURRENT — подходит."
else
  [ -n "$CURRENT" ] && say "▸ Node.js $CURRENT устарел, ставим новый…"
  say "▸ Node.js не найден — устанавливаем локально в ./.node"

  # Выбираем LTS-версию и архитектуру под текущую систему.
  NODE_VER="v22.23.4"
  case "$(uname -s)" in
    Darwin) PLATFORM="darwin" ;;
    Linux)  PLATFORM="linux" ;;
    *) fail "Неизвестная система: $(uname -s). Установите Node.js вручную: https://nodejs.org" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *) fail "Неизвестная архитектура: $(uname -m)" ;;
  esac

  FILE="node-${NODE_VER}-${PLATFORM}-${ARCH}.tar.gz"
  URL="https://nodejs.org/dist/${NODE_VER}/${FILE}"
  TMP="$(mktemp -d)"
  say "  Скачиваю $FILE…"
  curl -fsSL "$URL" -o "$TMP/$FILE" || fail "Не удалось скачать Node.js: $URL"
  mkdir -p "$LOCAL_NODE_DIR"
  tar -xzf "$TMP/$FILE" -C "$LOCAL_NODE_DIR" --strip-components=1
  rm -rf "$TMP"
  export PATH="$LOCAL_NODE_DIR/bin:$PATH"
  say "  Node.js $(node -v) установлен в ./.node"
fi

# ── 2. Зависимости ────────────────────────────────────────────────────────
say "▸ Устанавливаю зависимости (нужен интернет)…"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# ── 3. Настройка и сборка ─────────────────────────────────────────────────
say "▸ Настраиваю приложение…"
node scripts/setup.mjs

say ""
say "✔ Установка завершена."
say ""
say "Запустите мастерскую:"
if [ "$(uname -s)" = "Darwin" ]; then
  say "  ./«Запустить мастерскую.command»"
else
  say "  npm start"
fi
say ""
say "Страница откроется в браузере автоматически."

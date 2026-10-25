#!/bin/bash
# Установка Node.js 22 в ~/.local/node — без sudo и без Homebrew.
# Нужна один раз, если Node не установлен в системе.
set -e

VERSION="v22.23.4"
DIR="$HOME/.local/node"

if [ -x "$DIR/bin/node" ]; then
  echo "Node уже установлен: $("$DIR/bin/node" -v)"
  exit 0
fi

case "$(uname -m)" in
  x86_64) ARCH="x64" ;;
  arm64)  ARCH="arm64" ;;
  *) echo "Неизвестная архитектура: $(uname -m)"; exit 1 ;;
esac

FILE="node-${VERSION}-darwin-${ARCH}.tar.gz"
URL="https://nodejs.org/dist/${VERSION}/${FILE}"

echo "Скачиваю Node.js ${VERSION} для ${ARCH}…"
TMP="$(mktemp -d)"
curl -fsSL "$URL" -o "$TMP/$FILE"

echo "Распаковываю в $DIR…"
mkdir -p "$DIR"
tar -xzf "$TMP/$FILE" -C "$DIR" --strip-components=1
rm -rf "$TMP"

echo "Готово: $("$DIR/bin/node" -v), npm $("$DIR/bin/npm" -v)"
echo
echo "Добавьте в ~/.zshrc (уже добавлено автоматически):"
echo "  export PATH=\"\$HOME/.local/node/bin:\$PATH\""
echo
echo "Откройте новый терминал и запустите «Запустить мастерскую.command»."

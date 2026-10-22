/**
 * Проверка скриптов запуска и установки.
 *
 * Скрипты для Windows (.bat, .cmd) — хрупкие: маленькая ошибка в разборе
 * версии Node приводит к тому, что приложение не запускается. Здесь ловим
 * такие ошибки на этапе сборки, а не на машине пользователя.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Корень репозитория: из apps/api/src/__tests__ — на четыре уровня вверх. */
const repoRoot = resolve(import.meta.dirname, '../../../..');

/** Все пакетные файлы Windows в корне. */
function windowsScripts(): string[] {
  return readdirSync(repoRoot).filter(
    (name) => name.endsWith('.bat') || name.endsWith('.cmd'),
  );
}

describe('скрипты для Windows', () => {
  it('все .bat и .cmd сохраняют переносы строк CRLF', () => {
    // С LF-переносами cmd.exe разбирает блоки if(...) и for /f неправильно.
    for (const name of windowsScripts()) {
      const data = readFileSync(resolve(repoRoot, name));
      const crlf = data.toString('binary').split('\r\n').length - 1;
      const lf = data.toString('binary').split('\n').length - 1;
      expect(`${name}: ${lf - crlf}`).toBe(`${name}: 0`);
    }
  });

  it('не используют битую проверку версии через echo| findstr', () => {
    // `echo| findstr /c:"v22."` ищет в пустом вводе от echo, а не в версии
    // Node, поэтому проверка всегда проваливалась.
    for (const name of windowsScripts()) {
      const text = readFileSync(resolve(repoRoot, name), 'utf-8');
      expect(`${name}: ${/echo\|\s*findstr/.test(text)}`).toBe(`${name}: false`);
    }
  });

  it('проверяют версию Node через сам Node', () => {
    for (const name of ['Запустить мастерскую.bat', 'install.cmd']) {
      const text = readFileSync(resolve(repoRoot, name), 'utf-8');
      expect(text).toContain('parseInt(process.versions.node,10)>=22');
    }
  });

  it('не путают переменные версии Node', () => {
    // NODE_VER — найденная системная версия, NODE_LOCAL_VER — какая ставится.
    const text = readFileSync(resolve(repoRoot, 'install.cmd'), 'utf-8');
    expect(text).toContain('set "NODE_LOCAL_VER=v22.23.4"');
    expect(text).not.toContain('set "NODE_VER=v22.23.4"');
  });
});

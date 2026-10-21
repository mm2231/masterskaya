/**
 * Подстановка нативного модуля SQLite под версию Node на этой машине.
 *
 * Пакет содержит готовые бинарники для Node 20 (ABI 115) и Node 22 (ABI 127).
 * Скрипт выбирает нужный по версии Node и кладёт на место, куда его ищет
 * better-sqlite3: node_modules/better-sqlite3/build/Release/better_sqlite3.node
 *
 * Запуск: node scripts/prepare-native.mjs [корень-приложения]
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(process.argv[2] ?? join(here, '..'));

const abi = process.versions.modules;
const target = join(
  appRoot,
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node',
);

/** Готовые бинарники: ABI версии Node → файл. */
const BINARIES = {
  115: 'better_sqlite3.node.v115',
  127: 'better_sqlite3.node.v127',
};

const source = join(appRoot, 'sqlite-binaries', BINARIES[abi] ?? '');

if (!BINARIES[abi]) {
  console.error(
    [
      `Не найден готовый модуль SQLite для Node.js ${process.version} (ABI ${abi}).`,
      '',
      'Поддерживаются:',
      '  • Node.js 20.x (ABI 115)',
      '  • Node.js 22.x (ABI 127)',
      '',
      'Установите Node.js 22 LTS с https://nodejs.org и запустите скрипт заново.',
    ].join('\n'),
  );
  process.exit(1);
}

if (!existsSync(source)) {
  console.error(`Не найден файл бинарника: ${source}`);
  console.error('Пакет собран не полностью — пересоберите его на исходном компьютере.');
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Модуль SQLite для Node.js ${process.version} (ABI ${abi}) установлен.`);

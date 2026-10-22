/**
 * Первичная настройка приложения на новом компьютере.
 *
 * Делает четыре вещи:
 *   1. Создаёт .env из .env.example (если его ещё нет) и генерирует SECRET_KEY.
 *   2. Применяет миграции базы данных.
 *   3. Заполняет справочники (категории расходов, услуги, шаблоны уведомлений).
 *   4. Собирает интерфейс.
 *
 * Запуск: node scripts/setup.mjs
 * Повторный запуск безопасен: существующий .env не перезаписывается,
 * справочники дополняются, но существующие записи не меняются.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(here, '..'));

const envFile = join(appRoot, '.env');
const exampleFile = join(appRoot, '.env.example');

/** Запустить команду npm в корне проекта и показать её вывод. */
function run(command, args) {
  console.log(`\n▸ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: appRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`\nНе удалось выполнить: ${command} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

/** Проверить версию Node — нужна 22 или новее. */
function checkNode() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 22) {
    console.error(
      `Нужен Node.js 22 или новее, а сейчас ${process.versions.node}.\n` +
        'Для более старых версий у модуля SQLite нет готовых бинарников,\n' +
        'и установка падает с ошибкой сборки из исходников.\n' +
        'Скачать Node.js 22 LTS: https://nodejs.org',
    );
    process.exit(1);
  }
}

/** Создать .env из примера, если его нет. Возвращает true, если файл создан. */
function ensureEnv() {
  if (existsSync(envFile)) {
    console.log('Файл .env уже есть — не трогаю его.');
    return false;
  }
  if (!existsSync(exampleFile)) {
    console.error(`Не найден ${exampleFile}`);
    process.exit(1);
  }

  const secret = randomBytes(32).toString('hex');
  const content = readFileSync(exampleFile, 'utf-8').replace(/^SECRET_KEY=.*$/m, `SECRET_KEY=${secret}`);
  writeFileSync(envFile, content, 'utf-8');
  console.log('Создан .env (ключ сессии сгенерирован).');
  return true;
}

/**
 * Дописать часовой пояс в .env, если его там нет.
 *
 * По умолчанию — 3 (Минск и Москва). Без этого приложение считало бы время
 * по часам операционной системы, а это не всегда одно и то же.
 */
function ensureTimezone() {
  if (!existsSync(envFile)) return;
  const content = readFileSync(envFile, 'utf-8');
  if (/^TIMEZONE_OFFSET_HOURS=/m.test(content)) return;
  const updated = content.replace(
    /^/,
    '# Часовой пояс мастерской: 3 — Минск и Москва.\nTIMEZONE_OFFSET_HOURS=3\n\n',
  );
  writeFileSync(envFile, updated, 'utf-8');
  console.log('В .env добавлен часовой пояс (UTC+3).');
}

/** Создать папку для базы, бэкапов и выгрузок. */
function ensureDataDir() {
  const dir = join(appRoot, 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

console.log('Настройка «Мастерской»…\n');
checkNode();
ensureEnv();
ensureTimezone();
ensureDataDir();

// Пакеты shared и db собираем первыми: скрипты миграций и наполнения
// импортируют @masterskaya/shared из собранного dist.
run('npm', ['run', 'build:packages']);
run('npm', ['run', 'db:migrate']);
run('npm', ['run', 'db:seed']);

// Время в базе приводим к локальному: часть записей писалась в UTC.
// Скрипт идемпотентный — повторно ничего не меняет.
run('node', ['scripts/fix-times.mjs']);

run('npm', ['run', 'build:app']);

console.log('\n✔ Готово.');
console.log('Запустите приложение:');
console.log('  macOS:  ./«Запустить мастерскую.command»');
console.log('  Windows: «Запустить мастерскую.bat»');
console.log('  Вручную: npm start');
console.log('\nРеквизиты мастерской задаются в разделе «Настройки» или в файле .env.');

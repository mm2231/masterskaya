/**
 * Приведение времени в базе к локальному времени мастерской.
 *
 *   node scripts/fix-times.mjs           — конвертировать
 *   node scripts/fix-times.mjs --dry-run — только показать, что изменится
 *
 * Зачем: часть записей писалась значением по умолчанию SQLite
 * (datetime('now')), а это **UTC**. Приложение же показывает время как
 * локальное — из-за этого все даты и часы были на 3 часа раньше.
 *
 * Скрипт сдвигает на зону мастерской только те колонки, которые писались
 * через UTC-значение по умолчанию, и не трогает те, что задавались из кода
 * (orders.issued_at, orders.updated_at) — они уже локальные.
 *
 * Повторный запуск безопасен: выполненная конвертация отмечается флагом
 * в таблице settings.
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(here, '..'));
const dryRun = process.argv.includes('--dry-run');

/**
 * Путь к .env: сначала текущая папка, потом папка проекта.
 *
 * Так скрипт можно запускать на копии базы из своей папки, не задев
 * рабочую базу.
 */
function envFilePath() {
  const local = join(process.cwd(), '.env');
  if (existsSync(local)) return local;
  const project = join(appRoot, '.env');
  return existsSync(project) ? project : null;
}

/** Значение из .env. */
function readEnvValue(key) {
  const envFile = envFilePath();
  if (!envFile) return '';
  const match = readFileSync(envFile, 'utf-8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

/** Путь к базе. */
function databasePath() {
  const value = readEnvValue('DATABASE_PATH') || 'data/workshop.db';
  return value.startsWith('/') ? value : resolve(appRoot, value);
}

/** Смещение зоны в часах. */
function zoneOffset() {
  const raw = readEnvValue('TIMEZONE_OFFSET_HOURS');
  const value = Number(raw);
  return Number.isFinite(value) && value !== 0 ? value : 3;
}

/**
 * Колонки, записанные через datetime('now') — то есть в UTC.
 * Формат: таблица → колонки.
 */
const UTC_COLUMNS = {
  clients: ['created_at'],
  orders: ['accepted_at', 'created_at'],
  order_events: ['created_at'],
  order_tasks: ['created_at'],
  documents: ['issued_at', 'created_at'],
  payments: ['created_at'],
  settings: ['updated_at'],
};

const FLAG_KEY = 'timesNormalizedTo';

function main() {
  const path = databasePath();
  if (!existsSync(path)) {
    console.error(`База не найдена: ${path}`);
    process.exit(1);
  }

  const offset = zoneOffset();
  const db = new Database(path);

  // Уже конвертировали? Проверяем по флагу и по формату записи.
  const flag = db
    .prepare(`select value from settings where key = ?`)
    .get(FLAG_KEY);
  if (flag) {
    console.log(`Время уже приведено к зоне UTC+${offset} — ничего делать не нужно.`);
    db.close();
    return;
  }

  console.log(`Зона мастерской: UTC+${offset} (сдвиг на ${offset > 0 ? '+' : ''}${offset} ч).`);
  if (dryRun) {
    console.log('Режим просмотра — данные не меняются.\n');
  }

  let total = 0;
  for (const [table, columns] of Object.entries(UTC_COLUMNS)) {
    const exists = db
      .prepare(`select name from sqlite_master where type='table' and name = ?`)
      .get(table);
    if (!exists) continue;

    for (const column of columns) {
      // Только записи в формате SQLite — ISO-строки не трогаем.
      const count = db
        .prepare(
          `select count(*) as n from ${table} where ${column} is not null and ${column} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'`,
        )
        .get().n;
      if (count === 0) continue;

      total += count;
      console.log(`  ${table}.${column}: ${count} записей`);

      if (!dryRun) {
        db.prepare(
          `update ${table} set ${column} = datetime(${column}, ?) where ${column} is not null and ${column} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'`,
        ).run(`${offset >= 0 ? '+' : '-'}${Math.abs(offset)} hours`);
      }
    }
  }

  if (!dryRun && total > 0) {
    db.prepare(
      `insert into settings (key, value, updated_at) values (?, ?, datetime('now')) ` +
        `on conflict(key) do update set value = excluded.value`,
    ).run(FLAG_KEY, `UTC+${offset}`);
  }

  db.close();

  console.log(
    total === 0
      ? '\nКонвертировать нечего — записи уже в локальном времени.'
      : dryRun
        ? `\nВсего записей к сдвигу: ${total}. Запустите без --dry-run, чтобы применить.`
        : `\n✔ Сдвинуто записей: ${total}. Приложение покажет правильное время.`,
  );
}

main();

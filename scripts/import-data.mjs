/**
 * Загрузка данных из JSON в базу.
 *
 * Дубликаты не создаются: клиенты сверяются по телефону, заказы — по номеру.
 * Повторный импорт безопасен.
 *
 * Запуск: node scripts/import-data.mjs [файл.json] [база.db]
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(here, '..'));

function readEnvValue(envFile, key) {
  const text = readFileSync(envFile, 'utf-8');
  const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

function resolveDatabasePath() {
  const explicit = process.argv[3];
  if (explicit) return resolve(explicit);
  const envFile = join(appRoot, '.env');
  if (existsSync(envFile)) {
    const match = readEnvValue(envFile, 'DATABASE_PATH');
    if (match) {
      return match.startsWith('/') ? match : resolve(appRoot, match);
    }
  }
  return join(appRoot, 'data', 'workshop.db');
}

const inputFile = resolve(process.argv[2] ?? join(appRoot, 'data', 'export.json'));
if (!existsSync(inputFile)) {
  console.error(`Файл с данными не найден: ${inputFile}`);
  process.exit(1);
}

const payload = JSON.parse(readFileSync(inputFile, 'utf-8'));
const tables = payload.tables ?? payload;

const databasePath = resolveDatabasePath();
const db = new Database(databasePath);
db.pragma('foreign_keys = ON');

/** Порядок вставки: сначала родители, потом зависимые. */
const ORDER = [
  'settings',
  'clients',
  'devices',
  'orders',
  'order_events',
  'order_tasks',
  'order_photos',
  'documents',
  'payments',
  'expense_categories',
  'catalog_services',
  'notification_templates',
  'notification_log',
];

const report = {};

for (const table of ORDER) {
  const rows = tables[table];
  if (!Array.isArray(rows) || rows.length === 0) {
    report[table] = 0;
    continue;
  }

  const columns = db.prepare(`pragma table_info(${table})`).all().map((row) => row.name);
  const existingRows = db.prepare(`select * from ${table}`).all();

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    // Настройки обновляем по ключу: реквизиты мастерской должны переехать
    // на новый компьютер, а не молча пропускаться.
    if (table === 'settings') {
      const key = row.key;
      if (!key) {
        skipped += 1;
        continue;
      }
      const columns2 = db.prepare(`pragma table_info(${table})`).all().map((r) => r.name);
      const values2 = columns2
        .filter((column) => row[column] !== undefined)
        .map((column) => row[column]);
      const placeholders2 = columns2
        .filter((column) => row[column] !== undefined)
        .map(() => '?')
        .join(', ');
      if (!placeholders2) continue;
      db.prepare(
        `insert into ${table} (${columns2
          .filter((column) => row[column] !== undefined)
          .join(', ')}) values (${placeholders2})
         on conflict(key) do update set value = excluded.value`,
      ).run(...values2);
      inserted += 1;
      continue;
    }

    // Клиенты сверяем по телефону, заказы — по номеру, остальное — по id.
    let duplicate = false;
    if (table === 'clients' && row.phone) {
      duplicate = existingRows.some((item) => item.phone === row.phone);
    } else if (table === 'orders' && row.number) {
      duplicate = existingRows.some((item) => item.number === row.number);
    } else if (row.id !== undefined && row.id !== null) {
      duplicate = existingRows.some((item) => item.id === row.id);
    }
    if (duplicate) {
      skipped += 1;
      continue;
    }

    const values = columns
      .filter((column) => row[column] !== undefined)
      .map((column) => row[column]);
    const placeholders = columns
      .filter((column) => row[column] !== undefined)
      .map(() => '?')
      .join(', ');
    if (!placeholders) continue;

    try {
      db.prepare(`insert into ${table} (${columns
        .filter((column) => row[column] !== undefined)
        .join(', ')}) values (${placeholders})`).run(...values);
      inserted += 1;
    } catch {
      // Конфликт по внешнему ключу или NOT NULL — пропускаем запись.
      skipped += 1;
    }
  }

  report[table] = inserted;
  if (skipped) {
    report[`${table}:пропущено`] = skipped;
  }
}

db.close();

console.log(`Данные загружены в ${databasePath}`);
for (const [name, count] of Object.entries(report)) {
  if (count) console.log(`  ${name}: ${count}`);
}

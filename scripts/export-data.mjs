/**
 * Выгрузка всех данных в JSON — для переноса на другой компьютер.
 *
 * Читает базу напрямую (better-sqlite3), без сервера и без сборки TypeScript,
 * поэтому скрипт работает и в переносимом пакете.
 *
 * Запуск: node scripts/export-data.mjs [файл.json] [база.db]
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(here, '..'));

/** Таблицы, которые переносятся. Порядок важен: сначала родители. */
const TABLES = [
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

function resolveDatabasePath() {
  const explicit = process.argv[3];
  if (explicit) return resolve(explicit);

  // Путь из .env (может быть относительным — от корня приложения).
  const envFile = join(appRoot, '.env');
  if (existsSync(envFile)) {
    const match = readEnvValue(envFile, 'DATABASE_PATH');
    if (match) {
      return match.startsWith('/') ? match : resolve(appRoot, match);
    }
  }
  return join(appRoot, 'data', 'workshop.db');
}

function readEnvValue(envFile, key) {
  const text = readFileSync(envFile, 'utf-8');
  const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

const databasePath = resolveDatabasePath();
if (!existsSync(databasePath)) {
  console.error(`База не найдена: ${databasePath}`);
  process.exit(1);
}

const outputFile = resolve(process.argv[2] ?? join(appRoot, 'data', 'export.json'));

const db = new Database(databasePath, { readonly: true });
const data = { version: 2, exportedAt: new Date().toISOString(), tables: {} };

for (const table of TABLES) {
  const exists = db
    .prepare(`select name from sqlite_master where type='table' and name = ?`)
    .get(table);
  if (!exists) continue;
  data.tables[table] = db.prepare(`select * from ${table}`).all();
}
db.close();

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf-8');

const counts = Object.entries(data.tables)
  .map(([name, rows]) => `${name}: ${rows.length}`)
  .join(', ');
console.log(`Выгружено в ${outputFile}`);
console.log(counts);

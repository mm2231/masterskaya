/**
 * Резервная копия базы «на лету» — работает, даже когда приложение запущено.
 *
 *   node scripts/backup-db.mjs [папка-выгрузки]
 *
 * Копия снимается через SQLite backup API: SQLite сам согласует чтение с
 * копированием, поэтому файл получается целым без остановки приложения.
 * Дополнительно делается выгрузка в JSON — её удобнее переносить на флешку.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(here, '..'));

/** Значение из .env. */
function readEnvValue(key) {
  const envFile = join(appRoot, '.env');
  if (!existsSync(envFile)) return '';
  const match = readFileSync(envFile, 'utf-8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

/** Путь к базе. */
function databasePath() {
  const value = readEnvValue('DATABASE_PATH') || 'data/workshop.db';
  return value.startsWith('/') ? value : resolve(appRoot, value);
}

/** Текущая дата и время в виде ГГГГ-ММ-ДД_ЧЧ-ММ. */
function stamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_` +
    `${pad(now.getHours())}-${pad(now.getMinutes())}`
  );
}

const source = databasePath();
if (!existsSync(source)) {
  console.error(`База не найдена: ${source}`);
  process.exit(1);
}

const outDir = resolve(process.argv[2] ?? join(appRoot, 'data', 'exports'));
mkdirSync(outDir, { recursive: true });

const target = join(outDir, `workshop_${stamp()}.db`);
const db = new Database(source, { readonly: true });

// Копия через backup API — безопасна при работающем приложении.
await db.backup(target);

const counts = {};
for (const table of ['orders', 'clients', 'documents', 'payments', 'order_tasks']) {
  const exists = db
    .prepare(`select name from sqlite_master where type='table' and name = ?`)
    .get(table);
  if (exists) counts[table] = db.prepare(`select count(*) as n from ${table}`).get().n;
}
db.close();

console.log(`✔ Копия базы: ${target}`);
console.log(`  ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
console.log(`\nПапка выгрузок: ${outDir}`);
console.log('Скопируйте её на флешку — это перенос базы на другой компьютер.');

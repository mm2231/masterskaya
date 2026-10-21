/**
 * Проверка резервных копий: можно ли восстановиться из последней копии.
 *
 *   node scripts/backup-check.mjs
 *
 * Скрипт берёт последнюю копию из папки бэкапов, разворачивает её во
 * временную папку, проверяет целостность и сверяет количество заказов,
 * клиентов и актов с рабочей базой.
 *
 * Код выхода: 0 — всё в порядке, 1 — проблема.
 */

import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

/** Путь к рабочей базе. */
function workingDatabasePath() {
  const value = readEnvValue('DATABASE_PATH') || 'data/workshop.db';
  return value.startsWith('/') ? value : resolve(appRoot, value);
}

/** Папка с бэкапами. */
function backupsDir() {
  const value = readEnvValue('BACKUP_DIR') || 'data/backups';
  return value.startsWith('/') ? value : resolve(appRoot, value);
}

/** Последняя копия по дате в имени. */
function latestBackup(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((name) => name.startsWith('workshop_') && name.endsWith('.db'))
    .sort();
  if (files.length === 0) return null;
  return join(dir, files[files.length - 1]);
}

/** Количество строк в таблице (0, если таблицы нет). */
function countRows(db, table) {
  const exists = db
    .prepare(`select name from sqlite_master where type='table' and name = ?`)
    .get(table);
  if (!exists) return 0;
  return db.prepare(`select count(*) as n from ${table}`).get().n;
}

const dir = backupsDir();
const backup = latestBackup(dir);

if (!backup) {
  console.error(`✖ Резервных копий нет в папке ${dir}`);
  console.error('  Запустите: npm run data:backup');
  process.exit(1);
}

console.log(`Последняя копия: ${backup}`);

// Разворачиваем копию отдельно — рабочую базу не трогаем.
const tempDir = mkdtempSync(join(tmpdir(), 'masterskaya-check-'));
const tempDb = join(tempDir, 'check.db');

let failed = false;
try {
  // Копируем файл: так проверка идёт по настоящей копии, а не по симлинку.
  copyFileSync(backup, tempDb);

  const db = new Database(tempDb, { readonly: true });

  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') {
    console.error(`✖ Копия повреждена: integrity_check = ${integrity}`);
    failed = true;
  } else {
    console.log('✓ Целостность в порядке');
  }

  const copyOrders = countRows(db, 'orders');
  const copyClients = countRows(db, 'clients');
  const copyDocs = countRows(db, 'documents');
  db.close();

  const working = workingDatabasePath();
  let live = { orders: 0, clients: 0, documents: 0 };
  if (existsSync(working)) {
    const liveDb = new Database(working, { readonly: true });
    live = {
      orders: countRows(liveDb, 'orders'),
      clients: countRows(liveDb, 'clients'),
      documents: countRows(liveDb, 'documents'),
    };
    liveDb.close();
  }

  console.log(`  В копии:  заказов ${copyOrders}, клиентов ${copyClients}, актов ${copyDocs}`);
  console.log(`  В базе:   заказов ${live.orders}, клиентов ${live.clients}, актов ${live.documents}`);

  // Расхождение — предупреждение: копия могла быть снята раньше.
  if (copyOrders > live.orders) {
    console.error('✖ В копии больше заказов, чем в рабочей базе — она повреждена или подменена');
    failed = true;
  } else if (copyOrders < live.orders) {
    console.log('  ⚠ Копия старее рабочей базы (это нормально, если копия снята раньше)');
  } else {
    console.log('✓ Количество заказов совпадает');
  }

  if (!failed) {
    console.log('\n✔ Восстановление из копии возможно.');
  }
} catch (error) {
  console.error('✖ Не удалось проверить копию:', error instanceof Error ? error.message : error);
  failed = true;
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);

/** Применение миграций Drizzle к файлу БД. */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { openDatabase } from './connection.js';
import { databasePath, loadEnv, packageRoot } from './paths.js';

/**
 * Применить миграции.
 *
 * Файлы миграций лежат в packages/db/drizzle — они в git, поэтому
 * состояние базы всегда воспроизводимо из репозитория.
 */
export function applyMigrations(path: string): void {
  const db = openDatabase(path);
  const migrationsFolder = resolve(packageRoot, 'drizzle');
  if (!existsSync(migrationsFolder)) {
    // Миграций ещё нет — база остаётся пустой, схема создасттся позже.
    return;
  }
  migrate(db, { migrationsFolder });
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  loadEnv();
  const path = databasePath();
  applyMigrations(path);
  console.log(`Миграции применены: ${path}`);
}

/** Подключение к SQLite и применение миграций. */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema.js';

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

/** Абсолютный путь к файлу БД (путь из .env считается от корня репозитория). */
export function resolveDatabasePath(path: string, repoRoot: string): string {
  return path.startsWith('/') ? path : resolve(repoRoot, path);
}

/** Открыть БД и применить миграции. */
export function openDatabase(path: string): AppDatabase {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

/** Сырое соединение — для служебных задач (импорт, бэкап, отчёт). */
export function openRawDatabase(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}

/** Доступ к БД из обработчиков: одна БД на процесс, подключается при старте. */

import { openDatabase, type AppDatabase } from '@masterskaya/db';

let database: AppDatabase | null = null;

/** Подключить БД (вызывается один раз при старте сервера). */
export function initDb(path: string): AppDatabase {
  database = openDatabase(path);
  return database;
}

/** Текущее соединение с БД. */
export function db(): AppDatabase {
  if (!database) {
    throw new Error('БД не инициализирована: сначала вызовите initDb()');
  }
  return database;
}

export type { AppDatabase };

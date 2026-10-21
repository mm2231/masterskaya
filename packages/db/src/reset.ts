/** Полный сброс базы: удаляем файл и создаём заново по миграциям. */

import { rmSync } from 'node:fs';

import { applyMigrations } from './migrate.js';
import { databasePath, loadEnv } from './paths.js';

if (process.argv[1] && process.argv[1].endsWith('reset.ts')) {
  loadEnv();
  const path = databasePath();
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(`${path}${suffix}`, { force: true });
  }
  applyMigrations(path);
  console.log(`База пересоздана: ${path}`);
}

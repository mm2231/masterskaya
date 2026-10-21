/** Пути репозитория и загрузка .env — общее для скриптов пакета. */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));

/** Корень пакета @masterskaya/db. */
export const packageRoot = resolve(here, '..');
/** Корень репозитория. */
export const repoRoot = resolve(packageRoot, '../..');

/** Загрузить .env из корня репозитория (если он есть). */
export function loadEnv(): void {
  const envPath = resolve(repoRoot, '.env');
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
}

/** Абсолютный путь к файлу БД. */
export function databasePath(): string {
  const raw = process.env.DATABASE_PATH ?? 'data/workshop.db';
  return raw.startsWith('/') ? raw : resolve(repoRoot, raw);
}

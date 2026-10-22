/** Конфигурация приложения: .env → типизированные значения. */

import { resolve } from 'node:path';

import { config } from 'dotenv';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default('0.0.0.0'),
  DEV: z
    .string()
    .default('0')
    .transform((value) => ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())),
  DATABASE_PATH: z.string().default('data/workshop.db'),
  /** Смещение часового пояса в часах (3 — Минск). Пусто — время системы. */
  TIMEZONE_OFFSET_HOURS: z.string().default(''),
  BACKUP_DIR: z.string().default('data/backups'),
  BACKUP_INTERVAL_HOURS: z.coerce.number().positive().default(24),
  BACKUP_KEEP: z.coerce.number().int().min(0).default(14),
  WORKSHOP_NAME: z.string().default('Мастерская'),
  WORKSHOP_OWNER: z.string().default(''),
  WORKSHOP_UNP: z.string().default(''),
  WORKSHOP_ADDRESS: z.string().default(''),
  WORKSHOP_PHONE: z.string().default(''),
  APP_PASSWORD: z.string().default(''),
  SECRET_KEY: z.string().default(''),
  DOC_NUMBER_PATTERN: z.string().default('{YYYY}-{SEQ}'),
  ORDER_NUMBER_PATTERN: z.string().default('{YYYY}-{SEQ}'),
});

export type Env = z.infer<typeof schema>;

/** Корень репозитория — от каталога приложения на два уровня вверх. */
export const repoRoot = resolve(import.meta.dirname, '../../..');

/** Прочитать .env из корня репозитория и проверить значения. */
export function loadEnv(): Env {
  config({ path: resolve(repoRoot, '.env') });
  return schema.parse(process.env);
}

/** Абсолютный путь к файлу БД. */
export function databasePath(env: Env): string {
  return env.DATABASE_PATH.startsWith('/')
    ? env.DATABASE_PATH
    : resolve(repoRoot, env.DATABASE_PATH);
}

/** Абсолютный путь к папке бэкапов. */
export function backupDir(env: Env): string {
  return env.BACKUP_DIR.startsWith('/') ? env.BACKUP_DIR : resolve(repoRoot, env.BACKUP_DIR);
}

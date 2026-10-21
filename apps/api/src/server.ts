/** Точка входа: конфиг → БД → сервер. */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';

import { buildApp } from './app.js';
import { initDb } from './db.js';
import { databasePath, loadEnv, type Env } from './env.js';
import { applyMigrations, seedDatabase } from '@masterskaya/db';
import { startBackupScheduler } from './backup.js';

/**
 * Файл с PID процесса — по нему приложение останавливается скриптом.
 *
 * Кладём рядом с базой данных: в переносимом пакете база лежит в папке data
 * на уровень выше кода, и PID-файл должен быть там же.
 */
function pidFilePath(env: Env): string {
  return join(dirname(databasePath(env)), 'app.pid');
}

/** Записать PID, чтобы скрипт остановки знал, кого завершать. */
function writePidFile(env: Env): void {
  const path = pidFilePath(env);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, String(process.pid), 'utf-8');
}

/** Убрать файл PID при остановке. */
function removePidFile(env: Env): void {
  const path = pidFilePath(env);
  if (existsSync(path)) {
    try {
      rmSync(path);
    } catch {
      // Файл может быть занят — не критично.
    }
  }
}

async function main(): Promise<void> {
  const env: Env = loadEnv();
  const path = databasePath(env);

  // Схема актуальна всегда: миграции применяются при старте.
  applyMigrations(path);

  const database = initDb(path);
  await seedDatabase(database, {
    name: env.WORKSHOP_NAME,
    owner: env.WORKSHOP_OWNER,
    unp: env.WORKSHOP_UNP,
    address: env.WORKSHOP_ADDRESS,
    phone: env.WORKSHOP_PHONE,
  });

  const app = await buildApp({ env });
  startBackupScheduler(env);

  await app.listen({ port: env.PORT, host: env.HOST });
  writePidFile(env);

  // При выходе убираем файл PID и закрываем сервер корректно.
  const shutdown = async () => {
    removePidFile(env);
    try {
      await app.close();
    } catch {
      // Уже закрыт.
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => removePidFile(env));

  const addresses = localAddresses();
  const lines = [
    '',
    '  Мастерская запущена.',
    `  На этом компьютере:  http://127.0.0.1:${env.PORT}/`,
    ...addresses.map((address, index) =>
      `${index === 0 ? '  В локальной сети:  ' : '                      '}http://${address}:${env.PORT}/`,
    ),
    `  Защита паролем:      ${env.APP_PASSWORD ? 'включена' : 'ВЫКЛЮЧЕНА'}`,
    `  База данных:         ${path}`,
    '',
  ];
  app.log.info(lines.join('\n'));
}

/** IPv4-адреса локальной сети — чтобы открыть страницу с телефона. */
function localAddresses(): string[] {
  const result: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        result.push(entry.address);
      }
    }
  }
  return result;
}

main().catch((error) => {
  console.error('Не удалось запустить сервер:', error);
  process.exit(1);
});

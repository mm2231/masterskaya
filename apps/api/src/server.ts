/** Точка входа: конфиг → БД → сервер. */

import { networkInterfaces } from 'node:os';

import { buildApp } from './app.js';
import { initDb } from './db.js';
import { databasePath, loadEnv, type Env } from './env.js';
import { applyMigrations, seedDatabase } from '@masterskaya/db';
import { startBackupScheduler } from './backup.js';

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

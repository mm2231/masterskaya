/** CLI импорта: npm run import:legacy -- <путь к старой базе> */

import { resolve } from 'node:path';

import { initDb } from '../db.js';
import { databasePath, loadEnv, repoRoot } from '../env.js';
import { importLegacy } from './import.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const legacyPath = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(repoRoot, '../topset_workshop_refactor/topset.db');

  console.log(`Источник: ${legacyPath}`);
  const database = initDb(databasePath(env));
  const report = await importLegacy(database, legacyPath);

  console.log('\nИмпорт завершён:');
  console.log(
    `  клиенты: ${report.clients.created} создано, ${report.clients.skipped} пропущено (из ${report.clients.total})`,
  );
  console.log(
    `  заказы:  ${report.orders.created} создано, ${report.orders.skipped} пропущено (из ${report.orders.total})`,
  );
  console.log(
    `  доходы:  ${report.payments.created} создано, ${report.payments.skipped} пропущено (из ${report.payments.total})`,
  );
  console.log('\nСлужебные таблицы прежней программы не переносятся.');
}

main().catch((error) => {
  console.error('Ошибка импорта:', error instanceof Error ? error.message : error);
  process.exit(1);
});

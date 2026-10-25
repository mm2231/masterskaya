/**
 * Автоматические резервные копии базы.
 *
 * Копия делается через SQLite backup API — безопасно во время работы
 * приложения: SQLite сам согласует чтение с копированием.
 */

import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import type { Env } from './env.js';
import { backupDir, databasePath } from './env.js';
import { openRawDatabase } from '@masterskaya/db';

function stamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Сделать копию БД. Возвращает путь к файлу или null при ошибке.
 *
 * Копирование идёт через SQLite Online Backup API (`db.backup()`):
 * он читает базу постранично и согласован с активными транзакциями.
 * Обычное копирование файла (copyFileSync) на WAL-базе может дать
 * копию без последних транзакций — они живут в файле *.db-wal.
 */
export async function makeBackup(env: Env): Promise<string | null> {
  try {
    const source = databasePath(env);
    if (!existsSync(source)) return null;
    const dir = backupDir(env);
    mkdirSync(dir, { recursive: true });
    const target = join(dir, `workshop_${stamp()}.db`);
    const sqlite = openRawDatabase(source);
    try {
      await sqlite.backup(target);
    } finally {
      sqlite.close();
    }
    pruneBackups(dir, env.BACKUP_KEEP);
    return target;
  } catch {
    // Бэкап не должен ронять приложение.
    return null;
  }
}

/** Оставить только последние N копий. */
function pruneBackups(dir: string, keep: number): void {
  if (keep <= 0) return;
  const files = readdirSync(dir)
    .filter((name) => name.startsWith('workshop_') && name.endsWith('.db'))
    .sort();
  for (const old of files.slice(0, Math.max(0, files.length - keep))) {
    try {
      unlinkSync(join(dir, old));
    } catch {
      // Не смогли удалить — не критично.
    }
  }
}

/** Фоновый поток: копия базы по расписанию. */
export function startBackupScheduler(env: Env): void {
  const run = async () => {
    const target = await makeBackup(env);
    if (target) {
      console.log(`Резервная копия: ${target}`);
    }
  };
  void run();
  const intervalMs = Math.max(1, env.BACKUP_INTERVAL_HOURS) * 3600_000;
  setInterval(run, intervalMs).unref();
}

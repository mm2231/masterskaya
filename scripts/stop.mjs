/**
 * Остановка приложения.
 *
 * Сначала пробуем завершить процесс по PID-файлу, затем — по порту
 * (на случай, если PID-файл потерялся).
 *
 * PID-файл лежит рядом с базой данных, а база в переносимом пакете — на
 * уровень выше кода, поэтому ищем в двух местах.
 *
 * Запуск: node scripts/stop.mjs [путь-к-корню-приложения]
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Скрипт лежит в <корень>/scripts, значит корень — уровнем выше.
const appRoot = resolve(process.argv[2] ?? join(here, '..'));

/** Значение из .env (пустая строка, если ключа нет). */
function readEnvValue(key) {
  const envFile = join(appRoot, '.env');
  if (!existsSync(envFile)) return '';
  const match = readFileSync(envFile, 'utf-8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

/** Порт из .env. */
function readPort() {
  return readEnvValue('PORT') || '8080';
}

/** Где может лежать PID-файл: рядом с базой и в папке данных кода. */
function pidFileCandidates() {
  const candidates = [];
  const database = readEnvValue('DATABASE_PATH');
  if (database) {
    const dbPath = database.startsWith('/') ? database : resolve(appRoot, database);
    candidates.push(join(dirname(dbPath), 'app.pid'));
  }
  candidates.push(join(appRoot, 'data', 'app.pid'));
  return candidates;
}

/** Процесс с таким PID ещё жив? */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Найти процессы, слушающие порт (macOS/Linux и Windows). */
function processesOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execFileSync('netstat', ['-ano'], { encoding: 'utf-8' });
      const pids = new Set();
      for (const line of output.split('\n')) {
        if (line.includes(`:${port}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = Number(parts[parts.length - 1]);
          if (Number.isFinite(pid) && pid > 0) pids.add(pid);
        }
      }
      return [...pids];
    }
    const output = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      encoding: 'utf-8',
    });
    return output
      .trim()
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
  } catch {
    return [];
  }
}

let stopped = false;

// 1. По PID-файлу.
for (const pidFile of pidFileCandidates()) {
  if (!existsSync(pidFile)) continue;
  const pid = Number(readFileSync(pidFile, 'utf-8').trim());
  if (Number.isFinite(pid) && pid > 0 && isAlive(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Уже умер.
    }
    // Даём процессу завершиться корректно.
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 300)']);
    if (isAlive(pid)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Уже умер.
      }
    }
    stopped = true;
    console.log(`Остановлено (PID ${pid}).`);
  }
  rmSync(pidFile, { force: true });
}

// 2. По порту — если процесс ещё слушает.
if (!stopped) {
  const port = readPort();
  for (const pid of processesOnPort(port)) {
    if (pid === process.pid) continue;
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`Остановлено (PID ${pid}, порт ${port}).`);
      stopped = true;
    } catch {
      // Не смогли — пробуем следующий.
    }
  }
}

if (!stopped) {
  console.log('Приложение не запущено — останавливать нечего.');
}

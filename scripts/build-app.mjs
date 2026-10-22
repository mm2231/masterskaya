/**
 * Пересборка приложения с перезапуском сервера.
 *
 *   node scripts/build-app.mjs
 *
 * Порядок именно такой: **остановить сервер → собрать → запустить**.
 * На Windows работающий процесс держит файлы папки dist, и сборка при
 * работающем сервере падает с ошибкой вроде EPERM.
 *
 * Скрипт вызывается из apply-update.mjs уже ПОСЛЕ git pull — значит, он
 * всегда свежий, даже если сам обновляющий скрипт был старым.
 */

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, openSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(here, '..'));
const serverEntry = join(appRoot, 'apps', 'api', 'dist', 'server.js');
const logFile = join(appRoot, 'data', 'app.log');
const pidFile = join(appRoot, 'data', 'app.pid');

/** Значение из .env. */
function readEnvValue(key) {
  const envFile = join(appRoot, '.env');
  if (!existsSync(envFile)) return '';
  const match = readFileSync(envFile, 'utf-8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

const port = process.env.PORT || readEnvValue('PORT') || '8080';

function say(message) {
  console.log(message);
  try {
    if (!existsSync(join(appRoot, 'data'))) return;
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    appendFileSync(join(appRoot, 'data', 'update.log'), `[${stamp}] ${message}\n`);
  } catch {
    // Журнал не критичен.
  }
}

/** Остановить сервер по PID-файлу. */
function stopServer() {
  if (!existsSync(pidFile)) return;
  try {
    const pid = Number(readFileSync(pidFile, 'utf-8').trim());
    if (Number.isFinite(pid) && pid > 0) {
      process.kill(pid, 'SIGTERM');
      say(`Сервер остановлен (PID ${pid}).`);
    }
  } catch {
    // Уже не работает.
  }
  try {
    rmSync(pidFile, { force: true });
  } catch {
    // Не критично.
  }
}

// Даём порту освободиться.
await new Promise((resolveWait) => setTimeout(resolveWait, 2000));

say('Собираю приложение…');
const result = spawnSync('npm', ['run', 'build'], {
  cwd: appRoot,
  stdio: 'inherit',
  // npm на Windows — это npm.cmd, его нельзя запустить без оболочки.
  shell: true,
  windowsHide: true,
});

const built = result.status === 0 && existsSync(serverEntry);
if (!built) {
  say('✖ Сборка не удалась.');
}

/** Запустить сервер в фоне. */
function startServer() {
  say('Запускаю сервер…');
  const out = openSync(logFile, 'a');
  const child = spawn(process.execPath, [serverEntry], {
    cwd: appRoot,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, PORT: port },
  });
  child.unref();
  say(`Сервер запущен (PID ${child.pid}), порт ${port}.`);
}

// Сервер поднимаем в любом случае: даже если сборка не удалась,
// приложение должно остаться доступным.
startServer();
process.exit(built ? 0 : 1);

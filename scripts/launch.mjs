/**
 * Запуск приложения: поднимает сервер и открывает браузер.
 *
 *   node scripts/launch.mjs
 *
 * Скрипт кроссплатформенный — одинаково работает на Windows и macOS.
 * Главное отличие от простого `npm start`: браузер открывается только
 * после того, как сервер реально ответил на /api/health. Иначе на медленной
 * машине браузер открывался бы на ещё не поднятый порт.
 *
 * Если сервер не поднялся — показываем причину: последние строки журнала.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import {
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(here, '..'));
const serverEntry = join(appRoot, 'apps', 'api', 'dist', 'server.js');
const webIndex = join(appRoot, 'apps', 'web', 'dist', 'index.html');
const logFile = join(appRoot, 'data', 'app.log');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Значение из .env. */
function readEnvValue(key) {
  const envFile = join(appRoot, '.env');
  if (!existsSync(envFile)) return '';
  const match = readFileSync(envFile, 'utf-8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

const preferredPort = Number(readEnvValue('PORT')) || 8080;

function say(message) {
  console.log(message);
}

/** Последние строки журнала сервера — для диагностики. */
function logTail(lines = 20) {
  try {
    if (!existsSync(logFile)) return '(журнала нет)';
    const text = readFileSync(logFile, 'utf-8');
    const all = text.split('\n').filter(Boolean);
    return all.slice(-lines).join('\n');
  } catch {
    return '(не удалось прочитать журнал)';
  }
}

/** Ответил ли сервер на этом порту. */
async function isAlive(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Занят ли порт кем-то другим. */
function isPortBusy(port) {
  return new Promise((resolvePromise) => {
    const probe = createServer();
    probe.once('error', () => resolvePromise(true));
    probe.once('listening', () => probe.close(() => resolvePromise(false)));
    probe.listen(port, '0.0.0.0');
  });
}

/**
 * Выбрать порт: желаемый из .env, а если занят — следующий свободный.
 *
 * На Windows порт 8080 часто занимает какая-нибудь системная служба,
 * и приложение не должно из-за этого не запускаться.
 */
async function pickPort() {
  for (let candidate = preferredPort; candidate < preferredPort + 20; candidate += 1) {
    if (!(await isPortBusy(candidate))) return candidate;
    if (await isAlive(candidate)) return candidate;
  }
  return preferredPort;
}

/** Открыть страницу в браузере. */
function openBrowser(target) {
  try {
    if (process.platform === 'darwin') {
      const child = spawn('open', [target], { detached: true, stdio: 'ignore' });
      child.unref();
    } else if (process.platform === 'win32') {
      const child = spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' });
      child.unref();
    } else {
      const child = spawn('xdg-open', [target], { detached: true, stdio: 'ignore' });
      child.unref();
    }
  } catch {
    // Браузер может не открыться — это не ошибка запуска.
  }
}

/** Собрать приложение. */
function build(reason) {
  say(reason);
  // npm на Windows — это npm.cmd, его нельзя запустить без оболочки.
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: appRoot,
    stdio: 'inherit',
    shell: true,
    windowsHide: true,
  });
  return result.status === 0;
}

/** Самое свежее время изменения среди исходников. */
function newestSourceTime() {
  const roots = [
    join(appRoot, 'apps', 'web', 'src'),
    join(appRoot, 'apps', 'api', 'src'),
    join(appRoot, 'packages', 'shared', 'src'),
    join(appRoot, 'packages', 'db', 'src'),
  ];
  let newest = 0;
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      const time = statSync(join(entry.parentPath ?? root, entry.name)).mtimeMs;
      if (time > newest) newest = time;
    }
  }
  // package.json меняет состав команд — тоже повод пересобрать.
  for (const file of ['package.json', 'package-lock.json']) {
    const path = join(appRoot, file);
    if (existsSync(path)) {
      const time = statSync(path).mtimeMs;
      if (time > newest) newest = time;
    }
  }
  return newest;
}

/**
 * Устарела ли сборка.
 *
 * Главный случай: обновление через git pull меняет исходники, но папка dist
 * остаётся старой — и сервер отдаёт прежний интерфейс. Поэтому сравниваем
 * время исходников со временем сборки и пересобираем, если она старше.
 */
function isBuildStale() {
  if (!existsSync(serverEntry) || !existsSync(webIndex)) return true;
  const sourceTime = newestSourceTime();
  if (!sourceTime) return false;
  const webTime = statSync(webIndex).mtimeMs;
  const apiTime = existsSync(serverEntry) ? statSync(serverEntry).mtimeMs : 0;
  return sourceTime > webTime || sourceTime > apiTime;
}

say('Запускаю «Мастерскую»…');

// 1. Сборка должна быть свежей относительно исходников.
if (isBuildStale()) {
  if (!build('Исходники изменились — пересобираю приложение…')) {
    say('');
    say('✖ Не удалось собрать приложение. Подробности — в выводе выше.');
    process.exit(1);
  }
}

// 2. Выбираем порт: желаемый из .env, а если занят — следующий свободный.
const port = await pickPort();
const url = `http://127.0.0.1:${port}/`;
if (port !== preferredPort) {
  say(`Порт ${preferredPort} занят — использую свободный ${port}.`);
}

// 3. Если сервер уже работает — просто открываем браузер.
if (await isAlive(port)) {
  say(`Приложение уже запущено: ${url}`);
  openBrowser(url);
  process.exit(0);
}

// 4. Убираем старый PID-файл, если сервер умер неровно.
const pidFile = join(appRoot, 'data', 'app.pid');
if (existsSync(pidFile)) {
  try {
    rmSync(pidFile, { force: true });
  } catch {
    // Не критично.
  }
}

// 5. Запускаем сервер в фоне, вывод — в журнал.
mkdirSync(dirname(logFile), { recursive: true });
const out = openSync(logFile, 'a');
const child = spawn(process.execPath, [serverEntry], {
  cwd: appRoot,
  detached: true,
  windowsHide: true,
  stdio: ['ignore', out, out],
  env: { ...process.env, PORT: String(port) },
});
child.unref();
say(`Сервер запускается (PID ${child.pid}), порт ${port}…`);

// 6. Ждём, пока сервер реально ответит.
let ready = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  await sleep(500);
  if (await isAlive(port)) {
    ready = true;
    break;
  }
}

if (!ready) {
  say('');
  say('✖ Сервер не запустился. Последние строки журнала:');
  say(logTail(25));
  say('');
  say(`Журнал: ${logFile}`);

  // Самая частая причина на Windows — нативный модуль SQLite не подходит
  // к версии Node: тогда в журнале есть «was compiled against a different
  // Node.js version» или ошибка загрузки .node-файла.
  const tail = logTail(60);
  if (
    tail.includes('NODE_MODULE_VERSION') ||
    tail.includes('was compiled against a different Node.js version') ||
    tail.includes('ERR_DLOPEN_FAILED')
  ) {
    say('');
    say('Причина: модуль SQLite не подходит к этой версии Node.');
    say(`Сейчас Node.js ${process.version}, а приложению нужен Node.js 22 или новее.`);
    say('Запустите install.cmd (Windows) или ./install.sh (macOS) — он поставит подходящую версию.');
  } else {
    say('Частая причина: порт занят другой программой.');
    say(`Проверьте порт ${port} или смените PORT в файле .env.`);
  }
  process.exit(1);
}

say(`Готово: ${url}`);
openBrowser(url);
process.exit(0);

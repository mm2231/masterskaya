/**
 * Обновление приложения из GitHub.
 *
 *   node scripts/apply-update.mjs check    — проверить, есть ли обновления
 *   node scripts/apply-update.mjs install  — установить и перезапустить
 *
 * Все команды git вызываются с фиксированными аргументами: никакого
 * пользовательского ввода в команды не попадает. Обновление — только
 * fast-forward (--ff-only), история коммитов не переписывается.
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(here, '..'));
const logFile = join(appRoot, 'data', 'update.log');

/** Вывести строку и записать её в журнал обновлений. */
function say(message) {
  console.log(message);
  try {
    if (!existsSync(dirname(logFile))) return;
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    writeFileSync(logFile, `[${stamp}] ${message}\n`, { flag: 'a' });
  } catch {
    // Журнал не критичен.
  }
}

/** Выполнить команду и вернуть её вывод. Бросает исключение при ошибке. */
function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: appRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // На Windows не показываем чёрное окно консоли.
      windowsHide: true,
      ...options,
    }).trim();
  } catch (error) {
    // Понятное сообщение: что за команда, что она ответила.
    const failure = error;
    const details = String(failure?.stderr ?? '').trim().split('\n').slice(-6).join('\n');
    throw new Error(
      `команда «${command} ${args.join(' ')}» завершилась с кодом ${failure?.status ?? '?'}` +
        (details ? `:\n${details}` : ''),
    );
  }
}

/**
 * Команда npm.
 *
 * На Windows npm — это npm.cmd, а execFile без shell такие файлы не запускает:
 * скрипт падал с ENOENT, и обновление не применялось. Поэтому на Windows
 * указываем npm.cmd явно.
 */
function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

/** Есть ли в папке репозиторий git? */
function isGitRepo() {
  try {
    run('git', ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

/** Есть ли git в системе? */
function hasGit() {
  try {
    run('git', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/** Значение из .env. */
function readEnvValue(key) {
  const envFile = join(appRoot, '.env');
  if (!existsSync(envFile)) return '';
  const match = readFileSync(envFile, 'utf-8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

/** Текущий коммит: хеш, короткий хеш, дата и тема сообщения. */
function currentCommit() {
  const hash = run('git', ['rev-parse', 'HEAD']);
  const short = run('git', ['rev-parse', '--short', 'HEAD']);
  const date = run('git', ['log', '-1', '--format=%cd', '--date=iso']);
  const subject = run('git', ['log', '-1', '--format=%s']);
  return { hash, short, date, subject };
}

/** Коммит в origin/main (после fetch). */
function remoteCommit() {
  try {
    run('git', ['fetch', 'origin', '--quiet']);
    const hash = run('git', ['rev-parse', 'origin/main']);
    const subject = run('git', ['log', '-1', '--format=%s', 'origin/main']);
    const count = run('git', ['rev-list', '--count', 'HEAD..origin/main']);
    return { hash, subject, behind: Number(count) || 0 };
  } catch {
    return null;
  }
}

/** Проверка обновлений. */
function check() {
  if (!hasGit()) {
    return { available: false, reason: 'В системе нет программы git' };
  }
  if (!isGitRepo()) {
    return { available: false, reason: 'Папка приложения не является git-репозиторием' };
  }
  const current = currentCommit();
  const remote = remoteCommit();
  if (!remote) {
    return { available: false, current, reason: 'Не удалось получить данные с GitHub' };
  }
  return {
    available: remote.behind > 0,
    current,
    remote,
    reason: remote.behind > 0 ? `Доступно обновлений: ${remote.behind}` : 'Установлена последняя версия',
  };
}


/** Порт, на котором работало приложение: сначала окружение, потом .env. */
function resolvePort() {
  return process.env.PORT || readEnvValue('PORT') || '8080';
}

/** Занял ли кто-то порт? */
function portBusy(port) {
  try {
    const output = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean).length > 0;
  } catch {
    return false;
  }
}

/** Остановить работающий сервер (по PID-файлу). */
function stopServer() {
  const pidFile = join(appRoot, 'data', 'app.pid');
  if (existsSync(pidFile)) {
    const pid = Number(readFileSync(pidFile, 'utf-8').trim());
    if (Number.isFinite(pid) && pid > 0) {
      try {
        process.kill(pid, 'SIGTERM');
        say(`Сервер остановлен (PID ${pid}).`);
      } catch {
        // Уже не работает.
      }
    }
  }
  // Даём порту освободиться.
  try {
    run('sh', ['-c', 'sleep 2'], { stdio: 'ignore' });
  } catch {
    // Не критично.
  }
}

/** Запустить сервер заново в фоне. */
function startServer(port) {
  const logPath = join(appRoot, 'data', 'app.log');
  const out = openSync(logPath, 'a');
  const child = spawn(process.execPath, ['apps/api/dist/server.js'], {
    cwd: appRoot,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, PORT: port },
  });
  child.unref();
  say(`Сервер запущен (PID ${child.pid}), порт ${port}.`);
}

/** Открыть страницу в браузере. */
function openBrowser(url) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
  } catch {
    // Браузер может не открыться — не критично.
  }
}

const mode = process.argv[2] ?? 'check';

if (mode === 'check') {
  const result = check();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.available ? 10 : 0);
}

if (mode === 'install') {
  if (!hasGit() || !isGitRepo()) {
    say('✖ Обновление невозможно: нет git или это не git-репозиторий.');
    process.exit(1);
  }

  const before = check();
  if (!before.available) {
    say(`Обновление не требуется: ${before.reason ?? 'установлена последняя версия'}`);
    process.exit(0);
  }

  say(`Текущая версия: ${before.current.short} — ${before.current.subject}`);
  say(`Обновлений: ${before.remote.behind}`);

  try {
    say('Забираю изменения с GitHub…');
    run('git', ['pull', '--ff-only', 'origin', 'main']);
    say(`Забрано коммитов: ${before.remote.behind}`);

    say('Ставлю зависимости…');
    run(npmCommand(), ['ci', '--no-audit', '--no-fund']);

    say('Собираю приложение…');
    run(npmCommand(), ['run', 'build']);

    const port = resolvePort();
    stopServer();

    if (portBusy(port)) {
      say(`⚠ Порт ${port} занят другой программой — сервер не сможет запуститься.`);
      say('  Освободите порт и запустите приложение вручную.');
    }

    startServer(port);

    const after = currentCommit();
    say(`✔ Обновление установлено: ${after.short} — ${after.subject}`);
    setTimeout(() => openBrowser(`http://127.0.0.1:${port}/`), 2500);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    say(`✖ Обновление не удалось: ${message}`);
    say('Приложение продолжает работать на прежней версии.');
    process.exit(1);
  }
}

console.error(`Неизвестный режим: ${mode}. Доступны: check, install.`);
process.exit(2);
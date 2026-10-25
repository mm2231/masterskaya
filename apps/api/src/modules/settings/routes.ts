/** HTTP-маршруты настроек: /api/settings… */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { platform, release, arch } from 'node:os';
import { join, resolve } from 'node:path';

import { count } from 'drizzle-orm';
import { nowSql, timezoneLabel } from '@masterskaya/shared';
import { clients, documents, orders, payments } from '@masterskaya/db';
import type { FastifyInstance } from 'fastify';

import { db } from '../../db.js';
import { repoRoot } from '../../env.js';
import { exportAll, importAll } from './export.js';
import { getSetting, getWorkshop, setSetting } from './repository.js';

/** Версия приложения — из package.json в корне репозитория. */
function appVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(repoRoot, 'package.json'), 'utf-8'),
    ) as { version?: string };
    return pkg.version ?? '—';
  } catch {
    return '—';
  }
}

/**
 * Состояние сборки: когда собраны интерфейс и сервер.
 *
 * Показывает, свежая ли загруженная версия: если дата сборки интерфейса
 * старее даты изменения исходников — значит, обновление применило код,
 * но не пересобрало интерфейс.
 */
function buildInfo() {
  const timeOf = (relative: string) => {
    const path = resolve(repoRoot, relative);
    if (!existsSync(path)) return null;
    return statSync(path).mtimeMs;
  };

  // Самый свежий исходник — для сравнения со временем сборки.
  const roots = [
    'apps/web/src',
    'apps/api/src',
    'packages/shared/src',
    'packages/db/src',
  ];
  let newestSource = 0;
  for (const root of roots) {
    const dir = resolve(repoRoot, root);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      const time = statSync(join(entry.parentPath ?? dir, entry.name)).mtimeMs;
      if (time > newestSource) newestSource = time;
    }
  }

  const webTime = timeOf('apps/web/dist/index.html');
  const apiTime = timeOf('apps/api/dist/server.js');
  const format = (ms: number | null) =>
    ms === null ? null : new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

  return {
    webBuilt: format(webTime),
    apiBuilt: format(apiTime),
    newestSource: format(newestSource || null),
    /** Сборка отстаёт от исходников — интерфейс может быть старым. */
    stale: Boolean(
      newestSource &&
        ((webTime !== null && webTime < newestSource) ||
          (apiTime !== null && apiTime < newestSource)),
    ),
  };
}

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Диагностика: что за машина, где база, что в журнале.
   *
   * Нужна, когда пользователь звонит «не запускается» — скидывает этот отчёт,
   * и видно причину без копания в файлах.
   */
  app.get('/api/settings/diagnostics', async () => {
    const database = join(repoRoot, 'data', 'workshop.db');
    const logPath = join(repoRoot, 'data', 'app.log');

    let logTail: string[] = [];
    if (existsSync(logPath)) {
      try {
        const text = readFileSync(logPath, 'utf-8');
        logTail = text.split('\n').filter(Boolean).slice(-40);
      } catch {
        logTail = ['(не удалось прочитать журнал)'];
      }
    }

    // Сколько записей в базе — признак, что БД открылась нормально.
    // Счёт берём типизированными запросами Drizzle — без сырого SQL.
    const counts: Record<string, number | string> = {};
    try {
      const conn = db();
      counts.orders = Number(conn.select({ value: count() }).from(orders).get()?.value ?? 0);
      counts.clients = Number(conn.select({ value: count() }).from(clients).get()?.value ?? 0);
      counts.documents = Number(
        conn.select({ value: count() }).from(documents).get()?.value ?? 0,
      );
      counts.payments = Number(conn.select({ value: count() }).from(payments).get()?.value ?? 0);
    } catch (error) {
      counts.error = 'не удалось посчитать';
      counts.message = String(error).slice(0, 200);
    }

    return {
      system: {
        platform: platform(),
        release: release(),
        arch: arch(),
        node: process.version,
      },
      app: {
        repoRoot,
        port: process.env.PORT ?? '—',
        version: appVersion(),
        authEnabled: Boolean(process.env.APP_PASSWORD),
        /** Часовой пояс мастерской — время в базе хранится в нём. */
        timezone: timezoneLabel(),
        localTime: nowSql(),
      },
      build: buildInfo(),
      database: {
        path: database,
        exists: existsSync(database),
        sizeKb: existsSync(database) ? Math.round(statSync(database).size / 1024) : 0,
        counts,
      },
      log: {
        path: logPath,
        exists: existsSync(logPath),
        tail: logTail,
      },
    };
  });

  app.get('/api/settings/workshop', async () => {
    return { workshop: await getWorkshop(db()) };
  });

  app.put('/api/settings/workshop', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string>;
    const workshop = {
      name: (body.name ?? '').trim(),
      owner: (body.owner ?? '').trim(),
      unp: (body.unp ?? '').trim(),
      address: (body.address ?? '').trim(),
      phone: (body.phone ?? '').trim(),
    };
    await setSetting(db(), 'workshop', workshop);
    return { workshop };
  });

  /** Выгрузка всех данных в JSON — перенос между компьютерами. */
  app.get('/api/settings/export', async (_request, reply) => {
    const data = await exportAll(db());
    // Имя файла — по локальному времени, чтобы совпадало с записями в базе.
    const stamp = nowSql().slice(0, 16).replace(' ', '_').replace(':', '-');
    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="masterskaya_${stamp}.json"`)
      .send(JSON.stringify(data, null, 2));
  });

  /** Загрузка данных из JSON. */
  app.post('/api/settings/import', async (request, reply) => {
    const payload = (request.body ?? {}) as Record<string, unknown>;
    if (!payload || typeof payload !== 'object') {
      return reply.code(400).send({ error: 'Ожидался JSON-файл с данными' });
    }
    const report = await importAll(db(), payload);
    return { report };
  });

  /** Шаблоны нумерации заказов и актов. */
  app.get('/api/settings/numbering', async () => {
    return {
      orderNumberPattern:
        (await getSetting<string>(db(), 'orderNumberPattern')) ?? '{YYYY}-{SEQ}',
      documentNumberPattern:
        (await getSetting<string>(db(), 'documentNumberPattern')) ?? '{YYYY}-{SEQ}',
    };
  });

  /**
   * Проверка обновлений: текущая версия и есть ли новая на GitHub.
   *
   * Скрипт вызывается с фиксированным аргументом — пользовательский ввод
   * в команды не попадает.
   */
  app.get('/api/settings/update', async (_request, reply) => {
    const result = await runUpdateScript('check');
    if (result.code === null) {
      return reply.code(500).send({ error: 'Не удалось проверить обновления' });
    }
    // Скрипт отдаёт JSON в stdout и код 10, если обновления есть.
    const payload = parseUpdateOutput(result.stdout);
    return { ...payload, ok: result.code === 0 || result.code === 10 };
  });

  /**
   * Установка обновления: git pull → npm ci → сборка → перезапуск сервера.
   *
   * Скрипт работает в фоне: сервер перезапустится сам, когда всё будет готово.
   */
  app.post('/api/settings/update', async (_request, reply) => {
    const started = spawn(
      process.execPath,
      [resolve(repoRoot, 'scripts/apply-update.mjs'), 'install'],
      {
        cwd: repoRoot,
        detached: true,
        stdio: 'ignore',
        // На Windows без этого появляется чёрное окно консоли.
        windowsHide: true,
      },
    );
    started.unref();
    return { started: true, message: 'Обновление запущено. Приложение перезапустится.' };
  });

  app.put('/api/settings/numbering', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string>;
    if (body.orderNumberPattern) {
      await setSetting(db(), 'orderNumberPattern', body.orderNumberPattern.trim());
    }
    if (body.documentNumberPattern) {
      await setSetting(db(), 'documentNumberPattern', body.documentNumberPattern.trim());
    }
    return {
      orderNumberPattern:
        (await getSetting<string>(db(), 'orderNumberPattern')) ?? '{YYYY}-{SEQ}',
      documentNumberPattern:
        (await getSetting<string>(db(), 'documentNumberPattern')) ?? '{YYYY}-{SEQ}',
    };
  });
}

/** Результат запуска скрипта обновления. */
interface ScriptResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Запустить скрипт обновления и дождаться результата.
 *
 * Режим — фиксированная строка, путь к скрипту — постоянный.
 */
function runUpdateScript(mode: 'check' | 'install'): Promise<ScriptResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(
      process.execPath,
      [resolve(repoRoot, 'scripts/apply-update.mjs'), mode],
      {
        cwd: repoRoot,
        // На Windows без этого появляется и сразу исчезает чёрное окно.
        windowsHide: true,
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
    child.on('error', () => resolvePromise({ code: null, stdout, stderr }));
  });
}

/** Разобрать JSON-вывод скрипта проверки обновлений. */
function parseUpdateOutput(stdout: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return parsed;
  } catch {
    return { available: false, reason: 'Скрипт проверки не ответил' };
  }
}

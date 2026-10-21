/** HTTP-маршруты настроек: /api/settings… */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import type { FastifyInstance } from 'fastify';

import { db } from '../../db.js';
import { repoRoot } from '../../env.js';
import { exportAll, importAll } from './export.js';
import { getSetting, getWorkshop, setSetting } from './repository.js';

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
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
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
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
      { cwd: repoRoot, detached: true, stdio: 'ignore' },
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
      { cwd: repoRoot },
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

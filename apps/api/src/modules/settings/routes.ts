/** HTTP-маршруты настроек: /api/settings… */

import type { FastifyInstance } from 'fastify';

import { db } from '../../db.js';
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

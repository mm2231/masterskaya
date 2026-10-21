/** HTTP-маршруты настроек: /api/settings… */

import type { FastifyInstance } from 'fastify';

import { db } from '../../db.js';
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

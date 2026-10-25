/** HTTP-маршруты клиентов: /api/clients… */

import {
  clientInputSchema,
  clientUpdateSchema,
  normalizePhone,
} from '@masterskaya/shared';
import type { FastifyInstance } from 'fastify';

import { db } from '../../db.js';
import {
  allPhones,
  clientDevices,
  clientOrders,
  clientStats,
  createClient,
  deleteClient,
  findByPhone,
  getClient,
  listClients,
  updateClient,
} from './repository.js';

export async function registerClientRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/clients', async (request) => {
    const query = request.query as {
      q?: string;
      limit?: string;
      offset?: string;
      sort?: string;
    };
    const result = await listClients(db(), {
      q: query.q?.trim() || undefined,
      limit: Math.min(Number(query.limit) || 50, 200),
      offset: Number(query.offset) || 0,
      sort:
        query.sort === 'name' || query.sort === 'orders' || query.sort === 'recent'
          ? query.sort
          : 'recent',
    });
    return result;
  });

  /** Подсказки клиентов для автодополнения в форме заказа. */
  app.get('/api/clients/suggest', async (request) => {
    const query = request.query as { q?: string };
    const result = await listClients(db(), {
      q: query.q?.trim() || undefined,
      limit: 10,
      offset: 0,
      sort: 'recent',
    });
    return {
      clients: result.items.map((item) => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/api/clients/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const client = await getClient(db(), id);
    if (!client) {
      return reply.code(404).send({ error: 'Клиент не найден' });
    }
    const [orderList, deviceList, stats] = await Promise.all([
      clientOrders(db(), id),
      clientDevices(db(), id),
      clientStats(db(), id),
    ]);
    return { client, orders: orderList, devices: deviceList, stats };
  });

  app.post('/api/clients', async (request, reply) => {
    const parsed = clientInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Проверьте данные', details: parsed.error.issues });
    }
    const data = parsed.data;
    const phone = normalizePhone(data.phone);

    const existing = await findByPhone(db(), phone);
    if (existing) {
      return reply.code(409).send({
        error: 'Клиент с таким телефоном уже есть',
        clientId: existing.id,
      });
    }

    const client = await createClient(db(), { ...data, phone });
    return reply.code(201).send({ client });
  });

  app.patch<{ Params: { id: string } }>('/api/clients/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const parsed = clientUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Проверьте данные', details: parsed.error.issues });
    }
    const data = { ...parsed.data };
    if (data.name !== undefined) {
      // Пустое имя — это «убрать», а не «оставить как есть».
      data.name = data.name.trim();
    }
    if (data.phone) {
      data.phone = normalizePhone(data.phone);
      const duplicate = await findByPhone(db(), data.phone);
      if (duplicate && duplicate.id !== id) {
        return reply.code(409).send({ error: 'Этот телефон уже записан за другим клиентом' });
      }
    }
    const client = await updateClient(db(), id, data);
    if (!client) {
      return reply.code(404).send({ error: 'Клиент не найден' });
    }
    return { client };
  });

  app.delete<{ Params: { id: string } }>('/api/clients/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const ok = await deleteClient(db(), id);
    if (!ok) {
      return reply.code(404).send({ error: 'Клиент не найден' });
    }
    return { ok: true };
  });

  /** Проверка импорта: телефоны, которые уже заняты. */
  app.get('/api/clients/phones', async () => {
    return { phones: await allPhones(db()) };
  });
}

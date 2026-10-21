/** HTTP-маршруты заказов: /api/orders… */

import {
  allowedTransitions,
  canTransition,
  isOrderStatus,
  nowSql,
  orderInputSchema,
  orderPatchSchema,
  statusLabel,
} from '@masterskaya/shared';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

import { db } from '../../db.js';
import { clients } from '@masterskaya/db';
import { getSetting } from '../settings/repository.js';
import { nextOrderNumber } from './numbering.js';
import {
  countByStatus,
  createOrder,
  deleteOrder,
  getOrderWithClient,
  listOrders,
  logEvent,
  orderHistory,
  updateOrder,
} from './repository.js';

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/orders', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const result = await listOrders(db(), {
      q: query.q?.trim() || undefined,
      status: query.status || undefined,
      statuses: query.statuses || undefined,
      clientId: query.clientId ? Number(query.clientId) : undefined,
      from: query.from || undefined,
      to: query.to || undefined,
      limit: Math.min(Number(query.limit) || 50, 200),
      offset: Number(query.offset) || 0,
      sort:
        query.sort === 'date_asc' || query.sort === 'sum_desc' || query.sort === 'sum_asc'
          ? query.sort
          : 'date_desc',
    });
    return { ...result, counts: await countByStatus(db()) };
  });

  /** Счётчики статусов — для бокового меню. */
  app.get('/api/orders/counts', async () => {
    return { counts: await countByStatus(db()) };
  });

  app.get<{ Params: { id: string } }>('/api/orders/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const loaded = await getOrderWithClient(db(), id);
    if (!loaded) {
      return reply.code(404).send({ error: 'Заказ не найден' });
    }
    const history = await orderHistory(db(), id);
    return {
      ...loaded,
      history,
      allowedTransitions: allowedTransitions(loaded.order.status),
    };
  });

  app.post('/api/orders', async (request, reply) => {
    const parsed = orderInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Проверьте данные', details: parsed.error.issues });
    }
    const data = parsed.data;

    // Сумма за ремонт обязательна: это единственный итог, который видит клиент.
    if (!Number.isFinite(data.clientTotal) || data.clientTotal <= 0) {
      return reply.code(400).send({ error: 'Укажите сумму за ремонт больше нуля' });
    }
    if (data.costTotal < 0) {
      return reply.code(400).send({ error: 'Себестоимость не может быть отрицательной' });
    }

    const pattern = (await getSetting<string>(db(), 'orderNumberPattern')) ?? '{YYYY}-{SEQ}';
    const number = await nextOrderNumber(db(), pattern);

    const order = await createOrder(db(), { ...data, number });
    await logEvent(db(), order.id, 'created', `Заказ ${number} создан`, {
      status: order.status,
    });

    return reply.code(201).send({ order });
  });

  app.patch<{ Params: { id: string } }>('/api/orders/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const parsed = orderPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Проверьте данные', details: parsed.error.issues });
    }
    const data: Record<string, unknown> = { ...parsed.data };

    const current = await getOrderWithClient(db(), id);
    if (!current) {
      return reply.code(404).send({ error: 'Заказ не найден' });
    }

    // Пустое имя или телефон — это «убрать», а не «оставить как есть».
    if (data.clientName !== undefined) {
      data.clientName = String(data.clientName).trim() || null;
    }
    if (data.clientPhone !== undefined) {
      data.clientPhone = String(data.clientPhone).trim() || null;
    }

    // Обновить ли имя в справочнике клиентов — по запросу.
    const alsoUpdateClient = data.updateClientName === true;
    delete data.updateClientName;

    // Смена статуса — с проверкой перехода и фиксацией в журнале.
    if (data.status && data.status !== current.order.status) {
      if (!isOrderStatus(data.status)) {
        return reply.code(400).send({ error: 'Неизвестный статус' });
      }
      if (!canTransition(current.order.status, data.status)) {
        return reply.code(400).send({
          error: `Нельзя перевести заказ из «${statusLabel(current.order.status)}» в «${statusLabel(
            data.status,
          )}»`,
        });
      }

      const now = nowSql();
      if (data.status === 'ready' && !current.order.readyAt) {
        data.readyAt = now;
      }
      if (data.status === 'issued') {
        // Дата выдачи ставится один раз: по ней считается выручка периода.
        data.issuedAt = current.order.issuedAt ?? now;
      } else if (current.order.issuedAt) {
        // Заказ вернули из «Выдан» — деньги ещё не получены, дату убираем.
        data.issuedAt = null;
      }
    }

    const order = await updateOrder(db(), id, data);
    if (!order) {
      return reply.code(404).send({ error: 'Заказ не найден' });
    }

    if (data.status && data.status !== current.order.status) {
      await logEvent(
        db(),
        id,
        'status_changed',
        `Статус: ${statusLabel(current.order.status)} → ${statusLabel(data.status)}`,
        { from: current.order.status, to: data.status },
      );
    }
    if (data.clientTotal !== undefined && data.clientTotal !== current.order.clientTotal) {
      await logEvent(db(), id, 'total_changed', `Сумма для клиента: ${data.clientTotal}`, {
        from: current.order.clientTotal,
        to: data.clientTotal,
      });
    }
    if (data.costTotal !== undefined && data.costTotal !== current.order.costTotal) {
      await logEvent(db(), id, 'cost_changed', `Себестоимость: ${data.costTotal}`, {
        from: current.order.costTotal,
        to: data.costTotal,
      });
    }
    if (data.clientName !== undefined && data.clientName !== current.order.clientName) {
      await logEvent(
        db(),
        id,
        'client_changed',
        data.clientName ? `Клиент: ${data.clientName}` : 'Клиент убран',
        { from: current.order.clientName, to: data.clientName },
      );

      // По просьбе меняем имя и в справочнике клиентов.
      if (alsoUpdateClient && current.order.clientId && data.clientName) {
        await db()
          .update(clients)
          .set({ name: String(data.clientName), updatedAt: nowSql() })
          .where(eq(clients.id, current.order.clientId))
          .run();
      }
    }

    return { order };
  });

  app.delete<{ Params: { id: string } }>('/api/orders/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const ok = await deleteOrder(db(), id);
    if (!ok) {
      return reply.code(404).send({ error: 'Заказ не найден' });
    }
    return { ok: true };
  });

  /** Заметка в журнал событий. */
  app.post<{ Params: { id: string } }>('/api/orders/:id/notes', async (request, reply) => {
    const id = Number(request.params.id);
    const body = (request.body ?? {}) as { message?: string };
    const message = (body.message ?? '').trim();
    if (!message) {
      return reply.code(400).send({ error: 'Пустая заметка' });
    }
    const order = await getOrderWithClient(db(), id);
    if (!order) {
      return reply.code(404).send({ error: 'Заказ не найден' });
    }
    const event = await logEvent(db(), id, 'note', message);
    return reply.code(201).send({ event });
  });
}

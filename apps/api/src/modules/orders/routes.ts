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
import { clients, orders, inTransaction } from '@masterskaya/db';
import { findOrCreateClient } from '../clients/repository.js';
import { getSetting } from '../settings/repository.js';
import { nextOrderNumber } from './numbering.js';
import {
  countByStatus,
  createOrder,
  deleteOrder,
  findOrdersByPhone,
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

  /**
   * Прошлые заказы по телефону — подсказка при оформлении нового заказа.
   */
  app.get('/api/orders/by-phone', async (request) => {
    const query = request.query as { phone?: string };
    const phone = query.phone?.trim() ?? '';
    if (phone.length < 5) return { items: [] };
    const items = await findOrdersByPhone(db(), phone);
    return { items };
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

    // Клиент заводится сам: справочник наполняется по мере оформления
    // заказов, руками ничего заполнять не нужно.
    const phone = data.clientPhone?.trim();

    // Клиент, заказ и событие в журнале пишутся одной транзакцией:
    // частичный заказ (без клиента или без события) невозможен.
    const order = inTransaction(db(), () => {
      let clientId = data.clientId ?? null;
      if (!clientId && phone) {
        const client = findOrCreateClient(db(), { name: data.clientName, phone });
        clientId = client?.id ?? null;
      }
      const created = createOrder(db(), {
        ...data,
        number,
        clientId,
        // Дата предоплаты — момент оформления: по ней деньги попадают
        // в доход нужного периода, даже если заказ ещё не выдан.
        prepaymentAt: data.prepayment > 0 ? nowSql() : null,
        // Снимок себестоимости: затраты могут вырасти до выдачи
        // (докупка запчастей), тогда в период выдачи уйдёт только
        // разница, а себестоимость не посчитается дважды.
        prepaymentCost: data.prepayment > 0 ? data.costTotal : null,
      });
      logEvent(db(), created.id, 'created', `Заказ ${number} создан`, {
        status: created.status,
      });
      return created;
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

    // Предоплата: при первом появлении датируем её сегодняшним днём —
    // по этой дате она попадает в доход периода, не дожидаясь выдачи.
    // Если дата уже была, не переносим её: повторное сохранение формы
    // не должно перекидывать предоплату в другой месяц.
    const prepaymentChanged =
      data.prepayment !== undefined && data.prepayment !== current.order.prepayment;
    if (prepaymentChanged) {
      if (Number(data.prepayment) > 0) {
        data.prepaymentAt = current.order.prepaymentAt ?? nowSql();
        // Снимок себестоимости — только при первом внесении предоплаты:
        // сумма предоплаты меняется, но затраты уже учтены на дату
        // первоначальной предоплаты и снимок не переносится.
        if (current.order.prepaymentAt) {
          data.prepaymentCost = current.order.prepaymentCost ?? current.order.costTotal;
        } else {
          data.prepaymentCost = data.costTotal ?? current.order.costTotal;
        }
      } else {
        data.prepaymentAt = null;
        data.prepaymentCost = null;
      }
    }

    // Обновление заказа, журнал событий и правка клиента в справочнике —
    // одна транзакция: либо всё, либо ничего.
    const order = inTransaction(db(), () => {
      const updated = updateOrder(db(), id, data);
      if (!updated) {
        return null;
      }

      if (data.status && data.status !== current.order.status) {
        logEvent(
          db(),
          id,
          'status_changed',
          `Статус: ${statusLabel(current.order.status)} → ${statusLabel(data.status)}`,
          { from: current.order.status, to: data.status },
        );
      }
      if (data.clientTotal !== undefined && data.clientTotal !== current.order.clientTotal) {
        logEvent(db(), id, 'total_changed', `Сумма для клиента: ${data.clientTotal}`, {
          from: current.order.clientTotal,
          to: data.clientTotal,
        });
      }
      if (data.costTotal !== undefined && data.costTotal !== current.order.costTotal) {
        logEvent(db(), id, 'cost_changed', `Себестоимость: ${data.costTotal}`, {
          from: current.order.costTotal,
          to: data.costTotal,
        });
      }
      if (prepaymentChanged) {
        logEvent(
          db(),
          id,
          'prepayment_changed',
          Number(data.prepayment) > 0 ? `Предоплата: ${data.prepayment}` : 'Предоплата убрана',
          { from: current.order.prepayment, to: data.prepayment },
        );
      }
      if (data.clientName !== undefined && data.clientName !== current.order.clientName) {
        logEvent(
          db(),
          id,
          'client_changed',
          data.clientName ? `Клиент: ${data.clientName}` : 'Клиент убран',
          { from: current.order.clientName, to: data.clientName },
        );

        // По просьбе меняем имя у клиента и во всех его заказах: в заказах
        // хранится копия имени, и без этого они расходятся.
        if (alsoUpdateClient && current.order.clientId && data.clientName) {
          const name = String(data.clientName);
          db().update(clients)
            .set({ name, updatedAt: nowSql() })
            .where(eq(clients.id, current.order.clientId))
            .run();
          db().update(orders)
            .set({ clientName: name })
            .where(eq(orders.clientId, current.order.clientId))
            .run();
        }
      }

      return updated;
    });

    if (!order) {
      return reply.code(404).send({ error: 'Заказ не найден' });
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

/** HTTP-маршруты финансов: /api/finance… */

import { paymentInputSchema, paymentPatchSchema, summarize, todayIso } from '@masterskaya/shared';
import { inTransaction } from '@masterskaya/db';
import type { FastifyInstance } from 'fastify';

import { db } from '../../db.js';
import { issuedInPeriod, logEvent } from '../orders/repository.js';
import {
  createExpenseCategory,
  createPayment,
  deletePayment,
  expensesByCategory,
  expensesInPeriod,
  issuedOnDay,
  listExpenseCategories,
  listPayments,
  manualCostInPeriod,
  manualIncomeInPeriod,
  orderPaid,
  paymentsOnDay,
  prepaymentsInPeriod,
  prepaymentsListInPeriod,
  prepaymentsOnDay,
  updatePayment,
} from './repository.js';

/** Границы периода: из запроса или текущий месяц. */
function periodBounds(query: Record<string, string | undefined>): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  return {
    from: query.from ?? iso(first),
    to: query.to ?? iso(now),
  };
}

export async function registerFinanceRoutes(app: FastifyInstance): Promise<void> {
  /** Сводка за период. */
  app.get('/api/finance/summary', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const { from, to } = periodBounds(query);

    const issued = await issuedInPeriod(db(), from, to);
    const manualIncome = await manualIncomeInPeriod(db(), from, to);
    const manualCost = await manualCostInPeriod(db(), from, to);
    const openPrepay = await prepaymentsInPeriod(db(), from, to);
    const expenses = await expensesInPeriod(db(), from, to);
    const byCategory = await expensesByCategory(db(), from, to);

    const summary = summarize(
      issued.map((order) => ({
        clientTotal: order.clientTotal,
        costTotal: order.costTotal,
        prepayment: order.prepayment,
        prepaymentAt: order.prepaymentAt,
      })),
      {
        manualIncome,
        manualCost,
        expenses,
        from,
        to,
        openPrepayments: openPrepay.prepayments
          ? [{ prepayment: openPrepay.prepayments, costTotal: openPrepay.cost }]
          : [],
      },
    );

    return { from, to, summary, expensesByCategory: byCategory };
  });

  /**
   * Сводка за текущий день: выручка, прибыль и список выданных заказов.
   *
   * Основа — заказы, выданные сегодня (по дате выдачи). Дополнительно
   * учитываются оплаты за сегодня: доходы без заказа и расходы.
   */
  /** Сводка за текущий день (или день из ?date=). */
  app.get('/api/finance/today', async (request) => {
    const params = request.query as Record<string, string | undefined>;
    const day =
      params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayIso();
    const issued = await issuedOnDay(db(), day);
    const movements = await paymentsOnDay(db(), day);
    const openPrepay = await prepaymentsOnDay(db(), day);
    // Список предоплат дня — отдельные строки для отчёта/выгрузки.
    const prepayList = await prepaymentsListInPeriod(db(), day, day);

    // Ручные доходы — только движения без заказа: выручка выданных заказов
    // уже учтена в issued и не должна считаться второй раз.
    const manualIncome = movements
      .filter((item) => item.direction === 'in' && item.orderId === null)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const manualCost = movements
      .filter((item) => item.direction === 'in' && item.orderId === null)
      .reduce((sum, item) => sum + Number(item.cost ?? 0), 0);
    const expenses = movements
      .filter((item) => item.direction === 'out')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const summary = summarize(
      issued.map((order) => ({
        clientTotal: order.clientTotal,
        costTotal: order.costTotal,
        prepayment: order.prepayment,
        prepaymentAt: order.prepaymentAt,
      })),
      {
        manualIncome,
        manualCost,
        expenses,
        from: day,
        to: day,
        openPrepayments: openPrepay.prepayments
          ? [{ prepayment: openPrepay.prepayments, costTotal: openPrepay.cost }]
          : [],
      },
    );

    return {
      date: day,
      summary,
      orders: issued.map((order) => ({
        ...order,
        profit: Number(order.clientTotal) - Number(order.costTotal),
      })),
      payments: movements,
      prepayments: prepayList,
    };
  });

  /** Журнал движений денег. */
  app.get('/api/finance/payments', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const items = await listPayments(db(), {
      from: query.from || undefined,
      to: query.to || undefined,
      direction: query.direction || undefined,
      limit: Math.min(Number(query.limit) || 100, 500),
      offset: Number(query.offset) || 0,
    });
    return { items };
  });

  app.post('/api/finance/payments', async (request, reply) => {
    const parsed = paymentInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Проверьте данные', details: parsed.error.issues });
    }
    const data = parsed.data;

    // Платёж и запись в журнале заказа — одна транзакция.
    const payment = inTransaction(db(), () => {
      const created = createPayment(db(), {
        orderId: data.orderId ?? null,
        direction: data.direction,
        amount: data.amount,
        cost: data.direction === 'in' ? (data.cost ?? 0) : 0,
        method: data.method,
        category: data.category || null,
        occurredOn: data.occurredOn,
        note: data.note || null,
      });

      if (data.orderId) {
        const message =
          data.direction === 'in'
            ? `Оплата: +${data.amount}`
            : `Расход по заказу: −${data.amount}`;
        logEvent(db(), data.orderId, 'payment', message, {
          paymentId: created.id,
          direction: data.direction,
          amount: data.amount,
        });
      }

      return created;
    });

    return reply.code(201).send({ payment });
  });

  app.patch<{ Params: { id: string } }>(
    '/api/finance/payments/:id',
    async (request, reply) => {
      const id = Number(request.params.id);
      const parsed = paymentPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Проверьте данные', details: parsed.error.issues });
      }
      const data = parsed.data;

      const changes: {
        amount?: number;
        cost?: number;
        method?: string;
        category?: string | null;
        occurredOn?: string;
        note?: string | null;
      } = {};
      if (data.amount !== undefined) changes.amount = data.amount;
      if (data.cost !== undefined) changes.cost = data.cost;
      if (data.method !== undefined) changes.method = data.method;
      // Пустая категория или комментарий — это отсутствие значения, а не пустая строка.
      if (data.category !== undefined) changes.category = data.category || null;
      if (data.occurredOn !== undefined) changes.occurredOn = data.occurredOn;
      if (data.note !== undefined) changes.note = data.note || null;

      const payment = await updatePayment(db(), id, changes);
      if (!payment) {
        return reply.code(404).send({ error: 'Запись не найдена' });
      }
      return { payment };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/finance/payments/:id',
    async (request, reply) => {
      const id = Number(request.params.id);
      const ok = await deletePayment(db(), id);
      if (!ok) {
        return reply.code(404).send({ error: 'Запись не найдена' });
      }
      return { ok: true };
    },
  );

  /** Долг по заказу: сумма минус оплачено. */
  app.get<{ Params: { id: string } }>('/api/finance/orders/:id/debt', async (request) => {
    const id = Number(request.params.id);
    const paid = await orderPaid(db(), id);
    return { paid };
  });

  /** Категории расходов. */
  app.get('/api/finance/categories', async () => {
    return { items: await listExpenseCategories(db()) };
  });

  app.post('/api/finance/categories', async (request, reply) => {
    const body = (request.body ?? {}) as {
      name?: string;
      kind?: string;
      budgetMonthly?: number;
    };
    const name = (body.name ?? '').trim();
    if (!name) {
      return reply.code(400).send({ error: 'Укажите название категории' });
    }
    const category = await createExpenseCategory(db(), {
      name,
      kind: body.kind === 'fixed' ? 'fixed' : 'variable',
      budgetMonthly: Number(body.budgetMonthly) || 0,
    });
    return reply.code(201).send({ category });
  });

  /** Выгрузка сводки в CSV для Excel. */
  app.get('/api/finance/export', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const { from, to } = periodBounds(query);

    const issued = await issuedInPeriod(db(), from, to);
    const prepayments = await prepaymentsListInPeriod(db(), from, to);
    const items = await listPayments(db(), { from, to, limit: 5000, offset: 0 });

    const rows: string[][] = [];
    rows.push([
      'Дата',
      'Тип',
      'Сумма',
      'Расходники',
      'Прибыль',
      'Категория/Метод',
      'Заказ',
      'Клиент',
      'Комментарий',
    ]);
    const money = (value: number) => value.toFixed(2).replace('.', ',');
    for (const order of issued) {
      const prepayment = Number(order.prepayment);
      const prepaidElsewhere =
        prepayment > 0 &&
        !!order.prepaymentAt &&
        ((order.prepaymentAt ?? '').slice(0, 10) < from ||
          (order.prepaymentAt ?? '').slice(0, 10) > to);
      // Предоплата, учтённая в прежнем периоде, повторно не выдаётся:
      // за день получена только доплата, её себестоимость уже списана.
      const revenue = prepaidElsewhere
        ? Number(order.clientTotal) - prepayment
        : Number(order.clientTotal);
      const cost = prepaidElsewhere ? 0 : Number(order.costTotal);
      rows.push([
        (order.issuedAt ?? '').slice(0, 10),
        prepaidElsewhere
          ? 'Доход (доплата за выданный заказ)'
          : 'Доход (выданный заказ)',
        money(revenue),
        money(cost),
        money(revenue - cost),
        '',
        order.number,
        order.clientName ?? '',
        // Что делали по заказу; если описания нет — устройство.
        order.workDescription || order.deviceLabel || '',
      ]);
    }
    for (const item of prepayments) {
      const cost = Number(item.costTotal ?? 0);
      rows.push([
        (item.prepaymentAt ?? '').slice(0, 10),
        'Предоплата (заказ не выдан)',
        money(Number(item.prepayment)),
        money(cost),
        money(Number(item.prepayment) - cost),
        '',
        item.number,
        item.clientName ?? '',
        item.deviceLabel ?? '',
      ]);
    }
    for (const item of items) {
      const cost = Number(item.cost ?? 0);
      const profit = item.direction === 'in' ? Number(item.amount) - cost : -Number(item.amount);
      rows.push([
        item.occurredOn,
        item.direction === 'in' ? 'Доход' : 'Расход',
        money(Number(item.amount)),
        item.direction === 'in' && cost ? money(cost) : '',
        money(profit),
        item.category || item.method,
        item.orderNumber ?? '',
        item.clientName ?? '',
        item.note ?? '',
      ]);
    }

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';'))
      .join('\r\n');
    // BOM — чтобы Excel не превращал русский текст в кракозябры.
    const payload = Buffer.from(`﻿${csv}`, 'utf-8');

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="finance_${from}_${to}.csv"`)
      .send(payload);
  });
}

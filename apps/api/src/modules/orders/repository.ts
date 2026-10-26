/** Работа с заказами: список, карточка, статусы, журнал событий. */

import { and, count, desc, eq, gte, inArray, like, lte, or, sql } from 'drizzle-orm';
import { nowSql } from '@masterskaya/shared';

import type { AppDatabase } from '../../db.js';
import { clients, documents, orderEvents, orders, payments } from '@masterskaya/db';

export interface OrderListFilters {
  q?: string;
  status?: string;
  /** Несколько статусов через запятую — для панелей дашборда. */
  statuses?: string;
  clientId?: number;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
  sort: 'date_desc' | 'date_asc' | 'sum_desc' | 'sum_asc';
}

/** Заказ вместе с именем клиента, количеством документов и полученными деньгами. */
export interface OrderListItem {
  id: number;
  number: string;
  clientId: number | null;
  clientName: string | null;
  clientPhone: string | null;
  deviceLabel: string | null;
  fault: string | null;
  status: string;
  clientTotal: number;
  costTotal: number;
  prepayment: number;
  prepaymentAt: string | null;
  /** Внесённые оплаты из кассы (без предоплаты) — для кассовой прибыли. */
  paid: number;
  acceptedAt: string;
  promisedAt: string | null;
  readyAt: string | null;
  issuedAt: string | null;
  createdAt: string;
  documentsCount: number;
}

/**
 * Прошлые заказы по телефону клиента.
 *
 * Нужны при оформлении нового заказа: мастер вводит телефон и сразу видит,
 * что у клиента уже чинили и за сколько. Ищется по совпадению цифр —
 * телефон могли записать по-разному.
 */
export async function findOrdersByPhone(
  database: AppDatabase,
  phone: string,
  limit = 5,
) {
  const digits = phone.replace(/\D/g, '');
  // Ищем по полному телефону и по его последним 9 цифрам.
  const patterns = digits.length >= 9 ? [phone, digits.slice(-9)] : [phone];

  const conditions = patterns.map((pattern) =>
    like(orders.clientPhone, `%${pattern}%`),
  );

  return database
    .select({
      id: orders.id,
      number: orders.number,
      clientName: orders.clientName,
      deviceLabel: orders.deviceLabel,
      fault: orders.fault,
      workDescription: orders.workDescription,
      clientTotal: orders.clientTotal,
      status: orders.status,
      acceptedAt: orders.acceptedAt,
    })
    .from(orders)
    .where(or(...conditions))
    .orderBy(desc(orders.acceptedAt))
    .limit(limit)
    .all();
}

/** Список заказов с фильтрами. */
export async function listOrders(
  database: AppDatabase,
  filters: OrderListFilters,
): Promise<{ items: OrderListItem[]; total: number }> {
  const conditions = [];

  if (filters.status) {
    conditions.push(eq(orders.status, filters.status));
  }
  if (filters.statuses) {
    const list = filters.statuses
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (list.length) {
      conditions.push(inArray(orders.status, list));
    }
  }
  if (filters.clientId) {
    conditions.push(eq(orders.clientId, filters.clientId));
  }
  if (filters.from) {
    conditions.push(sql`date(${orders.acceptedAt}) >= ${filters.from}`);
  }
  if (filters.to) {
    conditions.push(sql`date(${orders.acceptedAt}) <= ${filters.to}`);
  }
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conditions.push(
      or(
        like(orders.number, pattern),
        like(orders.clientName, pattern),
        like(orders.clientPhone, pattern),
        like(orders.deviceLabel, pattern),
      )!,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await database
    .select({
      id: orders.id,
      number: orders.number,
      clientId: orders.clientId,
      clientName: orders.clientName,
      clientPhone: orders.clientPhone,
      deviceLabel: orders.deviceLabel,
      fault: orders.fault,
      status: orders.status,
      clientTotal: orders.clientTotal,
      costTotal: orders.costTotal,
      prepayment: orders.prepayment,
      prepaymentAt: orders.prepaymentAt,
      paid: sql<number>`(
        select coalesce(sum(p.amount), 0)
        from ${payments} p
        where p.order_id = ${orders.id} and p.direction = 'in'
      )`,
      acceptedAt: orders.acceptedAt,
      promisedAt: orders.promisedAt,
      readyAt: orders.readyAt,
      issuedAt: orders.issuedAt,
      createdAt: orders.createdAt,
      documentsCount: sql<number>`(
        select count(*) from ${documents} d where d.order_id = ${orders.id}
      )`,
    })
    .from(orders)
    .where(where)
    .orderBy(
      filters.sort === 'date_asc'
        ? orders.acceptedAt
        : filters.sort === 'sum_desc'
          ? desc(orders.clientTotal)
          : filters.sort === 'sum_asc'
            ? orders.clientTotal
            : desc(orders.acceptedAt),
    )
    .limit(filters.limit)
    .offset(filters.offset)
    .all();

  const totalRow = await database
    .select({ value: count() })
    .from(orders)
    .where(where)
    .get();

  return { items: rows as OrderListItem[], total: Number(totalRow?.value ?? 0) };
}

/** Один заказ по id. */
export async function getOrder(database: AppDatabase, id: number) {
  return database.select().from(orders).where(eq(orders.id, id)).get();
}

/** Заказ с данными клиента (для печатных документов). */
export async function getOrderWithClient(database: AppDatabase, id: number) {
  const order = await getOrder(database, id);
  if (!order) return null;
  const client = order.clientId
    ? await database.select().from(clients).where(eq(clients.id, order.clientId)).get()
    : undefined;
  return { order, client };
}

/** Журнал событий заказа — от свежих к старым. */
export async function orderHistory(database: AppDatabase, orderId: number) {
  return database
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(desc(orderEvents.createdAt))
    .all();
}

/** Добавить запись в журнал событий. */
export function logEvent(
  database: AppDatabase,
  orderId: number,
  type: string,
  message?: string,
  payload?: Record<string, unknown>,
) {
  const [row] = database
    .insert(orderEvents)
    .values({
      orderId,
      type,
      message: message ?? null,
      payload: payload ?? null,
      // Время задаём явно: значение по умолчанию в схеме — это UTC.
      createdAt: nowSql(),
    })
    .returning()
    .all();
  return row!;
}

/** Создать заказ. */
export function createOrder(
  database: AppDatabase,
  data: {
    number: string;
    clientId?: number | null;
    clientName?: string | null;
    clientPhone?: string | null;
    deviceLabel?: string | null;
    fault?: string | null;
    appearance?: string | null;
    accessories?: string | null;
    workDescription?: string | null;
    status: string;
    clientTotal: number;
    costTotal: number;
    /** Предоплата: сразу идёт в доход. */
    prepayment?: number;
    prepaymentAt?: string | null;
    promisedAt?: string | null;
    notes?: string | null;
    warrantyMonths?: number;
  },
) {
  const [row] = database
    .insert(orders)
    .values({
      number: data.number,
      clientId: data.clientId ?? null,
      clientName: data.clientName ?? null,
      clientPhone: data.clientPhone ?? null,
      deviceLabel: data.deviceLabel ?? null,
      fault: data.fault ?? null,
      appearance: data.appearance ?? null,
      accessories: data.accessories ?? null,
      workDescription: data.workDescription ?? null,
      status: data.status,
      clientTotal: data.clientTotal,
      costTotal: data.costTotal,
      prepayment: data.prepayment ?? 0,
      prepaymentAt: data.prepaymentAt ?? null,
      promisedAt: data.promisedAt || null,
      notes: data.notes ?? null,
      warrantyMonths: data.warrantyMonths ?? 0,
      // Время задаём явно: значение по умолчанию в схеме — это UTC.
      acceptedAt: nowSql(),
      createdAt: nowSql(),
    })
    .returning()
    .all();
  return row!;
}

/** Обновить заказ. */
export function updateOrder(
  database: AppDatabase,
  id: number,
  data: Record<string, unknown>,
) {
  const [row] = database
    .update(orders)
    .set({ ...data, updatedAt: nowSql() })
    .where(eq(orders.id, id))
    .returning()
    .all();
  return row ?? null;
}

/** Удалить заказ (события, документы и задачи удалятся каскадом). */
export async function deleteOrder(database: AppDatabase, id: number): Promise<boolean> {
  const result = await database.delete(orders).where(eq(orders.id, id)).run();
  return result.changes > 0;
}

/** Количество заказов по статусам — для счётчиков в меню. */
export async function countByStatus(database: AppDatabase) {
  const rows = await database
    .select({ status: orders.status, value: count() })
    .from(orders)
    .groupBy(orders.status)
    .all();
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.status] = Number(row.value);
  }
  return result;
}

/**
 * Заказы, выданные за период (для сводки).
 *
 * Сравниваем по DATE(...), а не по строке: дата выдачи может быть
 * записана в разных форматах (с «T» из JS или с пробелом из SQLite).
 */
export async function issuedInPeriod(database: AppDatabase, from: string, to: string) {
  return database
    .select()
    .from(orders)
    .where(
      and(
        sql`date(${orders.issuedAt}) between ${from} and ${to}`,
        inArray(orders.status, ['issued']),
      ),
    )
    .all();
}

/** Работа с заказами: список, карточка, статусы, журнал событий. */

import { and, count, desc, eq, gte, inArray, like, lte, or, sql } from 'drizzle-orm';
import { nowSql } from '@masterskaya/shared';

import type { AppDatabase } from '../../db.js';
import { clients, documents, orderEvents, orders } from '@masterskaya/db';

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

/** Заказ вместе с именем клиента и количеством документов. */
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
  acceptedAt: string;
  promisedAt: string | null;
  readyAt: string | null;
  issuedAt: string | null;
  createdAt: string;
  documentsCount: number;
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
export async function logEvent(
  database: AppDatabase,
  orderId: number,
  type: string,
  message?: string,
  payload?: Record<string, unknown>,
) {
  const [row] = await database
    .insert(orderEvents)
    .values({ orderId, type, message: message ?? null, payload: payload ?? null })
    .returning();
  return row!;
}

/** Создать заказ. */
export async function createOrder(
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
    promisedAt?: string | null;
    notes?: string | null;
    warrantyMonths?: number;
  },
) {
  const [row] = await database
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
      promisedAt: data.promisedAt || null,
      notes: data.notes ?? null,
      warrantyMonths: data.warrantyMonths ?? 0,
    })
    .returning();
  return row!;
}

/** Обновить заказ. */
export async function updateOrder(
  database: AppDatabase,
  id: number,
  data: Record<string, unknown>,
) {
  const [row] = await database
    .update(orders)
    .set({ ...data, updatedAt: nowSql() })
    .where(eq(orders.id, id))
    .returning();
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

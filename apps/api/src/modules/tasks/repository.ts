/** Работа с задачами: список, создание, отметка выполнения. */

import { and, asc, eq, sql } from 'drizzle-orm';

import type { AppDatabase } from '../../db.js';
import { orderTasks, orders } from '@masterskaya/db';

/** Задача вместе с контекстом заказа — без контекста она бесполезна. */
export interface TaskWithOrder {
  id: number;
  orderId: number;
  title: string;
  dueAt: string | null;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
  order: {
    id: number;
    number: string;
    clientName: string | null;
    clientPhone: string | null;
    deviceLabel: string | null;
    status: string;
  } | null;
}

const taskSelect = {
  id: orderTasks.id,
  orderId: orderTasks.orderId,
  title: orderTasks.title,
  dueAt: orderTasks.dueAt,
  done: orderTasks.done,
  doneAt: orderTasks.doneAt,
  createdAt: orderTasks.createdAt,
  orderIdRef: orders.id,
  orderNumber: orders.number,
  orderClientName: orders.clientName,
  orderClientPhone: orders.clientPhone,
  orderDeviceLabel: orders.deviceLabel,
  orderStatus: orders.status,
};

/** Собрать задачу с данными заказа. */
function toTask(row: Record<string, unknown>): TaskWithOrder {
  return {
    id: Number(row.id),
    orderId: Number(row.orderId),
    title: String(row.title),
    dueAt: (row.dueAt as string | null) ?? null,
    done: Boolean(row.done),
    doneAt: (row.doneAt as string | null) ?? null,
    createdAt: String(row.createdAt),
    order: row.orderNumber
      ? {
          id: Number(row.orderIdRef),
          number: String(row.orderNumber),
          clientName: (row.orderClientName as string | null) ?? null,
          clientPhone: (row.orderClientPhone as string | null) ?? null,
          deviceLabel: (row.orderDeviceLabel as string | null) ?? null,
          status: String(row.orderStatus),
        }
      : null,
  };
}

/**
 * Список задач.
 *
 * scope:
 *  - 'open'  — все невыполненные (по умолчанию);
 *  - 'today' — просроченные, сегодняшние и будущие;
 *  - 'done'  — выполненные.
 */
export async function listTasks(
  database: AppDatabase,
  filters: { scope?: string; orderId?: number; limit?: number },
): Promise<TaskWithOrder[]> {
  const conditions = [];

  if (filters.scope === 'done') {
    conditions.push(eq(orderTasks.done, true));
  } else {
    conditions.push(eq(orderTasks.done, false));
  }
  if (filters.orderId) {
    conditions.push(eq(orderTasks.orderId, filters.orderId));
  }

  const rows = await database
    .select(taskSelect)
    .from(orderTasks)
    .leftJoin(orders, eq(orders.id, orderTasks.orderId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      // Сначала те, у которых срок уже прошёл, потом по сроку, потом без срока.
      sql`case when ${orderTasks.dueAt} is null then 1 else 0 end`,
      asc(orderTasks.dueAt),
      asc(orderTasks.id),
    )
    .limit(filters.limit ?? 200)
    .all();

  return rows.map((row) => toTask(row as Record<string, unknown>));
}

/** Одна задача по id. */
export async function getTask(database: AppDatabase, id: number) {
  const rows = await database
    .select(taskSelect)
    .from(orderTasks)
    .leftJoin(orders, eq(orders.id, orderTasks.orderId))
    .where(eq(orderTasks.id, id))
    .all();
  const row = rows[0];
  return row ? toTask(row as Record<string, unknown>) : null;
}

/** Создать задачу. */
export async function createTask(
  database: AppDatabase,
  data: { orderId: number; title: string; dueAt: string | null },
) {
  const [row] = await database
    .insert(orderTasks)
    .values({
      orderId: data.orderId,
      title: data.title,
      dueAt: data.dueAt,
      done: false,
    })
    .returning();
  return row!;
}

/** Изменить задачу: текст, срок, отметка выполнения. */
export async function updateTask(
  database: AppDatabase,
  id: number,
  data: {
    title?: string;
    dueAt?: string | null;
    done?: boolean;
    doneAt?: string | null;
  },
) {
  const [row] = await database
    .update(orderTasks)
    .set(data)
    .where(eq(orderTasks.id, id))
    .returning();
  return row ?? null;
}

/** Сколько задач по заказу и сколько из них открытых. */
export async function countByOrder(database: AppDatabase, orderId: number) {
  const rows = await database
    .select({ done: orderTasks.done, value: sql<number>`count(*)` })
    .from(orderTasks)
    .where(eq(orderTasks.orderId, orderId))
    .groupBy(orderTasks.done)
    .all();

  let open = 0;
  let done = 0;
  for (const row of rows) {
    if (row.done) done = Number(row.value);
    else open = Number(row.value);
  }
  return { open, done, total: open + done };
}

/** Сколько открытых задач просрочено — для счётчика в меню. */
export async function countOverdue(database: AppDatabase, now: string): Promise<number> {
  const row = await database
    .select({ value: sql<number>`count(*)` })
    .from(orderTasks)
    .where(
      and(
        eq(orderTasks.done, false),
        sql`${orderTasks.dueAt} is not null`,
        sql`${orderTasks.dueAt} < ${now}`,
      ),
    )
    .get();
  return Number(row?.value ?? 0);
}

/** Сколько открытых задач на сегодня — для счётчика в меню. */
export async function countDueToday(database: AppDatabase, today: string): Promise<number> {
  const row = await database
    .select({ value: sql<number>`count(*)` })
    .from(orderTasks)
    .where(
      and(
        eq(orderTasks.done, false),
        sql`date(${orderTasks.dueAt}) = ${today}`,
      ),
    )
    .get();
  return Number(row?.value ?? 0);
}

/** Сколько всего открытых и выполненных задач. */
export async function countAll(database: AppDatabase): Promise<{ open: number; done: number }> {
  const rows = await database
    .select({ done: orderTasks.done, value: sql<number>`count(*)` })
    .from(orderTasks)
    .groupBy(orderTasks.done)
    .all();

  let open = 0;
  let done = 0;
  for (const row of rows) {
    if (row.done) done = Number(row.value);
    else open = Number(row.value);
  }
  return { open, done };
}

/** Удалить задачу. */
export async function deleteTask(database: AppDatabase, id: number): Promise<boolean> {
  const result = await database.delete(orderTasks).where(eq(orderTasks.id, id)).run();
  return result.changes > 0;
}

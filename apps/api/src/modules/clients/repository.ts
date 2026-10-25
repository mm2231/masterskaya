/** Работа с клиентами: поиск, карточка, метрики. */

import { and, count, desc, eq, like, or, sql } from 'drizzle-orm';

import type { AppDatabase } from '../../db.js';
import { clients, devices, orders } from '@masterskaya/db';
import { nowSql } from '@masterskaya/shared';

export interface ClientListFilters {
  q?: string;
  limit: number;
  offset: number;
  sort: 'name' | 'recent' | 'orders';
}

export interface ClientRow {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  telegram: string | null;
  viber: string | null;
  note: string | null;
  tags: string[];
  createdAt: string;
  ordersCount: number;
  lastOrderAt: string | null;
  totalRevenue: number;
}

/** Список клиентов с поиском по имени и телефону. */
export async function listClients(
  database: AppDatabase,
  filters: ClientListFilters,
): Promise<{ items: ClientRow[]; total: number }> {
  const conditions = [sql`${clients.archivedAt} is null`];
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conditions.push(or(like(clients.name, pattern), like(clients.phone, pattern))!);
  }

  const where = and(...conditions);

  const rows = await database
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      email: clients.email,
      telegram: clients.telegram,
      viber: clients.viber,
      note: clients.note,
      tags: clients.tags,
      createdAt: clients.createdAt,
      ordersCount: count(orders.id),
      lastOrderAt: sql<string | null>`max(${orders.createdAt})`,
      totalRevenue: sql<number>`coalesce(sum(case when ${orders.status} = 'issued' then ${orders.clientTotal} else 0 end), 0)`,
    })
    .from(clients)
    .leftJoin(orders, eq(orders.clientId, clients.id))
    .where(where)
    .groupBy(clients.id)
    .orderBy(
      filters.sort === 'name'
        ? clients.name
        : filters.sort === 'orders'
          ? desc(count(orders.id))
          : desc(sql`max(${orders.createdAt})`),
    )
    .limit(filters.limit)
    .offset(filters.offset)
    .all();

  const totalRow = await database
    .select({ value: count() })
    .from(clients)
    .where(where)
    .get();

  return { items: rows as ClientRow[], total: Number(totalRow?.value ?? 0) };
}

/** Один клиент по id. */
export async function getClient(database: AppDatabase, id: number) {
  return database.select().from(clients).where(eq(clients.id, id)).get();
}

/** Найти клиента по телефону (нормализованному). */
export function findByPhone(database: AppDatabase, phone: string) {
  return database.select().from(clients).where(eq(clients.phone, phone)).get();
}

/**
 * Найти клиента по телефону или завести нового.
 *
 * Нужен при оформлении заказа: клиент заводится сам, руками ничего
 * в справочнике заполнять не нужно. По телефону ищется точно — в базе
 * телефон уникален.
 */
export function findOrCreateClient(
  database: AppDatabase,
  data: { name?: string | null; phone: string },
) {
  const phone = data.phone.trim();
  const existing = findByPhone(database, phone);
  if (existing) return existing;

  // Телефон может быть пустым у клиента — тогда клиента не заводим.
  if (!phone) return null;

  return createClient(database, {
    name: data.name?.trim() || 'Клиент без имени',
    phone,
  });
}

/** Телефоны всех клиентов — для проверки уникальности при импорте. */
export async function allPhones(database: AppDatabase): Promise<string[]> {
  const rows = await database.select({ phone: clients.phone }).from(clients).all();
  return rows.map((row) => row.phone);
}

/** Создать клиента. */
export function createClient(
  database: AppDatabase,
  data: {
    name: string;
    phone: string;
    email?: string | null;
    telegram?: string | null;
    viber?: string | null;
    note?: string | null;
    tags?: string[];
  },
) {
  const [row] = database
    .insert(clients)
    .values({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      telegram: data.telegram || null,
      viber: data.viber || null,
      note: data.note || null,
      tags: data.tags ?? [],
      // Время задаём явно: значение по умолчанию в схеме — это UTC.
      createdAt: nowSql(),
    })
    .returning()
    .all();
  return row!;
}

/** Обновить клиента. */
export async function updateClient(
  database: AppDatabase,
  id: number,
  data: Partial<{
    name: string;
    phone: string;
    email: string | null;
    telegram: string | null;
    viber: string | null;
    note: string | null;
    tags: string[];
  }>,
) {
  const [row] = await database
    .update(clients)
    .set({ ...data, updatedAt: nowSql() })
    .where(eq(clients.id, id))
    .returning();
  return row ?? null;
}

/** Удалить клиента. Заказы сохраняются (clientId станет NULL). */
export async function deleteClient(database: AppDatabase, id: number): Promise<boolean> {
  const result = await database.delete(clients).where(eq(clients.id, id)).run();
  return result.changes > 0;
}

/** Заказы клиента — newest first. */
export async function clientOrders(database: AppDatabase, clientId: number) {
  return database
    .select()
    .from(orders)
    .where(eq(orders.clientId, clientId))
    .orderBy(desc(orders.createdAt))
    .all();
}

/** Техника клиента. */
export async function clientDevices(database: AppDatabase, clientId: number) {
  return database.select().from(devices).where(eq(devices.clientId, clientId)).all();
}

/** Метрики клиента для карточки: визиты, сумма, средний чек, последний визит. */
export async function clientStats(database: AppDatabase, clientId: number) {
  const [row] = await database
    .select({
      ordersCount: count(orders.id),
      issuedCount: sql<number>`coalesce(sum(case when ${orders.status} = 'issued' then 1 else 0 end), 0)`,
      revenue: sql<number>`coalesce(sum(case when ${orders.status} = 'issued' then ${orders.clientTotal} else 0 end), 0)`,
      profit: sql<number>`coalesce(sum(case when ${orders.status} = 'issued' then ${orders.clientTotal} - ${orders.costTotal} else 0 end), 0)`,
      lastOrderAt: sql<string | null>`max(${orders.createdAt})`,
    })
    .from(orders)
    .where(eq(orders.clientId, clientId))
    .all();

  const stats = row!;
  const averageCheck = stats.issuedCount ? stats.revenue / stats.issuedCount : 0;
  return { ...stats, averageCheck };
}

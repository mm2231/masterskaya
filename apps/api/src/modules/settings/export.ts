/**
 * Экспорт и импорт всех данных в JSON.
 *
 * Формат — обычный JSON со всеми сущностями: переносится между
 * компьютерами и редактируется вручную, если нужно.
 */

import { and, asc, eq, isNull } from 'drizzle-orm';
import { nowSql } from '@masterskaya/shared';

import type { AppDatabase } from '../../db.js';
import {
  clients,
  devices,
  documents,
  expenseCategories,
  orderEvents,
  orderTasks,
  orders,
  payments,
  settings,
} from '@masterskaya/db';

export interface ExportData {
  version: number;
  exportedAt: string;
  clients: unknown[];
  devices: unknown[];
  orders: unknown[];
  orderEvents: unknown[];
  orderTasks: unknown[];
  documents: unknown[];
  payments: unknown[];
  expenseCategories: unknown[];
  settings: unknown[];
}

/** Собрать все данные в объект. */
export async function exportAll(database: AppDatabase): Promise<ExportData> {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    clients: await database.select().from(clients).all(),
    devices: await database.select().from(devices).all(),
    orders: await database.select().from(orders).orderBy(asc(orders.id)).all(),
    orderEvents: await database.select().from(orderEvents).orderBy(asc(orderEvents.id)).all(),
    orderTasks: await database.select().from(orderTasks).all(),
    documents: await database.select().from(documents).all(),
    payments: await database.select().from(payments).all(),
    expenseCategories: await database.select().from(expenseCategories).all(),
    settings: await database.select().from(settings).all(),
  };
}

export interface ImportReport {
  clients: number;
  orders: number;
  events: number;
  tasks: number;
  documents: number;
  payments: number;
  settings: number;
  skipped: number;
}

/**
 * Загрузить данные из JSON.
 *
 * Клиенты сверяются по телефону, заказы — по номеру: повторный импорт
 * не создаёт дублей. Остальные записи добавляются как есть.
 */
export async function importAll(
  database: AppDatabase,
  data: Partial<ExportData>,
): Promise<ImportReport> {
  const report: ImportReport = {
    clients: 0,
    orders: 0,
    events: 0,
    tasks: 0,
    documents: 0,
    payments: 0,
    settings: 0,
    skipped: 0,
  };

  // Реквизиты мастерской и прочие настройки: обновляем существующие записи
  // по ключу, чтобы реквизиты перенеслись на новый компьютер.
  for (const row of (data.settings ?? []) as Array<Record<string, unknown>>) {
    const key = String(row.key ?? '').trim();
    if (!key) continue;
    const value = row.value;
    if (value === undefined) continue;
    await database
      .insert(settings)
      .values({ key, value: value as never, updatedAt: nowSql() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: value as never, updatedAt: nowSql() },
      })
      .run();
    report.settings += 1;
  }

  // Карта «старый id клиента → новый id».
  const clientMap = new Map<number, number>();
  for (const row of (data.clients ?? []) as Array<Record<string, unknown>>) {
    const phone = String(row.phone ?? '').trim();
    const existing = phone
      ? await database
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.phone, phone))
          .get()
      : undefined;
    if (existing) {
      if (row.id) clientMap.set(Number(row.id), existing.id);
      report.skipped += 1;
      continue;
    }
    const [created] = await database
      .insert(clients)
      .values({
        name: String(row.name ?? 'Клиент без имени'),
        phone,
        email: (row.email as string | null) ?? null,
        telegram: (row.telegram as string | null) ?? null,
        viber: (row.viber as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        tags: (row.tags as string[]) ?? [],
        createdAt: String(row.createdAt ?? new Date().toISOString()),
      })
      .returning();
    if (row.id) clientMap.set(Number(row.id), created!.id);
    report.clients += 1;
  }

  // Заказы.
  const orderMap = new Map<number, number>();
  for (const row of (data.orders ?? []) as Array<Record<string, unknown>>) {
    const number = String(row.number ?? '').trim();
    const existing = number
      ? await database
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.number, number))
          .get()
      : undefined;
    if (existing) {
      if (row.id) orderMap.set(Number(row.id), existing.id);
      report.skipped += 1;
      continue;
    }
    const oldClientId = row.clientId ? Number(row.clientId) : 0;
    const [created] = await database
      .insert(orders)
      .values({
        number,
        clientId: oldClientId ? (clientMap.get(oldClientId) ?? null) : null,
        clientName: (row.clientName as string | null) ?? null,
        clientPhone: (row.clientPhone as string | null) ?? null,
        deviceLabel: (row.deviceLabel as string | null) ?? null,
        fault: (row.fault as string | null) ?? null,
        appearance: (row.appearance as string | null) ?? null,
        accessories: (row.accessories as string | null) ?? null,
        workDescription: (row.workDescription as string | null) ?? null,
        status: String(row.status ?? 'new'),
        clientTotal: Number(row.clientTotal ?? 0),
        costTotal: Number(row.costTotal ?? 0),
        acceptedAt: String(row.acceptedAt ?? new Date().toISOString()),
        promisedAt: (row.promisedAt as string | null) ?? null,
        readyAt: (row.readyAt as string | null) ?? null,
        issuedAt: (row.issuedAt as string | null) ?? null,
        warrantyMonths: Number(row.warrantyMonths ?? 0),
        notes: (row.notes as string | null) ?? null,
      })
      .returning();
    if (row.id) orderMap.set(Number(row.id), created!.id);
    report.orders += 1;
  }

  // Привязанные записи: события, задачи, документы, платежи.
  for (const row of (data.orderEvents ?? []) as Array<Record<string, unknown>>) {
    const orderId = orderMap.get(Number(row.orderId));
    if (!orderId) {
      report.skipped += 1;
      continue;
    }
    // Событие уже есть, если совпали заказ, тип, текст и время.
    const message = (row.message as string | null) ?? null;
    const createdAt = String(row.createdAt ?? new Date().toISOString());
    const existing = await database
      .select({ id: orderEvents.id })
      .from(orderEvents)
      .where(
        and(
          eq(orderEvents.orderId, orderId),
          eq(orderEvents.type, String(row.type ?? 'note')),
          message === null ? isNull(orderEvents.message) : eq(orderEvents.message, message),
          eq(orderEvents.createdAt, createdAt),
        ),
      )
      .get();
    if (existing) {
      report.skipped += 1;
      continue;
    }
    await database.insert(orderEvents).values({
      orderId,
      type: String(row.type ?? 'note'),
      message,
      payload: (row.payload as Record<string, unknown> | null) ?? null,
      createdAt,
    });
    report.events += 1;
  }

  for (const row of (data.orderTasks ?? []) as Array<Record<string, unknown>>) {
    const orderId = orderMap.get(Number(row.orderId));
    if (!orderId) {
      report.skipped += 1;
      continue;
    }
    await database.insert(orderTasks).values({
      orderId,
      title: String(row.title ?? ''),
      dueAt: (row.dueAt as string | null) ?? null,
      done: Boolean(row.done),
      doneAt: (row.doneAt as string | null) ?? null,
    });
    report.tasks += 1;
  }

  for (const row of (data.documents ?? []) as Array<Record<string, unknown>>) {
    const orderId = orderMap.get(Number(row.orderId));
    if (!orderId) {
      report.skipped += 1;
      continue;
    }
    await database.insert(documents).values({
      orderId,
      kind: String(row.kind ?? 'works'),
      number: String(row.number ?? ''),
      note: (row.note as string | null) ?? null,
      snapshot: (row.snapshot as Record<string, unknown> | null) ?? null,
      issuedAt: String(row.issuedAt ?? new Date().toISOString()),
    });
    report.documents += 1;
  }

  for (const row of (data.payments ?? []) as Array<Record<string, unknown>>) {
    const orderId = row.orderId ? (orderMap.get(Number(row.orderId)) ?? null) : null;
    const occurredOn = String(row.occurredOn ?? new Date().toISOString().slice(0, 10));
    const amount = Number(row.amount ?? 0);
    // Платёж уже есть, если совпали заказ, дата, сумма и направление.
    const existing = await database
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          orderId === null ? isNull(payments.orderId) : eq(payments.orderId, orderId),
          eq(payments.occurredOn, occurredOn),
          eq(payments.amount, amount),
          eq(payments.direction, String(row.direction ?? 'out')),
        ),
      )
      .get();
    if (existing) {
      report.skipped += 1;
      continue;
    }
    await database.insert(payments).values({
      orderId,
      direction: String(row.direction ?? 'out'),
      amount,
      method: String(row.method ?? 'cash'),
      category: (row.category as string | null) ?? null,
      occurredOn,
      note: (row.note as string | null) ?? null,
    });
    report.payments += 1;
  }

  return report;
}

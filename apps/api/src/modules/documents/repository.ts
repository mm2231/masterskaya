/** Работа с документами: приёмный акт, акт выполненных работ. */

import { desc, eq, sql } from 'drizzle-orm';
import { nowSql } from '@masterskaya/shared';

import type { AppDatabase } from '../../db.js';
import { documents, orders } from '@masterskaya/db';

export type DocumentKind = 'acceptance' | 'works';

/** Список документов (реестр актов) с фильтрами. */
export async function listDocuments(
  database: AppDatabase,
  filters: { kind?: string; orderId?: number; limit: number; offset: number },
) {
  const conditions = [];
  if (filters.kind) {
    conditions.push(eq(documents.kind, filters.kind));
  }
  if (filters.orderId) {
    conditions.push(eq(documents.orderId, filters.orderId));
  }

  const where = conditions.length ? sql.join(conditions, sql` and `) : undefined;

  const rows = await database
    .select({
      id: documents.id,
      orderId: documents.orderId,
      kind: documents.kind,
      number: documents.number,
      note: documents.note,
      issuedAt: documents.issuedAt,
      createdAt: documents.createdAt,
      orderNumber: orders.number,
      clientName: orders.clientName,
      deviceLabel: orders.deviceLabel,
      clientTotal: orders.clientTotal,
    })
    .from(documents)
    .innerJoin(orders, eq(orders.id, documents.orderId))
    .where(where)
    .orderBy(desc(documents.issuedAt))
    .limit(filters.limit)
    .offset(filters.offset)
    .all();

  return rows;
}

/** Документы конкретного заказа. */
export async function orderDocuments(database: AppDatabase, orderId: number) {
  return database
    .select()
    .from(documents)
    .where(eq(documents.orderId, orderId))
    .orderBy(desc(documents.issuedAt))
    .all();
}

/** Один документ по id вместе с заказом. */
export async function getDocument(database: AppDatabase, id: number) {
  return database.select().from(documents).where(eq(documents.id, id)).get();
}

/** Создать документ. */
export function createDocument(
  database: AppDatabase,
  data: {
    orderId: number;
    kind: DocumentKind;
    number: string;
    note?: string | null;
    snapshot?: Record<string, unknown> | null;
  },
) {
  const [row] = database
    .insert(documents)
    .values({
      orderId: data.orderId,
      kind: data.kind,
      number: data.number,
      note: data.note ?? null,
      snapshot: data.snapshot ?? null,
      // Время задаём явно: значение по умолчанию в схеме — это UTC.
      issuedAt: nowSql(),
      createdAt: nowSql(),
    })
    .returning()
    .all();
  return row!;
}

/** Удалить документ. */
export async function deleteDocument(database: AppDatabase, id: number): Promise<boolean> {
  const result = await database.delete(documents).where(eq(documents.id, id)).run();
  return result.changes > 0;
}

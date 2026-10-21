/** Нумерация заказов и актов. */

import { sql } from 'drizzle-orm';

import type { AppDatabase } from '../../db.js';
import { documents, orders } from '@masterskaya/db';

/** Подставить {YYYY} и {SEQ} в шаблон номера. */
export function renderNumber(pattern: string, year: number, sequence: number): string {
  return pattern
    .replaceAll('{YYYY}', String(year))
    .replaceAll('{MM}', String(new Date().getMonth() + 1).padStart(2, '0'))
    .replaceAll('{SEQ}', String(sequence).padStart(4, '0'));
}

/**
 * Следующий номер заказа.
 *
 * Номер выдаётся по шаблону из настроек (по умолчанию «2026-0001»).
 * Счётчик считает заказы текущего года, поэтому номера не дублируются
 * даже после восстановления базы из бэкапа.
 */
export async function nextOrderNumber(
  database: AppDatabase,
  pattern: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = pattern.replaceAll('{SEQ}', '').replaceAll('{YYYY}', String(year));
  const row = await database
    .select({ value: sql<number>`count(*)` })
    .from(orders)
    .where(sql`${orders.number} like ${`${prefix}%`}`)
    .get();
  const count = Number(row?.value ?? 0);
  return renderNumber(pattern, year, count + 1);
}

/** Следующий номер документа (акта) указанного вида. */
export async function nextDocumentNumber(
  database: AppDatabase,
  kind: 'acceptance' | 'works',
  pattern: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = pattern.replaceAll('{SEQ}', '').replaceAll('{YYYY}', String(year));
  const row = await database
    .select({ value: sql<number>`count(*)` })
    .from(documents)
    .where(sql`${documents.kind} = ${kind} and ${documents.number} like ${`${prefix}%`}`)
    .get();
  const count = Number(row?.value ?? 0);
  return renderNumber(pattern, year, count + 1);
}

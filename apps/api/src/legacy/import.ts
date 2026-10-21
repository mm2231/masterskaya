/**
 * Импорт данных из старой базы «Мастерской» (topset.db).
 *
 * Старая схема: clients, estimates, estimate_items, manual_incomes.
 * Новые сущности: clients, orders, payments.
 *
 * Что переносится:
 *   clients        → clients
 *   estimates      → orders (номер акта → номер заказа, статусы по маппингу)
 *   estimate_items → orders.cost_total (сумма закупки) + запись в журнал событий
 *   manual_incomes → payments (приход без заказа)
 *
 * Что НЕ переносится (функционал снят):
 *   parts              — кэш цен парсера shop.topset.by
 *   supplier_orders    — заказы запчастей поставщику
 *   labor_cost, markup_percent — легаси-колонки
 */

import { existsSync } from 'node:fs';

import Database from 'better-sqlite3';
import { and, eq, sql } from 'drizzle-orm';

import type { AppDatabase } from '../db.js';
import { clients, orderEvents, orders, payments } from '@masterskaya/db';
import { nowSql } from '@masterskaya/shared';

/** Старый статус → новый. */
const STATUS_MAP: Record<string, string> = {
  accepted: 'new',
  in_progress: 'in_progress',
  waiting_parts: 'waiting_parts',
  ready: 'ready',
  issued: 'issued',
};

export interface ImportReport {
  clients: { total: number; created: number; skipped: number };
  orders: { total: number; created: number; skipped: number };
  payments: { total: number; created: number; skipped: number };
}

/** Нормализация телефона: только цифры и «+». */
function normalizePhone(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return plus ? `+${digits}` : digits;
}

/**
 * Перенести данные из старой базы.
 *
 * Функция идемпотентна: повторный запуск не создаёт дублей —
 * клиенты сверяются по телефону, заказы по номеру.
 */
export async function importLegacy(
  database: AppDatabase,
  legacyPath: string,
): Promise<ImportReport> {
  const report: ImportReport = {
    clients: { total: 0, created: 0, skipped: 0 },
    orders: { total: 0, created: 0, skipped: 0 },
    payments: { total: 0, created: 0, skipped: 0 },
  };

  if (!existsSync(legacyPath)) {
    throw new Error(`Старая база не найдена: ${legacyPath}`);
  }

  const legacy = new Database(legacyPath, { readonly: true });
  legacy.pragma('foreign_keys = OFF');

  const hasTable = (name: string): boolean => {
    const row = legacy
      .prepare(`select name from sqlite_master where type='table' and name = ?`)
      .get(name);
    return Boolean(row);
  };


  // ── Клиенты ──────────────────────────────────────────────────────────────
  if (hasTable('clients')) {
    const rows = legacy.prepare('select * from clients').all() as Array<
      Record<string, unknown>
    >;
    report.clients.total = rows.length;

    for (const row of rows) {
      const phone = normalizePhone(String(row.phone ?? ''));
      const name = String(row.name ?? '').trim();
      if (!phone && !name) {
        report.clients.skipped += 1;
        continue;
      }
      if (phone) {
        const existing = await database
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.phone, phone))
          .get();
        if (existing) {
          report.clients.skipped += 1;
          continue;
        }
      }
      await database
        .insert(clients)
        .values({
          name: name || 'Клиент без имени',
          phone,
          note: row.note ? String(row.note) : null,
          createdAt: String(row.created_at ?? new Date().toISOString()),
        })
        .run();
      report.clients.created += 1;
    }
  }

  // Карта «старый id клиента → новый id» и имена клиентов.
  const clientMap = new Map<number, number>();
  const clientNames = new Map<number, string>();
  if (hasTable('clients')) {
    const legacyClients = legacy.prepare('select id, phone, name from clients').all() as Array<{
      id: number;
      phone: string;
      name: string;
    }>;
    for (const legacyClient of legacyClients) {
      const phone = normalizePhone(String(legacyClient.phone ?? ''));
      const name = String(legacyClient.name ?? '').trim();
      if (name) clientNames.set(legacyClient.id, name);
      if (!phone) continue;
      const found = await database
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.phone, phone))
        .get();
      if (found) clientMap.set(legacyClient.id, found.id);
    }
  }


  // ── Заказы ───────────────────────────────────────────────────────────────
  if (hasTable('estimates')) {
    const rows = legacy.prepare('select * from estimates').all() as Array<
      Record<string, unknown>
    >;
    report.orders.total = rows.length;

    for (const row of rows) {
      const number = String(row.act_number ?? '').trim() || `legacy-${row.id}`;
      const existing = await database
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.number, number))
        .get();
      if (existing) {
        report.orders.skipped += 1;
        continue;
      }

      // Себестоимость = сумма закупки по позициям.
      let costTotal = 0;
      const legacyItems: Array<{ name: string; price: number; quantity: number }> = [];
      if (hasTable('estimate_items')) {
        const items = legacy
          .prepare('select * from estimate_items where estimate_id = ?')
          .all(row.id) as Array<Record<string, unknown>>;
        for (const item of items) {
          const price = Number(item.price ?? 0) || 0;
          const quantity = Number(item.quantity ?? 1) || 1;
          costTotal += price * quantity;
          legacyItems.push({ name: String(item.name ?? ''), price, quantity });
        }
      }

      const legacyClientId = row.client_id ? Number(row.client_id) : 0;
      const clientId = legacyClientId ? (clientMap.get(legacyClientId) ?? null) : null;
      const status = STATUS_MAP[String(row.status ?? 'accepted')] ?? 'new';
      const acceptedAt = String(row.created_at ?? nowSql());
      // В старой базе имя клиента часто пустое — берём его из справочника.
      const clientName =
        (row.client_name ? String(row.client_name).trim() : '') ||
        clientNames.get(legacyClientId) ||
        null;

      const [created] = await database
        .insert(orders)
        .values({
          number,
          clientId,
          clientName,
          clientPhone: row.client_phone ? String(row.client_phone) : null,
          deviceLabel: row.device ? String(row.device) : null,
          fault: row.fault ? String(row.fault) : null,
          appearance: row.appearance ? String(row.appearance) : null,
          workDescription: row.work_description ? String(row.work_description) : null,
          status,
          clientTotal: Number(row.final_total ?? 0) || 0,
          costTotal,
          acceptedAt,
          readyAt: status === 'ready' ? acceptedAt : null,
          issuedAt: row.issued_at ? String(row.issued_at) : null,
          notes: row.notes ? String(row.notes) : null,
        })
        .returning();

      await database
        .insert(orderEvents)
        .values({
          orderId: created!.id,
          type: 'imported',
          message: 'Заказ перенесён из старой базы',
          payload: { legacyId: row.id, items: legacyItems },
        })
        .run();

      report.orders.created += 1;
    }
  }

  // ── Прочие доходы (мелкие работы без заказа) ───────────────────────────
  if (hasTable('manual_incomes')) {
    const rows = legacy.prepare('select * from manual_incomes').all() as Array<
      Record<string, unknown>
    >;
    report.payments.total = rows.length;

    for (const row of rows) {
      const amount = Number(row.amount ?? 0) || 0;
      if (amount <= 0) {
        report.payments.skipped += 1;
        continue;
      }
      const occurredOn = String(row.occurred_on ?? nowSql().slice(0, 10));
      const title = row.title ? String(row.title) : null;

      // Повторный импорт не должен дублировать: сверяем по дате, сумме и названию.
      const existing = await database
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.direction, 'in'),
            sql`${payments.orderId} is null`,
            eq(payments.occurredOn, occurredOn),
            eq(payments.amount, amount),
            title === null ? sql`${payments.category} is null` : eq(payments.category, title),
          ),
        )
        .get();
      if (existing) {
        report.payments.skipped += 1;
        continue;
      }

      await database
        .insert(payments)
        .values({
          orderId: null,
          direction: 'in',
          amount,
          method: 'other',
          category: title,
          occurredOn,
        })
        .run();
      report.payments.created += 1;
    }
  }

  legacy.close();
  return report;
}

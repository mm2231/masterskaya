/** Работа с деньгами: платежи, расходы, сводка за период. */

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { nowSql } from '@masterskaya/shared';

import type { AppDatabase } from '../../db.js';
import { expenseCategories, orders, payments } from '@masterskaya/db';

/** Все движения денег за период (или все, если период не задан). */
export async function listPayments(
  database: AppDatabase,
  filters: { from?: string; to?: string; direction?: string; limit: number; offset: number },
) {
  const conditions = [];
  if (filters.from) conditions.push(gte(payments.occurredOn, filters.from));
  if (filters.to) conditions.push(lte(payments.occurredOn, filters.to));
  if (filters.direction) conditions.push(eq(payments.direction, filters.direction));

  const where = conditions.length ? and(...conditions) : undefined;

  return database
    .select({
      id: payments.id,
      orderId: payments.orderId,
      direction: payments.direction,
      amount: payments.amount,
      cost: payments.cost,
      method: payments.method,
      category: payments.category,
      occurredOn: payments.occurredOn,
      note: payments.note,
      createdAt: payments.createdAt,
      orderNumber: orders.number,
      clientName: orders.clientName,
      deviceLabel: orders.deviceLabel,
    })
    .from(payments)
    .leftJoin(orders, eq(orders.id, payments.orderId))
    .where(where)
    .orderBy(desc(payments.occurredOn), desc(payments.id))
    .limit(filters.limit)
    .offset(filters.offset)
    .all();
}

/** Добавить платёж (приход или расход). */
export function createPayment(
  database: AppDatabase,
  data: {
    orderId?: number | null;
    direction: 'in' | 'out';
    amount: number;
    cost?: number;
    method: string;
    category?: string | null;
    occurredOn: string;
    note?: string | null;
  },
) {
  const [row] = database
    .insert(payments)
    .values({ ...data, cost: data.cost ?? 0, createdAt: nowSql() })
    .returning()
    .all();
  return row!;
}

/** Изменить запись о движении денег. */
export async function updatePayment(
  database: AppDatabase,
  id: number,
  data: {
    amount?: number;
    cost?: number;
    method?: string;
    category?: string | null;
    occurredOn?: string;
    note?: string | null;
  },
) {
  const [row] = await database.update(payments).set(data).where(eq(payments.id, id)).returning();
  return row ?? null;
}

/** Удалить платёж. */
export async function deletePayment(database: AppDatabase, id: number): Promise<boolean> {
  const result = await database.delete(payments).where(eq(payments.id, id)).run();
  return result.changes > 0;
}

/** Сумма оплат по заказу. */
export async function orderPaid(database: AppDatabase, orderId: number): Promise<number> {
  const row = await database
    .select({ value: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.direction, 'in')))
    .get();
  return Number(row?.value ?? 0);
}

/** Категории расходов. */
export async function listExpenseCategories(database: AppDatabase) {
  return database
    .select()
    .from(expenseCategories)
    .orderBy(expenseCategories.name)
    .all();
}

/** Создать категорию расхода. */
export async function createExpenseCategory(
  database: AppDatabase,
  data: { name: string; kind: string; budgetMonthly: number },
) {
  const [row] = await database.insert(expenseCategories).values(data).returning();
  return row!;
}

/** Сумма расходов за период. */
export async function expensesInPeriod(
  database: AppDatabase,
  from: string,
  to: string,
): Promise<number> {
  const row = await database
    .select({ value: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(
      and(
        eq(payments.direction, 'out'),
        gte(payments.occurredOn, from),
        lte(payments.occurredOn, to),
      ),
    )
    .get();
  return Number(row?.value ?? 0);
}

/** Прочие доходы (мелкие работы без заказа) за период. */
export async function manualIncomeInPeriod(
  database: AppDatabase,
  from: string,
  to: string,
): Promise<number> {
  const row = await database
    .select({ value: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(
      and(
        eq(payments.direction, 'in'),
        sql`${payments.orderId} is null`,
        gte(payments.occurredOn, from),
        lte(payments.occurredOn, to),
      ),
    )
    .get();
  return Number(row?.value ?? 0);
}

/** Расходники по ручным доходам за период (себестоимость проданного). */
export async function manualCostInPeriod(
  database: AppDatabase,
  from: string,
  to: string,
): Promise<number> {
  const row = await database
    .select({ value: sql<number>`coalesce(sum(${payments.cost}), 0)` })
    .from(payments)
    .where(
      and(
        eq(payments.direction, 'in'),
        sql`${payments.orderId} is null`,
        gte(payments.occurredOn, from),
        lte(payments.occurredOn, to),
      ),
    )
    .get();
  return Number(row?.value ?? 0);
}

/** Условие «предоплата относится к периоду» — общее для суммы и списка. */
function prepaymentPeriodConditions(from: string, to: string) {
  return and(
    sql`${orders.status} <> 'issued'`,
    sql`${orders.prepayment} > 0`,
    sql`date(${orders.prepaymentAt}) >= ${from}`,
    sql`date(${orders.prepaymentAt}) <= ${to}`,
  );
}

/** Предоплаты по не выданным заказам за период — деньги уже получены.
 * Возвращает и себестоимость этих заказов: расход понесён, прибыль
 * считается кассой, иначе «предоплата 80 при расходниках 50» покажет
 * прибыль 80. */
export async function prepaymentsInPeriod(
  database: AppDatabase,
  from: string,
  to: string,
): Promise<{ prepayments: number; cost: number }> {
  const row = await database
    .select({
      prepayments: sql<number>`coalesce(sum(${orders.prepayment}), 0)`,
      cost: sql<number>`coalesce(sum(${orders.costTotal}), 0)`,
    })
    .from(orders)
    .where(prepaymentPeriodConditions(from, to))
    .get();
  return {
    prepayments: Number(row?.prepayments ?? 0),
    cost: Number(row?.cost ?? 0),
  };
}

/** Список предоплат за период — строки для выгрузки в CSV. */
export async function prepaymentsListInPeriod(
  database: AppDatabase,
  from: string,
  to: string,
) {
  return database
    .select({
      number: orders.number,
      clientName: orders.clientName,
      deviceLabel: orders.deviceLabel,
      prepayment: orders.prepayment,
      prepaymentAt: orders.prepaymentAt,
      costTotal: orders.costTotal,
      status: orders.status,
    })
    .from(orders)
    .where(prepaymentPeriodConditions(from, to))
    .orderBy(desc(orders.prepaymentAt))
    .all();
}

/** Предоплаты, внесённые за конкретный день. */
export async function prepaymentsOnDay(
  database: AppDatabase,
  day: string,
): Promise<{ prepayments: number; cost: number }> {
  const row = await database
    .select({
      prepayments: sql<number>`coalesce(sum(${orders.prepayment}), 0)`,
      cost: sql<number>`coalesce(sum(${orders.costTotal}), 0)`,
    })
    .from(orders)
    .where(
      and(
        sql`${orders.status} <> 'issued'`,
        sql`date(${orders.prepaymentAt}) = ${day}`,
      ),
    )
    .get();
  return {
    prepayments: Number(row?.prepayments ?? 0),
    cost: Number(row?.cost ?? 0),
  };
}

/** Расходы по категориям за период — для круговой диаграммы. */
export async function expensesByCategory(
  database: AppDatabase,
  from: string,
  to: string,
) {
  return database
    .select({
      category: payments.category,
      amount: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.direction, 'out'),
        gte(payments.occurredOn, from),
        lte(payments.occurredOn, to),
      ),
    )
    .groupBy(payments.category)
    .orderBy(desc(sql`coalesce(sum(${payments.amount}), 0)`))
    .all();
}

/** Заказы, выданные за конкретный день (по дате выдачи). */
export async function issuedOnDay(database: AppDatabase, day: string) {
  return database
    .select({
      id: orders.id,
      number: orders.number,
      clientName: orders.clientName,
      clientPhone: orders.clientPhone,
      deviceLabel: orders.deviceLabel,
      clientTotal: orders.clientTotal,
      costTotal: orders.costTotal,
      prepayment: orders.prepayment,
      prepaymentAt: orders.prepaymentAt,
      issuedAt: orders.issuedAt,
      workDescription: orders.workDescription,
    })
    .from(orders)
    .where(
      and(
        sql`date(${orders.issuedAt}) = ${day}`,
        eq(orders.status, 'issued'),
      ),
    )
    .orderBy(desc(orders.issuedAt))
    .all();
}

/** Оплаты, проведённые за день (приходы и расходы). */
export async function paymentsOnDay(database: AppDatabase, day: string) {
  return database
    .select({
      id: payments.id,
      orderId: payments.orderId,
      direction: payments.direction,
      amount: payments.amount,
      cost: payments.cost,
      method: payments.method,
      category: payments.category,
      note: payments.note,
    })
    .from(payments)
    .where(eq(payments.occurredOn, day))
    .all();
}

/** Финансовые расчёты: единая формула выручки, себестоимости и прибыли. */

import { toNumber } from './money.js';

export interface OrderAmounts {
  /** Сумма для клиента (одна итоговая сумма за ремонт). */
  clientTotal: number;
  /** Себестоимость: вводится мастером одной суммой. */
  costTotal: number;
}

export interface PeriodSummary {
  ordersCount: number;
  issuedCount: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  averageCheck: number;
  manualIncome: number;
  expenses: number;
}

export const emptySummary = (): PeriodSummary => ({
  ordersCount: 0,
  issuedCount: 0,
  revenue: 0,
  cost: 0,
  profit: 0,
  margin: 0,
  averageCheck: 0,
  manualIncome: 0,
  expenses: 0,
});

/**
 * Прибыль по одному заказу: сумма клиенту минус себестоимость.
 * Отрицательная прибыль — заказ убыточный, это нормальное состояние.
 */
export function orderProfit(order: OrderAmounts): number {
  return toNumber(order.clientTotal) - toNumber(order.costTotal);
}

/** Маржа в процентах от суммы клиенту. */
export function orderMargin(order: OrderAmounts): number {
  const total = toNumber(order.clientTotal);
  if (!total) return 0;
  return (orderProfit(order) / total) * 100;
}

/**
 * Сводка за период.
 *
 * Деньги считаются по заказам, ВЫДАННЫМ в периоде (дата выдачи) — как в
 * старой версии: выручка появляется, когда клиент расплатился.
 * Прочие доходы (мелкие работы без заказа) добавляются к выручке.
 */
export function summarize(
  issuedOrders: readonly OrderAmounts[],
  options: {
    ordersCount?: number;
    manualIncome?: number;
    expenses?: number;
  } = {},
): PeriodSummary {
  const summary = emptySummary();
  summary.ordersCount = options.ordersCount ?? 0;
  summary.issuedCount = issuedOrders.length;

  for (const order of issuedOrders) {
    summary.revenue += toNumber(order.clientTotal);
    summary.cost += toNumber(order.costTotal);
  }

  summary.manualIncome = toNumber(options.manualIncome);
  summary.expenses = toNumber(options.expenses);

  // Прочие доходы — часть выручки периода.
  summary.revenue += summary.manualIncome;
  summary.profit = summary.revenue - summary.cost - summary.expenses;
  summary.margin = summary.revenue ? (summary.profit / summary.revenue) * 100 : 0;
  summary.averageCheck = summary.issuedCount
    ? issuedOrders.reduce((sum, order) => sum + toNumber(order.clientTotal), 0) / summary.issuedCount
    : 0;

  return summary;
}

/** Долг клиента по заказу: сумма минус оплачено. */
export function orderDebt(clientTotal: number, paid: number): number {
  return Math.max(0, toNumber(clientTotal) - toNumber(paid));
}

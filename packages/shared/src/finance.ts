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
  /** Прочие доходы без заказа (мелкие работы, продажа восстановленной техники). */
  manualIncome: number;
  /** Расходники по ручным доходам — их себестоимость. */
  manualCost: number;
  /** Предоплаты по заказам, ещё не выданным: деньги уже получены. */
  prepayments: number;
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
  manualCost: 0,
  prepayments: 0,
  expenses: 0,
});

/**
 * Прибыль по одному заказу: сумма клиенту минус себестоимость.
 * Отрицательная прибыль — заказ убыточный, это нормальное состояние.
 */
export function orderProfit(order: OrderAmounts): number {
  return toNumber(order.clientTotal) - toNumber(order.costTotal);
}

export interface OrderProfitStage extends OrderAmounts {
  /** Получено от клиента: предоплата плюс внесённые платежи. */
  paid: number;
  /** Заказ выдан — деньги получены полностью. */
  issued?: boolean;
}

/**
 * Прибыль по заказу на текущий момент, «кассой»: только деньги, которые
 * клиент уже отдал, минус себестоимость. Пока заказ не выдан, остаток
 * к доплате — недополученная прибыль, в цифре его нет.
 *
 * Пример: ремонт 100, расходники 50, предоплата 80.
 * Сейчас прибыль 30 (80 − 50), после выдачи станет 50 (100 − 50).
 */
export function orderProfitAtStage(order: OrderProfitStage): number {
  const total = toNumber(order.clientTotal);
  const paid = order.issued
    ? total
    : Math.min(Math.max(toNumber(order.paid), 0), total);
  return paid - toNumber(order.costTotal);
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
 * Деньги считаются по заказам, ВЫДАННЫМ в периоде (дата выдачи): выручка
 * появляется, когда клиент расплатился.
 * Прочие доходы (мелкие работы без заказа) добавляются к выручке.
 *
 * Предоплаты по ещё не выданным заказам тоже входят в выручку сразу:
 * клиент уже отдал деньги. Когда заказ выдали, он попадает в выручку
 * целиком (clientTotal), а предоплата перестаёт учитываться отдельно —
 * двойного счёта нет.
 */
export function summarize(
  issuedOrders: readonly OrderAmounts[],
  options: {
    ordersCount?: number;
    manualIncome?: number;
    manualCost?: number;
    prepayments?: number;
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
  summary.manualCost = toNumber(options.manualCost);
  summary.prepayments = toNumber(options.prepayments);
  summary.expenses = toNumber(options.expenses);

  // Прочие доходы и предоплаты — часть выручки периода.
  summary.revenue += summary.manualIncome + summary.prepayments;
  summary.profit =
    summary.revenue - summary.cost - summary.manualCost - summary.expenses;
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

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
  /** Предоплаты по ещё не выданным заказам: деньги уже получены. */
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

/** Заказ для сводки периода. */
export interface PeriodOrderAmounts extends OrderAmounts {
  /** Предоплата по заказу — она уже в доходе предыдущих/этого периода. */
  prepayment?: number;
  /** Дата предоплаты: по ней видно, в каком периоде её учли. */
  prepaymentAt?: string | null;
}

/** Предоплата по не выданному заказу внутри периода. */
export interface OpenPrepayment {
  /** Сумма предоплаты — деньги уже получены. */
  prepayment: number;
  /** Себестоимость этого заказа — расход уже понесён. */
  costTotal: number;
}

/**
 * Дата YYYY-MM-DD (первые 10 символов любой даты со временем).
 */
function dayOf(value: string): string {
  return value.slice(0, 10);
}

/**
 * Сводка за период — по кассе.
 *
 * Выручка появляется, когда получены деньги:
 *
 * - выданный заказ даёт сумму целиком, если вся оплата пришла в этом
 *   периоде (предоплаты нет или предоплата датирована тем же периодом);
 * - выданный заказ, предоплата которого зависла в прежнем периоде,
 *   добавляет только доплату (clientTotal − prepayment): сама предоплата
 *   уже сидит в выручке того периода вместе со своей себестоимостью.
 *   Поэтому рубль попадает в выручку ровно один раз;
 * - предоплата по не выданному заказу (openPrepayments) даёт выручку
 *   сразу и несёт свою себестоимость: прибыль считать честно, а не «80
 *   при расходниках 50».
 *
 * Прочие доходы (мелкие работы без заказа) добавляются к выручке.
 */
export function summarize(
  issuedOrders: readonly PeriodOrderAmounts[],
  options: {
    ordersCount?: number;
    manualIncome?: number;
    manualCost?: number;
    expenses?: number;
    /** Границы периода — для проверки «предоплата учитывалась раньше?» */
    from?: string;
    to?: string;
    /** Предоплаты по не выданным заказам периода. */
    openPrepayments?: readonly OpenPrepayment[];
  } = {},
): PeriodSummary {
  const summary = emptySummary();
  summary.ordersCount = options.ordersCount ?? 0;
  summary.issuedCount = issuedOrders.length;

  for (const order of issuedOrders) {
    const prepayment = toNumber(order.prepayment);
    const paidElsewhere =
      prepayment > 0 &&
      !!order.prepaymentAt &&
      !!options.from &&
      !!options.to &&
      (dayOf(order.prepaymentAt) < options.from || dayOf(order.prepaymentAt) > options.to);

    if (paidElsewhere) {
      // Предоплата со своей себестоимостью учтена в прежнем периоде —
      // сейчас получена только доплата.
      summary.revenue += toNumber(order.clientTotal) - prepayment;
    } else {
      summary.revenue += toNumber(order.clientTotal);
      summary.cost += toNumber(order.costTotal);
    }
  }

  for (const item of options.openPrepayments ?? []) {
    const prepayment = toNumber(item.prepayment);
    summary.prepayments += prepayment;
    summary.revenue += prepayment;
    // У затрат по этим заказам дата это приём/предоплата — себестоимость
    // уходит в расход того же периода, иначе прибыль обманывает.
    summary.cost += toNumber(item.costTotal);
  }

  summary.manualIncome = toNumber(options.manualIncome);
  summary.manualCost = toNumber(options.manualCost);
  summary.expenses = toNumber(options.expenses);

  // Прочие доходы — часть выручки периода.
  summary.revenue += summary.manualIncome;
  summary.profit =
    summary.revenue - summary.cost - summary.manualCost - summary.expenses;
  summary.margin = summary.revenue ? (summary.profit / summary.revenue) * 100 : 0;
  summary.averageCheck = summary.issuedCount
    ? issuedOrders.reduce((sum, order) => sum + toNumber(order.clientTotal), 0) /
      summary.issuedCount
    : 0;

  return summary;
}

/** Долг клиента по заказу: сумма минус оплачено. */
export function orderDebt(clientTotal: number, paid: number): number {
  return Math.max(0, toNumber(clientTotal) - toNumber(paid));
}

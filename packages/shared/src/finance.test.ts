import { describe, expect, it } from 'vitest';

import { orderMargin, orderProfit, orderDebt, summarize } from './finance.js';

describe('прибыль по заказу', () => {
  it('считает сумму клиенту минус себестоимость', () => {
    expect(orderProfit({ clientTotal: 100, costTotal: 40 })).toBe(60);
    expect(orderMargin({ clientTotal: 100, costTotal: 40 })).toBe(60);
  });

  it('бывает убыточной', () => {
    expect(orderProfit({ clientTotal: 50, costTotal: 80 })).toBe(-30);
    expect(orderMargin({ clientTotal: 50, costTotal: 80 })).toBe(-60);
  });

  it('не делит на ноль', () => {
    expect(orderMargin({ clientTotal: 0, costTotal: 10 })).toBe(0);
  });
});

describe('сводка за период', () => {
  it('считает выручку только по выданным заказам', () => {
    const summary = summarize(
      [
        { clientTotal: 100, costTotal: 40 },
        { clientTotal: 200, costTotal: 150 },
      ],
      { ordersCount: 5, manualIncome: 50, expenses: 30 },
    );

    expect(summary.ordersCount).toBe(5);
    expect(summary.issuedCount).toBe(2);
    expect(summary.revenue).toBe(350);
    expect(summary.cost).toBe(190);
    expect(summary.expenses).toBe(30);
    expect(summary.profit).toBe(130);
    expect(summary.averageCheck).toBe(150);
  });

  it('пустой период даёт нули', () => {
    const summary = summarize([]);
    expect(summary.revenue).toBe(0);
    expect(summary.profit).toBe(0);
    expect(summary.margin).toBe(0);
  });
});

describe('долг по заказу', () => {
  it('не уходит в минус', () => {
    expect(orderDebt(100, 40)).toBe(60);
    expect(orderDebt(100, 150)).toBe(0);
  });
});

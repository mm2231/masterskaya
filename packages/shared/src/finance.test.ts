import { describe, expect, it } from 'vitest';

import { orderMargin, orderProfit, orderProfitAtStage, orderDebt, summarize } from './finance.js';

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

describe('прибыль по этапу (кассой)', () => {
  it('недоплаченная часть не считается прибылью', () => {
    // Ремонт 100, расходники 50, предоплата 80 → сейчас 30, после выдачи 50.
    const order = { clientTotal: 100, costTotal: 50, paid: 80 };
    expect(orderProfitAtStage(order)).toBe(30);
    expect(orderProfitAtStage({ ...order, issued: true })).toBe(50);
  });

  it('складывает предоплату и внесённые платежи', () => {
    expect(
      orderProfitAtStage({ clientTotal: 100, costTotal: 50, paid: 90 }),
    ).toBe(40);
  });

  it('полученное не больше суммы заказа', () => {
    expect(
      orderProfitAtStage({ clientTotal: 100, costTotal: 50, paid: 150 }),
    ).toBe(50);
  });

  it('считает отрицательную прибыль без предоплаты', () => {
    expect(
      orderProfitAtStage({ clientTotal: 100, costTotal: 50, paid: 0 }),
    ).toBe(-50);
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

  it('предоплата входит в выручку, даже если заказ не выдан', () => {
    // Выданных заказов нет — только предоплата по заказу в работе.
    const summary = summarize([], { prepayments: 50 });

    expect(summary.revenue).toBe(50);
    expect(summary.prepayments).toBe(50);
    expect(summary.profit).toBe(50);
  });

  it('расходники уменьшают прибыль ручного дохода', () => {
    // Продал восстановленный телефон за 130, детали обошлись в 50.
    const summary = summarize([], { manualIncome: 130, manualCost: 50 });

    expect(summary.revenue).toBe(130);
    expect(summary.manualIncome).toBe(130);
    expect(summary.manualCost).toBe(50);
    expect(summary.profit).toBe(80);
  });

  it('выданный заказ и предоплата не считаются дважды', () => {
    // Выданный заказ уже включает предоплату в clientTotal — в options
    // его предоплата не передаётся (её отсекает запрос по статусу).
    const summary = summarize([{ clientTotal: 100, costTotal: 40 }], {
      manualIncome: 130,
      manualCost: 50,
      prepayments: 20,
      expenses: 10,
    });

    expect(summary.revenue).toBe(250);
    expect(summary.profit).toBe(150);
  });
});

describe('долг по заказу', () => {
  it('не уходит в минус', () => {
    expect(orderDebt(100, 40)).toBe(60);
    expect(orderDebt(100, 150)).toBe(0);
  });
});

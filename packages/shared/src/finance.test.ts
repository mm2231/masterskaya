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

  it('предоплата входит в выручку вместе со своей себестоимостью', () => {
    // Ремонт 100, расходники 50, предоплата 80: прибыль кассой 30,
    // а не 80 — расход уже понесён.
    const summary = summarize(
      [],
      { openPrepayments: [{ prepayment: 80, costTotal: 50 }] },
    );

    expect(summary.revenue).toBe(80);
    expect(summary.prepayments).toBe(80);
    expect(summary.cost).toBe(50);
    expect(summary.profit).toBe(30);
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
      openPrepayments: [{ prepayment: 20, costTotal: 0 }],
      expenses: 10,
    });

    expect(summary.prepayments).toBe(20);
    expect(summary.revenue).toBe(250);
    expect(summary.profit).toBe(150);
  });

  it('выданным сегодня заказом предоплата из прежнего периода не удваивается', () => {
    // Приняли в сентябре (предоплата 30 учтена там же со своей
    // себестоимостью-снимком 40), выдали в октябре — сейчас получена
    // только доплата, затраты не вычитаются второй раз.
    const summary = summarize(
      [
        {
          clientTotal: 100,
          costTotal: 40,
          prepayment: 30,
          prepaymentAt: '2026-09-20 12:00:00',
          prepaymentCost: 40,
        },
      ],
      { from: '2026-10-01', to: '2026-10-31' },
    );

    expect(summary.revenue).toBe(70);
    expect(summary.cost).toBe(0);
    expect(summary.profit).toBe(70);
  });

  it('докупка запчастей после предоплаты доходит до периода выдачи разницей', () => {
    // Приём в сентябре: затраты 40 (снимок), выдача в октябре после
    // докупки на 20 (итого 60): в сентябре учтено 40, сейчас — 20.
    const summary = summarize(
      [
        {
          clientTotal: 100,
          costTotal: 60,
          prepayment: 30,
          prepaymentAt: '2026-09-20 12:00:00',
          prepaymentCost: 40,
        },
      ],
      { from: '2026-10-01', to: '2026-10-31' },
    );

    expect(summary.revenue).toBe(70);
    expect(summary.cost).toBe(20);
    expect(summary.profit).toBe(50);
  });

  it('выданный сегодня заказ с предоплатой сегодня считается целиком', () => {
    // Приняли и выдали в один период: вся сумма+себестоимость — здесь.
    const summary = summarize(
      [
        {
          clientTotal: 100,
          costTotal: 40,
          prepayment: 30,
          prepaymentAt: '2026-10-20 12:00:00',
        },
      ],
      { from: '2026-10-01', to: '2026-10-31' },
    );

    expect(summary.revenue).toBe(100);
    expect(summary.cost).toBe(40);
    expect(summary.profit).toBe(60);
  });
});

describe('долг по заказу', () => {
  it('не уходит в минус', () => {
    expect(orderDebt(100, 40)).toBe(60);
    expect(orderDebt(100, 150)).toBe(0);
  });
});

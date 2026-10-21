import { describe, expect, it } from 'vitest';

import { formatMoney, formatNumber, formatRub, formatRubInt, toNumber } from './money.js';

describe('toNumber', () => {
  it('принимает числа и строки', () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber('12,5')).toBe(12.5);
    expect(toNumber(' 1 234,50 ')).toBe(1234.5);
  });

  it('не-число превращает в ноль', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(Number.NaN)).toBe(0);
  });
});

describe('форматирование денег', () => {
  it('разделяет тысячи и ставит запятую', () => {
    expect(formatNumber(1234.5)).toBe('1 234,50');
    expect(formatMoney(1234.5)).toBe('1 234,50 р.');
    expect(formatRub(40)).toBe('40,00 руб.');
  });

  it('убирает копейки у целых сумм в акте', () => {
    expect(formatRubInt(40)).toBe('40 руб.');
    expect(formatRubInt(40.5)).toBe('40,50 руб.');
  });
});

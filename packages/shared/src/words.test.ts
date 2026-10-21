import { describe, expect, it } from 'vitest';

import { numberToWords, pluralize } from './words.js';

describe('numberToWords', () => {
  it('пишет сумму прописью', () => {
    expect(numberToWords(0)).toBe('Ноль рублей 00 копеек');
    expect(numberToWords(1)).toBe('Один рубль 00 копеек');
    expect(numberToWords(2)).toBe('Два рубля 00 копеек');
    expect(numberToWords(5)).toBe('Пять рублей 00 копеек');
    expect(numberToWords(40)).toBe('Сорок рублей 00 копеек');
    expect(numberToWords(200)).toBe('Двести рублей 00 копеек');
  });

  it('учитывает тысячи и миллионы', () => {
    expect(numberToWords(1000)).toBe('Одна тысяча рублей 00 копеек');
    expect(numberToWords(2000)).toBe('Две тысячи рублей 00 копеек');
    expect(numberToWords(1_000_000)).toBe('Один миллион рублей 00 копеек');
  });

  it('пишет копейки', () => {
    expect(numberToWords(40.5)).toBe('Сорок рублей 50 копеек');
    expect(numberToWords(1.01)).toBe('Один рубль 01 копейка');
  });

  it('переносит 100 копеек в рубли', () => {
    // 199.999 округляется до 200.00 — не должно быть «200 рублей 100 копеек».
    expect(numberToWords(199.999)).toBe('Двести рублей 00 копеек');
  });

  it('не падает на мусоре', () => {
    expect(numberToWords(null)).toBe('Ноль рублей 00 копеек');
    expect(numberToWords('abc')).toBe('Ноль рублей 00 копеек');
  });
});

describe('pluralize', () => {
  it('выбирает форму слова', () => {
    expect(pluralize(1, 'заказ', 'заказа', 'заказов')).toBe('заказ');
    expect(pluralize(2, 'заказ', 'заказа', 'заказов')).toBe('заказа');
    expect(pluralize(5, 'заказ', 'заказа', 'заказов')).toBe('заказов');
    expect(pluralize(11, 'заказ', 'заказа', 'заказов')).toBe('заказов');
    expect(pluralize(21, 'заказ', 'заказа', 'заказов')).toBe('заказ');
  });
});

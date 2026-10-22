import { afterEach, describe, expect, it } from 'vitest';

import { nowSql, timezoneLabel, todayIso } from './dates.js';

/** Ожидаемое локальное время при заданном смещении. */
function expectedWithOffset(offsetHours: number): string {
  const shifted = new Date(Date.now() + offsetHours * 3_600_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}

describe('часовой пояс', () => {
  afterEach(() => {
    delete process.env.TIMEZONE_OFFSET_HOURS;
  });

  it('nowSql считает время в заданной зоне', () => {
    process.env.TIMEZONE_OFFSET_HOURS = '3';
    // Секунды могут отличаться на 1 — сравниваем до минут.
    expect(nowSql().slice(0, 16)).toBe(expectedWithOffset(3).slice(0, 16));
  });

  it('todayIso берёт дату в заданной зоне', () => {
    process.env.TIMEZONE_OFFSET_HOURS = '3';
    expect(todayIso()).toBe(expectedWithOffset(3).slice(0, 10));
  });

  it('без заданной зоны берётся локальное время системы', () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    expect(todayIso()).toBe(local);
  });

  it('зона показывается понятной подписью', () => {
    process.env.TIMEZONE_OFFSET_HOURS = '3';
    expect(timezoneLabel()).toBe('UTC+3');

    process.env.TIMEZONE_OFFSET_HOURS = '2';
    expect(timezoneLabel()).toBe('UTC+2');

    delete process.env.TIMEZONE_OFFSET_HOURS;
    expect(timezoneLabel()).toBe('локальное время системы');
  });
});

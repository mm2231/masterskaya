import { describe, expect, it } from 'vitest';

import {
  describeDue,
  isDueToday,
  isOverdue,
  normalizeDueAt,
  overdueDays,
  todayDate,
} from './tasks.js';

/**
 * Дата через N дней от сегодня — «YYYY-MM-DD».
 *
 * Функции overdueDays и describeDue считают от текущего дня, поэтому
 * тесты не должны быть привязаны к конкретной дате: иначе они падают
 * на следующий день после написания.
 */
function dayFromNow(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

describe('normalizeDueAt', () => {
  it('приводит дату и время к формату SQLite', () => {
    expect(normalizeDueAt('2026-10-21T16:00')).toBe('2026-10-21 16:00:00');
    expect(normalizeDueAt('2026-10-21 16:00')).toBe('2026-10-21 16:00:00');
  });

  it('дату без времени ставит на конец дня', () => {
    expect(normalizeDueAt('2026-10-21')).toBe('2026-10-21 23:59:00');
  });

  it('пустой срок — это отсутствие срока', () => {
    expect(normalizeDueAt('')).toBeNull();
    expect(normalizeDueAt(null)).toBeNull();
    expect(normalizeDueAt('не дата')).toBeNull();
  });
});

describe('просрочка', () => {
  const now = '2026-10-21 12:00:00';

  it('задача со сроком в прошлом просрочена', () => {
    expect(isOverdue('2026-10-20 18:00', now)).toBe(true);
  });

  it('задача со сроком в будущем не просрочена', () => {
    expect(isOverdue('2026-10-22 09:00', now)).toBe(false);
  });

  it('задача без срока не просрочена', () => {
    expect(isOverdue(null, now)).toBe(false);
  });

  it('считает дни просрочки', () => {
    expect(overdueDays(`${dayFromNow(-2)} 10:00`)).toBe(2);
    expect(overdueDays(`${dayFromNow(0)} 10:00`)).toBe(0);
    expect(overdueDays(null)).toBe(0);
  });

  it('определяет задачу на сегодня', () => {
    expect(isDueToday('2026-10-21 16:00', '2026-10-21')).toBe(true);
    expect(isDueToday('2026-10-22 16:00', '2026-10-21')).toBe(false);
    expect(isDueToday(null, '2026-10-21')).toBe(false);
  });
});

describe('describeDue', () => {
  it('описывает близкие сроки словами', () => {
    expect(describeDue(`${todayDate()} 16:00`)).toBe('сегодня, 16:00');
    expect(describeDue(`${dayFromNow(1)} 16:00`)).toBe('завтра, 16:00');
  });

  it('пишет «просрочено», если срок прошёл', () => {
    expect(describeDue(`${dayFromNow(-2)} 16:00`)).toContain('просрочено');
  });

  it('для далёких сроков показывает дату', () => {
    expect(describeDue('2026-12-01 16:00')).toBe('01.12.2026');
  });

  it('без срока — «без срока»', () => {
    expect(describeDue(null)).toBe('без срока');
  });
});

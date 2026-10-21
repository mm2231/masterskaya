/**
 * Задачи по заказу: «позвонить клиенту», «заказать деталь», «напомнить».
 *
 * Срок хранится текстом в формате SQLite: «YYYY-MM-DD HH:MM».
 */

import { z } from 'zod';

export const taskInputSchema = z.object({
  orderId: z.number().int().positive(),
  title: z.string().trim().min(1, 'Укажите, что нужно сделать').max(300),
  /** Срок: дата и время. Пусто — задача без срока. */
  dueAt: z.string().trim().max(40).optional().or(z.literal('')),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskPatchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  dueAt: z.string().trim().max(40).optional(),
  done: z.boolean().optional(),
});

/** Готовые задачи — кнопки в карточке заказа. */
export const TASK_TEMPLATES = [
  { title: 'Позвонить клиенту', icon: '📞' },
  { title: 'Заказать деталь', icon: '🧩' },
  { title: 'Уточнить стоимость у клиента', icon: '💬' },
  { title: 'Напомнить о готовности', icon: '⏰' },
] as const;

/** Текущий момент в формате SQLite. */
function nowSql(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:00`
  );
}

/** Сегодняшняя дата в формате YYYY-MM-DD. */
export function todayDate(): string {
  return nowSql().slice(0, 10);
}

/**
 * Привести срок к формату SQLite: «YYYY-MM-DD HH:MM».
 *
 * Принимает то, что приходит из формы: «2026-10-21T16:00», «2026-10-21 16:00»,
 * «2026-10-21». Дату без времени ставим на конец дня.
 */
export function normalizeDueAt(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  if (!text) return null;

  const withTime = text.replace('T', ' ');
  const match = /^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/.exec(withTime);
  if (!match) return null;

  const day = match[1]!;
  const time = match[2] ?? '23:59';
  return `${day} ${time}:00`;
}

/** Задача просрочена: срок прошёл, а задача не выполнена. */
export function isOverdue(dueAt: string | null | undefined, now: string = nowSql()): boolean {
  if (!dueAt) return false;
  return dueAt < now;
}

/** Задача на сегодня. */
export function isDueToday(dueAt: string | null | undefined, today: string = todayDate()): boolean {
  if (!dueAt) return false;
  return dueAt.slice(0, 10) === today;
}

/** Сколько дней задача просрочена (0 — сегодня). */
export function overdueDays(dueAt: string | null | undefined): number {
  if (!dueAt) return 0;
  const due = new Date(`${dueAt.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 0;
  const today = new Date(`${todayDate()}T00:00:00`);
  const diff = Math.round((today.getTime() - due.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** Человекочитаемый срок: «сегодня», «завтра», «через 3 дня», «21.10.2026». */
export function describeDue(dueAt: string | null | undefined): string {
  if (!dueAt) return 'без срока';
  const day = dueAt.slice(0, 10);
  const time = dueAt.slice(11, 16);
  const today = todayDate();

  const due = new Date(`${day}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const diff = Math.round((due.getTime() - now.getTime()) / 86_400_000);

  if (diff === 0) return time ? `сегодня, ${time}` : 'сегодня';
  if (diff === 1) return time ? `завтра, ${time}` : 'завтра';
  if (diff === -1) return time ? `вчера, ${time}` : 'вчера';
  if (diff < 0) return `просрочено на ${Math.abs(diff)} дн.`;
  if (diff <= 6) return `через ${diff} дн.`;
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
}

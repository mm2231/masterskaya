/** Даты: хранение в ISO, показ в русском формате. */

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function parse(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  if (!text) return null;

  // SQLite отдаёт «YYYY-MM-DD HH:MM:SS» — приводим к ISO.
  const iso = text.includes('T') ? text : text.replace(' ', 'T');
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  // Дата без времени: трактуем как локальную полночь, а не UTC.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return null;
}

/** «18.10.2026» */
export function formatDate(value: unknown): string {
  const date = parse(value);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

/** «18.10.2026 14:30» */
export function formatDateTime(value: unknown): string {
  const date = parse(value);
  if (!date) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)} ${hours}:${minutes}`;
}

/** «18 октября 2026 г.» — для печатных актов. */
export function formatDateLong(value: unknown): string {
  const date = parse(value);
  if (!date) return '';
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()} г.`;
}

/** «18 окт.» — для таблиц. */
export function formatDateShort(value: unknown): string {
  const date = parse(value);
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** Сегодняшняя дата в формате YYYY-MM-DD. */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Текущий момент в формате SQLite: «YYYY-MM-DD HH:MM:SS».
 *
 * В базе все даты хранятся именно так — иначе строковое сравнение
 * в запросах по периоду ломается (ISO с «T» сравнивается с пробелом).
 */
export function nowSql(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

/** «14:30» — только время, для списка за сегодня. */
export function formatTime(value: unknown): string {
  const date = parse(value);
  if (!date) return '—';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Первый день месяца в формате YYYY-MM-DD. */
export function monthStartIso(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Человекочитаемый период: «18.10.2026 — 21.10.2026». */
export function formatPeriod(from: unknown, to: unknown): string {
  const left = formatDate(from);
  const right = formatDate(to);
  if (!left && !right) return '';
  if (!left) return `— ${right}`;
  if (!right) return `${left} —`;
  return `${left} — ${right}`;
}

/** Возраст в днях — для отчёта по клиентам. */
export function daysSince(value: unknown): number | null {
  const date = parse(value);
  if (!date) return null;
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / 86_400_000);
}

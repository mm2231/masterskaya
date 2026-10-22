/**
 * Даты: хранение в формате SQLite, показ в русском формате.
 *
 * Время в базе — **локальное время мастерской** (зона из
 * TIMEZONE_OFFSET_HOURS, по умолчанию время операционной системы).
 * Значения по умолчанию в схеме SQLite (datetime('now')) дают UTC —
 * поэтому все времена задаются из кода явно.
 */

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

/**
 * Смещение часового пояса в часах.
 *
 * Читается из переменной окружения TIMEZONE_OFFSET_HOURS (3 — Минск,
 * 2 — Калининград и т. д.). Если переменной нет или браузер — берём
 * локальное время системы.
 */
export function timezoneOffsetHours(): number | null {
  if (typeof process === 'undefined' || !process.env) return null;
  const raw = process.env.TIMEZONE_OFFSET_HOURS;
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Название зоны для интерфейса: «UTC+3» или «локальное время». */
export function timezoneLabel(): string {
  const offset = timezoneOffsetHours();
  if (offset === null) return 'локальное время системы';
  const sign = offset >= 0 ? '+' : '−';
  const abs = Math.abs(offset);
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  return minutes ? `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}` : `UTC${sign}${hours}`;
}

/**
 * Текущий момент, сдвинутый в зону мастерской.
 *
 * Возвращает «настенные» часы: для зоны UTC+3 к UTC-времени прибавляется
 * три часа, а компоненты берутся как UTC-поля.
 */
function nowInZone(): Date | null {
  const offset = timezoneOffsetHours();
  if (offset === null) return null;
  return new Date(Date.now() + offset * 3_600_000);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

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

/** Сегодняшняя дата в формате YYYY-MM-DD — в зоне мастерской. */
export function todayIso(): string {
  const zoned = nowInZone();
  if (zoned) {
    return `${zoned.getUTCFullYear()}-${pad(zoned.getUTCMonth() + 1)}-${pad(zoned.getUTCDate())}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Текущий момент в формате SQLite: «YYYY-MM-DD HH:MM:SS».
 *
 * В базе все даты хранятся именно так — иначе строковое сравнение
 * в запросах по периоду ломается (ISO с «T» сравнивается с пробелом).
 *
 * Время — локальное для мастерской: если задан TIMEZONE_OFFSET_HOURS,
 * считаем по нему, иначе берём время системы.
 */
export function nowSql(): string {
  const zoned = nowInZone();
  if (zoned) {
    return (
      `${zoned.getUTCFullYear()}-${pad(zoned.getUTCMonth() + 1)}-${pad(zoned.getUTCDate())} ` +
      `${pad(zoned.getUTCHours())}:${pad(zoned.getUTCMinutes())}:${pad(zoned.getUTCSeconds())}`
    );
  }
  const now = new Date();
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

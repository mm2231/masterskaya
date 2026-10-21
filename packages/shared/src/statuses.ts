/** Статусы заказа: код, подпись, цвет бейджа, «терминальный» признак. */
export const ORDER_STATUSES = [
  { code: 'new', label: 'Новый', color: 'blue', terminal: false },
  { code: 'diagnostics', label: 'Диагностика', color: 'indigo', terminal: false },
  { code: 'in_progress', label: 'В работе', color: 'amber', terminal: false },
  { code: 'waiting_parts', label: 'Ждёт запчасть', color: 'violet', terminal: false },
  { code: 'ready', label: 'Готов', color: 'green', terminal: false },
  { code: 'issued', label: 'Выдан', color: 'emerald', terminal: true },
  { code: 'declined', label: 'Отказ клиента', color: 'rose', terminal: true },
  { code: 'warranty', label: 'Гарантийный', color: 'teal', terminal: false },
] as const;

export type OrderStatusCode = (typeof ORDER_STATUSES)[number]['code'];

export const ORDER_STATUS_CODES: readonly OrderStatusCode[] = ORDER_STATUSES.map(
  (item) => item.code,
);

export function isOrderStatus(value: unknown): value is OrderStatusCode {
  return typeof value === 'string' && (ORDER_STATUS_CODES as readonly string[]).includes(value);
}

export function statusLabel(code: unknown): string {
  return ORDER_STATUSES.find((item) => item.code === code)?.label ?? '—';
}

export function statusColor(code: unknown): string {
  return ORDER_STATUSES.find((item) => item.code === code)?.color ?? 'gray';
}

/** Статусы, в которых заказ ещё в работе (не выдан и не отменён). */
export function isOpenStatus(code: unknown): boolean {
  const found = ORDER_STATUSES.find((item) => item.code === code);
  return found ? !found.terminal : false;
}

/**
 * Разрешённые переходы статусов.
 *
 * Жёсткие переходы (например «Готов» → «Новый») запрещены намеренно:
 * они ломают историю выдачи и финансовую отчётность. Мягкие — разрешены
 * в обе стороны, но фиксируются в журнале событий.
 */
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  new: ['diagnostics', 'in_progress', 'waiting_parts', 'ready', 'declined', 'warranty'],
  diagnostics: ['in_progress', 'waiting_parts', 'ready', 'declined', 'warranty'],
  in_progress: ['waiting_parts', 'ready', 'declined', 'warranty'],
  waiting_parts: ['in_progress', 'ready', 'declined', 'warranty'],
  ready: ['in_progress', 'issued', 'declined', 'warranty'],
  issued: ['ready', 'warranty'],
  declined: ['new', 'in_progress'],
  warranty: ['in_progress', 'ready', 'issued', 'declined'],
};

export function canTransition(from: unknown, to: unknown): boolean {
  if (!isOrderStatus(to)) return false;
  if (from === to) return true;
  if (!isOrderStatus(from)) return true;
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function allowedTransitions(from: unknown): readonly string[] {
  if (!isOrderStatus(from)) return ORDER_STATUS_CODES;
  return ALLOWED_TRANSITIONS[from] ?? ORDER_STATUS_CODES;
}

/** Статусы заказа поставщику удалены вместе с парсингом — здесь их нет. */

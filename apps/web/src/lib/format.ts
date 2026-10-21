/** Форматирование для интерфейса: деньги, даты, инициалы. */

export { formatMoney, formatNumber, formatRub, formatRubInt } from '@masterskaya/shared';
export { formatDate, formatDateLong, formatDateShort, formatDateTime } from '@masterskaya/shared';

/** Инициалы клиента для аватара: «Иванов Иван» → «ИИ». */
export function initials(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

/** Маска телефона для показа: «+375 29 123-45-67». */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('375')) {
    return `+375 ${digits.slice(3, 5)} ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

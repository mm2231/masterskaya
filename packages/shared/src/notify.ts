/** Ссылки для уведомления клиента о готовности заказа. */

export interface NotifyTarget {
  phone?: string | null;
  telegram?: string | null;
  viber?: string | null;
}

export interface NotifyMessage {
  text: string;
  sms: string;
  telegram: string;
  viber: string;
}

/** Нормализация номера: белорусский без кода → 375 + номер. */
export function normalizeNumber(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 9) return `375${digits}`;
  return digits;
}

/** Текст сообщения о готовности заказа. */
export function readyMessage(options: {
  clientName?: string | null;
  device?: string | null;
  workshopName: string;
  address?: string | null;
  phone?: string | null;
}): string {
  const greeting = options.clientName?.trim()
    ? `Здравствуйте, ${options.clientName.trim()}!`
    : 'Здравствуйте!';
  const device = options.device?.trim() || 'Ваш телефон';
  const parts = [
    `${greeting} ${device} готов к выдаче.`,
    `Мастерская «${options.workshopName}»${options.address ? `, ${options.address}` : ''}.`,
  ];
  if (options.phone) parts.push(`Телефон: ${options.phone}`);
  return parts.join(' ');
}

/** Ссылки для отправки: SMS, Telegram, Viber. */
export function notifyLinks(
  target: NotifyTarget,
  text: string,
): NotifyMessage {
  const digits = normalizeNumber(target.phone);
  return {
    text,
    // ?&body= — совместимо и с iOS, и с Android.
    sms: target.phone ? `sms:${target.phone}?&body=${encodeURIComponent(text)}` : '',
    telegram: digits ? `https://t.me/+${digits}` : '',
    // Viber ждёт номер в международном формате, «+» кодируется как %2B.
    viber: digits ? `viber://chat?number=%2B${digits}` : '',
  };
}

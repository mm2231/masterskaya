/** Форматирование денег и дат. Один источник правды для API и интерфейса. */

/** Приводит любое значение к числу; не-число — ноль. */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** «1 234,56» — без символа валюты. */
export function formatNumber(value: unknown, fractionDigits = 2): string {
  return toNumber(value)
    .toLocaleString('ru-RU', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    .replace(/ /g, ' ');
}

/** «1 234,56 р.» — как в интерфейсе. */
export function formatMoney(value: unknown): string {
  return `${formatNumber(value)} р.`;
}

/** «1 234,56 руб.» — как в печатных актах. */
export function formatRub(value: unknown): string {
  return `${formatNumber(value)} руб.`;
}

/** Итог акта: без копеек, если сумма целая («40 руб.» вместо «40,00 руб.»). */
export function formatRubInt(value: unknown): string {
  const number = toNumber(value);
  if (Math.abs(number - Math.round(number)) < 0.005) {
    return `${Math.round(number).toLocaleString('ru-RU').replace(/ /g, ' ')} руб.`;
  }
  return formatRub(number);
}

/** Знак валюты отдельной строкой — для вёрстки акта. */
export function formatMoneyPlain(value: unknown): string {
  return formatNumber(value);
}

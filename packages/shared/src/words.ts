/**
 * Сумма прописью для печатных актов.
 *
 * Перенесено из прежнего проекта (app.py → number_to_words) без изменения
 * поведения: акты уже печатались с этим текстом, правки меняли бы бланк.
 */

const UNITS_MALE = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const UNITS_FEMALE = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const TEENS = [
  'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать',
  'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать',
];
const TENS = [
  '', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят',
  'семьдесят', 'восемьдесят', 'девяносто',
];
const HUNDREDS = [
  '', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот',
  'семьсот', 'восемьсот', 'девятьсот',
];

/** Число от 0 до 999 словами с учётом рода. */
function tripleToWords(number: number, female: boolean): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(number / 100);
  const rest = number % 100;
  const tens = Math.floor(rest / 10);
  const units = rest % 10;

  if (hundreds > 0) words.push(HUNDREDS[hundreds]!);
  if (tens === 1) {
    words.push(TEENS[units]!);
  } else {
    if (tens > 0) words.push(TENS[tens]!);
    if (units > 0) words.push((female ? UNITS_FEMALE : UNITS_MALE)[units]!);
  }
  return words;
}

/** Форма слова: 1 рубль / 2 рубля / 5 рублей. */
function plural(number: number, forms: [string, string, string]): string {
  const mod100 = Math.abs(number) % 100;
  if (mod100 >= 11 && mod100 <= 19) return forms[2];
  const mod10 = mod100 % 10;
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** «Двести рублей 00 копеек». */
export function numberToWords(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value) || 0;
  const negative = amount < 0;
  const absolute = Math.abs(amount);

  const whole = Math.floor(absolute);
  let kopecks = Math.round((absolute - whole) * 100);
  // Округление может дать 100 копеек — переносим в рубли (как в старом коде).
  let rubles = whole;
  if (kopecks >= 100) {
    rubles += 1;
    kopecks -= 100;
  }

  let text = '';
  if (rubles === 0) {
    text = 'ноль';
  } else {
    const parts: string[] = [];
    const millions = Math.floor(rubles / 1_000_000);
    const thousands = Math.floor((rubles % 1_000_000) / 1000);
    const rest = rubles % 1000;

    if (millions > 0) {
      parts.push(...tripleToWords(millions, false));
      parts.push(plural(millions, ['миллион', 'миллиона', 'миллионов']));
    }
    if (thousands > 0) {
      parts.push(...tripleToWords(thousands, true));
      parts.push(plural(thousands, ['тысяча', 'тысячи', 'тысяч']));
    }
    if (rest > 0) {
      parts.push(...tripleToWords(rest, false));
    }
    text = parts.join(' ');
  }

  const rubleForms = plural(rubles, ['рубль', 'рубля', 'рублей']);
  const kopeckForms = plural(kopecks, ['копейка', 'копейки', 'копеек']);

  const result = `${negative ? 'минус ' : ''}${text} ${rubleForms} ${String(kopecks).padStart(2, '0')} ${kopeckForms}`;
  // Первая буква заглавная — как в старых актах.
  return result[0]!.toUpperCase() + result.slice(1);
}

/** Правильное окончание: 1 заказ / 2 заказа / 5 заказов. */
export function pluralize(number: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(number) % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  const mod10 = mod100 % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

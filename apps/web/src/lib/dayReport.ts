/**
 * Отчёт за рабочий день: строки для PDF-отчёта и копирования в таблицу.
 *
 * Строки повторяют структуру пользовательской Google-таблицы:
 * Дата | Клиент / Устройство | Тип работ | Затраты (ЗЧ) | Выручка |
 * Прибыль | Статус | Примечание.
 *
 * Буфер обмена отдаёт TSV без строки заголовков — вставляется в конец
 * листа целиком, колонки попадают по порядку.
 */

import { formatDate } from '@masterskaya/shared';

import type { TodayData } from './types';

/** Строка отчёта дня — одна ячейка таблицы Google. */
export interface DayReportRow {
  /** ДД.ММ.ГГГГ */
  date: string;
  /** Клиент / Устройство */
  client: string;
  /** Тип работ */
  work: string;
  /** Затраты (ЗЧ) */
  cost: number | null;
  /** Выручка */
  revenue: number | null;
  /** Прибыль */
  profit: number | null;
  /** Выполнен / Предоплата / Расходы */
  status: string;
  /** Примечание (№ заказа, категория, комментарий) */
  note: string;
}

const SUMMARY_OF_DAY = 'Выполнен';
const STATUS_PREPAYMENT = 'Предоплата';
const STATUS_EXPENSE = 'Расходы';

/** Число для буфера: без разделителей тысяч, десятичная запятая (ru). */
function cellMoney(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '';
  const round = Math.round(value * 100) / 100;
  return Number.isInteger(round) ? String(round) : String(round).replace('.', ',');
}

/** Строки дня всех четырёх типов, в порядке прохода кассы. */
export function buildDayReportRows(data: TodayData): DayReportRow[] {
  const day = formatDate(data.date);
  if (!day) return [];
  const rows: DayReportRow[] = [];

  // 1. Выданные заказы: полный расчёт (предоплата из прежнего периода
  //    уже учтена в таблице ранее — сейчас получена только доплата).
  for (const order of data.orders) {
    const prepayment = Number(order.prepayment ?? 0);
    const prepaidElsewhere =
      prepayment > 0 &&
      !!order.prepaymentAt &&
      (order.prepaymentAt ?? '').slice(0, 10) < data.date.slice(0, 10);
    const revenue = prepaidElsewhere
      ? Number(order.clientTotal) - prepayment
      : Number(order.clientTotal);
    const cost = prepaidElsewhere ? 0 : Number(order.costTotal);
    const clientParts = [order.deviceLabel || null, order.clientName]
      .filter(Boolean)
      .join(' · ');
    rows.push({
      date: day,
      client: clientParts || '—',
      work: order.workDescription?.trim() || 'ремонт',
      cost,
      revenue,
      profit: revenue - cost,
      status: SUMMARY_OF_DAY,
      note: `Заказ №${order.number}`,
    });
  }

  // 2. Ручные доходы без заказа: услуги, продажи («защитки», «выручка»...).
  for (const payment of data.payments) {
    if (payment.direction !== 'in' || payment.orderId !== null) continue;
    const amount = Number(payment.amount);
    const cost = Number(payment.cost ?? 0);
    rows.push({
      date: day,
      client: payment.category || 'Услуги',
      work: payment.note?.trim() || 'услуги',
      cost: cost || null,
      revenue: amount,
      profit: amount - cost,
      status: SUMMARY_OF_DAY,
      note: payment.note?.trim() ?? '',
    });
  }

  // 3. Расходы дня: затраты строкой, отрицательная прибыль.
  for (const payment of data.payments) {
    if (payment.direction !== 'out') continue;
    const amount = Number(payment.amount);
    rows.push({
      date: day,
      client: payment.category || 'Расходы',
      work: '',
      cost: amount,
      revenue: null,
      profit: -amount,
      status: STATUS_EXPENSE,
      note: payment.note?.trim() ?? '',
    });
  }

  // 4. Предоплаты дня: заказ ещё не выдан, деньги уже в кассе.
  //    Затраты (ЗЧ) уже понесены — расходники куплены, иначе прибыль
  //    обманывает: «80 без затрат» вместо честных 80 − 50. Когда заказ
  //    выдадут, в лист пойдёт только доплата (у неё затрат 0) — рубль
  //    и себестоимость считаются ровно один раз.
  for (const item of data.prepayments ?? []) {
    const prepayment = Number(item.prepayment);
    const cost = Number(item.costTotal ?? 0);
    const clientParts = [item.deviceLabel || null, item.clientName]
      .filter(Boolean)
      .join(' · ');
    rows.push({
      date: day,
      client: clientParts || 'Предоплата',
      work: item.workDescription?.trim() || 'предоплата',
      cost: cost,
      revenue: prepayment,
      profit: prepayment - cost,
      status: STATUS_PREPAYMENT,
      note: `Предоплата по заказу №${item.number}, не выдан`,
    });
  }

  return rows;
}

/**
 * Итоги дня для отчёта: выручка, затраты ЗЧ, прибыль.
 * Берём из сводки — она уже кассовая (предоплата со своей себестоимостью,
 * выданный заказ с предоплатой из прежнего периода — только доплата).
 */
export function dayReportTotals(data: TodayData) {
  const s = data.summary;
  return {
    revenue: s.revenue,
    cost: s.cost + s.manualCost,
    profit: s.profit,
    expenses: s.expenses,
  };
}

/**
 * Формула «Прибыль», не привязанная к строке: вставляется текстом,
 * Google Sheets распознаёт её как формулу, ROW() берёт строку вставки.
 * Пустая ячейка затёрла бы формулу листа (E−D), а значение оставило бы
 * колонку «мёртвой» для будущих правок — формула сохраняет поведение.
 */
const PROFIT_CELL = '=INDIRECT("E"&ROW())-INDIRECT("D"&ROW())';

/** TSV без заголовков: одна табуляция между колонками. */
export function dayReportTsv(rows: readonly DayReportRow[]): string {
  return rows
    .map((row) =>
      [
        row.date,
        row.client,
        row.work,
        cellMoney(row.cost),
        cellMoney(row.revenue),
        // Колонка «Прибыль»: самоссылочная formula — Sheets сама считает
        // E−D в строке вставки, формулы листа не затираются впустую.
        PROFIT_CELL,
        row.status,
        row.note,
      ]
        .map((cell) => cell.replace(/\t/g, ' ').replace(/\n/g, ' ').trim())
        .join('\t'),
    )
    .join('\n');
}

/**
 * Копирование в буфер. Через Async Clipboard API; в старых браузерах —
 * резервный путь через скрытую textarea.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

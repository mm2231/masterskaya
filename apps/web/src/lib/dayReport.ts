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

import type { PeriodReportData, TodayData } from './types';

/** Строка отчёта дня — одна ячейка таблицы Google. */
export interface DayReportRow {
  /** Тип строки: выданный заказ, услуги/продажи, расход, предоплата. */
  kind: 'issued' | 'manual' | 'expense' | 'prepayment';
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

/** Дата YYYY-MM-DD из любой даты со временем. */
function dayOf(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10);
}

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
    const clientParts = [order.deviceLabel || null, order.clientName]
      .filter(Boolean)
      .join(' · ');
    const prepaidElsewhere =
      prepayment > 0 &&
      !!order.prepaymentAt &&
      (order.prepaymentAt ?? '').slice(0, 10) < data.date.slice(0, 10);
    const revenue = prepaidElsewhere
      ? Number(order.clientTotal) - prepayment
      : Number(order.clientTotal);
    // В затраты ранее учтённого периода закладывали снимок (сколько
    // стоил заказ на дату предоплаты) — сейчас идёт только разница
    // (докупка запчастей), иначе себестоимость посчитается дважды.
    const cost = prepaidElsewhere
      ? Number(order.costTotal) - Number(order.prepaymentCost ?? 0)
      : Number(order.costTotal);
    rows.push({
      kind: 'issued',
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
      kind: 'manual',
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
      kind: 'expense',
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
      kind: 'prepayment',
      date: day,
      client: clientParts || 'Предоплата',
      work: item.workDescription?.trim() || 'предоплата',
      // Затраты — снимок на дату предоплаты: расходники уже куплены,
      // иначе прибыль обманывает. После выдачи пойдёт только доплата
      // с разницей затрат — двойного счёта нет.
      cost: Number(item.prepaymentCost ?? item.costTotal ?? 0),
      revenue: prepayment,
      profit: prepayment - Number(item.prepaymentCost ?? item.costTotal ?? 0),
      status: STATUS_PREPAYMENT,
      note: `Предоплата по заказу №${item.number}, не выдан`,
    });
  }

  return rows;
}

/**
 * Строки месячного (произвольного периода) отчёта — целостный кассовый
 * леджер периода, отсортированный по датам.
 *
 * Отличия от дневного:
 * - у каждой строки своя дата (движения разных дней одного месяца);
 * - предоплаты периода включают и те, что уже выданы в этом же
 *   периоде: деньги получены здесь, а строка выдачи у них несёт
 *   только доплату и разницу затрат — двойного счёта нет;
 * - у строки выдачи «предоплата раньше» проверяется относительно
 *   даты выдачи, а не границы отчёта: деньги могли прийти и до
 *   периода (учтены раньше), и внутри него (учтены строкой предоплаты).
 */
export function buildPeriodReportRows(data: PeriodReportData): DayReportRow[] {
  const rows: DayReportRow[] = [];

  for (const order of data.orders) {
    const prepayment = Number(order.prepayment ?? 0);
    const clientParts = [order.deviceLabel || null, order.clientName]
      .filter(Boolean)
      .join(' · ');
    const issuedDate = dayOf(order.issuedAt) || data.from;
    const prepaidEarlier =
      prepayment > 0 && !!order.prepaymentAt && dayOf(order.prepaymentAt) < issuedDate;
    const revenue = prepaidEarlier
      ? Number(order.clientTotal) - prepayment
      : Number(order.clientTotal);
    const cost = prepaidEarlier
      ? Number(order.costTotal) - Number(order.prepaymentCost ?? 0)
      : Number(order.costTotal);
    rows.push({
      kind: 'issued',
      date: formatDate(issuedDate),
      client: clientParts || '—',
      work: order.workDescription?.trim() || 'ремонт',
      cost,
      revenue,
      profit: revenue - cost,
      status: SUMMARY_OF_DAY,
      note: `Заказ №${order.number}`,
    });
  }

  for (const payment of data.payments) {
    const amount = Number(payment.amount);
    const date = formatDate(dayOf(payment.occurredOn) || data.from);
    if (payment.direction === 'in' && payment.orderId === null) {
      const cost = Number(payment.cost ?? 0);
      rows.push({
        kind: 'manual',
        date,
        client: payment.category || 'Услуги',
        work: payment.note?.trim() || 'услуги',
        cost: cost || null,
        revenue: amount,
        profit: amount - cost,
        status: SUMMARY_OF_DAY,
        note: payment.note?.trim() ?? '',
      });
    } else if (payment.direction === 'out') {
      rows.push({
        kind: 'expense',
        date,
        client: payment.category || 'Расходы',
        work: '',
        cost: amount,
        revenue: null,
        profit: -amount,
        status: STATUS_EXPENSE,
        note: payment.note?.trim() ?? '',
      });
    }
  }

  for (const item of data.prepayments ?? []) {
    const prepayment = Number(item.prepayment);
    const prepayDate = dayOf(item.prepaymentAt);
    // Выдача в день предоплаты или позже: деньги посчитаны строкой
    // выдачи — предоплатную строку не дублируем.
    if (item.issuedAt && prepayDate >= dayOf(item.issuedAt)) continue;
    const cost = Number(item.prepaymentCost ?? item.costTotal ?? 0);
    const clientParts = [item.deviceLabel || null, item.clientName]
      .filter(Boolean)
      .join(' · ');
    rows.push({
      kind: 'prepayment',
      date: formatDate(prepayDate || data.from),
      client: clientParts || 'Предоплата',
      work: item.workDescription?.trim() || 'предоплата',
      cost,
      revenue: prepayment,
      profit: prepayment - cost,
      status: STATUS_PREPAYMENT,
      note:
        item.status === 'issued' && item.issuedAt
          ? `Предоплата по заказу №${item.number}, выдан ${formatDate(item.issuedAt)}`
          : `Предоплата по заказу №${item.number}, не выдан`,
    });
  }

  return sortLedgerRows(rows, data.from);
}

/** Порядок типов строк внутри одной даты — проход кассы. */
const KIND_ORDER: Record<DayReportRow['kind'], number> = {
  issued: 0,
  manual: 1,
  expense: 2,
  prepayment: 3,
};

/** Сортировка по дате (_iso из ячеек ДД.ММ.ГГГГ — переводим обратно). */
function sortLedgerRows(rows: DayReportRow[], fallback: string): DayReportRow[] {
  const iso = (ddMmYyyy: string) => {
    const [d, m, y] = ddMmYyyy.split('.');
    return y && m && d ? `${y}-${m}-${d}` : fallback;
  };
  return [...rows].sort((a, b) => {
    const byDate = iso(a.date).localeCompare(iso(b.date));
    if (byDate !== 0) return byDate;
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
}

/** Итоги периода из строк леджера — та же математика, что в листе. */
export interface PeriodTotals {
  revenue: number;
  cost: number;
  profit: number;
  expenses: number;
  issuedCount: number;
  prepayments: number;
  manualIncome: number;
}

export function periodTotalsFromRows(rows: readonly DayReportRow[]): PeriodTotals {
  let revenue = 0;
  let cost = 0;
  let expenses = 0;
  let prepayments = 0;
  let manualIncome = 0;
  let issuedCount = 0;
  for (const row of rows) {
    revenue += row.revenue ?? 0;
    cost += row.cost ?? 0;
    if (row.kind === 'expense') expenses += row.cost ?? 0;
    if (row.kind === 'prepayment') prepayments += row.revenue ?? 0;
    if (row.kind === 'manual') manualIncome += row.revenue ?? 0;
    if (row.kind === 'issued') issuedCount += 1;
  }
  return {
    revenue,
    cost,
    profit: revenue - cost,
    expenses,
    issuedCount,
    prepayments,
    manualIncome,
  };
}

/** Границы текущего месяца — для кнопки «Отчёт за месяц». */
export function currentMonthRange(now = new Date()): { from: string; to: string } {
  const pad = (value: number) => String(value).padStart(2, '0');
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
  )}`;
  return { from, to };
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

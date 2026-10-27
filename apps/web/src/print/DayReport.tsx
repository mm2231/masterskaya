/**
 * Печатный отчёт: за день (?date=), за месяц (?month=YYYY-MM) или
 * за произвольный период (?from=&to=).
 *
 * Открывается кнопкой «Отчёт за день» или «Отчёт за месяц» с дашборда
 * и «Финансов». Печать браузера («Сохранить как PDF») даёт документ —
 * отдельного генератора PDF в приложении нет и он не нужен.
 */

import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatMoney } from '@masterskaya/shared';

import { api } from '../lib/api';
import {
  buildDayReportRows,
  buildPeriodReportRows,
  dayReportTotals,
  dayReportTsv,
  periodTotalsFromRows,
  copyToClipboard,
  type DayReportRow,
} from '../lib/dayReport';
import type { PeriodReportData, TodayData } from '../lib/types';
import './print.css';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** Границы месяца по номеру (YYYY-MM) — для переключателя на печати. */
function monthBounds(month: string): { from: string; to: string } {
  const [ry, rm] = month.split('-').map(Number);
  const year = Number.isFinite(ry) ? ry! : new Date().getFullYear();
  const monthNo = Number.isFinite(rm) ? rm! : new Date().getMonth() + 1;
  const last = new Date(year, monthNo, 0).getDate();
  const pad = (v: number) => String(v).padStart(2, '0');
  return { from: `${year}-${pad(monthNo)}-01`, to: `${year}-${pad(monthNo)}-${pad(last)}` };
}

function monthShift(month: string, delta: number): string {
  const [ry, rm] = month.split('-').map(Number);
  const date = new Date((ry ?? new Date().getFullYear()), (rm ?? 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function DayReport() {
  const [params] = useSearchParams();
  const date = params.get('date') ?? '';
  const month = params.get('month') ?? '';
  const qFrom = params.get('from') ?? '';
  const qTo = params.get('to') ?? '';

  // Период: ?month= или явные границы. День: ?date= или сегодня.
  const bounds = month
    ? monthBounds(month)
    : qFrom && qTo
      ? { from: qFrom, to: qTo }
      : null;
  const isPeriod = Boolean(bounds);
  const queryString = bounds
    ? `?from=${bounds.from}&to=${bounds.to}`
    : date
      ? `?date=${date}`
      : '';

  const report = useQuery({
    queryKey: ['finance-today', 'print', queryString],
    queryFn: () => api.get<TodayData | PeriodReportData>('/api/finance/today' + queryString),
  });

  useEffect(() => {
    const data = report.data;
    if (!data) return;
    if (isPeriod) {
      const label = month ? `${MONTH_NAMES[Number(month.split('-')[1]) - 1]} ${month.split('-')[0]}` : 'период';
      document.title = `Отчёт за месяц: ${label}`;
    } else {
      document.title = `Отчёт за день ${formatDate((data as TodayData).date)}`;
    }
  }, [report.data, isPeriod, month]);

  if (report.isLoading) {
    return <div className="print-root">Загрузка…</div>;
  }
  if (!report.data) {
    return <div className="print-root">Данные за период не найдены</div>;
  }

  const data = report.data;
  const periodData = 'from' in data ? (data as PeriodReportData) : null;
  const dayData = periodData ? null : (data as TodayData);

  // Строки и итоги: у месяца считаем из синхронных строк, у дня — из
  // кассовой сводки сервера (историческое поведение).
  const rows: DayReportRow[] = [];
  const money = { revenue: 0, cost: 0, profit: 0 };
  const counts = { issuedCount: 0, prepayments: 0, manualIncome: 0, expenses: 0 };

  if (periodData) {
    for (const row of buildPeriodReportRows(periodData)) rows.push(row);
    const t = periodTotalsFromRows(rows);
    money.revenue = t.revenue;
    money.cost = t.cost;
    money.profit = t.profit;
    counts.issuedCount = t.issuedCount;
    counts.prepayments = t.prepayments;
    counts.manualIncome = t.manualIncome;
    counts.expenses = t.expenses;
  } else if (dayData) {
    for (const row of buildDayReportRows(dayData)) rows.push(row);
    const t = dayReportTotals(dayData);
    money.revenue = t.revenue;
    money.cost = t.cost;
    money.profit = t.profit;
    counts.issuedCount = dayData.summary.issuedCount;
    counts.prepayments = dayData.summary.prepayments;
    counts.manualIncome = dayData.summary.manualIncome;
    counts.expenses = dayData.summary.expenses;
  }
  const rangeTitle = periodData
    ? month
      ? `${MONTH_NAMES[Number(month.split('-')[1]) - 1]} ${month.split('-')[0]}`
      : `${formatDate(periodData.from)} – ${formatDate(periodData.to)}`
    : formatDate(dayData!.date ?? '');

  async function copy() {
    const ok = await copyToClipboard(dayReportTsv(rows));
    window.alert(ok ? 'Данные скопированы — вставьте в таблицу' : 'Не удалось скопировать');
  }

  return (
    <div className="print-root">
      <div className="print-toolbar">
        <button type="button" className="btn primary" onClick={() => window.print()}>
          Печать / PDF
        </button>
        <button type="button" className="btn" onClick={() => void copy()}>
          Копировать в таблицу
        </button>
        {month ? (
          <>
            <Link className="btn" to={`/print/day?month=${monthShift(month, -1)}`}>
              ‹ {MONTH_NAMES[Number(monthShift(month, -1).split('-')[1]) - 1]}
            </Link>
            <Link className="btn" to={`/print/day?month=${monthShift(month, 1)}`}>
              {MONTH_NAMES[Number(monthShift(month, 1).split('-')[1]) - 1]} ›
            </Link>
          </>
        ) : null}
        <button type="button" className="btn" onClick={() => window.close()}>
          Закрыть
        </button>
        <span style={{ color: 'var(--text-muted)' }}>
          Чтобы получить PDF: «Печать / PDF» → «Сохранить как PDF».
        </span>
      </div>

      <article className="print-page">
        <h1>{isPeriod ? 'Отчёт за месяц' : 'Отчёт за рабочий день'}</h1>
        <p className="report-date">{rangeTitle}</p>

        <table className="report-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Клиент / Устройство</th>
              <th>Тип работ</th>
              <th className="num">Затраты (ЗЧ)</th>
              <th className="num">Выручка</th>
              <th className="num">Прибыль</th>
              <th>Статус</th>
              <th>Примечание</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="nowrap">{row.date}</td>
                <td>{row.client}</td>
                <td>{row.work}</td>
                <td className="num">{row.cost === null ? '' : formatMoney(row.cost)}</td>
                <td className="num">{row.revenue === null ? '' : formatMoney(row.revenue)}</td>
                <td className="num">{row.profit === null ? '' : formatMoney(row.profit)}</td>
                <td className="nowrap">{row.status}</td>
                <td>{row.note}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="report-empty">
                  За период нет движений
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>{isPeriod ? 'Итого за месяц' : 'Итого за день'}</td>
              <td className="num">{formatMoney(money.cost)}</td>
              <td className="num">{formatMoney(money.revenue)}</td>
              <td className="num">{formatMoney(money.profit)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>

        <p className="report-summary">
          Заказов выдано: {counts.issuedCount} · Предоплаты: {formatMoney(counts.prepayments)} ·
          Прочие доходы: {formatMoney(counts.manualIncome)} · Расходы:{' '}
          {formatMoney(counts.expenses)}
        </p>
      </article>
    </div>
  );
}

/**
 * Печатный отчёт за рабочий день.
 *
 * Открывается кнопкой «Отчёт за день» с дашборда или «Финансов».
 * Печать браузера («Сохранить как PDF») даёт документ — отдельного
 * генератора PDF в приложении нет и он не нужен.
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatMoney } from '@masterskaya/shared';

import { api } from '../lib/api';
import { buildDayReportRows, dayReportTotals, dayReportTsv, copyToClipboard } from '../lib/dayReport';
import type { TodayData } from '../lib/types';
import './print.css';

export function DayReport() {
  const [params] = useSearchParams();
  const date = params.get('date') ?? '';

  const today = useQuery({
    queryKey: ['finance-today', 'print', date],
    queryFn: () => api.get<TodayData>('/api/finance/today' + (date ? `?date=${date}` : '')),
  });

  useEffect(() => {
    if (today.data) {
      document.title = `Отчёт за день ${formatDate(today.data.date)}`;
    }
  }, [today.data]);

  if (today.isLoading) {
    return <div className="print-root">Загрузка…</div>;
  }
  if (!today.data) {
    return <div className="print-root">Данные за день не найдены</div>;
  }

  const rows = buildDayReportRows(today.data);
  const totals = dayReportTotals(today.data);
  const summary = today.data.summary;

  async function copy() {
    const ok = await copyToClipboard(dayReportTsv(rows));
    window.alert(ok ? 'Данные дня скопированы — вставьте в таблицу' : 'Не удалось скопировать');
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
        <button type="button" className="btn" onClick={() => window.close()}>
          Закрыть
        </button>
        <span style={{ color: 'var(--text-muted)' }}>
          Чтобы получить PDF: «Печать / PDF» → «Сохранить как PDF».
        </span>
      </div>

      <article className="print-page">
        <h1>Отчёт за рабочий день</h1>
        <p className="report-date">{formatDate(today.data.date)}</p>

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
                  За день нет движений
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Итого за день</td>
              <td className="num">{formatMoney(totals.cost)}</td>
              <td className="num">{formatMoney(totals.revenue)}</td>
              <td className="num">{formatMoney(totals.profit)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>

        <p className="report-summary">
          Заказов выдано: {summary.issuedCount} · Предоплаты: {formatMoney(summary.prepayments)} ·
          Прочие доходы: {formatMoney(summary.manualIncome)} · Расходы:{' '}
          {formatMoney(summary.expenses)}
        </p>
      </article>
    </div>
  );
}

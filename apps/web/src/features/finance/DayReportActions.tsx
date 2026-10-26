/**
 * Кнопки отчёта дня: копирование в Google-таблицу и печатный PDF.
 *
 * Использует данные `/api/finance/today` (тот же ключ запроса, что и панель
 * «Сегодня» — на дашборде лишнего запроса не будет). Строки повторяют
 * структуру таблицы пользователя, копируются без заголовков.
 */

import { useQuery } from '@tanstack/react-query';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { buildDayReportRows, copyToClipboard, dayReportTsv } from '../../lib/dayReport';
import type { TodayData } from '../../lib/types';

export function DayReportActions() {
  const toast = useToast();

  const today = useQuery({
    queryKey: ['finance-today'],
    queryFn: () => api.get<TodayData>('/api/finance/today'),
    refetchInterval: 60_000,
  });

  async function copy() {
    if (!today.data) return;
    const text = dayReportTsv(buildDayReportRows(today.data));
    if (!text) {
      toast.show('За день пока нет строк для копирования', 'error');
      return;
    }
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.show(`Скопировано строк: ${text.split('\n').length}`, 'success');
    } else {
      toast.show('Не удалось скопировать — выдайте разрешение на буфер', 'error');
    }
  }

  return (
    <div className="row-actions">
      <button
        type="button"
        className="btn sm"
        aria-label="Скопировать данные дня для вставки в таблицу Google"
        disabled={!today.data || today.isFetching}
        onClick={() => void copy()}
      >
        Копировать в таблицу
      </button>
      <a
        className="btn sm"
        aria-label="Открыть отчёт за день в новой вкладке — для печати и сохранения в PDF"
        href="/print/day"
        target="_blank"
        rel="noopener noreferrer"
      >
        Отчёт за день (PDF)
      </a>
    </div>
  );
}

/**
 * Кнопки отчёта дня: копирование в Google-таблицу и печатный PDF.
 *
 * Использует данные `/api/finance/today` (тот же ключ запроса, что и панель
 * «Сегодня» — на дашборде лишнего запроса не будет). Строки повторяют
 * структуру таблицы пользователя, копируются без заголовков.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import {
  buildDayReportRows,
  buildPeriodReportRows,
  copyToClipboard,
  currentMonthRange,
  dayReportTsv,
} from '../../lib/dayReport';
import type { PeriodReportData, TodayData } from '../../lib/types';

export function DayReportActions() {
  const toast = useToast();

  const today = useQuery({
    queryKey: ['finance-today'],
    queryFn: () => api.get<TodayData>('/api/finance/today'),
    refetchInterval: 60_000,
  });

  // Месяц берём на лету — отдельный запрос при нажатии.
  const month = useMutation({
    mutationFn: () => {
      const { from, to } = currentMonthRange();
      return api.get<PeriodReportData>(`/api/finance/today?from=${from}&to=${to}`);
    },
    onSuccess: async (data) => {
      const text = dayReportTsv(buildPeriodReportRows(data));
      if (!text) {
        toast.show('За месяц пока нет строк для копирования', 'error');
        return;
      }
      const ok = await copyToClipboard(text);
      if (ok) {
        toast.show(`Скопировано строк: ${text.split('\n').length}`, 'success');
      } else {
        toast.show('Не удалось скопировать — выдайте разрешение на буфер', 'error');
      }
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
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
      <button
        type="button"
        className="btn sm"
        aria-label="Скопировать строки месяца целиком для вставки в таблицу"
        disabled={month.isPending}
        onClick={() => month.mutate()}
      >
        {month.isPending ? 'Сборка строк…' : 'Копировать месяц'}
      </button>
      <a
        className="btn sm"
        aria-label="Открыть отчёт за месяц в новой вкладке — с переключением месяцев"
        href={`/print/day?month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Отчёт за месяц (PDF)
      </a>
    </div>
  );
}

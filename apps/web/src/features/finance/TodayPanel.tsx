/**
 * Панель «Сегодня»: прибыль за текущий день и список выданных заказов.
 *
 * Данные берутся по дате выдачи заказа — поэтому в списке только то,
 * что реально выдано сегодня.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '../../components/EmptyState';
import { api } from '../../lib/api';
import { buildDayReportRows, type DayReportRow } from '../../lib/dayReport';
import { formatDate, formatMoney, formatPhone, formatTime } from '../../lib/format';
import type { TodayData } from '../../lib/types';
import { DayReportActions } from './DayReportActions';

/** Название типа движения для панели «Движения дня». */
const KIND_LABEL: Record<DayReportRow['kind'], string> = {
  issued: 'Заказ',
  manual: 'Без акта',
  expense: 'Расход',
  prepayment: 'Предоплата',
};

export function TodayPanel() {
  const today = useQuery({
    queryKey: ['finance-today'],
    queryFn: () => api.get<TodayData>('/api/finance/today'),
    // Обновляем раз в минуту — день идёт, суммы меняются.
    refetchInterval: 60_000,
  });

  const s = today.data?.summary;
  const orders = today.data?.orders ?? [];

  return (
    <section className="panel">
      <div className="panel-head">
        <span>Сегодня</span>
        <span className="panel-head-note">
          {today.data ? formatDate(today.data.date) : '…'} · выдано заказов:{' '}
          {s?.issuedCount ?? 0}
        </span>
        <DayReportActions />
      </div>

      <div className="panel-body">
        <div className="kpi-grid today-kpis">
          <div className="kpi">
            <div className="kpi-label">Выручка за сегодня</div>
            <div className="kpi-value">{formatMoney(s?.revenue ?? 0)}</div>
            <div className="kpi-hint">
              выдано заказов: {s?.issuedCount ?? 0}
              {s?.prepayments ? ` · предоплаты: ${formatMoney(s.prepayments)}` : ''}
              {s?.manualIncome ? ` · прочие доходы: ${formatMoney(s.manualIncome)}` : ''}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Прибыль за сегодня</div>
            <div className={`kpi-value ${(s?.profit ?? 0) >= 0 ? 'positive' : 'negative'}`}>
              {formatMoney(s?.profit ?? 0)}
            </div>
            <div className="kpi-hint">маржа {Math.round(s?.margin ?? 0)}%</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Себестоимость</div>
            <div className="kpi-value">{formatMoney(s?.cost ?? 0)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Средний чек</div>
            <div className="kpi-value">{formatMoney(s?.averageCheck ?? 0)}</div>
          </div>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon="📅"
            title="Сегодня ещё ничего не выдано"
            hint="Заказы, переведённые в статус «Выдан», появятся здесь. Предоплаты и прочие доходы уже учтены в выручке."
          />
        ) : (
          <div className="table-wrap flush">
            <table className="data">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Время</th>
                  <th>Устройство</th>
                  <th>Клиент</th>
                  <th>Телефон</th>
                  <th className="num">Сумма</th>
                  <th className="num">Себестоимость</th>
                  <th className="num">Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="nowrap">
                      <Link className="row-link" to={`/orders/${order.id}`}>
                        №{order.number}
                      </Link>
                    </td>
                    <td className="nowrap">{formatTime(order.issuedAt)}</td>
                    <td className="nowrap">{order.deviceLabel ?? '—'}</td>
                    <td>{order.clientName ?? '—'}</td>
                    <td className="nowrap">{formatPhone(order.clientPhone)}</td>
                    <td className="num">{formatMoney(order.clientTotal)}</td>
                    <td className="num">{formatMoney(order.costTotal)}</td>
                    <td className={`num ${order.profit >= 0 ? 'pos' : 'neg'}`}>
                      {formatMoney(order.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Остальные движения дня: предоплаты, услуги без актов, расходы.
            Выданные заказы уже в таблице выше — их не дублируем. */}
        {(today.data ? buildDayReportRows(today.data) : []).filter(
          (row) => row.kind !== 'issued',
        ).length > 0 && <MovementsTable data={today.data!} />}
      </div>
    </section>
  );
}

/** Движения дня кроме выданных заказов: предоплаты, «без актов», расходы. */
function MovementsTable({ data }: { data: TodayData }) {
  const rows = buildDayReportRows(data).filter((row) => row.kind !== 'issued');
  return (
    <div className="table-wrap flush mt-3">
      <table className="data">
        <thead>
          <tr>
            <th>Тип</th>
            <th>Клиент / Устройство</th>
            <th>Описание</th>
            <th className="num">Затраты</th>
            <th className="num">Сумма</th>
            <th className="num">Прибыль</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="nowrap">{KIND_LABEL[row.kind]}</td>
              <td className="nowrap">{row.client}</td>
              <td>{row.work || row.note}</td>
              <td className="num">{row.cost === null ? '' : formatMoney(row.cost)}</td>
              <td className="num">{row.revenue === null ? '' : formatMoney(row.revenue)}</td>
              <td className={`num ${(row.profit ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                {row.profit === null ? '' : formatMoney(row.profit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

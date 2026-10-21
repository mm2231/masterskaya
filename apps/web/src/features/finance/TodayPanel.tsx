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
import { formatDate, formatMoney, formatPhone, formatTime } from '../../lib/format';
import type { TodayData } from '../../lib/types';

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
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        📅 Сегодня
        <span style={{ marginLeft: 'auto', fontWeight: 400, color: 'var(--text-muted)' }}>
          {today.data ? formatDate(today.data.date) : '…'} · выдано заказов:{' '}
          {s?.issuedCount ?? 0}
        </span>
      </div>

      <div className="panel-body">
        <div className="kpi-grid" style={{ marginBottom: orders.length ? 16 : 0 }}>
          <div className="kpi">
            <div className="kpi-label">Выручка за сегодня</div>
            <div className="kpi-value">{formatMoney(s?.revenue ?? 0)}</div>
            <div className="kpi-hint">выдано заказов: {s?.issuedCount ?? 0}</div>
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
            hint="Заказы, переведённые в статус «Выдан», появятся здесь"
          />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
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
                    <td
                      className="num"
                      style={{ color: order.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}
                    >
                      {formatMoney(order.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

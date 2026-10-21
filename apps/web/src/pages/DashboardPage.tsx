/** Дашборд: показатели за период, заказы в работе, быстрые действия. */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { api, query } from '../lib/api';
import { formatDateTime, formatMoney, formatPhone } from '../lib/format';
import type { FinanceSummary, Order } from '../lib/types';

export function DashboardPage() {
  const summary = useQuery({
    queryKey: ['finance-summary'],
    queryFn: () => api.get<FinanceSummary>('/api/finance/summary'),
  });

  const open = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () =>
      api.get<{ items: Order[]; total: number }>(
        query({ status: 'new', limit: 8, sort: 'date_desc' }),
      ),
  });

  const ready = useQuery({
    queryKey: ['orders', 'ready'],
    queryFn: () => api.get<{ items: Order[]; total: number }>('/api/orders' + query({ status: 'ready', limit: 8 })),
  });

  const s = summary.data?.summary;

  return (
    <>
      <div className="page-head">
        <h1>Дашборд</h1>
        <Link className="btn primary" to="/orders?new=1">
          ＋ Принять заказ
        </Link>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Выручка за период</div>
          <div className="kpi-value">{formatMoney(s?.revenue ?? 0)}</div>
          <div className="kpi-hint">с {summary.data?.from} по {summary.data?.to}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Прибыль</div>
          <div
            className={`kpi-value ${(s?.profit ?? 0) >= 0 ? 'positive' : 'negative'}`}
          >
            {formatMoney(s?.profit ?? 0)}
          </div>
          <div className="kpi-hint">маржа {Math.round(s?.margin ?? 0)}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Себестоимость</div>
          <div className="kpi-value">{formatMoney(s?.cost ?? 0)}</div>
          <div className="kpi-hint">детали и работы</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Расходы</div>
          <div className="kpi-value">{formatMoney(s?.expenses ?? 0)}</div>
          <div className="kpi-hint">прочие расходы</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Средний чек</div>
          <div className="kpi-value">{formatMoney(s?.averageCheck ?? 0)}</div>
          <div className="kpi-hint">выдано заказов: {s?.issuedCount ?? 0}</div>
        </div>
      </div>

      <div className="split-even">
        <section className="panel">
          <div className="panel-head">🆕 Новые заказы</div>
          <OrderMiniTable orders={open.data?.items ?? []} emptyText="Новых заказов нет" />
        </section>

        <section className="panel">
          <div className="panel-head">✅ Готовы к выдаче</div>
          <OrderMiniTable orders={ready.data?.items ?? []} emptyText="Готовых заказов нет" />
        </section>
      </div>
    </>
  );
}

function OrderMiniTable({ orders, emptyText }: { orders: Order[]; emptyText: string }) {
  if (orders.length === 0) {
    return <EmptyState icon="📋" title={emptyText} />;
  }
  return (
    <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
      <table className="data">
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="nowrap">
                <Link className="row-link" to={`/orders/${order.id}`}>
                  №{order.number}
                </Link>
              </td>
              <td className="nowrap">{order.deviceLabel ?? '—'}</td>
              <td className="nowrap">{formatPhone(order.clientPhone)}</td>
              <td>
                <StatusBadge code={order.status} />
              </td>
              <td className="num">{formatMoney(order.clientTotal)}</td>
              <td className="nowrap muted">{formatDateTime(order.acceptedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Дашборд: показатели за период и заказы по всем этапам.
 *
 * В панели «Этапы работы» видны все незакрытые заказы. У каждого есть
 * кнопки-переходы: статус меняется прямо из дашборда, без открытия
 * карточки.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ORDER_STATUSES, statusLabel } from '@masterskaya/shared';

import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { api, query } from '../lib/api';
import { formatDateTime, formatMoney, formatPhone } from '../lib/format';
import type { FinanceSummary, Order } from '../lib/types';
import { StatusTransition } from '../features/orders/StatusTransition';
import { TodayPanel } from '../features/finance/TodayPanel';
import { TaskWidget } from '../features/tasks/TaskWidget';

/** Этапы, на которых заказ ещё в работе. */
const OPEN_STATUSES = ORDER_STATUSES.filter(
  (item) => item.code !== 'issued' && item.code !== 'declined',
).map((item) => item.code);

export function DashboardPage() {
  const [stage, setStage] = useState('');

  const summary = useQuery({
    queryKey: ['finance-summary'],
    queryFn: () => api.get<FinanceSummary>('/api/finance/summary'),
  });

  // Все незакрытые заказы — одним запросом.
  const open = useQuery({
    queryKey: ['dashboard', 'open'],
    queryFn: () =>
      api.get<{ items: Order[]; total: number }>(
        '/api/orders' + query({ statuses: OPEN_STATUSES.join(','), limit: 100 }),
      ),
  });

  // Выданные заказы — недавние, для контроля потока.
  const issued = useQuery({
    queryKey: ['dashboard', 'issued'],
    queryFn: () =>
      api.get<{ items: Order[]; total: number }>(
        '/api/orders' + query({ status: 'issued', limit: 8 }),
      ),
  });

  const s = summary.data?.summary;
  const allOpen = open.data?.items ?? [];
  const items = stage ? allOpen.filter((order) => order.status === stage) : allOpen;
  const readyOrders = allOpen.filter((order) => order.status === 'ready');
  const recentIssued = issued.data?.items.slice(0, 5) ?? [];

  // Сколько заказов на каждом этапе.
  const byStage = (code: string) => allOpen.filter((order) => order.status === code).length;

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
          <div className="kpi-hint">
            с {summary.data?.from} по {summary.data?.to}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Прибыль</div>
          <div className={`kpi-value ${(s?.profit ?? 0) >= 0 ? 'positive' : 'negative'}`}>
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
        <div className="kpi">
          <div className="kpi-label">Открытых заказов</div>
          <div className="kpi-value">{allOpen.length}</div>
          <div className="kpi-hint">принято, но ещё не выдано</div>
        </div>
      </div>

      <TodayPanel />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <span>Заказы по этапам</span>
            <span className="panel-head-note">нажмите «→ этап», чтобы перевести заказ</span>
          </div>
        <div className="panel-body">
          <div className="chips">
            <button
              type="button"
              className={`chip ${stage === '' ? 'active' : ''}`}
              onClick={() => setStage('')}
            >
              Все этапы ({allOpen.length})
            </button>
            {ORDER_STATUSES.filter(
              (item) => item.code !== 'issued' && item.code !== 'declined',
            ).map((item) => (
              <button
                key={item.code}
                type="button"
                className={`chip ${stage === item.code ? 'active' : ''}`}
                onClick={() => setStage(item.code)}
              >
                {item.label} ({byStage(item.code)})
              </button>
            ))}
          </div>

          {open.isLoading ? (
            <div className="panel-loading">Загрузка заказов…</div>
          ) : open.isError ? (
            <EmptyState
              icon="⚠️"
              title="Не удалось загрузить заказы"
              hint="Проверьте соединение и обновите страницу"
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="🔧"
              title={stage ? `На этапе «${statusLabel(stage)}» заказов нет` : 'Незакрытых заказов нет'}
              hint="Принятые заказы появятся здесь автоматически"
            />
          ) : (
            <div className="table-wrap flush">
              <table className="data">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Устройство</th>
                    <th>Клиент</th>
                    <th className="col-phone">Телефон</th>
                    <th>Этап</th>
                    <th className="num">Сумма</th>
                    <th className="col-accepted">Принят</th>
                    <th>Перевести</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((order) => (
                    <tr key={order.id}>
                      <td className="nowrap">
                        <Link className="row-link" to={`/orders/${order.id}`}>
                          №{order.number}
                        </Link>
                      </td>
                      <td className="nowrap">{order.deviceLabel ?? '—'}</td>
                      <td>{order.clientName ?? '—'}</td>
                      <td className="nowrap col-phone">{formatPhone(order.clientPhone)}</td>
                      <td>
                        <StatusBadge code={order.status} />
                      </td>
                      <td className="num">{formatMoney(order.clientTotal)}</td>
                      <td className="nowrap col-accepted">{formatDateTime(order.acceptedAt)}</td>
                      <td>
                        <StatusTransition orderId={order.id} status={order.status} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

        <TaskWidget />
      </div>

      <div className="split-even">
        <section className="panel">
          <div className="panel-head">
            <span>Готовы к выдаче</span>
            <span className="panel-head-note">{readyOrders.length}</span>
          </div>
          <ReadyTable orders={readyOrders} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <span>Выданные заказы</span>
            <span className="panel-head-note">последние {recentIssued.length}</span>
          </div>
          <OrderMiniTable orders={recentIssued} emptyText="Выданных заказов нет" />
        </section>
      </div>
    </>
  );
}

/** Готовые к выдаче: главное действие — выдать заказ (статус → «Выдан»). */
function ReadyTable({ orders }: { orders: Order[] }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const issue = useMutation({
    mutationFn: (orderId: number) => api.patch(`/api/orders/${orderId}`, { status: 'issued' }),
    onSuccess: () => {
      toast.show('Заказ выдан', 'success');
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order-counts'] });
      void queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  if (orders.length === 0) {
    return <EmptyState icon="✅" title="Готовых заказов нет" />;
  }
  return (
    <div className="table-wrap flush">
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
              <td className="num">{formatMoney(order.clientTotal)}</td>
              <td>
                <button
                  type="button"
                  className="btn sm primary"
                  disabled={issue.isPending}
                  onClick={() => issue.mutate(order.id)}
                >
                  Выдать
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderMiniTable({ orders, emptyText }: { orders: Order[]; emptyText: string }) {
  if (orders.length === 0) {
    return <EmptyState icon="📋" title={emptyText} />;
  }
  return (
    <div className="table-wrap flush">
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Список заказов: поиск, фильтры по статусу, таблица в стиле CRM. */

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORDER_STATUSES } from '@masterskaya/shared';

import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { api, query } from '../lib/api';
import { formatDateTime, formatMoney, formatPhone } from '../lib/format';
import type { Order, OrderListResponse } from '../lib/types';
import { NewOrderModal } from '../features/orders/NewOrderModal';

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const status = params.get('status') ?? '';
  const search = params.get('q') ?? '';

  const list = useQuery({
    queryKey: ['orders', status, search],
    queryFn: () => api.get<OrderListResponse>('/api/orders' + query({ status, q: search, limit: 100 })),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/orders/${id}`),
    onSuccess: () => {
      toast.show('Заказ удалён', 'success');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const counts = list.data?.counts ?? {};
  const totalOpen = ORDER_STATUSES.filter(
    (item) => item.code !== 'issued' && item.code !== 'declined',
  ).reduce((sum, item) => sum + (counts[item.code] ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <h1>Заказы</h1>
        <button type="button" className="btn primary" onClick={() => setNewOpen(true)}>
          ＋ Принять заказ
        </button>
      </div>

      <div className="chips">
        <button
          type="button"
          className={`chip ${status === '' ? 'active' : ''}`}
          onClick={() => setParam('status', '')}
        >
          Все ({totalOpen + (counts.issued ?? 0) + (counts.declined ?? 0)})
        </button>
        {ORDER_STATUSES.map((item) => (
          <button
            key={item.code}
            type="button"
            className={`chip ${status === item.code ? 'active' : ''}`}
            onClick={() => setParam('status', item.code)}
          >
            {item.label} ({counts[item.code] ?? 0})
          </button>
        ))}
      </div>

      <div className="page-head" style={{ marginBottom: 12 }}>
        <input
          type="search"
          placeholder="Поиск: телефон, устройство, клиент или номер заказа"
          value={search}
          onChange={(event) => setParam('q', event.target.value)}
          style={{
            flex: 1,
            minWidth: 240,
            height: 34,
            padding: '0 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-elevated)',
          }}
        />
      </div>

      {list.isLoading ? (
        <div className="panel">
          <div className="panel-body">Загрузка…</div>
        </div>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <div className="panel">
          <EmptyState
            icon="🔧"
            title="Заказов нет"
            hint="Измените фильтры или примите новый заказ"
            action={
              <button type="button" className="btn primary" onClick={() => setNewOpen(true)}>
                ＋ Принять заказ
              </button>
            }
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>№</th>
                <th>Принят</th>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Устройство</th>
                <th>Статус</th>
                <th className="num">Сумма</th>
                <th className="num">Прибыль</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data?.items.map((order) => (
                <OrderRow key={order.id} order={order} onDelete={() => remove.mutate(order.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {newOpen ? <NewOrderModal onClose={() => setNewOpen(false)} /> : null}
    </>
  );
}

function OrderRow({ order, onDelete }: { order: Order; onDelete: () => void }) {
  const profit = order.clientTotal - order.costTotal;
  return (
    <tr>
      <td className="nowrap">
        <Link className="row-link" to={`/orders/${order.id}`}>
          №{order.number}
        </Link>
      </td>
      <td className="nowrap">{formatDateTime(order.acceptedAt)}</td>
      <td>{order.clientName ?? '—'}</td>
      <td className="nowrap">{formatPhone(order.clientPhone)}</td>
      <td>{order.deviceLabel ?? '—'}</td>
      <td>
        <StatusBadge code={order.status} />
      </td>
      <td className="num">{formatMoney(order.clientTotal)}</td>
      <td className="num" style={{ color: profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
        {formatMoney(profit)}
      </td>
      <td>
        <div className="row-actions">
          <Link className="btn sm" to={`/orders/${order.id}`}>
            Открыть
          </Link>
          <button
            type="button"
            className="btn sm danger"
            onClick={() => {
              if (window.confirm(`Удалить заказ №${order.number}?`)) onDelete();
            }}
          >
            Удалить
          </button>
        </div>
      </td>
    </tr>
  );
}

/** Список заказов: поиск, фильтры по статусу, таблица в стиле CRM. */

import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ORDER_STATUSES, orderProfitAtStage } from '@masterskaya/shared';

import { EmptyState } from '../components/EmptyState';
import { EqualChips } from '../components/EqualChips';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { api, query } from '../lib/api';
import { formatDateTime, formatMoney, formatPhone } from '../lib/format';
import type { Order, OrderListResponse } from '../lib/types';
import { NewOrderModal } from '../features/orders/NewOrderModal';
import { StatusTransition } from '../features/orders/StatusTransition';

export function OrdersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Прямые ссылки вида /orders?new=1 сразу открывают приём заказа.
  const [newOpen, setNewOpen] = useState(() => params.get('new') === '1');
  const toast = useToast();
  const queryClient = useQueryClient();

  const status = params.get('status') ?? '';
  const search = params.get('q') ?? '';

  // Постраничная дозагрузка: очередь не растёт в одну бесконечную
  // страницу — показываем по 100 заказов, остальное по кнопке
  // «Показать ещё». total приходит из БД, поиск учитывается.
  const list = useInfiniteQuery({
    queryKey: ['orders', status, search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<OrderListResponse>(
        '/api/orders' + query({ status, q: search, limit: 100, offset: pageParam }),
      ),
    getNextPageParam: (last, pages) => {
      const shown = pages.reduce((sum, page) => sum + page.items.length, 0);
      return shown < last.total ? shown : undefined;
    },
  });

  const orders = list.data?.pages.flatMap((page) => page.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;

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

  const counts = list.data?.pages[0]?.counts ?? {};
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

      <EqualChips>
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
      </EqualChips>

      <div className="toolbar">
        <div className="search-box">
          <span className="search-box-icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            aria-label="Поиск по заказам: телефон, устройство, клиент или номер"
            placeholder="Поиск: телефон, устройство, клиент или номер заказа"
            value={search}
            onChange={(event) => setParam('q', event.target.value)}
          />
        </div>
        {list.data ? (
          <span className="panel-head-note">Найдено: {total}</span>
        ) : null}
      </div>

      {list.isLoading ? (
        <div className="panel">
          <div className="panel-loading">Загрузка заказов…</div>
        </div>
      ) : list.isError ? (
        <div className="panel">
          <EmptyState
            icon="⚠️"
            title="Не удалось загрузить заказы"
            hint="Проверьте соединение и обновите страницу"
          />
        </div>
      ) : orders.length === 0 ? (
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
                <th className="col-accepted">Принят</th>
                <th>Клиент</th>
                <th className="col-phone">Телефон</th>
                <th>Устройство</th>
                <th>Статус</th>
                <th className="num">Сумма</th>
                <th className="num">Прибыль</th>
                <th>Перевести</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} onDelete={() => remove.mutate(order.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.hasNextPage ? (
        <button
          type="button"
          className="load-more"
          disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
        >
          {list.isFetchingNextPage
            ? 'Загрузка…'
            : `Показать ещё ${Math.min(100, total - orders.length)} заказов`}
        </button>
      ) : null}

      {newOpen ? (
        <NewOrderModal
          onClose={() => {
            setNewOpen(false);
            if (params.get('new')) setParam('new', '');
          }}
        />
      ) : null}
    </>
  );
}

function OrderRow({ order, onDelete }: { order: Order; onDelete: () => void }) {
  const navigate = useNavigate();
  // Прибыль на текущий момент «кассой»: только полученные деньги минус
  // себестоимость. У выданного заказа — полная маржа.
  const profit = orderProfitAtStage({
    clientTotal: order.clientTotal,
    costTotal: order.costTotal,
    paid: Number(order.prepayment ?? 0) + Number(order.paid ?? 0),
    issued: Boolean(order.issuedAt),
  });

  // Клик по любой части строки открывает заказ; кнопки и ссылки внутри
  // строки обрабатывают свои события сами (см. проверку в openOrder).
  function openOrder(event: React.MouseEvent<HTMLTableRowElement>) {
    if ((event.target as HTMLElement).closest('button, a, .btn-row')) return;
    navigate(`/orders/${order.id}`);
  }

  return (
    <tr className="row-clickable" onClick={openOrder}>
      <td className="nowrap">
        <Link className="row-link" to={`/orders/${order.id}`}>
          №{order.number}
        </Link>
      </td>
      <td className="nowrap col-accepted">{formatDateTime(order.acceptedAt)}</td>
      <td>{order.clientName ?? '—'}</td>
      <td className="nowrap col-phone">{formatPhone(order.clientPhone)}</td>
      <td>{order.deviceLabel ?? '—'}</td>
      <td>
        <StatusBadge code={order.status} />
      </td>
      <td className="num">{formatMoney(order.clientTotal)}</td>
      <td className={`num ${profit >= 0 ? 'pos' : 'neg'}`}>
        {formatMoney(profit)}
      </td>
      <td>
        <StatusTransition orderId={order.id} status={order.status} compact />
      </td>
      <td>
        <button
          type="button"
          className="btn sm ghost danger"
          aria-label={`Удалить заказ №${order.number}`}
          onClick={(event) => {
            event.stopPropagation();
            if (window.confirm(`Удалить заказ №${order.number}?`)) onDelete();
          }}
        >
          Удалить
        </button>
      </td>
    </tr>
  );
}

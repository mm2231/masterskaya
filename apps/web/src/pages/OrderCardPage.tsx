/** Карточка заказа: данные, смена статуса, журнал событий, документы, деньги. */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { formatDateTime, formatMoney } from '../lib/format';
import type { DocumentRow, OrderCard, Payment } from '../lib/types';
import { OrderTab } from '../features/orders/OrderTab';
import { CreateDocumentButton } from '../features/orders/CreateDocumentButton';
import { NotifyButtons } from '../features/orders/NotifyButtons';

type Tab = 'order' | 'history' | 'documents' | 'money';

export function OrderCardPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('order');

  const card = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.get<OrderCard>(`/api/orders/${orderId}`),
  });

  const documents = useQuery({
    queryKey: ['order-documents', orderId],
    queryFn: () => api.get<{ items: DocumentRow[] }>(`/api/documents?orderId=${orderId}`),
  });

  const payments = useQuery({
    queryKey: ['order-payments'],
    queryFn: () => api.get<{ items: Payment[] }>('/api/finance/payments?limit=200'),
  });

  const patch = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.patch<{ order: OrderCard['order'] }>(`/api/orders/${orderId}`, data),
    onSuccess: () => {
      toast.show('Сохранено', 'success');
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order-counts'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  if (card.isLoading) {
    return (
      <div className="panel">
        <div className="panel-body">Загрузка…</div>
      </div>
    );
  }
  if (!card.data) {
    return (
      <div className="panel">
        <EmptyState icon="🔍" title="Заказ не найден" />
      </div>
    );
  }

  const { order, client, history, allowedTransitions } = card.data;
  const profit = order.clientTotal - order.costTotal;
  const orderPayments = (payments.data?.items ?? []).filter((item) => item.orderId === orderId);
  const paid = orderPayments
    .filter((item) => item.direction === 'in')
    .reduce((sum, item) => sum + item.amount, 0);


  return (
    <>
      <div className="page-head">
        <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <h1>
          Заказ №{order.number} <StatusBadge code={order.status} />
        </h1>
        <CreateDocumentButton orderId={orderId} kind="works" label="📄 Создать акт работ" />
        <CreateDocumentButton
          orderId={orderId}
          kind="acceptance"
          label="📥 Создать приёмный акт"
        />
        <NotifyButtons orderId={orderId} />
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Сумма для клиента</div>
          <div className="kpi-value">{formatMoney(order.clientTotal)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Себестоимость</div>
          <div className="kpi-value">{formatMoney(order.costTotal)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Прибыль</div>
          <div className={`kpi-value ${profit >= 0 ? 'positive' : 'negative'}`}>
            {formatMoney(profit)}
          </div>
          <div className="kpi-hint">
            {order.clientTotal ? `${Math.round((profit / order.clientTotal) * 100)}%` : '—'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Оплачено</div>
          <div className="kpi-value">{formatMoney(paid)}</div>
          {paid < order.clientTotal ? (
            <div className="kpi-hint">долг {formatMoney(order.clientTotal - paid)}</div>
          ) : null}
        </div>
      </div>

      <div className="chips">
        {(
          [
            ['order', 'Заказ'],
            ['history', `История (${history.length})`],
            ['documents', `Акты (${documents.data?.items.length ?? 0})`],
            ['money', `Деньги (${orderPayments.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`chip ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'order' ? (
        <OrderTab
          order={order}
          clientName={client?.name ?? order.clientName}
          allowedTransitions={allowedTransitions}
          onChange={(data) => patch.mutate(data)}
        />
      ) : null}

      {tab === 'history' ? (
        <section className="panel">
          <div className="panel-head">Журнал действий</div>
          <div className="panel-body">
            {history.length === 0 ? (
              <EmptyState icon="📜" title="Событий пока нет" />
            ) : (
              history.map((event) => (
                <div
                  key={event.id}
                  style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}
                >
                  <div style={{ fontWeight: 550 }}>{event.message || event.type}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatDateTime(event.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}


      {tab === 'documents' ? (
        <section className="panel">
          <div className="panel-head">Документы по заказу</div>
          <div className="panel-body">
            {(documents.data?.items.length ?? 0) === 0 ? (
              <EmptyState icon="📄" title="Актов пока нет" />
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Номер</th>
                    <th>Вид</th>
                    <th>Создан</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {documents.data?.items.map((document) => (
                    <tr key={document.id}>
                      <td>№{document.number}</td>
                      <td>
                        {document.kind === 'works' ? 'Акт выполненных работ' : 'Приёмный акт'}
                      </td>
                      <td>{formatDateTime(document.issuedAt)}</td>
                      <td className="num">
                        <Link className="btn sm" to={`/orders/${orderId}/print/${document.kind}`}>
                          Открыть
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : null}

      {tab === 'money' ? (
        <section className="panel">
          <div className="panel-head">Движение денег по заказу</div>
          <div className="panel-body">
            {orderPayments.length === 0 ? (
              <EmptyState icon="💰" title="Платежей не было" />
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Тип</th>
                    <th>Категория</th>
                    <th className="num">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {orderPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.occurredOn}</td>
                      <td>{payment.direction === 'in' ? 'Доход' : 'Расход'}</td>
                      <td>{payment.category || payment.method}</td>
                      <td className="num">
                        {payment.direction === 'in' ? '+' : '−'}
                        {formatMoney(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}

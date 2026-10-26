/** Карточка заказа: данные, смена статуса, журнал событий, документы, деньги. */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { formatDateTime, formatMoney } from '../lib/format';
import type { DocumentRow, OrderCard, Payment, TaskListResponse } from '../lib/types';
import { OrderTab } from '../features/orders/OrderTab';
import { CreateDocumentButton } from '../features/orders/CreateDocumentButton';
import { NotifyButtons } from '../features/orders/NotifyButtons';
import { TaskList } from '../features/tasks/TaskList';
import { NewTaskModal } from '../features/tasks/NewTaskModal';

type Tab = 'order' | 'history' | 'documents' | 'money' | 'tasks';

export function OrderCardPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('order');
  const [taskModalOpen, setTaskModalOpen] = useState(false);

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

  const orderTasks = useQuery({
    queryKey: ['tasks', 'order', orderId],
    queryFn: () => api.get<TaskListResponse>(`/api/tasks?orderId=${orderId}`),
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
        <div className="panel-loading">Загрузка заказа…</div>
      </div>
    );
  }
  if (!card.data) {
    return (
      <div className="panel">
        <EmptyState
          icon="🔍"
          title="Заказ не найден"
          hint="Возможно, заказ удалён или ссылка устарела"
          action={
            <button type="button" className="btn" onClick={() => navigate(-1)}>
              ← Назад к списку
            </button>
          }
        />
      </div>
    );
  }

  const { order, history, allowedTransitions } = card.data;
  const profit = order.clientTotal - order.costTotal;
  const orderPayments = (payments.data?.items ?? []).filter((item) => item.orderId === orderId);
  const paid = orderPayments
    .filter((item) => item.direction === 'in')
    .reduce((sum, item) => sum + item.amount, 0);
  const prepayment = Number(order.prepayment ?? 0);
  // Предоплата — тоже полученные деньги, хотя отдельной строкой в платежах
  // не лежит: она уже в доходе и уменьшает сумму к доплате.
  const paidTotal = prepayment + paid;
  const toPay = Math.max(order.clientTotal - paidTotal, 0);


  return (
    <>
      <div className="page-head">
        <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <h1 className="card-title">
          Заказ №{order.number} <StatusBadge code={order.status} />
        </h1>
        <CreateDocumentButton orderId={orderId} kind="works" label="Акт работ" />
        <CreateDocumentButton
          orderId={orderId}
          kind="acceptance"
          label="Приёмный акт"
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
          <div className="kpi-value">{formatMoney(paidTotal)}</div>
          {prepayment > 0 ? (
            <div className="kpi-hint">в т.ч. предоплата {formatMoney(prepayment)}</div>
          ) : null}
          {toPay > 0 ? <div className="kpi-hint">долг {formatMoney(toPay)}</div> : null}
        </div>
      </div>

      <div className="chips" role="tablist" aria-label="Разделы карточки заказа">
        {(
          [
            ['order', 'Заказ'],
            ['history', `История (${history.length})`],
            ['documents', `Акты (${documents.data?.items.length ?? 0})`],
            ['money', `Деньги (${orderPayments.length})`],
            ['tasks', `Задачи (${orderTasks.data?.items.filter((task) => !task.done).length ?? 0})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
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
                <div key={event.id} className="event-row">
                  <div className="event-title">{event.message || event.type}</div>
                  <div className="event-date">{formatDateTime(event.createdAt)}</div>
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
                        <Link className="btn sm ghost" to={`/orders/${orderId}/print/${document.kind}`}>
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
            {orderPayments.length === 0 && prepayment === 0 ? (
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
                  {prepayment > 0 ? (
                    <tr>
                      <td>{order.prepaymentAt ? formatDateTime(order.prepaymentAt) : '—'}</td>
                      <td>Предоплата</td>
                      <td>внесена при приёме</td>
                      <td className="num">+{formatMoney(prepayment)}</td>
                    </tr>
                  ) : null}
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

      {tab === 'tasks' ? (
        <section className="panel">
          <div className="panel-head">
            <span>Задачи по заказу</span>
            <button
              type="button"
              className="btn sm head-action"
              onClick={() => setTaskModalOpen(true)}
            >
              ＋ Задача
            </button>
          </div>
          <div className="panel-body">
            {(orderTasks.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                icon="✅"
                title="Задач нет"
                hint="Например: «Позвонить клиенту» или «Заказать деталь»"
              />
            ) : (
              <TaskList tasks={orderTasks.data?.items ?? []} showOrder={false} />
            )}
          </div>
        </section>
      ) : null}

      {taskModalOpen ? (
        <NewTaskModal orderId={orderId} onClose={() => setTaskModalOpen(false)} />
      ) : null}
    </>
  );
}

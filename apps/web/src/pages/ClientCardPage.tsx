/** Карточка клиента: контакты, метрики, история ремонтов. */

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { formatDateTime, formatMoney, formatPhone, initials } from '../lib/format';
import type { ClientCard } from '../lib/types';

export function ClientCardPage() {
  const { id } = useParams();
  const clientId = Number(id);
  const navigate = useNavigate();

  const card = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => api.get<ClientCard>(`/api/clients/${clientId}`),
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
        <EmptyState icon="🔍" title="Клиент не найден" />
      </div>
    );
  }

  const { client, orders, stats } = card.data;

  return (
    <>
      <div className="page-head">
        <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <h1>{client.name || 'Клиент без имени'}</h1>
        <Link className="btn primary" to="/orders?new=1">
          ＋ Новый заказ
        </Link>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Всего ремонтов</div>
          <div className="kpi-value">{stats.ordersCount}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Выручка</div>
          <div className="kpi-value">{formatMoney(stats.revenue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Прибыль</div>
          <div
            className={`kpi-value ${stats.profit >= 0 ? 'positive' : 'negative'}`}
          >
            {formatMoney(stats.profit)}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Средний чек</div>
          <div className="kpi-value">{formatMoney(stats.averageCheck)}</div>
        </div>
      </div>

      <div className="split-wide">
        <section className="panel">
          <div className="panel-head">Контакты</div>
          <div className="panel-body">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <span
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                {initials(client.name)}
              </span>
              <div>
                <div style={{ fontWeight: 650 }}>{client.name || '—'}</div>
                <div style={{ color: 'var(--text-muted)' }}>{formatPhone(client.phone)}</div>
              </div>
            </div>
            {client.email ? (
              <div className="field">
                <span className="field-label">E-mail</span>
                <div>{client.email}</div>
              </div>
            ) : null}
            {client.telegram ? (
              <div className="field">
                <span className="field-label">Telegram</span>
                <div>{client.telegram}</div>
              </div>
            ) : null}
            {client.viber ? (
              <div className="field">
                <span className="field-label">Viber</span>
                <div>{client.viber}</div>
              </div>
            ) : null}
            {client.note ? (
              <div className="field">
                <span className="field-label">Заметка</span>
                <div>{client.note}</div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">История ремонтов</div>
          <div className="panel-body">
            {orders.length === 0 ? (
              <EmptyState icon="🔧" title="Ремонтов не было" />
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Устройство</th>
                    <th>Неисправность</th>
                    <th>Статус</th>
                    <th className="num">Сумма</th>
                    <th>Дата</th>
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
                      <td>{order.deviceLabel ?? '—'}</td>
                      <td>{order.fault ?? '—'}</td>
                      <td>
                        <StatusBadge code={order.status} />
                      </td>
                      <td className="num">{formatMoney(order.clientTotal)}</td>
                      <td className="nowrap">{formatDateTime(order.acceptedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

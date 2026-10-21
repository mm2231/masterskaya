/** Финансы: сводка за период, журнал доходов и расходов. */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { api, query } from '../lib/api';
import { formatMoney } from '../lib/format';
import type { FinanceSummary, Payment } from '../lib/types';
import { PaymentForm } from '../features/finance/PaymentForm';

export function FinancePage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const summary = useQuery({
    queryKey: ['finance-summary', from, to],
    queryFn: () => api.get<FinanceSummary>('/api/finance/summary' + query({ from, to })),
  });

  const payments = useQuery({
    queryKey: ['finance-payments', from, to],
    queryFn: () => api.get<{ items: Payment[] }>('/api/finance/payments' + query({ from, to, limit: 300 })),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/finance/payments/${id}`),
    onSuccess: () => {
      toast.show('Запись удалена', 'success');
      void queryClient.invalidateQueries({ queryKey: ['finance-payments'] });
      void queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const s = summary.data?.summary;


  return (
    <>
      <div className="page-head">
        <h1>Финансы</h1>
        <a
          className="btn"
          href={`/api/finance/export?from=${summary.data?.from ?? ''}&to=${summary.data?.to ?? ''}`}
        >
          📊 Экспорт в Excel (CSV)
        </a>
      </div>

      <div className="page-head" style={{ marginBottom: 14 }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">С</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">По</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        {from || to ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            Сбросить
          </button>
        ) : null}
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Выручка</div>
          <div className="kpi-value">{formatMoney(s?.revenue ?? 0)}</div>
          <div className="kpi-hint">заказы + прочие доходы</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Себестоимость</div>
          <div className="kpi-value">{formatMoney(s?.cost ?? 0)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Расходы</div>
          <div className="kpi-value">{formatMoney(s?.expenses ?? 0)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Прибыль</div>
          <div className={`kpi-value ${(s?.profit ?? 0) >= 0 ? 'positive' : 'negative'}`}>
            {formatMoney(s?.profit ?? 0)}
          </div>
          <div className="kpi-hint">маржа {Math.round(s?.margin ?? 0)}%</div>
        </div>
      </div>

      <PaymentForm />

      {summary.data?.expensesByCategory.length ? (
        <section className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">Расходы по категориям</div>
          <div className="panel-body">
            {summary.data.expensesByCategory.map((row) => (
              <div
                key={row.category ?? '—'}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span>{row.category ?? 'Без категории'}</span>
                <span style={{ fontWeight: 600 }}>{formatMoney(row.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}


      <section className="panel">
        <div className="panel-head">Движение денег</div>
        <div className="panel-body">
          {(payments.data?.items.length ?? 0) === 0 ? (
            <EmptyState icon="💰" title="Операций нет" />
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тип</th>
                  <th>Категория</th>
                  <th>Заказ</th>
                  <th>Клиент</th>
                  <th className="num">Сумма</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.data?.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="nowrap">{payment.occurredOn}</td>
                    <td className="nowrap">
                      {payment.direction === 'in' ? 'Доход' : 'Расход'}
                    </td>
                    <td>{payment.category || payment.method}</td>
                    <td className="nowrap">
                      {payment.orderId ? (
                        <Link className="row-link" to={`/orders/${payment.orderId}`}>
                          №{payment.orderNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{payment.clientName ?? '—'}</td>
                    <td
                      className="num"
                      style={{
                        color: payment.direction === 'in' ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {payment.direction === 'in' ? '+' : '−'}
                      {formatMoney(payment.amount)}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn sm danger"
                          onClick={() => {
                            if (window.confirm('Удалить запись?')) remove.mutate(payment.id);
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

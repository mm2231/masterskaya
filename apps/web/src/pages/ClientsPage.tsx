/** Список клиентов: поиск, метрики, создание. */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { api, query } from '../lib/api';
import { formatDateShort, formatMoney, formatPhone, initials } from '../lib/format';
import type { Client } from '../lib/types';
import { NewClientModal } from '../features/clients/NewClientModal';

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['clients', search],
    queryFn: () =>
      api.get<{ items: Client[]; total: number }>('/api/clients' + query({ q: search, limit: 200 })),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/clients/${id}`),
    onSuccess: () => {
      toast.show('Клиент удалён', 'success');
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  return (
    <>
      <div className="page-head">
        <h1>Клиенты</h1>
        <button type="button" className="btn primary" onClick={() => setNewOpen(true)}>
          ＋ Новый клиент
        </button>
      </div>

      <div className="page-head" style={{ marginBottom: 12 }}>
        <input
          type="search"
          placeholder="Поиск по имени или телефону"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{
            flex: 1,
            maxWidth: 420,
            height: 34,
            padding: '0 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-elevated)',
          }}
        />
        <span style={{ color: 'var(--text-muted)' }}>Всего: {list.data?.total ?? 0}</span>
      </div>

      {(list.data?.items.length ?? 0) === 0 ? (
        <div className="panel">
          <EmptyState
            icon="👥"
            title="Клиентов нет"
            hint="Клиенты создаются автоматически при оформлении заказа"
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Телефон</th>
                <th className="num">Ремонтов</th>
                <th className="num">Выручка</th>
                <th>Последний визит</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data?.items.map((client) => (
                <tr key={client.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          background: 'var(--primary-soft)',
                          color: 'var(--primary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 650,
                        }}
                      >
                        {initials(client.name)}
                      </span>
                      <Link className="row-link" to={`/clients/${client.id}`}>
                        {client.name || 'Без имени'}
                      </Link>
                    </div>
                  </td>
                  <td className="nowrap">{formatPhone(client.phone)}</td>
                  <td className="num">{client.ordersCount}</td>
                  <td className="num">{formatMoney(client.totalRevenue)}</td>
                  <td className="nowrap">
                    {client.lastOrderAt ? formatDateShort(client.lastOrderAt) : '—'}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn sm" to={`/clients/${client.id}`}>
                        Открыть
                      </Link>
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => {
                          if (window.confirm(`Удалить клиента «${client.name}»?`)) {
                            remove.mutate(client.id);
                          }
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
        </div>
      )}

      {newOpen ? <NewClientModal onClose={() => setNewOpen(false)} /> : null}
    </>
  );
}

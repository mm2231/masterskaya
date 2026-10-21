/** Создание задачи: выбираем заказ, пишем что сделать и ставим срок. */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TASK_TEMPLATES } from '@masterskaya/shared';

import { useToast } from '../../components/Toast';
import { api, query } from '../../lib/api';
import type { Order } from '../../lib/types';

export function NewTaskModal({
  orderId,
  onClose,
}: {
  /** Если задан — задача создаётся сразу для этого заказа. */
  orderId?: number;
  onClose: () => void;
}) {
  const [order, setOrder] = useState(orderId ? String(orderId) : '');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('');
  const [search, setSearch] = useState('');

  const toast = useToast();
  const queryClient = useQueryClient();

  const orders = useQuery({
    queryKey: ['orders', 'for-task', search],
    queryFn: () =>
      api.get<{ items: Order[] }>(
        '/api/orders' + query({ q: search, limit: 50, sort: 'date_desc' }),
      ),
    enabled: !orderId,
  });

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/api/tasks', payload),
    onSuccess: () => {
      toast.show('Задача создана', 'success');
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['task-counts'] });
      onClose();
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!order) {
      toast.show('Выберите заказ', 'error');
      return;
    }
    if (!title.trim()) {
      toast.show('Напишите, что нужно сделать', 'error');
      return;
    }
    const dueAt = time ? `${due}T${time}` : due;
    create.mutate({ orderId: Number(order), title: title.trim(), dueAt });
  };

  const selectedOrder = orders.data?.items.find((item) => String(item.id) === order);

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">Новая задача</div>
        <div className="modal-body">
          {orderId ? (
            <div className="field">
              <span className="field-label">Заказ</span>
              <input value={`№${selectedOrder?.number ?? '…'}`} readOnly />
            </div>
          ) : (
            <>
              <label className="field">
                <span className="field-label">Заказ *</span>
                <input
                  type="search"
                  placeholder="Поиск: телефон, устройство или номер"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div className="chips" style={{ marginBottom: 12 }}>
                {orders.data?.items.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip ${order === String(item.id) ? 'active' : ''}`}
                    onClick={() => setOrder(String(item.id))}
                  >
                    №{item.number} · {item.deviceLabel ?? 'без устройства'}
                  </button>
                ))}
              </div>
              {order ? (
                <div className="field">
                  <span className="field-label">Выбран заказ</span>
                  <input
                    value={
                      `№${selectedOrder?.number ?? order} · ${
                        selectedOrder?.deviceLabel ?? ''
                      }` || order
                    }
                    readOnly
                  />
                </div>
              ) : null}
            </>
          )}

          <label className="field">
            <span className="field-label">Что нужно сделать *</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Позвонить клиенту"
            />
          </label>

          <div className="chips" style={{ marginBottom: 12 }}>
            {TASK_TEMPLATES.map((template) => (
              <button
                key={template.title}
                type="button"
                className={`chip ${title === template.title ? 'active' : ''}`}
                onClick={() => setTitle(template.title)}
              >
                {template.icon} {template.title}
              </button>
            ))}
          </div>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Срок</span>
              <input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Время (необязательно)</span>
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn primary" disabled={create.isPending}>
            Создать
          </button>
        </div>
      </form>
    </div>
  );
}

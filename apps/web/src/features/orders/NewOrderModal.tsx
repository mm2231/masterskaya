/** Приём заказа: клиент, устройство, неисправность, суммы. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import type { Client, Order } from '../../lib/types';

export function NewOrderModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [device, setDevice] = useState('');
  const [fault, setFault] = useState('');
  const [appearance, setAppearance] = useState('');
  const [work, setWork] = useState('');
  const [clientTotal, setClientTotal] = useState('');
  const [costTotal, setCostTotal] = useState('');
  const [clientId, setClientId] = useState<number | null>(null);

  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Подсказки клиентов по телефону.
  const suggest = useQuery({
    queryKey: ['client-suggest', phone],
    queryFn: () =>
      api.get<{ clients: Client[] }>(`/api/clients/suggest?q=${encodeURIComponent(phone)}`),
    enabled: phone.trim().length >= 3,
  });

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<{ order: Order }>('/api/orders', payload),
    onSuccess: (data) => {
      toast.show('Заказ принят', 'success');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order-counts'] });
      onClose();
      navigate(`/orders/${data.order.id}`);
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const total = Number(clientTotal.replace(',', '.'));
    if (!Number.isFinite(total) || total <= 0) {
      toast.show('Укажите сумму за ремонт', 'error');
      return;
    }
    const cost = Number(costTotal.replace(',', '.'));
    create.mutate({
      clientId: clientId ?? undefined,
      clientName: name.trim() || undefined,
      clientPhone: phone.trim() || undefined,
      deviceLabel: device.trim() || undefined,
      fault: fault.trim() || undefined,
      appearance: appearance.trim() || undefined,
      workDescription: work.trim() || undefined,
      clientTotal: total,
      costTotal: Number.isFinite(cost) && cost > 0 ? cost : 0,
      status: 'new',
    });
  };


  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">Приём заказа</div>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Клиент</span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setClientId(null);
                }}
                placeholder="Имя клиента"
              />
            </label>
            <label className="field">
              <span className="field-label">Телефон</span>
              <input
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setClientId(null);
                }}
                placeholder="+375291234567"
                list="client-suggest"
              />
            </label>
          </div>

          <datalist id="client-suggest">
            {suggest.data?.clients.map((client) => (
              <option key={client.id} value={client.phone}>
                {client.name}
              </option>
            ))}
          </datalist>

          {suggest.data?.clients.length ? (
            <div className="chips" style={{ marginBottom: 14 }}>
              {suggest.data.clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setClientId(client.id);
                    setName(client.name);
                    setPhone(client.phone);
                  }}
                >
                  {client.name || 'Без имени'} · {client.phone}
                </button>
              ))}
            </div>
          ) : null}

          <label className="field">
            <span className="field-label">Устройство</span>
            <input
              value={device}
              onChange={(event) => setDevice(event.target.value)}
              placeholder="Redmi Note 9, iPhone 13…"
            />
          </label>

          <label className="field">
            <span className="field-label">Заявленная неисправность</span>
            <input
              value={fault}
              onChange={(event) => setFault(event.target.value)}
              placeholder="Не включается, разбит экран…"
            />
          </label>

          <label className="field">
            <span className="field-label">Комплектация и внешний вид</span>
            <input
              value={appearance}
              onChange={(event) => setAppearance(event.target.value)}
              placeholder="Чехол, SIM-карта, царапины на корпусе…"
            />
          </label>

          <label className="field">
            <span className="field-label">Выполненные работы</span>
            <textarea
              value={work}
              onChange={(event) => setWork(event.target.value)}
              placeholder="Что сделано — попадёт в акт выполненных работ"
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Сумма за ремонт (для клиента) *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={clientTotal}
                onChange={(event) => setClientTotal(event.target.value)}
                placeholder="45"
              />
            </label>
            <label className="field">
              <span className="field-label">Себестоимость</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costTotal}
                onChange={(event) => setCostTotal(event.target.value)}
                placeholder="20"
              />
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn primary" disabled={create.isPending}>
            Принять заказ
          </button>
        </div>
      </form>
    </div>
  );
}

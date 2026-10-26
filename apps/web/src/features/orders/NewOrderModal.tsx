/** Приём заказа: клиент, устройство, неисправность, суммы. */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { formatDateShort, formatMoney } from '../../lib/format';
import type { Order, PastOrder } from '../../lib/types';

export function NewOrderModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [device, setDevice] = useState('');
  const [fault, setFault] = useState('');
  const [appearance, setAppearance] = useState('');
  const [work, setWork] = useState('');
  const [clientTotal, setClientTotal] = useState('');
  const [costTotal, setCostTotal] = useState('');
  const [prepayment, setPrepayment] = useState('');
  const [totalError, setTotalError] = useState('');
  const [prepayError, setPrepayError] = useState('');

  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Прошлые заказы по телефону: что у клиента уже чинили и за сколько.
  const history = useQuery({
    queryKey: ['orders-by-phone', phone],
    queryFn: () =>
      api.get<{ items: PastOrder[] }>(
        `/api/orders/by-phone?phone=${encodeURIComponent(phone)}`,
      ),
    enabled: phone.trim().length >= 5,
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
      setTotalError('Укажите сумму за ремонт — обязательное поле');
      return;
    }
    setTotalError('');
    const cost = Number(costTotal.replace(',', '.'));
    const prepaid = prepayment.trim() ? Number(prepayment.replace(',', '.')) : 0;
    if (!Number.isFinite(prepaid) || prepaid < 0) {
      setPrepayError('Предоплата указана неверно');
      return;
    }
    if (prepaid > total) {
      setPrepayError('Предоплата не может быть больше суммы за ремонт');
      return;
    }
    setPrepayError('');
    create.mutate({
      clientName: name.trim() || undefined,
      clientPhone: phone.trim() || undefined,
      deviceLabel: device.trim() || undefined,
      fault: fault.trim() || undefined,
      appearance: appearance.trim() || undefined,
      workDescription: work.trim() || undefined,
      clientTotal: total,
      costTotal: Number.isFinite(cost) && cost > 0 ? cost : 0,
      prepayment: prepaid,
      status: 'new',
    });
  };


  // Esc закрывает форму, как диалог.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-order-title"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head" id="new-order-title">
          Приём заказа
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Клиент</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Имя клиента"
              />
            </label>
            <label className="field">
              <span className="field-label">Телефон</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+375291234567"
                list="client-suggest"
              />
            </label>
          </div>

          {history.data?.items.length ? (
            <div className="past-orders">
              <div className="past-orders-title">
                У этого клиента уже были заказы — нажмите, чтобы подставить
              </div>
              {history.data.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="past-order"
                  onClick={() => {
                    if (!name.trim() && item.clientName) setName(item.clientName);
                    if (!device.trim() && item.deviceLabel) setDevice(item.deviceLabel);
                    if (!fault.trim() && item.fault) setFault(item.fault);
                    if (!work.trim() && item.workDescription) setWork(item.workDescription);
                  }}
                >
                  <span className="past-order-device">
                    {item.deviceLabel ?? 'без устройства'}
                  </span>
                  <span className="past-order-what">
                    {item.fault || item.workDescription || 'без описания'}
                  </span>
                  <span className="past-order-meta">
                    {formatDateShort(item.acceptedAt)} · {formatMoney(item.clientTotal)}
                  </span>
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
              <span className="field-label">
                Сумма за ремонт <span className="req">*</span>
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={clientTotal}
                onChange={(event) => {
                  setClientTotal(event.target.value);
                  if (totalError) setTotalError('');
                }}
                placeholder="45"
                aria-required="true"
                aria-invalid={totalError ? true : undefined}
                aria-describedby={totalError ? 'new-order-total-error' : undefined}
              />
              <span className="field-hint">Баллами не считаем: рубли, дробные через точку</span>
              {totalError ? (
                <span className="error" id="new-order-total-error">
                  {totalError}
                </span>
              ) : null}
            </label>
            <label className="field">
              <span className="field-label">Себестоимость</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={costTotal}
                onChange={(event) => setCostTotal(event.target.value)}
                placeholder="20"
              />
              <span className="field-hint">Запчасти и работы, без наценки</span>
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Предоплата</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={prepayment}
                onChange={(event) => {
                  setPrepayment(event.target.value);
                  if (prepayError) setPrepayError('');
                }}
                placeholder="0"
                aria-invalid={prepayError ? true : undefined}
                aria-describedby={prepayError ? 'new-order-prepay-error' : undefined}
              />
              <span className="field-hint">Сразу попадёт в доход, даже без выдачи</span>
              {prepayError ? (
                <span className="error" id="new-order-prepay-error">
                  {prepayError}
                </span>
              ) : null}
            </label>
            <div className="field">
              <span className="field-label">К доплате при выдаче</span>
              <div className="field-echo">
                {formatMoney(
                  Math.max(
                    Number(clientTotal.replace(',', '.') || 0) -
                      Number(prepayment.replace(',', '.') || 0),
                    0,
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={create.isPending}
            aria-busy={create.isPending}
          >
            {create.isPending ? 'Принимаем…' : 'Принять заказ'}
          </button>
        </div>
      </form>
    </div>
  );
}

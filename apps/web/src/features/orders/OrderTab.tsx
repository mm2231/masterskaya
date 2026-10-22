/** Вкладка «Заказ»: редактируемые поля заказа и смена статуса. */

import { useState } from 'react';
import { statusLabel } from '@masterskaya/shared';

import { StatusBadge } from '../../components/StatusBadge';

import type { Order } from '../../lib/types';

export function OrderTab({
  order,
  allowedTransitions,
  onChange,
}: {
  order: Order;
  allowedTransitions: string[];
  onChange: (data: Record<string, unknown>) => void;
}) {
  const [device, setDevice] = useState(order.deviceLabel ?? '');
  const [fault, setFault] = useState(order.fault ?? '');
  const [appearance, setAppearance] = useState(order.appearance ?? '');
  const [work, setWork] = useState(order.workDescription ?? '');
  const [clientName, setClientName] = useState(order.clientName ?? '');
  const [clientPhone, setClientPhone] = useState(order.clientPhone ?? '');
  const [alsoClient, setAlsoClient] = useState(false);
  const [clientTotal, setClientTotal] = useState(String(order.clientTotal ?? ''));
  const [costTotal, setCostTotal] = useState(String(order.costTotal ?? ''));

  return (
    <div className="split">
      <section className="panel">
        <div className="panel-head">Данные заказа</div>
        <div className="panel-body">
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Клиент</span>
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Имя клиента — можно оставить пустым"
              />
            </label>
            <label className="field">
              <span className="field-label">Телефон</span>
              <input
                value={clientPhone}
                onChange={(event) => setClientPhone(event.target.value)}
                placeholder="+375291234567"
              />
            </label>
          </div>

          {order.clientId ? (
            <label
              className="field"
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -4 }}
            >
              <input
                type="checkbox"
                checked={alsoClient}
                onChange={(event) => setAlsoClient(event.target.checked)}
                style={{ width: 'auto', minHeight: 0 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Обновить имя во всех заказах этого клиента
              </span>
            </label>
          ) : null}

          <label className="field">
            <span className="field-label">Устройство</span>
            <input value={device} onChange={(event) => setDevice(event.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Заявленная неисправность</span>
            <input value={fault} onChange={(event) => setFault(event.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Комплектация и внешний вид</span>
            <input value={appearance} onChange={(event) => setAppearance(event.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Выполненные работы</span>
            <textarea value={work} onChange={(event) => setWork(event.target.value)} />
          </label>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Сумма для клиента</span>
              <input
                type="number"
                step="0.01"
                value={clientTotal}
                onChange={(event) => setClientTotal(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Себестоимость</span>
              <input
                type="number"
                step="0.01"
                value={costTotal}
                onChange={(event) => setCostTotal(event.target.value)}
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                onChange({
                  clientName: clientName.trim(),
                  clientPhone: clientPhone.trim(),
                  updateClientName: alsoClient,
                  deviceLabel: device,
                  fault,
                  appearance,
                  workDescription: work,
                  clientTotal: Number(clientTotal.replace(',', '.')) || 0,
                  costTotal: Number(costTotal.replace(',', '.')) || 0,
                })
              }
            >
              Сохранить
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">Статус</div>
        <div className="panel-body">
          <div className="field">
            <span className="field-label">Текущий статус</span>
            <StatusBadge code={order.status} />
          </div>
          {allowedTransitions.map((code) => (
            <button
              key={code}
              type="button"
              className="btn block"
              style={{ marginBottom: 6 }}
              onClick={() => onChange({ status: code })}
            >
              → {statusLabel(code)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

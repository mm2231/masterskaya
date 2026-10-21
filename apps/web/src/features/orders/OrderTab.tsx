/** Вкладка «Заказ»: редактируемые поля заказа и смена статуса. */

import { useState } from 'react';
import { statusLabel } from '@masterskaya/shared';

import { StatusBadge } from '../../components/StatusBadge';
import { formatPhone } from '../../lib/format';
import type { Order } from '../../lib/types';

export function OrderTab({
  order,
  clientName,
  allowedTransitions,
  onChange,
}: {
  order: Order;
  clientName: string | null;
  allowedTransitions: string[];
  onChange: (data: Record<string, unknown>) => void;
}) {
  const [device, setDevice] = useState(order.deviceLabel ?? '');
  const [fault, setFault] = useState(order.fault ?? '');
  const [appearance, setAppearance] = useState(order.appearance ?? '');
  const [work, setWork] = useState(order.workDescription ?? '');
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
              <input value={clientName ?? '—'} readOnly />
            </label>
            <label className="field">
              <span className="field-label">Телефон</span>
              <input value={formatPhone(order.clientPhone)} readOnly />
            </label>
          </div>

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

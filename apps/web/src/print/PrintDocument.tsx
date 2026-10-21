/** Печатный бланк: приёмный акт или акт выполненных работ. */

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { formatDateLong, formatRubInt } from '../lib/format';
import './print.css';

interface PreviewData {
  kind: 'acceptance' | 'works';
  order: {
    id: number;
    number: string;
    clientName: string | null;
    clientPhone: string | null;
    deviceLabel: string | null;
    fault: string | null;
    appearance: string | null;
    accessories: string | null;
    workDescription: string | null;
    clientTotal: number;
    costTotal: number;
    acceptedAt: string;
    warrantyMonths: number;
  };
  client: { name: string; phone: string } | null;
  workshop: {
    name: string;
    owner: string;
    unp: string;
    address: string;
    phone: string;
  };
  totals: { words: string; profit: number; margin: number };
}

export function PrintDocument() {
  const { id, kind } = useParams();
  const orderId = Number(id);

  const preview = useQuery({
    queryKey: ['doc-preview', orderId, kind],
    queryFn: () => api.get<PreviewData>(`/api/documents/${orderId}/preview/${kind}`),
  });

  useEffect(() => {
    if (preview.data) {
      document.title =
        preview.data.kind === 'works'
          ? `Акт выполненных работ №${preview.data.order.number}`
          : `Приёмный акт №${preview.data.order.number}`;
    }
  }, [preview.data]);

  if (preview.isLoading) {
    return <div className="print-root">Загрузка…</div>;
  }
  if (!preview.data) {
    return <div className="print-root">Документ не найден</div>;
  }

  const { order, workshop, totals } = preview.data;
  const isWorks = preview.data.kind === 'works';


  return (
    <div className="print-root">
      <div className="print-toolbar">
        <button type="button" className="btn primary" onClick={() => window.print()}>
          🖨 Печать / PDF
        </button>
        <button type="button" className="btn" onClick={() => window.close()}>
          Закрыть
        </button>
        <span style={{ color: 'var(--text-muted)' }}>
          Чтобы получить PDF: «Печать / PDF» → «Сохранить как PDF».
        </span>
      </div>

      <article className="print-page">
        <header className="print-head">
          <div>{workshop.address}</div>
          <div>Мастерская «{workshop.name}»</div>
          <div>Тел: {workshop.phone}</div>
          <div>{workshop.owner}</div>
          <div>УНП: {workshop.unp}</div>
        </header>

        <h1>{isWorks ? 'Акт выполненных работ' : 'Приёмный акт'}</h1>

        <div className="print-title">
          № {order.number} от {formatDateLong(order.acceptedAt)}
        </div>

        <div className="print-block">
          <div className="print-row">
            <span className="print-label">Заказчик:</span>
            <span className="print-value">{order.clientName ?? '—'}</span>
          </div>
          <div className="print-row">
            <span className="print-label">Телефон:</span>
            <span className="print-value">{order.clientPhone ?? '—'}</span>
          </div>
        </div>

        <h2>Оборудование, переданное в ремонт</h2>
        <div className="print-block">
          <div className="print-row">
            <span className="print-label">Бренд, модель:</span>
            <span className="print-value">{order.deviceLabel ?? '—'}</span>
          </div>
          <div className="print-row">
            <span className="print-label">Заявленная неисправность:</span>
            <span className="print-value">{order.fault ?? '—'}</span>
          </div>
          <div className="print-row">
            <span className="print-label">Отметки, комплектация, внешний вид:</span>
            <span className="print-value">{order.appearance ?? '—'}</span>
          </div>
          {order.accessories ? (
            <div className="print-row">
              <span className="print-label">Комплектация:</span>
              <span className="print-value">{order.accessories}</span>
            </div>
          ) : null}
        </div>


        {isWorks ? (
          <>
            <h2>Выполненные работы</h2>
            <div className="print-block">
              <div className="print-row">
                <span className="print-label">Перечень работ:</span>
                <span className="print-value">{order.workDescription ?? '—'}</span>
              </div>
            </div>

            <div className="print-sum">
              <span>Стоимость работ и запасных частей:</span>
              <span>{formatRubInt(order.clientTotal)}</span>
            </div>
            <div className="print-words">{totals.words}</div>

            {order.warrantyMonths > 0 ? (
              <div className="print-note">
                Гарантия на выполненные работы и установленные запасные части —{' '}
                {order.warrantyMonths} мес. с даты выдачи.
              </div>
            ) : null}
          </>
        ) : (
          <>
            <h2>Условия ремонта</h2>
            <div className="print-block">
              <div className="print-row">
                <span className="print-label">Ориентировочная стоимость:</span>
                <span className="print-value">{formatRubInt(order.clientTotal)}</span>
              </div>
              <div className="print-row">
                <span className="print-label">Срок выполнения:</span>
                <span className="print-value">уточняется после диагностики</span>
              </div>
            </div>
            <div className="print-note">
              Стоимость ремонта окончательно определяется после диагностики и согласуется с
              заказчиком. Заказчик уведомляется о готовности.
            </div>
          </>
        )}

        <div className="print-signs">
          <div className="print-sign">
            Заказчик: ______________________
            <div className="print-sign-label">
              {order.clientName ?? ''} / {order.clientPhone ?? ''}
            </div>
          </div>
          <div className="print-sign">
            Мастер: ______________________
            <div className="print-sign-label">{workshop.owner}</div>
          </div>
        </div>
      </article>
    </div>
  );
}

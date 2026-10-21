/**
 * Печатный бланк: приёмный акт или акт выполненных работ.
 *
 * Приёмный акт печатается в двух экземплярах на одном листе A4:
 * лист режется пополам — верхняя половина отдаётся заказчику,
 * нижняя остаётся в мастерской.
 */

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { ActBody } from './ActBody';
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
          {isWorks
            ? 'Чтобы получить PDF: «Печать / PDF» → «Сохранить как PDF».'
            : 'Бланк печатается в двух экземплярах — лист разрезается по пунктирной линии.'}
        </span>
      </div>

      {isWorks ? (
        <article className="print-page">
          <ActBody kind="works" order={order} workshop={workshop} words={totals.words} />
        </article>
      ) : (
        <article className="print-duo">
          <div className="print-half">
            <ActBody
              kind="acceptance"
              order={order}
              workshop={workshop}
              words={totals.words}
              copyLabel="Заказчику"
            />
          </div>
          <div className="print-cut">
            <span>✂ —————— разрезать по линии —————— ✂</span>
          </div>
          <div className="print-half">
            <ActBody
              kind="acceptance"
              order={order}
              workshop={workshop}
              words={totals.words}
              copyLabel="Мастерской"
            />
          </div>
        </article>
      )}
    </div>
  );
}

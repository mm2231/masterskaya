/** Реестр актов: все приёмные акты и акты выполненных работ. */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '../components/EmptyState';
import { api, query } from '../lib/api';
import { formatDateTime, formatMoney } from '../lib/format';
import type { DocumentRow } from '../lib/types';

export function DocumentsPage() {
  const [kind, setKind] = useState('');

  const list = useQuery({
    queryKey: ['documents', kind],
    queryFn: () => api.get<{ items: DocumentRow[] }>('/api/documents' + query({ kind, limit: 200 })),
  });

  return (
    <>
      <div className="page-head">
        <h1>Акты</h1>
      </div>

      <div className="chips">
        <button
          type="button"
          className={`chip ${kind === '' ? 'active' : ''}`}
          onClick={() => setKind('')}
        >
          Все
        </button>
        <button
          type="button"
          className={`chip ${kind === 'acceptance' ? 'active' : ''}`}
          onClick={() => setKind('acceptance')}
        >
          Приёмные акты
        </button>
        <button
          type="button"
          className={`chip ${kind === 'works' ? 'active' : ''}`}
          onClick={() => setKind('works')}
        >
          Акты выполненных работ
        </button>
      </div>

      {(list.data?.items.length ?? 0) === 0 ? (
        <div className="panel">
          <EmptyState
            icon="📄"
            title="Актов пока нет"
            hint="Акт создаётся из карточки заказа"
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Вид</th>
                <th>Заказ</th>
                <th>Клиент</th>
                <th>Устройство</th>
                <th className="num">Сумма</th>
                <th>Создан</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data?.items.map((document) => (
                <tr key={document.id}>
                  <td className="nowrap">№{document.number}</td>
                  <td className="nowrap">
                    {document.kind === 'works' ? 'Акт работ' : 'Приёмный акт'}
                  </td>
                  <td className="nowrap">
                    <Link className="row-link" to={`/orders/${document.orderId}`}>
                      №{document.orderNumber}
                    </Link>
                  </td>
                  <td>{document.clientName ?? '—'}</td>
                  <td>{document.deviceLabel ?? '—'}</td>
                  <td className="num">{formatMoney(document.clientTotal ?? 0)}</td>
                  <td className="nowrap">{formatDateTime(document.issuedAt)}</td>
                  <td>
                    <div className="row-actions">
                      <Link
                        className="btn sm"
                        to={`/orders/${document.orderId}/print/${document.kind}`}
                      >
                        Открыть
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

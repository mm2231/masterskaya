/**
 * Тело одного экземпляра акта.
 *
 * Используется дважды: приёмный акт печатается в двух экземплярах
 * (верхняя половина — заказчику, нижняя — мастерской), акт выполненных
 * работ — в одном.
 */

import { formatDateLong, formatRubInt } from '../lib/format';
import { PrintTerms } from './PrintTerms';

export interface ActOrder {
  number: string;
  clientName: string | null;
  clientPhone: string | null;
  deviceLabel: string | null;
  fault: string | null;
  appearance: string | null;
  accessories: string | null;
  workDescription: string | null;
  clientTotal: number;
  acceptedAt: string;
  warrantyMonths: number;
}

export interface ActWorkshop {
  name: string;
  owner: string;
  unp: string;
  address: string;
  phone: string;
}

export function ActBody({
  kind,
  order,
  workshop,
  words,
  copyLabel,
}: {
  kind: 'acceptance' | 'works';
  order: ActOrder;
  workshop: ActWorkshop;
  words: string;
  /** Метка экземпляра: «Заказчику» / «Мастерской». */
  copyLabel?: string;
}) {
  const isWorks = kind === 'works';

  return (
    <>
      <header className="print-head">
        <div>{workshop.address}</div>
        <div>Мастерская «{workshop.name}»</div>
        <div>Тел: {workshop.phone}</div>
        <div>{workshop.owner}</div>
        <div>УНП: {workshop.unp}</div>
      </header>

      <h1>
        {isWorks ? 'Акт выполненных работ' : 'Приёмный акт'}
        {copyLabel ? <span className="print-copy-mark"> {copyLabel}</span> : null}
      </h1>

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
          <div className="print-words">{words}</div>

          {order.warrantyMonths > 0 ? (
            <div className="print-note">
              Гарантия на выполненные работы и установленные запасные части —{' '}
              {order.warrantyMonths} мес. с даты выдачи.
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="print-block">
            <div className="print-row">
              <span className="print-label">Итоговая стоимость:</span>
              <span className="print-value">
                определяется после диагностики и согласуется с заказчиком
              </span>
            </div>
            <div className="print-row">
              <span className="print-label">Срок выполнения:</span>
              <span className="print-value">уточняется после диагностики</span>
            </div>
          </div>
        </>
      )}

      <PrintTerms />

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
    </>
  );
}

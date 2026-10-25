/** HTTP-маршруты документов: /api/documents… */

import { documentInputSchema, numberToWords, orderMargin, orderProfit } from '@masterskaya/shared';
import { inTransaction } from '@masterskaya/db';
import type { FastifyInstance } from 'fastify';

import { db } from '../../db.js';
import { getSetting } from '../settings/repository.js';
import { logEvent, getOrderWithClient } from '../orders/repository.js';
import { nextDocumentNumber } from '../orders/numbering.js';
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  orderDocuments,
} from './repository.js';

export async function registerDocumentRoutes(app: FastifyInstance): Promise<void> {
  /** Реестр актов. */
  app.get('/api/documents', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const items = await listDocuments(db(), {
      kind: query.kind || undefined,
      orderId: query.orderId ? Number(query.orderId) : undefined,
      limit: Math.min(Number(query.limit) || 50, 200),
      offset: Number(query.offset) || 0,
    });
    return { items };
  });

  app.get<{ Params: { id: string } }>('/api/documents/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const document = await getDocument(db(), id);
    if (!document) {
      return reply.code(404).send({ error: 'Документ не найден' });
    }
    return { document };
  });

  /**
   * Данные для печати акта.
   *
   * Отдаём всё, что нужно бланку: реквизиты, заказ, клиента и итоги.
   * Сумма прописью считается на сервере — чтобы бланк и отчёт совпадали.
   */
  app.get<{ Params: { id: string; kind: string } }>(
    '/api/documents/:id/preview/:kind',
    async (request, reply) => {
      const id = Number(request.params.id);
      const kind = request.params.kind;
      if (kind !== 'acceptance' && kind !== 'works') {
        return reply.code(400).send({ error: 'Неизвестный вид документа' });
      }
      const loaded = await getOrderWithClient(db(), id);
      if (!loaded) {
        return reply.code(404).send({ error: 'Заказ не найден' });
      }
      const workshop = (await getSetting<Record<string, string>>(db(), 'workshop')) ?? {};
      const docs = await orderDocuments(db(), id);
      return {
        kind,
        order: loaded.order,
        client: loaded.client ?? null,
        workshop,
        documents: docs,
        totals: {
          clientTotal: loaded.order.clientTotal,
          costTotal: loaded.order.costTotal,
          profit: orderProfit(loaded.order),
          margin: orderMargin(loaded.order),
          words: numberToWords(loaded.order.clientTotal),
        },
      };
    },
  );

  /** Создать документ (зафиксировать факт печати). */
  app.post('/api/documents', async (request, reply) => {
    const parsed = documentInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Проверьте данные', details: parsed.error.issues });
    }
    const data = parsed.data;

    const loaded = await getOrderWithClient(db(), data.orderId);
    if (!loaded) {
      return reply.code(404).send({ error: 'Заказ не найден' });
    }

    const pattern =
      (await getSetting<string>(db(), 'documentNumberPattern')) ?? '{YYYY}-{SEQ}';
    const number = data.number || (await nextDocumentNumber(db(), data.kind, pattern));

    // Документ и запись в журнале создаются одной транзакцией:
    // акт без события или событие без акта недопустимы.
    const document = inTransaction(db(), () => {
      const created = createDocument(db(), {
        orderId: data.orderId,
        kind: data.kind,
        number,
        note: data.note || null,
        snapshot: {
          clientTotal: loaded.order.clientTotal,
          workDescription: loaded.order.workDescription,
          deviceLabel: loaded.order.deviceLabel,
        },
      });

      logEvent(
        db(),
        data.orderId,
        'document',
        data.kind === 'acceptance'
          ? `Приёмный акт №${number} создан`
          : `Акт выполненных работ №${number} создан`,
        { documentId: created.id, kind: data.kind, number },
      );

      return created;
    });

    return reply.code(201).send({ document });
  });

  app.delete<{ Params: { id: string } }>('/api/documents/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const ok = await deleteDocument(db(), id);
    if (!ok) {
      return reply.code(404).send({ error: 'Документ не найден' });
    }
    return { ok: true };
  });
}

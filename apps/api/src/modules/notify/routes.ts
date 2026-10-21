/** HTTP-маршруты уведомлений: /api/notify… */

import { notifyLinks, readyMessage } from '@masterskaya/shared';
import type { FastifyInstance } from 'fastify';

import { db } from '../../db.js';
import { getOrderWithClient } from '../orders/repository.js';
import { getWorkshop } from '../settings/repository.js';

export async function registerNotifyRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Ссылки для сообщения клиенту о готовности заказа.
   *
   * Отправку делает сам мастер (кнопка открывает мессенджер) — внешние
   * SMS-шлюзы не нужны и данные не уходят наружу.
   */
  app.get<{ Params: { id: string } }>('/api/notify/ready/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const loaded = await getOrderWithClient(db(), id);
    if (!loaded) {
      return reply.code(404).send({ error: 'Заказ не найден' });
    }
    const workshop = await getWorkshop(db());
    const client = loaded.client;

    const text = readyMessage({
      clientName: client?.name ?? loaded.order.clientName,
      device: loaded.order.deviceLabel,
      workshopName: workshop.name,
      address: workshop.address,
      phone: workshop.phone,
    });

    const links = notifyLinks(
      {
        phone: client?.phone ?? loaded.order.clientPhone,
        telegram: client?.telegram,
        viber: client?.viber,
      },
      text,
    );

    return { text, links };
  });
}

/**
 * Тесты API: полный цикл заказа и финансовые расчёты.
 *
 * База — временная (в отдельной папке), поэтому тесты не трогают рабочие данные.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';
import { initDb } from '../db.js';
import { applyMigrations, seedDatabase } from '@masterskaya/db';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let tempDir: string;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'masterskaya-test-'));
  const path = join(tempDir, 'test.db');
  applyMigrations(path);
  const database = initDb(path);
  await seedDatabase(database, {
    name: 'Тестовая мастерская',
    owner: 'Иван',
    unp: '123456',
    address: 'ул. Тестовая, 1',
    phone: '+375291234567',
  });

  app = await buildApp({
    env: {
      PORT: 0,
      HOST: '127.0.0.1',
      DEV: false,
      DATABASE_PATH: path,
      BACKUP_DIR: join(tempDir, 'backups'),
      BACKUP_INTERVAL_HOURS: 24,
      BACKUP_KEEP: 3,
      WORKSHOP_NAME: 'Тестовая мастерская',
      WORKSHOP_OWNER: 'Иван',
      WORKSHOP_UNP: '123456',
      WORKSHOP_ADDRESS: 'ул. Тестовая, 1',
      WORKSHOP_PHONE: '+375291234567',
      APP_PASSWORD: '',
      SECRET_KEY: 'test-secret',
      DOC_NUMBER_PATTERN: '{YYYY}-{SEQ}',
      ORDER_NUMBER_PATTERN: '{YYYY}-{SEQ}',
    },
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(tempDir, { recursive: true, force: true });
});

async function createOrder(data: Record<string, unknown>) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/orders',
    payload: data,
  });
  return response.json();
}

describe('клиенты', () => {
  it('создаёт клиента и находит его по телефону', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/clients',
      payload: { name: 'Петров Пётр', phone: '+375291111111' },
    });
    expect(response.statusCode).toBe(201);
    const client = response.json().client;
    expect(client.name).toBe('Петров Пётр');
    expect(client.phone).toBe('+375291111111');

    const list = await app.inject({ method: 'GET', url: '/api/clients?q=Петров' });
    expect(list.json().items).toHaveLength(1);
  });

  it('не создаёт дубликат клиента с тем же телефоном', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/clients',
      payload: { name: 'Петров Пётр', phone: '+375291111111' },
    });
    expect(response.statusCode).toBe(409);
  });

  it('требует имя клиента', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/clients',
      payload: { name: '', phone: '+375292222222' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('заказы', () => {
  it('создаёт заказ с номером по шаблону', async () => {
    const { order } = await createOrder({
      clientName: 'Иванов',
      clientPhone: '+375293333333',
      deviceLabel: 'Redmi Note 9',
      clientTotal: 45,
      costTotal: 20,
      status: 'new',
    });
    expect(order.number).toMatch(/^\d{4}-\d{4}$/);
    expect(order.status).toBe('new');
  });

  it('записывает создание заказа в журнал событий', async () => {
    const { order } = await createOrder({
      clientName: 'Сидоров',
      clientTotal: 30,
      costTotal: 10,
      status: 'new',
    });
    const response = await app.inject({ method: 'GET', url: `/api/orders/${order.id}` });
    const history = response.json().history;
    expect(history.some((event: { type: string }) => event.type === 'created')).toBe(true);
  });

  it('разрешает смену статуса и фиксирует её в журнале', async () => {
    const { order } = await createOrder({ clientTotal: 50, costTotal: 25, status: 'new' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { status: 'ready' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().order.status).toBe('ready');

    const card = await app.inject({ method: 'GET', url: `/api/orders/${order.id}` });
    const changed = card
      .json()
      .history.find((event: { type: string }) => event.type === 'status_changed');
    expect(changed).toBeTruthy();
    expect(changed.payload.to).toBe('ready');
  });

  it('запрещает недопустимый переход статуса', async () => {
    const { order } = await createOrder({ clientTotal: 50, costTotal: 25, status: 'new' });
    // Путь «Новый» → «Готов» → «Выдан» разрешён.
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { status: 'ready' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { status: 'issued' },
    });
    // Из «Выдан» назад в «Новый» — нельзя.
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { status: 'new' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('Нельзя перевести');
  });

  it('проставляет дату выдачи один раз', async () => {
    const { order } = await createOrder({ clientTotal: 50, costTotal: 25, status: 'new' });
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { status: 'ready' },
    });
    const issued = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { status: 'issued' },
    });
    expect(issued.json().order.issuedAt).toBeTruthy();

    // Возврат в «Готов» сбрасывает дату выдачи — деньги ещё не получены.
    const back = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { status: 'ready' },
    });
    expect(back.json().order.issuedAt).toBeNull();
  });

  it('требует сумму за ремонт', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: { clientTotal: 0, status: 'new' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('акты', () => {
  it('создаёт акт с очередным номером', async () => {
    const { order } = await createOrder({ clientTotal: 60, costTotal: 30, status: 'ready' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/documents',
      payload: { orderId: order.id, kind: 'works' },
    });
    expect(response.statusCode).toBe(201);
    const document = response.json().document;
    expect(document.kind).toBe('works');
    expect(document.number).toMatch(/^\d{4}-\d{4}$/);
  });

  it('отдаёт бланк с суммой прописью', async () => {
    const { order } = await createOrder({ clientTotal: 200, costTotal: 100, status: 'ready' });
    const response = await app.inject({
      method: 'GET',
      url: `/api/documents/${order.id}/preview/works`,
    });
    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.totals.words).toContain('Двести рублей');
    expect(data.totals.profit).toBe(100);
  });
});

describe('финансы', () => {
  it('считает выручку и прибыль по выданным заказам', async () => {
    const { order } = await createOrder({ clientTotal: 100, costTotal: 40, status: 'new' });
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { status: 'ready' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { status: 'issued' },
    });

    const response = await app.inject({ method: 'GET', url: '/api/finance/summary' });
    const summary = response.json().summary;
    expect(summary.issuedCount).toBeGreaterThan(0);
    expect(summary.revenue).toBeGreaterThan(0);
    expect(summary.profit).toBe(summary.revenue - summary.cost - summary.expenses);
  });

  it('учитывает расходы в прибыли', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/finance/summary' });
    const profitBefore = before.json().summary.profit;

    await app.inject({
      method: 'POST',
      url: '/api/finance/payments',
      payload: {
        direction: 'out',
        amount: 30,
        method: 'cash',
        category: 'Аренда',
        occurredOn: new Date().toISOString().slice(0, 10),
      },
    });

    const after = await app.inject({ method: 'GET', url: '/api/finance/summary' });
    expect(after.json().summary.expenses).toBe(30);
    expect(after.json().summary.profit).toBe(profitBefore - 30);
  });

  it('выгружает CSV с BOM для Excel', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/finance/export' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    const body = response.rawPayload as Buffer;
    // BOM в начале — иначе Excel ломает кириллицу.
    expect(body[0]).toBe(0xef);
    expect(body[1]).toBe(0xbb);
    expect(body[2]).toBe(0xbf);
  });
});

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
      TIMEZONE_OFFSET_HOURS: '3',
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

  it('меняет имя клиента в заказе', async () => {
    const { order } = await createOrder({
      clientName: 'Старое имя',
      clientTotal: 30,
      costTotal: 10,
      status: 'new',
    });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { clientName: 'Новое имя' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().order.clientName).toBe('Новое имя');
  });

  it('убирает имя клиента, если поле очистили', async () => {
    const { order } = await createOrder({
      clientName: 'Будет убрано',
      clientTotal: 30,
      costTotal: 10,
      status: 'new',
    });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { clientName: '' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().order.clientName).toBeNull();
  });

  it('по запросу меняет имя и в справочнике клиентов', async () => {
    const client = await app.inject({
      method: 'POST',
      url: '/api/clients',
      payload: { name: 'Клиент Из Справочника', phone: '+375297777777' },
    });
    const clientId = client.json().client.id;

    const { order } = await createOrder({
      clientId,
      clientName: 'Клиент Из Справочника',
      clientTotal: 30,
      costTotal: 10,
      status: 'new',
    });

    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { clientName: 'Новое Имя', updateClientName: true },
    });

    const card = await app.inject({ method: 'GET', url: `/api/clients/${clientId}` });
    expect(card.json().client.name).toBe('Новое Имя');
  });

  it('не трогает справочник клиентов без явного запроса', async () => {
    const client = await app.inject({
      method: 'POST',
      url: '/api/clients',
      payload: { name: 'Оригинальное Имя', phone: '+375296666666' },
    });
    const clientId = client.json().client.id;

    const { order } = await createOrder({
      clientId,
      clientName: 'Оригинальное Имя',
      clientTotal: 30,
      costTotal: 10,
      status: 'new',
    });

    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      payload: { clientName: 'Только В Заказе' },
    });

    const card = await app.inject({ method: 'GET', url: `/api/clients/${clientId}` });
    expect(card.json().client.name).toBe('Оригинальное Имя');
  });

  it('фильтрует по нескольким статусам сразу', async () => {
    const first = await createOrder({ clientTotal: 30, costTotal: 10, status: 'new' });
    const second = await createOrder({ clientTotal: 40, costTotal: 20, status: 'new' });
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${first.order.id}`,
      payload: { status: 'waiting_parts' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/orders?statuses=new,waiting_parts&limit=200',
    });
    const numbers = response
      .json()
      .items.map((item: { number: string }) => item.number);
    expect(numbers).toContain(first.order.number);
    expect(numbers).toContain(second.order.number);
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

  it('изменяет запись: сумму, категорию и комментарий', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/finance/payments',
      payload: {
        direction: 'out',
        amount: 30,
        method: 'cash',
        category: 'Аренда',
        occurredOn: '2026-10-01',
        note: 'Аренда за сентябрь',
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().payment.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/finance/payments/${id}`,
      payload: {
        amount: 45,
        category: 'Налоги',
        note: 'Закупка телефонов на запчасти + налоги',
      },
    });
    expect(response.statusCode).toBe(200);
    const payment = response.json().payment;
    expect(payment.amount).toBe(45);
    expect(payment.category).toBe('Налоги');
    expect(payment.note).toBe('Закупка телефонов на запчасти + налоги');
  });

  it('пустой комментарий снимает его, а не оставляет пустую строку', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/finance/payments',
      payload: {
        direction: 'out',
        amount: 30,
        method: 'cash',
        occurredOn: '2026-10-01',
        note: 'Был комментарий',
      },
    });
    const id = created.json().payment.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/finance/payments/${id}`,
      payload: { note: '' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().payment.note).toBeNull();
  });

  it('не меняет несуществующую запись', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/finance/payments/999999',
      payload: { amount: 10 },
    });
    expect(response.statusCode).toBe(404);
  });

  it('не принимает неправильную сумму при правке', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/finance/payments',
      payload: {
        direction: 'out',
        amount: 30,
        method: 'cash',
        occurredOn: '2026-10-01',
      },
    });
    const id = created.json().payment.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/finance/payments/${id}`,
      payload: { amount: -5 },
    });
    expect(response.statusCode).toBe(400);
  });

  it('сводит выданное за сегодня в отдельную сводку', async () => {
    const { order } = await createOrder({ clientTotal: 120, costTotal: 50, status: 'new' });
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

    const response = await app.inject({ method: 'GET', url: '/api/finance/today' });
    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.date).toBe(new Date().toISOString().slice(0, 10));
    expect(data.summary.issuedCount).toBeGreaterThan(0);
    // Выданный сегодня заказ есть в списке, и его прибыль посчитана.
    const found = data.orders.find((item: { number: string }) => item.number === order.number);
    expect(found).toBeTruthy();
    expect(found.profit).toBe(70);
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

describe('задачи', () => {
  it('создаёт задачу с привязкой к заказу', async () => {
    const { order } = await createOrder({ clientTotal: 30, costTotal: 10, status: 'new' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { orderId: order.id, title: 'Позвонить клиенту', dueAt: '2026-10-21T16:00' },
    });
    expect(response.statusCode).toBe(201);
    const task = response.json().task;
    expect(task.title).toBe('Позвонить клиенту');
    expect(task.dueAt).toBe('2026-10-21 16:00:00');
    // В ответе — контекст заказа, иначе задача бесполезна.
    expect(task.order.number).toBe(order.number);
  });

  it('не создаёт задачу без названия', async () => {
    const { order } = await createOrder({ clientTotal: 30, costTotal: 10, status: 'new' });
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { orderId: order.id, title: '   ' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('не создаёт задачу для несуществующего заказа', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { orderId: 999999, title: 'Позвонить' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('отмечает задачу выполненной и ставит время', async () => {
    const { order } = await createOrder({ clientTotal: 30, costTotal: 10, status: 'new' });
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { orderId: order.id, title: 'Заказать деталь' },
    });
    const taskId = created.json().task.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      payload: { done: true },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().task.done).toBe(true);
    expect(response.json().task.doneAt).toBeTruthy();

    // Снятие отметки убирает время выполнения.
    const undone = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      payload: { done: false },
    });
    expect(undone.json().task.doneAt).toBeNull();
  });

  it('изменяет текст и срок задачи', async () => {
    const { order } = await createOrder({ clientTotal: 30, costTotal: 10, status: 'new' });
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { orderId: order.id, title: 'Позвонить клиенту', dueAt: '2026-10-21' },
    });
    const taskId = created.json().task.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      payload: { title: 'Напомнить о готовности', dueAt: '2026-11-01T16:00' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().task.title).toBe('Напомнить о готовности');
    expect(response.json().task.dueAt).toBe('2026-11-01 16:00:00');
  });

  it('снимает срок задачи при пустом значении', async () => {
    const { order } = await createOrder({ clientTotal: 30, costTotal: 10, status: 'new' });
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { orderId: order.id, title: 'Заказать деталь', dueAt: '2026-10-21' },
    });
    const taskId = created.json().task.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      payload: { dueAt: '' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().task.dueAt).toBeNull();
    expect(response.json().task.overdue).toBe(false);
  });

  it('удаляет задачу', async () => {
    const { order } = await createOrder({ clientTotal: 30, costTotal: 10, status: 'new' });
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { orderId: order.id, title: 'Временная задача' },
    });
    const taskId = created.json().task.id;

    const response = await app.inject({ method: 'DELETE', url: `/api/tasks/${taskId}` });
    expect(response.statusCode).toBe(200);

    const check = await app.inject({ method: 'GET', url: `/api/tasks/${taskId}` });
    expect(check.statusCode).toBe(404);
  });

  it('удаляет задачи вместе с заказом', async () => {
    const { order } = await createOrder({ clientTotal: 30, costTotal: 10, status: 'new' });
    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { orderId: order.id, title: 'Позвонить клиенту' },
    });

    await app.inject({ method: 'DELETE', url: `/api/orders/${order.id}` });

    const list = await app.inject({
      method: 'GET',
      url: `/api/tasks?orderId=${order.id}`,
    });
    expect(list.json().items).toHaveLength(0);
  });

  it('считает просроченные и сегодняшние задачи', async () => {
    const { order } = await createOrder({ clientTotal: 30, costTotal: 10, status: 'new' });
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { orderId: order.id, title: 'Просроченная', dueAt: yesterday },
    });
    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { orderId: order.id, title: 'Сегодняшняя', dueAt: today },
    });

    const counts = await app.inject({ method: 'GET', url: '/api/tasks/counts' });
    expect(counts.json().overdue).toBeGreaterThan(0);
    expect(counts.json().today).toBeGreaterThan(0);
    expect(counts.json().open).toBeGreaterThan(0);
  });
});

describe('экспорт и импорт данных', () => {
  it('выгружает все данные в JSON', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/settings/export' });
    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.version).toBe(2);
    expect(Array.isArray(data.clients)).toBe(true);
    expect(Array.isArray(data.orders)).toBe(true);
  });

  it('импорт не создаёт дубликатов при повторном запуске', async () => {
    const exported = await app.inject({ method: 'GET', url: '/api/settings/export' });
    const payload = exported.json();

    const first = await app.inject({
      method: 'POST',
      url: '/api/settings/import',
      payload,
    });
    expect(first.statusCode).toBe(200);
    // Всё уже было в базе — ничего не создано.
    expect(first.json().report.clients).toBe(0);
    expect(first.json().report.orders).toBe(0);
    expect(first.json().report.events).toBe(0);
    expect(first.json().report.payments).toBe(0);

    const second = await app.inject({
      method: 'POST',
      url: '/api/settings/import',
      payload,
    });
    expect(second.json().report.clients).toBe(0);
    expect(second.json().report.orders).toBe(0);
  });

  it('переносит реквизиты мастерской при импорте', async () => {
    // Реквизиты из выгрузки должны записаться — иначе на новом компьютере
    // в актах были бы пустые поля.
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      clients: [],
      orders: [],
      orderEvents: [],
      orderTasks: [],
      documents: [],
      payments: [],
      expenseCategories: [],
      settings: [
        {
          key: 'workshop',
          value: {
            name: 'Перенесённая мастерская',
            owner: 'Сидоров',
            unp: '999',
            address: 'ул. Новая, 5',
            phone: '+375290000000',
          },
        },
      ],
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/settings/import',
      payload,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().report.settings).toBe(1);

    const workshop = await app.inject({ method: 'GET', url: '/api/settings/workshop' });
    expect(workshop.json().workshop.name).toBe('Перенесённая мастерская');
    expect(workshop.json().workshop.phone).toBe('+375290000000');

    // Возвращаем как было.
    await app.inject({
      method: 'PUT',
      url: '/api/settings/workshop',
      payload: {
        name: 'Тестовая мастерская',
        owner: 'Иван',
        unp: '123456',
        address: 'ул. Тестовая, 1',
        phone: '+375291234567',
      },
    });
  });
});

describe('время в записях', () => {
  it('заказ и акт записываются в локальной зоне, а не в UTC', async () => {
    // Зона UTC+3: записи должны быть на 3 часа позже, чем UTC.
    const utc = new Date();
    const expected = new Date(utc.getTime() + 3 * 3_600_000);
    const pad = (value: number) => String(value).padStart(2, '0');
    const localNow = `${expected.getUTCFullYear()}-${pad(expected.getUTCMonth() + 1)}-${pad(
      expected.getUTCDate(),
    )} ${pad(expected.getUTCHours())}:${pad(expected.getUTCMinutes())}`;

    const { order } = await createOrder({ clientTotal: 50, costTotal: 20, status: 'new' });
    expect(order.acceptedAt.slice(0, 16)).toBe(localNow);

    const document = await app.inject({
      method: 'POST',
      url: '/api/documents',
      payload: { orderId: order.id, kind: 'acceptance' },
    });
    expect(document.statusCode).toBe(201);
    expect(document.json().document.issuedAt.slice(0, 16)).toBe(localNow);
  });
});

describe('проверка обновлений', () => {
  it('отвечает о состоянии репозитория', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/settings/update' });
    expect(response.statusCode).toBe(200);
    // В тестовой папке git-репозитория нет — скрипт честно об этом сообщает.
    expect(typeof response.json().available).toBe('boolean');
    expect(typeof response.json().reason).toBe('string');
  });
});

describe('диагностика', () => {
  it('собирает отчёт о системе, базе и журнале', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/settings/diagnostics' });
    expect(response.statusCode).toBe(200);
    const report = response.json();

    // Система.
    expect(typeof report.system.platform).toBe('string');
    expect(report.system.node).toMatch(/^v\d+/);

    // Приложение.
    expect(report.app.version).toBe('2.0.0');
    expect(typeof report.app.authEnabled).toBe('boolean');

    // База: путь и количество записей.
    expect(typeof report.database.path).toBe('string');
    expect(typeof report.database.counts.orders).toBe('number');

    // Журнал: путь и наличие.
    expect(typeof report.log.path).toBe('string');
    expect(Array.isArray(report.log.tail)).toBe(true);
  });
});

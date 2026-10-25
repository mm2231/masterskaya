/**
 * Схема базы данных «Мастерской» v2.
 *
 * Ядро: клиент → заказ → документы (акты) → деньги (приход/расход).
 * Парсинга цен и заказов поставщику здесь нет — эти функции сняты.
 */

import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Клиент мастерской. */
export const clients = sqliteTable(
  'clients',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    telegram: text('telegram'),
    viber: text('viber'),
    note: text('note'),
    /** Теги в JSON: ['постоянный', 'оптовый']. */
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
    archivedAt: text('archived_at'),
  },
  (table) => ({
    phoneUnique: uniqueIndex('idx_clients_phone').on(table.phone),
    nameIdx: index('idx_clients_name').on(table.name),
  }),
);

/** Техника клиента: модель, IMEI. */
export const devices = sqliteTable(
  'devices',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clientId: integer('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    brand: text('brand'),
    model: text('model'),
    imei: text('imei'),
    note: text('note'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    clientIdx: index('idx_devices_client').on(table.clientId),
  }),
);

/** Заказ на ремонт. */
export const orders = sqliteTable(
  'orders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Номер заказа: «2026-0007». */
    number: text('number').notNull(),
    clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
    /** Денормализованные контакты: нужны, даже если клиент удалён. */
    clientName: text('client_name'),
    clientPhone: text('client_phone'),
    /** Устройство одной строкой: «Redmi Note 9». */
    deviceLabel: text('device_label'),
    fault: text('fault'),
    appearance: text('appearance'),
    accessories: text('accessories'),
    /** Выполненные работы — попадают в акт работ. */
    workDescription: text('work_description'),
    status: text('status').notNull().default('new'),
    /** Сумма для клиента: одна итоговая сумма за ремонт. */
    clientTotal: real('client_total').notNull().default(0),
    /** Себестоимость: вводится мастером одной суммой. */
    costTotal: real('cost_total').notNull().default(0),
    /**
     * Предоплата, внесённая клиентом при приёме заказа.
     *
     * Учитывается в доходе сразу, не дожидаясь статуса «Выдан»:
     * клиент уже отдал деньги. При выдаче она входит в clientTotal
     * и отдельно не суммируется — двойного счёта нет.
     */
    prepayment: real('prepayment').notNull().default(0),
    /** Когда внесена предоплата — по этой дате она попадает в доход периода. */
    prepaymentAt: text('prepayment_at'),
    acceptedAt: text('accepted_at').notNull().default(sql`(datetime('now'))`),
    promisedAt: text('promised_at'),
    readyAt: text('ready_at'),
    issuedAt: text('issued_at'),
    warrantyMonths: integer('warranty_months').notNull().default(0),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    numberUnique: uniqueIndex('idx_orders_number').on(table.number),
    statusIdx: index('idx_orders_status').on(table.status),
    clientIdx: index('idx_orders_client').on(table.clientId),
    issuedIdx: index('idx_orders_issued').on(table.issuedAt),
    acceptedIdx: index('idx_orders_accepted').on(table.acceptedAt),
  }),
);


/** Журнал действий по заказу — «история событий» из CRM. */
export const orderEvents = sqliteTable(
  'order_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** Тип: created, status_changed, total_changed, payment, document, note… */
    type: text('type').notNull(),
    message: text('message'),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown> | null>(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    orderIdx: index('idx_events_order').on(table.orderId),
    createdIdx: index('idx_events_created').on(table.createdAt),
  }),
);

/** Фото устройства и дефектов. */
export const orderPhotos = sqliteTable(
  'order_photos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** Относительный путь внутри data/uploads. */
    path: text('path').notNull(),
    caption: text('caption'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    orderIdx: index('idx_photos_order').on(table.orderId),
  }),
);

/** Задачи по заказу: «позвонить клиенту», «заказать деталь». */
export const orderTasks = sqliteTable(
  'order_tasks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    dueAt: text('due_at'),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    doneAt: text('done_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    orderIdx: index('idx_tasks_order').on(table.orderId),
    doneIdx: index('idx_tasks_done').on(table.done),
    dueIdx: index('idx_tasks_due').on(table.dueAt),
  }),
);

/** Документы: приёмный акт и акт выполненных работ. */
export const documents = sqliteTable(
  'documents',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** acceptance — приёмный акт, works — акт выполненных работ. */
    kind: text('kind').notNull(),
    number: text('number').notNull(),
    note: text('note'),
    /** Снимок данных документа на момент печати — чтобы акт не менялся задним числом. */
    snapshot: text('snapshot', { mode: 'json' }).$type<Record<string, unknown> | null>(),
    /** Путь к PDF, если документ сохраняли файлом. */
    pdfPath: text('pdf_path'),
    issuedAt: text('issued_at').notNull().default(sql`(datetime('now'))`),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    orderIdx: index('idx_documents_order').on(table.orderId),
    kindIdx: index('idx_documents_kind').on(table.kind),
    numberIdx: index('idx_documents_number').on(table.number),
  }),
);

/** Движение денег: приход (оплата клиента) и расход. */
export const payments = sqliteTable(
  'payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    /** in — приход, out — расход. */
    direction: text('direction').notNull(),
    amount: real('amount').notNull(),
    /**
     * Расходники (себестоимость) для ручного дохода без заказа.
     *
     * Пример: продал восстановленный телефон за 130, потратил на
     * детали 50 — доход 130, расходники 50, прибыль 80.
     */
    cost: real('cost').notNull().default(0),
    /** cash, card, invoice, other. */
    method: text('method').notNull().default('cash'),
    /** Категория расхода: аренда, инструмент, запчасти, реклама… */
    category: text('category'),
    occurredOn: text('occurred_on').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    orderIdx: index('idx_payments_order').on(table.orderId),
    dateIdx: index('idx_payments_date').on(table.occurredOn),
    directionIdx: index('idx_payments_direction').on(table.direction),
  }),
);

/** Категории расходов: план по месяцу — для контроля. */
export const expenseCategories = sqliteTable('expense_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  /** fixed — постоянный (аренда), variable — переменный (запчасти). */
  kind: text('kind').notNull().default('variable'),
  budgetMonthly: real('budget_monthly').notNull().default(0),
  archivedAt: text('archived_at'),
});

/** Справочник типовых услуг. */
export const catalogServices = sqliteTable('catalog_services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  defaultPrice: real('default_price').notNull().default(0),
  category: text('category'),
  archivedAt: text('archived_at'),
});

/** Настройки: реквизиты мастерской, шаблоны, счётчики нумерации. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

/** Шаблоны уведомлений клиенту. */
export const notificationTemplates = sqliteTable('notification_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull(),
  channel: text('channel').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

/** Журнал отправленных уведомлений. */
export const notificationLog = sqliteTable(
  'notification_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    templateCode: text('template_code'),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
    channel: text('channel').notNull(),
    target: text('target'),
    text: text('text'),
    /** sent, failed, skipped. */
    status: text('status').notNull().default('sent'),
    error: text('error'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    createdIdx: index('idx_notify_created').on(table.createdAt),
  }),
);

export type Client = typeof clients.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type OrderPhoto = typeof orderPhotos.$inferSelect;
export type OrderTask = typeof orderTasks.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type CatalogService = typeof catalogServices.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NotificationLogEntry = typeof notificationLog.$inferSelect;

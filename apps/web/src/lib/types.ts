/** Типы данных, которые приходят с API. Дублируют серверные контракты. */

import type { OrderStatusCode } from '@masterskaya/shared';

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  telegram: string | null;
  viber: string | null;
  note: string | null;
  tags: string[];
  createdAt: string;
  ordersCount: number;
  lastOrderAt: string | null;
  totalRevenue: number;
}

export interface ClientStats {
  ordersCount: number;
  issuedCount: number;
  revenue: number;
  profit: number;
  lastOrderAt: string | null;
  averageCheck: number;
}

export interface ClientCard {
  client: Client;
  orders: Order[];
  devices: Device[];
  stats: ClientStats;
}

export interface Device {
  id: number;
  clientId: number;
  brand: string | null;
  model: string | null;
  imei: string | null;
  note: string | null;
  createdAt: string;
}

export interface Order {
  id: number;
  number: string;
  clientId: number | null;
  clientName: string | null;
  clientPhone: string | null;
  deviceLabel: string | null;
  fault: string | null;
  appearance: string | null;
  accessories: string | null;
  workDescription: string | null;
  status: OrderStatusCode | string;
  clientTotal: number;
  costTotal: number;
  /** Предоплата: учтена в доходе сразу, не дожидаясь выдачи. */
  prepayment: number;
  /** Дата предоплаты — по ней она попадает в период. */
  prepaymentAt: string | null;
  acceptedAt: string;
  promisedAt: string | null;
  readyAt: string | null;
  issuedAt: string | null;
  warrantyMonths: number;
  notes: string | null;
  createdAt: string;
}

export interface OrderEvent {
  id: number;
  orderId: number;
  type: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface OrderCard {
  order: Order;
  client: Client | null;
  history: OrderEvent[];
  allowedTransitions: string[];
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  counts: Record<string, number>;
}

export interface DocumentRow {
  id: number;
  orderId: number;
  kind: 'acceptance' | 'works';
  number: string;
  note: string | null;
  issuedAt: string;
  createdAt: string;
  orderNumber?: string;
  clientName?: string | null;
  deviceLabel?: string | null;
  clientTotal?: number;
}

export interface Workshop {
  name: string;
  owner: string;
  unp: string;
  address: string;
  phone: string;
}

export interface Payment {
  id: number;
  orderId: number | null;
  direction: 'in' | 'out';
  amount: number;
  /** Расходники ручного дохода: прибыль = amount − cost. */
  cost: number;
  method: string;
  category: string | null;
  occurredOn: string;
  note: string | null;
  createdAt: string;
  orderNumber?: string | null;
  clientName?: string | null;
  deviceLabel?: string | null;
}

export interface PeriodSummary {
  ordersCount: number;
  issuedCount: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  averageCheck: number;
  manualIncome: number;
  manualCost: number;
  prepayments: number;
  expenses: number;
}

export interface FinanceSummary {
  from: string;
  to: string;
  summary: PeriodSummary;
  expensesByCategory: { category: string | null; amount: number; count: number }[];
}

/** Задача по заказу с контекстом заказа. */
export interface Task {
  id: number;
  orderId: number;
  title: string;
  dueAt: string | null;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
  overdue: boolean;
  isToday: boolean;
  overdueDays: number;
  order: {
    id: number;
    number: string;
    clientName: string | null;
    clientPhone: string | null;
    deviceLabel: string | null;
    status: string;
  } | null;
}

export interface TaskListResponse {
  items: Task[];
  counts: { overdue: number; today: number };
}

/** Счётчики задач: просроченные, на сегодня, всего открытых и выполненных. */
export interface TaskCounts {
  overdue: number;
  today: number;
  open: number;
  done: number;
}

/** Заказ, выданный сегодня. */
export interface TodayOrder {
  id: number;
  number: string;
  clientName: string | null;
  clientPhone: string | null;
  deviceLabel: string | null;
  clientTotal: number;
  costTotal: number;
  profit: number;
  issuedAt: string | null;
  workDescription: string | null;
}

/** Сводка за текущий день: выданные заказы и прибыль за день. */
export interface TodayData {
  date: string;
  summary: PeriodSummary;
  orders: TodayOrder[];
  payments: {
    id: number;
    orderId: number | null;
    direction: 'in' | 'out';
    amount: number;
    cost?: number;
    method: string;
    category: string | null;
    note: string | null;
  }[];
}

/** Прошлый заказ клиента — подсказка при оформлении нового. */
export interface PastOrder {
  id: number;
  number: string;
  clientName: string | null;
  deviceLabel: string | null;
  fault: string | null;
  workDescription: string | null;
  clientTotal: number;
  status: OrderStatusCode | string;
  acceptedAt: string;
}

/** Состояние репозитория: текущий коммит и данные с GitHub. */
export interface UpdateStatus {
  ok: boolean;
  available: boolean;
  reason?: string;
  current?: { hash: string; short: string; date: string; subject: string };
  remote?: { hash: string; subject: string; behind: number };
}

/** Отчёт о состоянии приложения и машины — для диагностики. */
export interface Diagnostics {
  system: { platform: string; release: string; arch: string; node: string };
  app: {
    repoRoot: string;
    port: string;
    version: string;
    authEnabled: boolean;
    /** Часовой пояс мастерской и текущее время в нём. */
    timezone: string;
    localTime: string;
  };
  build: {
    /** Когда собран интерфейс. */
    webBuilt: string | null;
    /** Когда собран сервер. */
    apiBuilt: string | null;
    /** Когда менялись исходники. */
    newestSource: string | null;
    /** Сборка отстаёт от исходников — интерфейс может быть старым. */
    stale: boolean;
  };
  database: {
    path: string;
    exists: boolean;
    sizeKb: number;
    counts: Record<string, number | string>;
  };
  log: { path: string; exists: boolean; tail: string[] };
}

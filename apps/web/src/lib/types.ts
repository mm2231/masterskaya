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
  expenses: number;
}

export interface FinanceSummary {
  from: string;
  to: string;
  summary: PeriodSummary;
  expensesByCategory: { category: string | null; amount: number; count: number }[];
}

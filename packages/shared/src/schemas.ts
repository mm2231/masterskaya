/** Zod-схемы запросов и ответов API — общий контракт фронта и бэка. */

import { z } from 'zod';

import { ORDER_STATUS_CODES } from './statuses.js';

/** Телефон: цифры, пробелы, +, скобки — минимум 7 цифр. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[^\d+]/g, ''))
  .refine((value) => value.replace(/\D/g, '').length >= 7, {
    message: 'Телефон должен содержать не менее 7 цифр',
  });

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя клиента').max(200),
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal('')),
  telegram: z.string().trim().max(100).optional().or(z.literal('')),
  viber: z.string().trim().max(100).optional().or(z.literal('')),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

/**
 * Правка клиента: имя может быть пустым — это значит «убрать имя».
 * Телефон обязателен (по нему клиент ищется).
 */
export const clientUpdateSchema = clientInputSchema.partial().extend({
  name: z.string().trim().max(200).optional(),
});

export const deviceInputSchema = z.object({
  clientId: z.number().int().positive(),
  brand: z.string().trim().max(100).optional().or(z.literal('')),
  model: z.string().trim().max(200).optional().or(z.literal('')),
  imei: z.string().trim().max(50).optional().or(z.literal('')),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
});

export type DeviceInput = z.infer<typeof deviceInputSchema>;

export const orderInputSchema = z.object({
  clientId: z.number().int().positive().optional(),
  clientName: z.string().trim().max(200).optional().or(z.literal('')),
  clientPhone: z.string().trim().max(50).optional().or(z.literal('')),
  deviceLabel: z.string().trim().max(200).optional().or(z.literal('')),
  fault: z.string().trim().max(2000).optional().or(z.literal('')),
  appearance: z.string().trim().max(2000).optional().or(z.literal('')),
  accessories: z.string().trim().max(1000).optional().or(z.literal('')),
  workDescription: z.string().trim().max(4000).optional().or(z.literal('')),
  status: z.enum(ORDER_STATUS_CODES as unknown as [string, ...string[]]).default('new'),
  clientTotal: z.number().min(0).default(0),
  costTotal: z.number().min(0).default(0),
  promisedAt: z.string().trim().max(40).optional().or(z.literal('')),
  notes: z.string().trim().max(4000).optional().or(z.literal('')),
  warrantyMonths: z.number().int().min(0).max(60).default(0),
});

export type OrderInput = z.infer<typeof orderInputSchema>;

export const orderPatchSchema = orderInputSchema.partial().extend({
  /** Обновить имя и в справочнике клиентов, а не только в заказе. */
  updateClientName: z.boolean().optional(),
});

export const paymentInputSchema = z.object({
  orderId: z.number().int().positive().optional(),
  direction: z.enum(['in', 'out']),
  amount: z.number().positive('Сумма должна быть больше нуля'),
  method: z.enum(['cash', 'card', 'invoice', 'other']).default('cash'),
  category: z.string().trim().max(100).optional().or(z.literal('')),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД'),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const documentInputSchema = z.object({
  orderId: z.number().int().positive(),
  kind: z.enum(['acceptance', 'works']),
  number: z.string().trim().max(50).optional().or(z.literal('')),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
});

export type DocumentInput = z.infer<typeof documentInputSchema>;

// Схема задач живёт в tasks.ts — там же логика сроков и просрочки.

export const eventInputSchema = z.object({
  orderId: z.number().int().positive(),
  type: z.string().trim().min(1).max(60),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  payload: z.unknown().optional(),
});

export const periodSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.string().trim().max(40).optional(),
  clientId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['date_desc', 'date_asc', 'sum_desc', 'sum_asc']).default('date_desc'),
});

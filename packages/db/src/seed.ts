/**
 * Начальное наполнение базы: реквизиты мастерской, категории расходов,
 * справочник услуг и шаблоны уведомлений.
 *
 * Повторный запуск ничего не ломает: используется INSERT ... ON CONFLICT.
 */

import { eq } from 'drizzle-orm';

import { openDatabase, type AppDatabase } from './connection.js';
import { databasePath, loadEnv } from './paths.js';
import {
  catalogServices,
  expenseCategories,
  notificationTemplates,
  settings,
} from './schema.js';

export interface WorkshopInfo {
  name: string;
  owner: string;
  unp: string;
  address: string;
  phone: string;
}

const DEFAULT_EXPENSE_CATEGORIES: { name: string; kind: 'fixed' | 'variable' }[] = [
  { name: 'Аренда', kind: 'fixed' },
  { name: 'Зарплата', kind: 'fixed' },
  { name: 'Запчасти', kind: 'variable' },
  { name: 'Инструмент и расходники', kind: 'variable' },
  { name: 'Реклама', kind: 'variable' },
  { name: 'Связь и интернет', kind: 'fixed' },
  { name: 'Прочее', kind: 'variable' },
];

const DEFAULT_SERVICES = [
  { name: 'Замена дисплея', defaultPrice: 60, category: 'Ремонт' },
  { name: 'Замена аккумулятора', defaultPrice: 30, category: 'Ремонт' },
  { name: 'Замена разъёма зарядки', defaultPrice: 35, category: 'Ремонт' },
  { name: 'Замена задней крышки', defaultPrice: 25, category: 'Ремонт' },
  { name: 'Чистка от пыли и влаги', defaultPrice: 25, category: 'Обслуживание' },
  { name: 'Установка защитного стекла', defaultPrice: 10, category: 'Дополнительно' },
  { name: 'Установка плёнки', defaultPrice: 5, category: 'Дополнительно' },
  { name: 'Диагностика', defaultPrice: 0, category: 'Диагностика' },
];

const DEFAULT_TEMPLATES = [
  {
    code: 'order_accepted',
    channel: 'sms',
    title: 'Заказ принят',
    body: 'Здравствуйте! Ваш {{device}} принят в мастерскую «{{workshop}}». Ориентировочно готовы до {{promisedAt}}.',
  },
  {
    code: 'order_ready',
    channel: 'sms',
    title: 'Заказ готов',
    body: 'Здравствуйте{{clientName}}! Ваш {{device}} готов к выдаче. Мастерская «{{workshop}}», {{address}}. Телефон: {{phone}}',
  },
  {
    code: 'order_delayed',
    channel: 'sms',
    title: 'Заказ задерживается',
    body: 'Здравствуйте! Ремонт {{device}} задерживается. Готовы сообщить сроки: {{phone}}',
  },
  {
    code: 'review_request',
    channel: 'sms',
    title: 'Просьба об отзыве',
    body: 'Спасибо за ремонт в мастерской «{{workshop}}»! Будем благодарны за отзыв.',
  },
];

/** Наполнить базу начальными данными. */
export async function seedDatabase(db: AppDatabase, workshop: WorkshopInfo): Promise<void> {
  // Реквизиты записываются только если их ещё нет: иначе каждый запуск
  // перезаписывал бы то, что мастер настроил в приложении или перенёс
  // из другой машины, пустыми значениями из .env.
  await db
    .insert(settings)
    .values({ key: 'workshop', value: workshop })
    .onConflictDoNothing({ target: settings.key })
    .run();

  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    const existing = await db
      .select({ id: expenseCategories.id })
      .from(expenseCategories)
      .where(eq(expenseCategories.name, category.name))
      .get();
    if (!existing) {
      await db.insert(expenseCategories).values(category).run();
    }
  }

  for (const service of DEFAULT_SERVICES) {
    const existing = await db
      .select({ id: catalogServices.id })
      .from(catalogServices)
      .where(eq(catalogServices.name, service.name))
      .get();
    if (!existing) {
      await db.insert(catalogServices).values(service).run();
    }
  }

  for (const template of DEFAULT_TEMPLATES) {
    const existing = await db
      .select({ id: notificationTemplates.id })
      .from(notificationTemplates)
      .where(eq(notificationTemplates.code, template.code))
      .get();
    if (!existing) {
      await db.insert(notificationTemplates).values(template).run();
    }
  }
}

/** Реквизиты мастерской из переменных окружения. */
function workshopFromEnv(): WorkshopInfo {
  return {
    name: process.env.WORKSHOP_NAME ?? 'Мастерская',
    owner: process.env.WORKSHOP_OWNER ?? '',
    unp: process.env.WORKSHOP_UNP ?? '',
    address: process.env.WORKSHOP_ADDRESS ?? '',
    phone: process.env.WORKSHOP_PHONE ?? '',
  };
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  loadEnv();
  const path = databasePath();
  const db = openDatabase(path);
  await seedDatabase(db, workshopFromEnv());
  console.log(`Начальные данные записаны: ${path}`);
}

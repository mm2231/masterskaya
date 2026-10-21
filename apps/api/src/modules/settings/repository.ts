/** Настройки: реквизиты мастерской, шаблоны нумерации, ключи счётчиков. */

import { eq } from 'drizzle-orm';
import { nowSql } from '@masterskaya/shared';

import type { AppDatabase } from '../../db.js';
import { settings } from '@masterskaya/db';

export interface WorkshopInfo {
  name: string;
  owner: string;
  unp: string;
  address: string;
  phone: string;
}

/** Прочитать настройку по ключу. */
export async function getSetting<T>(database: AppDatabase, key: string): Promise<T | null> {
  const row = await database.select().from(settings).where(eq(settings.key, key)).get();
  return (row?.value as T) ?? null;
}

/** Записать настройку. */
export async function setSetting(database: AppDatabase, key: string, value: unknown) {
  await database
    .insert(settings)
    .values({ key, value, updatedAt: nowSql() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: nowSql() },
    })
    .run();
}

/** Реквизиты мастерской — подставляются в акты. */
export async function getWorkshop(database: AppDatabase): Promise<WorkshopInfo> {
  const stored = await getSetting<WorkshopInfo>(database, 'workshop');
  if (stored) return stored;
  return {
    name: 'Мастерская',
    owner: '',
    unp: '',
    address: '',
    phone: '',
  };
}

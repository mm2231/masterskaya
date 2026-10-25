/** Транзакции: коммит и откат. */

import { count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { inTransaction, openDatabase } from './connection.js';
import { clients } from './schema.js';

type TestDatabase = ReturnType<typeof openDatabase>;

/** База в памяти с таблицей клиентов. */
function testDb(): TestDatabase {
  const database = openDatabase(':memory:');
  database.run(`
    create table clients (
      id integer primary key autoincrement,
      name text not null,
      phone text not null,
      email text,
      telegram text,
      viber text,
      note text,
      tags text not null default '[]',
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      archived_at text
    )
  `);
  database.run(
    `create unique index idx_clients_phone on clients (phone)`,
  );
  return database;
}

function clientsCount(database: TestDatabase): number {
  const row = database.select({ value: count() }).from(clients).get();
  return Number(row?.value ?? 0);
}

describe('inTransaction', () => {
  it('коммитит все записи при успехе', () => {
    const database = testDb();

    inTransaction(database, () => {
      database
        .insert(clients)
        .values({ name: 'Первый', phone: '+375291111111', tags: [] })
        .run();
      database
        .insert(clients)
        .values({ name: 'Второй', phone: '+375292222222', tags: [] })
        .run();
    });

    expect(clientsCount(database)).toBe(2);
  });

  it('откатывает всё при ошибке в середине', () => {
    const database = testDb();

    expect(() => {
      inTransaction(database, () => {
        database
          .insert(clients)
          .values({ name: 'Останется?', phone: '+375293333333', tags: [] })
          .run();
        throw new Error('Сломалось посередине');
      });
    }).toThrow('Сломалось посередине');

    // Ни клиент, ни части данных не должны остаться.
    expect(clientsCount(database)).toBe(0);
  });

  it('откатывает обе записи при нарушении уникальности второй', () => {
    const database = testDb();

    expect(() => {
      inTransaction(database, () => {
        database
          .insert(clients)
          .values({ name: 'Аня', phone: '+375294444444', tags: [] })
          .run();
        // Телефон уникален — вторая вставка ломает это.
        database
          .insert(clients)
          .values({ name: 'Дубль Ани', phone: '+375294444444', tags: [] })
          .run();
      });
    }).toThrow();

    expect(clientsCount(database)).toBe(0);
  });

  it('не трогает данные, записанные до транзакции', () => {
    const database = testDb();
    database
      .insert(clients)
      .values({ name: 'До транзакции', phone: '+375295555555', tags: [] })
      .run();

    inTransaction(database, () => {
      database
        .update(clients)
        .set({ name: 'Переименован' })
        .where(eq(clients.id, 1))
        .run();
    });

    expect(clientsCount(database)).toBe(1);
    const row = database.select().from(clients).get();
    expect(row?.name).toBe('Переименован');
  });
});

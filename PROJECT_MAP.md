# PROJECT_MAP.md — карта проекта «Мастерская»

> Актуально на коммит `2ec49d7` (ветка `main`).
> Документ для разработчика/агента: где что лежит, как считаются деньги,
> как менять схему и что нельзя ломать. Пользовательская инструкция — в `README.md`.

---

## 1. Что это

Локальная CRM для одной мастерской по ремонту телефонов:

- один мастер, один пароль, без ролей и филиалов;
- все данные — в локальном SQLite-файле;
- внешние интеграции (SMS, Telegram, поставщики) не подключены;
- приложение работает как локальный веб-сервер: Fastify раздаёт API и собранный React-фронт;
- запускается двойным щелчком по `Запустить мастерскую.command` / `.bat`.

Основной сценарий: **клиент → заказ → акты (приёмный / выполненных работ) → деньги (доходы/расходы)**.

---

## 2. Быстрые команды

Из корня репозитория:

| Команда | Что делает |
|---|---|
| `npm run build:packages` | собирает `packages/shared` и `packages/db` в `dist` |
| `npm run build` | packages + web + API (полная прод-сборка) |
| `npm test` | тесты всех воркспейсов (Vitest) |
| `npm run typecheck` | `tsc --noEmit` во всех воркспейсах |
| `npm run dev` | API в watch-режиме (`tsx watch`) |
| `npm run dev:web` | Vite-фронт на `:5173`, проксирует `/api` |
| `npm start` | запуск собранного API (`apps/api/dist/server.js`) |
| `npm run db:generate` | сгенерировать миграцию после правки `schema.ts` |
| `npm run db:migrate` | применить миграции вручную |
| `npm run db:seed` | начальные данные (реквизиты, категории, услуги) |
| `npm run db:reset` | сброс локальной БД (осторожно) |
| `npm run data:backup` | резервная копия БД |
| `npm run data:export` / `data:import` | JSON-выгрузка/загрузка данных |
| `npm run update:check` / `update:install` | проверка/установка обновлений из GitHub |
| `npm run launch` / `npm run stop` | запуск/остановка локального сервера |
| `npm run build:portable` | переносимый пакет (Windows) |

Требуется Node.js **>= 22.12**. Зависимости ставятся `npm install` (или `npm run setup`).

Полезно: после правок в `packages/shared` или `packages/db` **сначала** `npm run build:packages`, иначе API/Web увидят старые `dist`.

---

## 3. Стек и структура

- **API:** Fastify 5, Drizzle ORM, better-sqlite3, Zod, TypeScript.
- **Web:** React 18, Vite 5, React Router 6, TanStack Query 5.
- **БД:** SQLite (WAL), миграции Drizzle Kit.
- **Тесты:** Vitest.

```
masterskaya/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── server.ts          точка входа: env → миграции → seed → listen
│   │       ├── app.ts             сборка Fastify, регистрация маршрутов, статика
│   │       ├── auth.ts            вход по паролю, cookie-сессия
│   │       ├── env.ts             .env → типизированный Env (Zod)
│   │       ├── db.ts              singleton подключения к БД
│   │       ├── backup.ts          фоновые бэкапы через SQLite Backup API
│   │       ├── modules/           домены: clients, orders, documents,
│   │       │                      finance, tasks, notify, settings
│   │       └── legacy/            импорт из первой версии (topset.db)
│   └── web/
│       └── src/
│           ├── app/               App, Layout, тема
│           ├── pages/             экраны
│           ├── features/          формы/виджеты по доменам
│           ├── print/             печатные акты
│           └── lib/               api-клиент, форматирование, типы
├── packages/
│   ├── shared/                    общие контракты, статусы, деньги, даты,
│   │                              сумма прописью, условия актов
│   └── db/                        схема Drizzle, миграции, seed, соединение
├── scripts/                       установка, запуск, бэкапы, обновление,
│                                  портативная сборка
├── data/                          БД, бэкапы, логи, PID (в git не входит)
├── drizzle/                       НЕ здесь: миграции в packages/db/drizzle
└── .env                           локальные настройки (в git не входит)
```

### Границы ответственности

- `packages/shared` **не знает** о БД и HTTP: чистые функции, типы, Zod-схемы, статусы.
- `packages/db` знает только схему и подключение.
- `apps/api` — HTTP + репозитории + бизнес-правила.
- `apps/web` — только UI и вызовы `/api`; типы в `apps/web/src/lib/types.ts` дублируют серверные ответы вручную.

---

## 4. Конфигурация

Читается из `<repo>/.env` в `apps/api/src/env.ts` (Zod). Шаблон — `.env.example`.

| Переменная | По умолчанию | Смысл |
|---|---|---|
| `PORT` | `8080` | порт сервера (в текущей локальной копии может быть другой) |
| `HOST` | `0.0.0.0` | доступ по локальной сети; `127.0.0.1` — только этот ПК |
| `DEV` | `0` | `1` — режим разработки (подробный лог) |
| `DATABASE_PATH` | `data/workshop.db` | путь к SQLite относительно корня |
| `TIMEZONE_OFFSET_HOURS` | пусто | смещение зоны (`3` — Минск/Москва); пусто — время ОС |
| `BACKUP_DIR` | `data/backups` | папка бэкапов |
| `BACKUP_INTERVAL_HOURS` | `24` | период бэкапа |
| `BACKUP_KEEP` | `14` | сколько копий хранить |
| `WORKSHOP_*` | — | реквизиты для первого запуска (дальше берутся из БД) |
| `APP_PASSWORD` | пусто | пароль; пусто — вход без пароля |
| `SECRET_KEY` | — | подпись cookie-сессии; менять только осознанно |
| `ORDER_NUMBER_PATTERN` | `{YYYY}-{SEQ}` | шаблон номера заказа |
| `DOC_NUMBER_PATTERN` | `{YYYY}-{SEQ}` | шаблон номера акта |

Важно:

- `.env` и `data/*` **не коммитятся** (`.gitignore`).
- Порт может быть изменён в `.env`; dev-фронт по умолчанию проксирует на `127.0.0.1:8090`, переопределяется `VITE_API_TARGET`.
- `data/app.pid` пишется при старте, удаляется при остановке — по нему работают скрипты stop.
- Время в БД — **локальное время мастерской**, а не UTC. Поэтому все даты/время пишутся через `nowSql()` из `@masterskaya/shared`, а не через SQL-default `datetime('now')` (он даёт UTC).

---

## 5. База данных

Схема: `packages/db/src/schema.ts`. Миграции: `packages/db/drizzle/`.

### Таблицы

| Таблица | Назначение | Ключевое |
|---|---|---|
| `clients` | клиенты | `phone` уникален; `tags` — JSON-массив |
| `devices` | техника клиента | FK `client_id`, cascade |
| `orders` | заказы | уникальный `number`; денормализованные `client_name`, `client_phone` |
| `order_events` | журнал действий | `type`, `message`, JSON `payload` |
| `order_tasks` | задачи по заказу | `done`, `done_at`, `due_at` |
| `documents` | акты | `kind` = `acceptance` / `works`; JSON `snapshot` |
| `payments` | движения денег | `direction` = `in` / `out`; `cost` — расходники |
| `expense_categories` | категории расходов | `kind` = `fixed` / `variable` |
| `catalog_services` | справочник услуг | задел, UI почти не использует |
| `settings` | настройки | `key` → JSON `value` (реквизиты, шаблоны номеров) |
| `notification_templates` | шаблоны сообщений | задел под SMS |
| `notification_log` | журнал уведомлений | задел под SMS |
| `order_photos` | фото заказа | задел, маршрутов нет |

### Ключевые поля заказа

- `status` — один из кодов `packages/shared/src/statuses.ts`:
  `new`, `diagnostics`, `in_progress`, `waiting_parts`, `ready`, `issued`, `declined`, `warranty`.
- `client_total` — итоговая сумма для клиента (одна цифра).
- `cost_total` — себестоимость заказа (одна цифра, вводит мастер).
- `prepayment` — предоплата (`real`, default 0).
- `prepayment_at` — дата/время предоплаты; по ней она попадает в период.
- `accepted_at`, `ready_at`, `issued_at` — вехи; `issued_at` — дата выручки.
- `client_name` / `client_phone` — копии на момент заказа: заказ живёт, даже если клиента удалили.

### Ключевые поля платежа

- `direction` — `in` (доход) или `out` (расход).
- `amount` — сумма.
- `cost` — расходники ручного дохода (себестоимость проданного/вложенного).
- `order_id` — `NULL` для ручных доходов/расходов без заказа.
- `occurred_on` — дата операции (`YYYY-MM-DD`), по ней считается период.
- `category`, `note` — категория и комментарий.

### Особенности целостности

- Удаление клиента: `orders.client_id → SET NULL`; удаление заказа: события/задачи/документы/фото → `CASCADE`, платежи → `SET NULL`.
- `documents.snapshot` хранит снимок сумм/работ на момент печати — акт не меняется задним числом.
- `settings.value` — JSON, поэтому читать/писать только через `getSetting`/`setSetting`.

---

## 6. Деньги: единственные правильные формулы

Реализация: `packages/shared/src/finance.ts`, запросы: `apps/api/src/modules/finance/repository.ts`.

```
Выручка = Σ client_total по заказам, ВЫДАННЫМ в периоде (по issued_at)
        + предоплаты по НЕ выданным заказам, у которых prepayment_at в периоде
        + ручные доходы (payments.direction = 'in' AND order_id IS NULL)

Себестоимость = Σ cost_total по выданным заказам
              + расходники ручных доходов (Σ payments.cost, direction='in', order_id IS NULL)

Расходы = Σ payments.amount, direction='out', дата в периоде

Прибыль = Выручка − Себестоимость − Расходы
Маржа   = Прибыль / Выручка × 100
```

Правила, которые нельзя нарушать:

1. **Заказ попадает в выручку по `issued_at`**, а не по `created_at`.
2. При переводе в `issued`: `issued_at` ставится один раз. При возврате из `issued` — сбрасывается в `NULL` (деньги ещё не получены).
3. **Предоплата считается сразу**, пока заказ не выдан. После выдачи она входит в `client_total` и отдельно не суммируется — двойного счёта нет.
4. Ручной доход — только `order_id IS NULL`. Платёж, привязанный к заказу, не должен попадать в «прочие доходы».
5. `payments.cost` учитывается только у доходов (`direction='in'`); у расходов он принудительно 0.
6. Прибыль по одному заказу = `client_total − cost_total`; маржа — от `client_total`.
7. Долг по заказу в UI = `client_total − (предоплата + Σ приходов по заказу)`, не меньше 0.
8. Деньги форматируются только через `formatMoney` / `formatRubInt` (`packages/shared/src/money.ts`).

### Поведение предоплаты при выдаче в другом месяце

Текущее решение: предоплата не выданного заказа учитывается в периоде по `prepayment_at`; после выдачи заказ целиком попадает в период `issued_at`. Поэтому при выдаче в следующем месяце отчёт прошлого месяца уменьшится на сумму предоплаты. Это осознанный компромисс простой модели; менять формулу — только вместе с тестами `finance.test.ts` и API-тестами.

---

## 7. API

Префикс — `/api`. Формат — JSON. Ошибки: `{ "error": "текст" }`, у валидации — `{ error, details }`.

### Аутентификация

- Если `APP_PASSWORD` задан: `POST /api/login { password }` → cookie `workshop_session` (HttpOnly, 30 дней).
- `POST /api/logout`, `GET /api/session`.
- Все остальные `/api/*` требуют валидную подпись cookie. Если пароль пуст — доступ открыт.
- Подпись: HMAC-SHA256 от срока действия; `SECRET_KEY` обязателен для стабильных сессий.

### Маршруты

| Метод и путь | Назначение |
|---|---|
| `GET /api/health` | живость и версия |
| `GET/POST /api/clients` | список/создание клиентов |
| `GET /api/clients/suggest`, `/phones` | подсказки |
| `GET/PATCH/DELETE /api/clients/:id` | карточка клиента |
| `GET /api/orders` | список: `q`, `status`, `statuses`, `clientId`, `from`, `to`, `sort`, `limit`, `offset` |
| `GET /api/orders/counts` | счётчики по статусам |
| `GET /api/orders/by-phone` | прошлые заказы по телефону |
| `GET /api/orders/:id` | карточка + история + `allowedTransitions` |
| `POST /api/orders` | создание заказа (см. ниже) |
| `PATCH /api/orders/:id` | правка, статус, предоплата |
| `DELETE /api/orders/:id` | удаление |
| `POST /api/orders/:id/notes` | заметка в журнал |
| `GET /api/documents` | реестр актов |
| `GET /api/documents/:id` | документ |
| `GET /api/documents/:id/preview/:kind` | данные для печати (`acceptance`/`works`) |
| `POST /api/documents` | зафиксировать печать акта |
| `DELETE /api/documents/:id` | удалить акт |
| `GET /api/finance/summary` | сводка за период (`from`, `to`; по умолчанию текущий месяц) |
| `GET /api/finance/today` | сводка за сегодня + выданные заказы + движения |
| `GET /api/finance/payments` | журнал движений |
| `POST /api/finance/payments` | добавить доход/расход |
| `PATCH/DELETE /api/finance/payments/:id` | правка/удаление |
| `GET /api/finance/orders/:id/debt` | оплачено по заказу |
| `GET/POST /api/finance/categories` | категории расходов |
| `GET /api/finance/export` | CSV для Excel (BOM, `;`) |
| `GET /api/tasks`, `/counts`, `/:id` | задачи |
| `POST /api/tasks`, `PATCH/DELETE /api/tasks/:id` | CRUD задач |
| `GET /api/notify/ready/:id` | текст сообщения «заказ готов» |
| `GET/PUT /api/settings/workshop` | реквизиты |
| `GET/PUT /api/settings/numbering` | шаблоны номеров |
| `GET /api/settings/export` | JSON всех данных |
| `POST /api/settings/import` | импорт JSON |
| `GET /api/settings/diagnostics` | состояние приложения/БД/сборки |
| `GET/POST /api/settings/update` | проверка/установка обновления |

### Критичные контракты

**Создание заказа** `POST /api/orders`

```json
{
  "clientName": "Иван",
  "clientPhone": "+375291234567",
  "deviceLabel": "iPhone 13",
  "fault": "Разбит экран",
  "workDescription": "Замена дисплея",
  "clientTotal": 100,
  "costTotal": 40,
  "prepayment": 30,
  "status": "new"
}
```

- Клиент создаётся/находится по телефону автоматически (справочник наполняется сам).
- `prepayment > 0` → `prepayment_at = nowSql()`.
- Клиент, заказ и событие `created` пишутся одной транзакцией.

**Правка заказа** `PATCH /api/orders/:id`

- Разрешённые переходы статусов — `canTransition` из `shared/statuses.ts`; недопустимый → 400.
- `issued` ставит `issued_at`; уход из `issued` сбрасывает его.
- Смена `prepayment`: при появлении датируем `prepayment_at`, при 0 — `NULL`; событие `prepayment_changed`.
- Смена суммы/себестоимости/клиента — события `total_changed`, `cost_changed`, `client_changed`.
- `updateClientName: true` обновляет имя во всех заказах клиента.

**Сводка** `GET /api/finance/summary` → `{ from, to, summary, expensesByCategory }`, где

```ts
summary = {
  ordersCount, issuedCount, revenue, cost, profit, margin, averageCheck,
  manualIncome, manualCost, prepayments, expenses
}
```

**Платёж** `POST /api/finance/payments`

```json
{ "direction": "in", "amount": 130, "cost": 50, "method": "cash",
  "occurredOn": "2026-10-25", "note": "Продажа восстановленного телефона" }
```

- `cost` принимается только для `direction: "in"`.
- Платёж + событие `payment` (если есть `orderId`) — одна транзакция.

**Печать акта** `GET /api/documents/:id/preview/:kind` → `totals`:

```ts
{
  clientTotal, prepayment, toPay, costTotal,
  profit, margin,
  words  // сумма прописью для toPay
}
```

**Импорт/экспорт** `GET/POST /api/settings/*`: весь импорт — одна транзакция; клиенты сверяются по телефону, заказы — по номеру, платежи — по заказу+дате+сумме+направлению. Новые поля (`prepayment`, `prepaymentAt`, `cost`) должны переноситься в `settings/export.ts`.

---

## 8. Frontend

Маршруты (`apps/web/src/app/App.tsx`):

| Путь | Компонент | Что показывает |
|---|---|---|
| `/` | `DashboardPage` | KPI, «Сегодня», этапы, задачи |
| `/orders` | `OrdersPage` | список/фильтры/создание |
| `/orders/:id` | `OrderCardPage` | карточка, вкладки: заказ, история, акты, деньги, задачи |
| `/orders/:id/print/:kind` | `PrintDocument` | печатный бланк без оболочки |
| `/tasks` | `TasksPage` | задачи |
| `/documents` | `DocumentsPage` | реестр актов |
| `/finance` | `FinancePage` | сводка, форма дохода/расхода, журнал |
| `/settings` | `SettingsPage` | реквизиты, нумерация, диагностика, обновление |

Ключевые компоненты:

- `features/orders/NewOrderModal.tsx` — приём заказа, поля суммы/себестоимости/предоплаты.
- `features/orders/OrderTab.tsx` — правка заказа; предоплата + «К доплате».
- `pages/OrderCardPage.tsx` — KPI (в т.ч. предоплата в «Оплачено»), вкладка «Деньги».
- `features/finance/PaymentForm.tsx` — доход/расход; поле «Расходники» только для дохода.
- `features/finance/EditPaymentModal.tsx` — правка записи, в т.ч. расходники.
- `pages/FinancePage.tsx` — KPI, таблица с «Расходники»/«Прибыль», CSV.
- `features/finance/TodayPanel.tsx` — сводка дня с предоплатами/ручными доходами.

Правила:

- Запросы — только через `lib/api.ts`; ошибки — `ApiError`.
- Query keys и инвалидации: `orders`, `order-counts`, `order`, `finance-summary`, `finance-payments`, `finance-today`, `expense-categories`, `tasks`.
- При добавлении поля в ответ API **обязательно** обновить `apps/web/src/lib/types.ts` — это ручная копия контракта.
- Суммы вводить можно с запятой; перед отправкой `Number(value.replace(',', '.'))`.
- Все денежные подписи — `formatMoney` (`lib/format.ts`), не собственная локализация.

---

## 9. Печать актов

Файлы: `apps/web/src/print/PrintDocument.tsx`, `ActBody.tsx`, `PrintTerms.tsx`, стили `print.css`.

- `PrintDocument` запрашивает `/api/documents/:id/preview/:kind`.
- Приёмный акт печатается **в двух экземплярах** на одном A4: «Заказчику» и «Мастерской», между ними линия разреза.
- Акт работ — один экземпляр.
- Блок условий (`REPAIR_TERMS`) лежит в `packages/shared/src/terms.ts` и печатается в обоих актах.
- Если `prepayment > 0`, в акте печатаются:
  - «Внесена предоплата»;
  - «К доплате при выдаче»;
  - сумма прописью — **на остаток** (`toPay`), а не на всю стоимость.
- PDF не генерируется на сервере: браузерный диалог «Печать → Сохранить как PDF».
- `documents.snapshot` фиксирует суммы/работы на момент создания документа.

---

## 10. Транзакции и особенности Drizzle + better-sqlite3

- Драйвер **синхронный**. `db().select()...get()` / `.all()` возвращают значение сразу; `await` не нужен (но и не вредит в async-функциях).
- Для нескольких записей используется `inTransaction(db(), () => { ... })` из `@masterskaya/db`:
  - вручную `BEGIN` / `COMMIT` / `ROLLBACK` на `$client`;
  - **колбэк обязан быть синхронным** — внутри нельзя `await`;
  - тип внутри — тот же `AppDatabase`, репозитории не знают о транзакции.
- Синхронный builder не итерируется: после `.returning()` нужен `.all()`.
- `db.transaction()` типизирован иначе (нет `$client`), поэтому в проекте не используется.
- В синхронных репозиториях (`createOrder`, `updateOrder`, `logEvent`, `createClient`, `findOrCreateClient`, `createDocument`, `createPayment`) нельзя возвращать `Promise`.
- Время задаётся явно `nowSql()`: SQL-default `datetime('now')` — UTC, а приложение живёт в зоне мастерской.

---

## 11. Миграции: как менять схему

Правило: **схема и миграции — единственный источник правды о структуре БД**.

Порядок:

1. Изменить `packages/db/src/schema.ts`.
2. `npm run db:generate` (из корня) — появится `packages/db/drizzle/000N_*.sql` + снапшот в `meta/`.
3. Проверить SQL: для существующих таблиц должны быть безопасные `ALTER TABLE ... ADD ... DEFAULT ...`.
4. Закоммитить **и SQL, и `meta/_journal.json`, и `meta/000N_snapshot.json`**.
5. Перезапустить приложение — `applyMigrations()` в `server.ts` применит миграции автоматически.
6. `npm run build:packages` — обновить `dist` для API/Web.

Запрещено:

- удалять/редактировать старые файлы миграций и снапшоты;
- менять схему «руками в БД» без миграции;
- рассчитывать, что миграция применится без перезапуска сервера.

Текущие миграции:

| Файл | Что делает |
|---|---|
| `0000_acoustic_starfox.sql` | начальная схема |
| `0001_tidy_red_ghost.sql` | правки первой итерации |
| `0002_elite_human_fly.sql` | `orders.prepayment`, `orders.prepayment_at`, `payments.cost` |

---

## 12. Тесты и проверка перед коммитом

```bash
npm run build:packages
npm run typecheck
npm test
npm run build
```

Ожидаемо: **111 тестов** — 4 (`packages/db`), 50 (`packages/shared`), 57 (`apps/api`).

Где что:

- `packages/db/src/connection.test.ts` — коммит/откат `inTransaction`, уникальность.
- `packages/shared/src/*.test.ts` — деньги, даты, слова, статусы, задачи, условия.
- `apps/api/src/__tests__/api.test.ts` — сквозные API-тесты на временной БД: заказы, клиенты, документы, финансы, предоплата, расходники, задачи, CSV.
- `apps/api/src/__tests__/scripts.test.ts` — служебные скрипты/обновление.

API-тесты используют `buildApp()` + `app.inject()` и `mkdtemp` — рабочие данные не трогают. Тесты в файле идут последовательно и делят одну БД, поэтому финансовые проверки часто строятся на «до/после».

Минимальный чек-лист для изменений денег/схемы:

- [ ] миграция сгенерирована и закоммичена;
- [ ] `build:packages`;
- [ ] обновлены `packages/shared/src/finance.ts` и его тесты;
- [ ] обновлены запросы `finance/repository.ts`;
- [ ] обновлены `apps/api/src/modules/settings/export.ts` (импорт/экспорт);
- [ ] обновлены `apps/web/src/lib/types.ts` и UI;
- [ ] обновлены акты, если поле влияет на печать;
- [ ] `typecheck`, `test`, `build`.

---

## 13. Git и GitHub

- Remote: `origin → https://github.com/mm2231/masterskaya`.
- Ветка по умолчанию — `main`; именно её видно на главной GitHub.
- Исторические рабочие ветки: `refactor/critical-fixes`, `feature/prepayment-revenue`.
- Коммиты — на русском, с префиксом (`fix:`, `feat:`, `refactor:`, `test:`, `docs:`).
- Автор коммита может быть не настроен глобально — git пишет предупреждение, но коммит проходит.
- Обновление приложения: `scripts/apply-update.mjs` делает `git pull --ff-only` → `npm ci` → сборку → перезапуск. История не переписывается.

---

## 14. Бэкапы, экспорт, импорт, обновление

- **Бэкап БД:** `apps/api/src/backup.ts`, SQLite Online Backup API (`sqlite.backup(target)`), не `copyFileSync` — иначе на WAL-базе теряются последние транзакции. Запуск при старте и раз в `BACKUP_INTERVAL_HOURS`.
- **JSON-экспорт/импорт:** `settings/export.ts`; импорт одной транзакцией.
- **Диагностика:** `/api/settings/diagnostics` — версия, время сборки, состояние БД, хвост лога.
- **Обновление:** UI «Настройки» → проверка/установка; сервер запускает скрипт отдельным процессом и перезапускается.
- **Логи:** `data/app.log`, `data/update.log`.

---

## 15. Известные особенности и техдолг

1. **Нумерация заказов** — `count(*) + 1` (`orders/numbering.ts`). При одновременном создании двух заказов возможен пропуск/конфликт; unique-индекс защищает БД, но номер может не выдаться. Правильное решение — отдельный счётчик в `settings` или `MAX(sequence)+1` в транзакции.
2. **Предоплата и смена периода** — см. раздел 6: при выдаче в другом месяце отчёт прошлого месяца пересчитывается. Если пользователь попросит «зафиксировать предоплату в месяце получения», нужно менять формулу (предоплата всегда + остаток при выдаче).
3. **API не проверяет `prepayment <= clientTotal`** — это делает только UI. Для внешних клиентов стоит добавить серверную валидацию.
4. **`updatePayment` остаётся async**, `createPayment` — sync; это не ошибка, но при добавлении транзакций помнить о синхронности колбэка.
5. **`order_photos`, `catalog_services`, `notification_*`, `documents.pdf_path`** — задел, маршрутов/UI может не быть. Не удалять без проверки.
6. **`apps/api/src/legacy/`** — импорт из первой версии. Удалять только если пользователь подтвердил, что перенос данных завершён.
7. **`dist/` не коммитится** — после изменений нужна сборка; приложение запускается из `dist`.
8. **`data/` и `.env` не коммитятся** — не пытаться «починить» это.
9. **Список заказов и карточка — разные выборки.** При добавлении поля в `orders` его нужно добавить и в `listOrders` (`OrderListItem`), и в карточку (`getOrderWithClient` использует `select()` целиком).
10. **`getOrderWithClient` и `listOrders`** возвращают денормализованные `clientName/clientPhone`; синхронизация имени — только через `updateClientName: true`.

---

## 16. Рецепты типовых задач

### Добавить поле в заказ (пример: скидка)

1. `packages/db/src/schema.ts` — колонка.
2. `npm run db:generate` → проверить SQL → закоммитить миграцию.
3. `packages/shared/src/schemas.ts` — поле в `orderInputSchema` (PATCH получит автоматически через `.partial()`).
4. `apps/api/src/modules/orders/repository.ts` — `createOrder`, `OrderListItem`, `listOrders`.
5. `apps/api/src/modules/orders/routes.ts` — если нужна серверная логика/событие.
6. `apps/api/src/modules/documents/routes.ts` — если поле влияет на акт (и `snapshot`).
7. `apps/api/src/modules/settings/export.ts` — импорт/экспорт.
8. `apps/web/src/lib/types.ts`, формы, карточка, печать.
9. Тесты: shared (формула), API (создание/правка/печать), UI-типы.
10. `build:packages` → `typecheck` → `test` → `build`.

### Добавить поле в платёж

Аналогично, плюс:
- `paymentInputSchema` / `paymentPatchSchema`;
- `finance/repository.ts` — `listPayments`, `paymentsOnDay`, `createPayment`, `updatePayment`;
- `finance/routes.ts` — POST/PATCH и CSV;
- `PaymentForm`, `EditPaymentModal`, `FinancePage`, `TodayPanel`, `types.ts`;
- проверить, что поле не попадает в расходы, если оно только для доходов.

### Изменить формулу денег

1. `packages/shared/src/finance.ts` — единственный источник формулы + `finance.test.ts`.
2. `apps/api/src/modules/finance/repository.ts` — запросы, которые поставляют данные.
3. `apps/api/src/modules/finance/routes.ts` — summary/today/CSV.
4. Тесты API на сценарии «до/после».
5. Проверить UI-подписи, чтобы они не врали (например, «Себестоимость» = заказы + расходники).

---

## 17. Если что-то не работает

| Симптом | Причина/действие |
|---|---|
| `Cannot find module '@masterskaya/shared'` | не собран `packages/shared` → `npm run build:packages` |
| TypeScript: `Property '$client' is missing` | использован `db.transaction()` вместо `inTransaction()` |
| `Type ... must have '[Symbol.iterator]'` | синхронный Drizzle: после `.returning()` нужен `.all()` |
| Миграция не применилась | сервер не перезапускали; `npm run db:migrate` |
| Фронт старый | `npm run build`; в диагностике смотреть `build.stale` |
| Порт занят | изменить `PORT` в `.env` и перезапустить |
| Время в актах/сводках съехало | `TIMEZONE_OFFSET_HOURS`; все записи — через `nowSql()` |
| Бэкап пустой/неполный | использовать SQLite Backup API, не `copyFileSync` |
| Тесты падают на данных | тесты используют временную БД; проверить, не перепутана ли последовательность «до/после» |
| Обновление не установилось | `data/update.log`, затем `npm run update:install` вручную |

---

## 18. Статус на момент последнего обновления карты

- Рефакторинг критичных мест завершён: SQL-инъекция в диагностике, бэкап через API, дедупликация `normalizePhone`, транзакции.
- Добавлены: предоплата (`orders.prepayment`, `orders.prepayment_at`) и расходники ручного дохода (`payments.cost`).
- Миграция `0002` применена/применяется автоматически.
- `main` запушен на GitHub, рабочее дерево чистое.
- Тесты: 111 зелёных, typecheck и прод-сборка проходят.

При следующих изменениях сначала читать этот файл, затем `README.md`, затем код соответствующих модулей.

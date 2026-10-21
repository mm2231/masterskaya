/** HTTP-маршруты задач: /api/tasks… */

import {
  isDueToday,
  isOverdue,
  normalizeDueAt,
  nowSql,
  overdueDays,
  taskInputSchema,
  taskPatchSchema,
  todayDate,
} from '@masterskaya/shared';
import type { FastifyInstance } from 'fastify';

import { db } from '../../db.js';
import { getOrder } from '../orders/repository.js';
import {
  countAll,
  countByOrder,
  countDueToday,
  countOverdue,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from './repository.js';

/** Обогатить задачу признаками «просрочено» и «на сегодня». */
function withFlags(task: {
  dueAt: string | null;
  done: boolean;
  overdue?: boolean;
  isToday?: boolean;
  overdueDays?: number;
}) {
  const now = nowSql();
  return {
    ...task,
    overdue: !task.done && isOverdue(task.dueAt, now),
    isToday: !task.done && isDueToday(task.dueAt, todayDate()),
    overdueDays: overdueDays(task.dueAt),
  };
}

export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Список задач.
   *
   * scope=open (по умолчанию) — невыполненные;
   * scope=done — выполненные;
   * orderId=N — только по заказу.
   */
  app.get('/api/tasks', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const tasks = await listTasks(db(), {
      scope: query.scope,
      orderId: query.orderId ? Number(query.orderId) : undefined,
    });
    return {
      items: tasks.map((task) => withFlags(task)),
      counts: {
        overdue: await countOverdue(db(), nowSql()),
        today: await countDueToday(db(), todayDate()),
      },
    };
  });

  /** Создать задачу по заказу. */
  app.post('/api/tasks', async (request, reply) => {
    const parsed = taskInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Проверьте данные', details: parsed.error.issues });
    }
    const data = parsed.data;

    const order = await getOrder(db(), data.orderId);
    if (!order) {
      return reply.code(404).send({ error: 'Заказ не найден' });
    }

    const created = await createTask(db(), {
      orderId: data.orderId,
      title: data.title,
      dueAt: normalizeDueAt(data.dueAt),
    });
    // Возвращаем задачу с контекстом заказа — как и в списке.
    const task = await getTask(db(), created.id);
    return reply.code(201).send({ task: withFlags(task!) });
  });

  /** Счётчики задач — для значка в меню. Регистрируем до /:id. */
  app.get('/api/tasks/counts', async () => {
    const totals = await countAll(db());
    return {
      overdue: await countOverdue(db(), nowSql()),
      today: await countDueToday(db(), todayDate()),
      open: totals.open,
      done: totals.done,
    };
  });

  /** Задача по id. */
  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const task = await getTask(db(), id);
    if (!task) {
      return reply.code(404).send({ error: 'Задача не найдена' });
    }
    return { task: withFlags(task) };
  });

  /** Изменить задачу: текст, срок, отметка выполнения. */
  app.patch<{ Params: { id: string } }>('/api/tasks/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const parsed = taskPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Проверьте данные', details: parsed.error.issues });
    }
    const data = parsed.data;

    const current = await getTask(db(), id);
    if (!current) {
      return reply.code(404).send({ error: 'Задача не найдена' });
    }

    const changes: Record<string, unknown> = {};
    if (data.title !== undefined) changes.title = data.title;
    if (data.dueAt !== undefined) changes.dueAt = normalizeDueAt(data.dueAt);
    if (data.done !== undefined) {
      changes.done = data.done;
      // Выполненную задачу помечаем временем; снятую с выполнения — снимаем.
      changes.doneAt = data.done ? nowSql() : null;
    }

    const task = await updateTask(db(), id, changes);
    if (!task) {
      return reply.code(404).send({ error: 'Задача не найдена' });
    }
    const full = await getTask(db(), id);
    return { task: withFlags(full ?? task) };
  });

  /** Удалить задачу. */
  app.delete<{ Params: { id: string } }>('/api/tasks/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const ok = await deleteTask(db(), id);
    if (!ok) {
      return reply.code(404).send({ error: 'Задача не найдена' });
    }
    return { ok: true };
  });
}

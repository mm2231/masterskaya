/** Раздел «Задачи»: все открытые задачи по заказам. */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '../components/EmptyState';
import { api } from '../lib/api';
import type { TaskCounts, TaskListResponse } from '../lib/types';
import { TaskList } from '../features/tasks/TaskList';
import { NewTaskModal } from '../features/tasks/NewTaskModal';

export function TasksPage() {
  const [scope, setScope] = useState<'open' | 'done'>('open');
  const [newOpen, setNewOpen] = useState(false);

  const tasks = useQuery({
    queryKey: ['tasks', scope],
    queryFn: () => api.get<TaskListResponse>(`/api/tasks?scope=${scope}`),
    refetchInterval: 60_000,
  });

  const taskCounts = useQuery({
    queryKey: ['task-counts'],
    queryFn: () => api.get<TaskCounts>('/api/tasks/counts'),
    refetchInterval: 60_000,
  });

  const items = tasks.data?.items ?? [];

  return (
    <>
      <div className="page-head">
        <h1>Задачи</h1>
        <button type="button" className="btn primary" onClick={() => setNewOpen(true)}>
          ＋ Новая задача
        </button>
      </div>

      <div className="chips">
        <button
          type="button"
          className={`chip ${scope === 'open' ? 'active' : ''}`}
          onClick={() => setScope('open')}
        >
          Открытые ({scope === 'open' ? items.length : taskCounts?.data?.open ?? 0})
        </button>
        <button
          type="button"
          className={`chip ${scope === 'done' ? 'active' : ''}`}
          onClick={() => setScope('done')}
        >
          Выполненные ({scope === 'done' ? items.length : taskCounts?.data?.done ?? 0})
        </button>
      </div>

      {scope === 'open' && (tasks.data?.counts.overdue ?? 0) > 0 ? (
        <div className="task-alert">
          ⚠️ Просроченных задач: {tasks.data?.counts.overdue} — их срок уже прошёл
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-body">
          {items.length === 0 ? (
            <EmptyState
              icon="✅"
              title={scope === 'open' ? 'Открытых задач нет' : 'Выполненных задач нет'}
              hint="Задачи создаются в карточке заказа или кнопкой «＋ Новая задача»"
            />
          ) : (
            <TaskList tasks={items} />
          )}
        </div>
      </section>

      {newOpen ? <NewTaskModal onClose={() => setNewOpen(false)} /> : null}
    </>
  );
}

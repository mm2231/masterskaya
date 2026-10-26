/**
 * Виджет «Что сделать сегодня» на дашборде.
 *
 * Показывает открытые задачи, разбитые на просроченные, сегодняшние и будущие.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '../../components/EmptyState';
import { api } from '../../lib/api';
import type { TaskListResponse } from '../../lib/types';
import { TaskList } from './TaskList';
import { NewTaskModal } from './NewTaskModal';

export function TaskWidget() {
  const [newOpen, setNewOpen] = useState(false);
  const [showLater, setShowLater] = useState(false);

  const tasks = useQuery({
    queryKey: ['tasks', 'open'],
    queryFn: () => api.get<TaskListResponse>('/api/tasks?scope=open'),
    refetchInterval: 60_000,
  });

  const all = tasks.data?.items ?? [];
  const overdue = all.filter((task) => task.overdue);
  const today = all.filter((task) => !task.overdue && task.isToday);
  const later = all.filter((task) => !task.overdue && !task.isToday);

  return (
    <section className="panel">
      <div className="panel-head">
        <span>Что сделать сегодня</span>
        <span className="panel-head-note">
          просрочено: {tasks.data?.counts.overdue ?? 0} · на сегодня:{' '}
          {tasks.data?.counts.today ?? 0}
        </span>
        <button type="button" className="btn sm" onClick={() => setNewOpen(true)}>
          ＋ Задача
        </button>
      </div>

      <div className="panel-body">
        {all.length === 0 ? (
          <EmptyState
            icon="✅"
            title="Задач нет — всё сделано"
            hint="Задачи создаются в карточке заказа или кнопкой «＋ Задача»"
          />
        ) : (
          <>
            {overdue.length > 0 ? (
              <div className="task-group">
                <div className="task-group-title overdue">Просроченные</div>
                <TaskList tasks={overdue} />
              </div>
            ) : null}

            {today.length > 0 ? (
              <div className="task-group">
                <div className="task-group-title">На сегодня</div>
                <TaskList tasks={today} />
              </div>
            ) : null}

            {later.length > 0 ? (
              <div className="task-group">
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setShowLater((value) => !value)}
                >
                  {showLater ? '▾' : '▸'} Позже: {later.length}
                </button>
                {showLater ? <TaskList tasks={later} /> : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {newOpen ? <NewTaskModal onClose={() => setNewOpen(false)} /> : null}
    </section>
  );
}

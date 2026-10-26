/**
 * Список задач: чекбокс, текст, заказ-ссылка и срок.
 *
 * Используется и на дашборде, и в карточке заказа.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { describeDue } from '@masterskaya/shared';
import { Link } from 'react-router-dom';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { formatPhone } from '../../lib/format';
import type { Task } from '../../lib/types';
import { EditTaskModal } from './EditTaskModal';

export function TaskList({
  tasks,
  showOrder = true,
}: {
  tasks: Task[];
  /** Показывать колонку с заказом (в карточке заказа — не нужна). */
  showOrder?: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  // Задача, которую сейчас редактируем (null — модалка закрыта).
  const [editing, setEditing] = useState<Task | null>(null);

  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      api.patch(`/api/tasks/${id}`, { done }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['task-counts'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/tasks/${id}`),
    onSuccess: () => {
      toast.show('Задача удалена', 'success');
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['task-counts'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  return (
    <>
      <div className="task-list">
      {tasks.map((task) => {
        const order = task.order;
        const phone = order?.clientPhone;
        return (
          <div
            key={task.id}
            className={`task-item ${task.overdue ? 'overdue' : ''} ${task.done ? 'done' : ''}`}
          >
            <input
              type="checkbox"
              checked={task.done}
              onChange={(event) => toggle.mutate({ id: task.id, done: event.target.checked })}
              aria-label={task.done ? `Снять отметку: ${task.title}` : `Отметить выполненной: ${task.title}`}
              title={task.done ? 'Снять отметку' : 'Задача выполнена'}
            />

            <div className="task-body">
              <button
                type="button"
                className="task-title task-title-editable"
                onClick={() => setEditing(task)}
                title="Изменить задачу"
              >
                {task.title}
              </button>
              {showOrder && order ? (
                <div className="task-meta">
                  <Link className="row-link" to={`/orders/${order.id}`}>
                    №{order.number}
                  </Link>
                  {order.deviceLabel ? <span> · {order.deviceLabel}</span> : null}
                  {order.clientName ? <span> · {order.clientName}</span> : null}
                </div>
              ) : null}
            </div>

            <div className="task-side">
              <span className={`task-due ${task.overdue ? 'overdue' : ''}`}>
                {describeDue(task.dueAt)}
              </span>
              <div className="task-actions">
                {phone ? (
                  <a
                    className="btn sm ghost"
                    href={`tel:${phone}`}
                    title="Позвонить клиенту"
                    aria-label="Позвонить клиенту"
                  >
                    ☎
                  </a>
                ) : null}
                {showOrder && order ? (
                  <Link
                    className="btn sm ghost"
                    to={`/orders/${order.id}`}
                    title="Открыть заказ"
                    aria-label="Открыть заказ"
                  >
                    →
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => setEditing(task)}
                  title="Изменить задачу"
                  aria-label="Изменить задачу"
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="btn sm ghost danger"
                  onClick={() => {
                    if (window.confirm('Удалить задачу?')) remove.mutate(task.id);
                  }}
                  title="Удалить задачу"
                  aria-label={`Удалить задачу: ${task.title}`}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {editing ? <EditTaskModal task={editing} onClose={() => setEditing(null)} /> : null}
      </div>
    </>
  );
}

/**
 * Список задач: чекбокс, текст, заказ-ссылка и срок.
 *
 * Используется и на дашборде, и в карточке заказа.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { describeDue } from '@masterskaya/shared';
import { Link } from 'react-router-dom';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { formatPhone } from '../../lib/format';
import type { Task } from '../../lib/types';

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
              title={task.done ? 'Снять отметку' : 'Задача выполнена'}
            />

            <div className="task-body">
              <div className="task-title">{task.title}</div>
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
                  <a className="btn sm" href={`tel:${phone}`} title="Позвонить клиенту">
                    📞
                  </a>
                ) : null}
                {showOrder && order ? (
                  <Link className="btn sm" to={`/orders/${order.id}`} title="Открыть заказ">
                    →
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn sm danger"
                  onClick={() => {
                    if (window.confirm('Удалить задачу?')) remove.mutate(task.id);
                  }}
                  title="Удалить задачу"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Редактирование задачи: текст и срок.
 *
 * Срок хранится в базе как «YYYY-MM-DD HH:MM:SS», здесь разбираем его на
 * дату и время, а при сохранении собираем обратно.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TASK_TEMPLATES } from '@masterskaya/shared';

import { api } from '../../lib/api';
import type { Task } from '../../lib/types';

/** Разделить срок из базы на дату и время для полей формы. */
function splitDue(dueAt: string | null): { due: string; time: string } {
  if (!dueAt) return { due: '', time: '' };
  return {
    due: dueAt.slice(0, 10),
    time: dueAt.length >= 16 ? dueAt.slice(11, 16) : '',
  };
}

export function EditTaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);
  const initial = splitDue(task.dueAt);
  const [due, setDue] = useState(initial.due);
  const [time, setTime] = useState(initial.time);
  const [titleError, setTitleError] = useState('');

  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch(`/api/tasks/${task.id}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['task-counts'] });
      void queryClient.invalidateQueries({ queryKey: ['order', task.orderId] });
      onClose();
    },
    onError: (error: Error) => setTitleError(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError('Напишите, что нужно сделать — обязательное поле');
      return;
    }
    setTitleError('');
    // Пустой срок — задача без срока; иначе дата и время вместе.
    const dueAt = due ? (time ? `${due}T${time}` : due) : '';
    save.mutate({ title: title.trim(), dueAt });
  };

  // Esc закрывает модалку, как диалог.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-title"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head" id="edit-task-title">
          Изменить задачу
        </div>
        <div className="modal-body">
          {task.order ? (
            <div className="field">
              <span className="field-label">Заказ</span>
              <input
                readOnly
                value={`№${task.order.number}${
                  task.order.deviceLabel ? ` · ${task.order.deviceLabel}` : ''
                }`}
              />
            </div>
          ) : null}

          <label className="field">
            <span className="field-label">
              Что нужно сделать <span className="req">*</span>
            </span>
            <input
              autoFocus
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (titleError) setTitleError('');
              }}
              placeholder="Позвонить клиенту"
              aria-required="true"
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? 'edit-task-title-error' : undefined}
            />
            {titleError ? (
              <span className="error" id="edit-task-title-error">
                {titleError}
              </span>
            ) : null}
          </label>

          <div className="chips">
            {TASK_TEMPLATES.map((template) => (
              <button
                key={template.title}
                type="button"
                className={`chip ${title === template.title ? 'active' : ''}`}
                onClick={() => setTitle(template.title)}
              >
                {template.title}
              </button>
            ))}
          </div>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">
                Срок
                {task.dueAt ? (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setDue('');
                      setTime('');
                    }}
                  >
                    убрать
                  </button>
                ) : null}
              </span>
              <input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Время (необязательно)</span>
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={save.isPending}
            aria-busy={save.isPending || undefined}
          >
            {save.isPending ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}

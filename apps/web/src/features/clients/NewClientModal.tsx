/** Создание клиента вручную. */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import type { Client } from '../../lib/types';

export function NewClientModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  const toast = useToast();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<{ client: Client }>('/api/clients', payload),
    onSuccess: () => {
      toast.show('Клиент добавлен', 'success');
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.show('Укажите имя и телефон', 'error');
      return;
    }
    create.mutate({ name: name.trim(), phone: phone.trim(), note: note.trim() });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">Новый клиент</div>
        <div className="modal-body">
          <label className="field">
            <span className="field-label">Имя *</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Телефон *</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+375291234567"
            />
          </label>
          <label className="field">
            <span className="field-label">Заметка</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn primary" disabled={create.isPending}>
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}

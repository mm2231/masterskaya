/**
 * Правка записи о движении денег: сумма, категория, дата и комментарий.
 *
 * Комментарий часто забывают заполнить при вводе расхода, а потом
 * дописывают — поэтому запись можно изменить в любой момент.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import type { Payment } from '../../lib/types';

interface Category {
  id: number;
  name: string;
  kind: string;
}

export function EditPaymentModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [cost, setCost] = useState(String(payment.cost ?? 0));
  const [category, setCategory] = useState(payment.category ?? '');
  const [occurredOn, setOccurredOn] = useState(payment.occurredOn);
  const [note, setNote] = useState(payment.note ?? '');

  const toast = useToast();
  const queryClient = useQueryClient();

  const categories = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get<{ items: Category[] }>('/api/finance/categories'),
  });

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch(`/api/finance/payments/${payment.id}`, payload),
    onSuccess: () => {
      toast.show('Запись изменена', 'success');
      void queryClient.invalidateQueries({ queryKey: ['finance-payments'] });
      void queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['finance-today'] });
      onClose();
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      toast.show('Укажите сумму больше нуля', 'error');
      return;
    }
    save.mutate({
      amount: value,
      category,
      occurredOn,
      note,
      // Расходники есть только у ручного дохода: у расхода это поле не нужно.
      ...(payment.direction === 'in' ? { cost: Number(cost.replace(',', '.')) || 0 } : {}),
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          Изменить запись · {payment.direction === 'in' ? 'Доход' : 'Расход'}
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Сумма *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Дата</span>
              <input
                type="date"
                value={occurredOn}
                onChange={(event) => setOccurredOn(event.target.value)}
              />
            </label>
            {payment.direction === 'in' ? (
              <label className="field">
                <span className="field-label">Расходники</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                />
                <span className="field-hint">Себестоимость проданного — уменьшает прибыль</span>
              </label>
            ) : null}
          </div>

          <label className="field">
            <span className="field-label">Категория</span>
            <input
              list="expense-categories-list"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Например: Налоги"
            />
            <datalist id="expense-categories-list">
              {categories.data?.items.map((item) => (
                <option key={item.id} value={item.name} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span className="field-label">Комментарий</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Например: закупка телефонов на запчасти, налоги"
            />
          </label>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn primary" disabled={save.isPending}>
            {save.isPending ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}

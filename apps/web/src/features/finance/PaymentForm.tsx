/** Форма добавления дохода или расхода. */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { todayIso } from '@masterskaya/shared';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface Category {
  id: number;
  name: string;
  kind: string;
}

export function PaymentForm() {
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [amount, setAmount] = useState('');
  const [cost, setCost] = useState('');
  const [category, setCategory] = useState('');
  const [occurredOn, setOccurredOn] = useState(() => todayIso());
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState('');

  const toast = useToast();
  const queryClient = useQueryClient();

  const categories = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get<{ items: Category[] }>('/api/finance/categories'),
  });

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      // Если категории нет в справочнике — заводим её, чтобы в следующий раз
      // она была в подсказках. Ошибка здесь не должна мешать записать расход.
      const name = String(payload.category ?? '').trim();
      if (name && !categories.data?.items.some((item) => item.name === name)) {
        try {
          await api.post('/api/finance/categories', { name, kind: 'variable' });
          void queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
        } catch {
          // Категория не создалась — расход всё равно запишем.
        }
      }
      return api.post('/api/finance/payments', payload);
    },
    onSuccess: () => {
      toast.show('Запись добавлена', 'success');
      setAmount('');
      setCost('');
      setNote('');
      setAmountError('');
      void queryClient.invalidateQueries({ queryKey: ['finance-payments'] });
      void queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['finance-today'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setAmountError('Укажите сумму больше нуля — обязательное поле');
      return;
    }
    const costValue = Number(cost.replace(',', '.'));
    const cleanCost = direction === 'in' && Number.isFinite(costValue) && costValue > 0 ? costValue : 0;
    if (cleanCost > value) {
      setAmountError('Расходники не могут быть больше суммы дохода');
      return;
    }
    setAmountError('');
    create.mutate({
      direction,
      amount: value,
      cost: cleanCost,
      method: 'cash',
      category: direction === 'out' ? category : category || undefined,
      occurredOn,
      note: note.trim() || undefined,
    });
  };

  return (
    <section className="panel mb-4">
      <div className="panel-head">Записать доход или расход</div>
      <div className="panel-body">
        <form onSubmit={submit} aria-label="Форма записи дохода или расхода">
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Тип</span>
              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value as 'in' | 'out')}
              >
                <option value="out">Расход</option>
                <option value="in">Доход (без заказа)</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">
                Сумма <span className="req">*</span>
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  if (amountError) setAmountError('');
                }}
                placeholder="50"
                aria-required="true"
                aria-invalid={amountError ? true : undefined}
                aria-describedby={amountError ? 'payment-amount-error' : undefined}
              />
              {amountError ? (
                <span className="error" id="payment-amount-error">
                  {amountError}
                </span>
              ) : null}
            </label>
            {direction === 'in' ? (
              <label className="field">
                <span className="field-label">Расходники</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  placeholder="0"
                />
                <span className="field-hint">
                  Продали за 130, детали 50 → доход сделки 80
                </span>
              </label>
            ) : null}
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
              <span className="field-label">Дата</span>
              <input
                type="date"
                value={occurredOn}
                onChange={(event) => setOccurredOn(event.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Комментарий</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Например: закупка телефонов на запчасти, налоги за 3 месяц, аренда"
              rows={2}
            />
          </label>
          <p className="field-hint">
            Комментарий сохраняется вместе с расходом и виден в таблице ниже и в
            выгрузке в Excel — так видно, куда ушли деньги.
          </p>

          <div className="form-actions">
            <button
              type="submit"
              className="btn primary"
              disabled={create.isPending}
              aria-busy={create.isPending || undefined}
            >
              {create.isPending ? 'Записываем…' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

/**
 * Быстрый перевод заказа на другой этап.
 *
 * Кнопки-переходы подставляют статус прямо из списка разрешённых
 * переходов — значит, кнопка не может дать ошибку на сервере.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { allowedTransitions, statusLabel } from '@masterskaya/shared';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

export function StatusTransition({
  orderId,
  status,
  compact = false,
}: {
  orderId: number;
  status: string;
  /** Только два самых вероятных перехода. */
  compact?: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const transitions = allowedTransitions(status).filter((code) => code !== status);
  const visible = compact ? transitions.slice(0, 2) : transitions.slice(0, 4);

  const change = useMutation({
    mutationFn: (next: string) =>
      api.patch(`/api/orders/${orderId}`, { status: next }),
    onSuccess: (_data, next) => {
      toast.show(`Статус: ${statusLabel(next)}`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order-counts'] });
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  if (visible.length === 0) return null;

  return (
    <span className="btn-row">
      {visible.map((code) => (
        <button
          key={code}
          type="button"
          className="btn sm ghost"
          disabled={change.isPending}
          aria-busy={change.isPending || undefined}
          onClick={() => change.mutate(code)}
          title={`Перевести в «${statusLabel(code)}»`}
        >
          → {statusLabel(code)}
        </button>
      ))}
    </span>
  );
}

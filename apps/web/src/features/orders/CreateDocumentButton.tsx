/** Кнопка «Создать акт»: фиксирует документ в базе и открывает бланк. */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import type { DocumentRow } from '../../lib/types';

export function CreateDocumentButton({
  orderId,
  kind,
  label,
}: {
  orderId: number;
  kind: 'acceptance' | 'works';
  label: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () => api.post<{ document: DocumentRow }>('/api/documents', { orderId, kind }),
    onSuccess: (data) => {
      toast.show(`Акт №${data.document.number} создан`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['order-documents', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      window.open(`/orders/${orderId}/print/${kind}`, '_blank');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  return (
    <button
      type="button"
      className="btn"
      disabled={create.isPending}
      onClick={() => create.mutate()}
    >
      {label}
    </button>
  );
}

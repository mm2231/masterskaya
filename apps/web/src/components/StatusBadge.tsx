/** Бейдж статуса заказа. */

import { statusLabel } from '@masterskaya/shared';

export function StatusBadge({ code }: { code: string }) {
  return <span className={`badge status-${code}`}>{statusLabel(code)}</span>;
}

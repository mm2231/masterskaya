/** Всплывающие уведомления. */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastKind = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ToastApi {
  show: (text: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = ++counter;
    setItems((current) => [...current, { id, text, kind }]);
    setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {items.map((item) => (
        <div key={item.id} className={`toast ${item.kind}`}>
          {item.text}
        </div>
      ))}
    </ToastContext.Provider>
  );
}

/** Хук для показа уведомлений. */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast используется вне ToastProvider');
  }
  return context;
}

/**
 * Иконки интерфейса: один stroke-стиль для всего приложения.
 *
 * Сетка 24×24, толщина линии 1.8 со скруглёнными концами — иконки
 * читаются и мелкими (навигация), и средними (панели). Текущий цвет
 * наследуется (currentColor): активный пункт меню красит иконку.
 */

import type { ReactNode } from 'react';

export interface IconProps {
  /** Токен-имя иконки из набора ниже. */
  name: IconName;
  /** Сторона квадрата в px, по умолчанию 22. */
  size?: number;
}

export type IconName =
  | 'dashboard'
  | 'orders'
  | 'tasks'
  | 'documents'
  | 'finance'
  | 'settings'
  | 'wrench';

/** Пути иконок: stroke-холст 24×24. */
const PATHS: Record<IconName, ReactNode> = {
  // Дашборд: мозаика сводки — четыре блока разного размера.
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="10" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="3" y="15" width="8" height="6" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
    </>
  ),
  // Заказы: сдаваемый в ремонт аппарат — смартфон с линией снизу.
  orders: (
    <>
      <rect x="7.5" y="2.5" width="9" height="19" rx="2" />
      <path d="M10.5 6h3" />
      <path d="M11 18.5h2" />
    </>
  ),
  // Задачи: список с отметками.
  tasks: (
    <>
      <path d="M4 6.5l2 2 3.5-3.5" />
      <path d="M4 17.5l2 2 3.5-3.5" />
      <path d="M13 7h7" />
      <path d="M13 18h7" />
    </>
  ),
  // Акты: документ с подвернутым углом и строками.
  documents: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </>
  ),
  // Финансы: банкнота с номиналом в центре.
  finance: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9.5h.01" />
      <path d="M17.5 14.5h.01" />
    </>
  ),
  // Настройки: шкив.
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" />
    </>
  ),
  // Бренд: гаечный ключ.
  wrench: (
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>
  ),
};

export function Icon({ name, size = 22 }: IconProps) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

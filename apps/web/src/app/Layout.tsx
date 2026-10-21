/** Оболочка приложения: сайдбар с навигацией, топбар, рабочая область. */

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { useTheme } from './useTheme';

interface NavEntry {
  to: string;
  icon: string;
  label: string;
  /** Показывать счётчик заказов в этом статусе. */
  countKey?: string;
}

const NAV: NavEntry[] = [
  { to: '/', icon: '📊', label: 'Дашборд' },
  { to: '/orders', icon: '🔧', label: 'Заказы', countKey: 'open' },
  { to: '/clients', icon: '👥', label: 'Клиенты' },
  { to: '/documents', icon: '📄', label: 'Акты' },
  { to: '/finance', icon: '💰', label: 'Финансы' },
  { to: '/settings', icon: '⚙️', label: 'Настройки' },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Дашборд',
  '/orders': 'Заказы',
  '/clients': 'Клиенты',
  '/documents': 'Акты',
  '/finance': 'Финансы',
  '/settings': 'Настройки',
};

/** Заголовок для вложенных страниц: /orders/12 → «Заказ», /clients/3 → «Клиент». */
function titleFromPath(path: string): string {
  if (path.startsWith('/orders/')) return 'Карточка заказа';
  if (path.startsWith('/clients/')) return 'Карточка клиента';
  return 'Мастерская';
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();

  // Счётчики статусов — для бейджей в меню.
  const { data: counts } = useQuery({
    queryKey: ['order-counts'],
    queryFn: () => api.get<{ counts: Record<string, number> }>('/api/orders/counts'),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const openOrders =
    (counts?.counts.new ?? 0) +
    (counts?.counts.diagnostics ?? 0) +
    (counts?.counts.in_progress ?? 0) +
    (counts?.counts.waiting_parts ?? 0) +
    (counts?.counts.ready ?? 0) +
    (counts?.counts.warranty ?? 0);

  const title = PAGE_TITLES[location.pathname] ?? titleFromPath(location.pathname);

  return (
    <div className="app">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span>🔧</span>
          <span>Мастерская</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-item-icon">{entry.icon}</span>
              <span>{entry.label}</span>
              {entry.countKey === 'open' && openOrders > 0 ? (
                <span className="nav-item-badge">{openOrders}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">Локальная база · данные только на этом компьютере</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="btn icon ghost menu-button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Меню"
          >
            ☰
          </button>
          <div className="topbar-title">{title}</div>
          <div className="topbar-spacer" />
          <div className="search-box">
            <span className="search-box-icon">🔍</span>
            <input
              type="search"
              placeholder="Поиск: телефон, устройство, номер заказа"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  const value = (event.target as HTMLInputElement).value.trim();
                  if (value) navigate(`/orders?q=${encodeURIComponent(value)}`);
                }
              }}
            />
          </div>
          <button
            type="button"
            className="btn icon ghost"
            onClick={toggle}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            aria-label="Переключить тему"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

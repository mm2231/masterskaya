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
  countKey?: 'open';
  /** Показывать счётчик задач (просроченные + сегодняшние). */
  taskCount?: boolean;
}

const NAV_GROUPS: Array<{ title: string; items: NavEntry[] }> = [
  {
    title: 'Работа',
    items: [
      { to: '/', icon: '📊', label: 'Дашборд' },
      { to: '/orders', icon: '🔧', label: 'Заказы', countKey: 'open' },
      { to: '/tasks', icon: '✅', label: 'Задачи', taskCount: true },
    ],
  },
  {
    title: 'Учёт',
    items: [
      { to: '/documents', icon: '📄', label: 'Акты' },
      { to: '/finance', icon: '💰', label: 'Финансы' },
    ],
  },
  {
    title: 'Система',
    items: [{ to: '/settings', icon: '⚙️', label: 'Настройки' }],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Дашборд',
  '/orders': 'Заказы',
  '/documents': 'Акты',
  '/finance': 'Финансы',
  '/settings': 'Настройки',
};

/** Заголовок для вложенных страниц: /orders/12 → «Карточка заказа». */
function titleFromPath(path: string): string {
  if (path.startsWith('/orders/')) return 'Карточка заказа';
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

  // Счётчик задач: просроченные и сегодняшние.
  const { data: taskCounts } = useQuery({
    queryKey: ['task-counts'],
    queryFn: () => api.get<{ overdue: number; today: number }>('/api/tasks/counts'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Esc закрывает мобильное меню — как обычный диалог.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const openOrders =
    (counts?.counts.new ?? 0) +
    (counts?.counts.diagnostics ?? 0) +
    (counts?.counts.in_progress ?? 0) +
    (counts?.counts.waiting_parts ?? 0) +
    (counts?.counts.ready ?? 0) +
    (counts?.counts.warranty ?? 0);

  const taskTotal = (taskCounts?.overdue ?? 0) + (taskCounts?.today ?? 0);

  const title = PAGE_TITLES[location.pathname] ?? titleFromPath(location.pathname);

  return (
    <div className="app">
      <aside id="sidebar" className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span aria-hidden="true">🔧</span>
          <span>Мастерская</span>
        </div>
        <nav className="sidebar-nav" aria-label="Основная навигация">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((entry) => (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-item-icon" aria-hidden="true">
                    {entry.icon}
                  </span>
                  <span>{entry.label}</span>
                  {entry.countKey === 'open' && openOrders > 0 ? (
                    <span className="nav-item-badge">{openOrders}</span>
                  ) : null}
                  {entry.taskCount && taskTotal > 0 ? (
                    <span
                      className={`nav-item-badge ${
                        (taskCounts?.overdue ?? 0) > 0 ? 'danger' : ''
                      }`}
                    >
                      {taskTotal}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">Локальная база · данные только на этом компьютере</div>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="btn icon ghost menu-button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            aria-controls="sidebar"
          >
            <span aria-hidden="true">☰</span>
          </button>
          <div className="topbar-title">{title}</div>
          <div className="topbar-spacer" />
          <div className="search-box">
            <span className="search-box-icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="search"
              aria-label="Поиск по заказам: телефон, устройство, номер"
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
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

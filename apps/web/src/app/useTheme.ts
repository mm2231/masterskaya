/** Тема «день/ночь»: выбор сохраняется в localStorage, по умолчанию — системная. */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'workshop-theme';

function preferredTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Приватный режим — просто берём системную тему.
  }
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  return media?.matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => preferredTheme());

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Тема всё равно переключится, просто не запомнится.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}

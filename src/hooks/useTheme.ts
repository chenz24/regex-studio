import { useState, useEffect, useCallback } from 'react';

export function useTheme() {
  // Keep SSR deterministic and wait for hydration before persisting a choice.
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('regex-tool-theme');
      if (stored === 'dark' || stored === 'light') {
        setIsDark(stored === 'dark');
        return;
      }
    } catch {
      // Storage can be blocked; the theme still works for this session.
    }

    setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  useEffect(() => {
    if (isDark === null) return;
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('regex-tool-theme', isDark ? 'dark' : 'light');
    } catch {
      // A persistence failure must not prevent rendering or switching themes.
    }
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((d) => !d), []);

  return { isDark: isDark ?? false, toggle };
}

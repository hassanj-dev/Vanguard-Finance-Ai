'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'vg-theme';

// Mirrors the inline NO_FLASH script in app/layout.tsx — that script has
// already set data-theme on <html> before hydration runs, so on mount we
// just read it back rather than re-deriving it from matchMedia.
function readAttrTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function useTheme() {
  // Server-rendered value always assumes 'dark' (matches :root defaults),
  // so this never causes a hydration mismatch — we only correct it after
  // mount, same as the `mounted` guard pattern for icons below.
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readAttrTheme());
    setMounted(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable (private mode, etc.) — theme still
      // applies for this session via the attribute, just won't persist.
    }
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme, mounted };
}
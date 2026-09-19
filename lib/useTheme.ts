'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'vg-theme';
const SWITCH_CLASS = 'theme-switching';

/**
 * Mirrors the inline NO_FLASH script in app/layout.tsx — that script has
 * already set data-theme on <html> before hydration runs, so on mount we
 * just read it back rather than re-deriving it from matchMedia.
 */
function readAttrTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/**
 * FIX #1 — theme switching lag.
 *
 * Three things were making the toggle feel slow, none of them React:
 *
 *  1. Every bordered / shadowed element in the app carries a Tailwind
 *     `transition` utility. Flipping `data-theme` therefore started a few
 *     hundred simultaneous colour cross-fades. We now add `.theme-switching`
 *     to <html> for exactly one frame, and globals.css kills every
 *     transition while that class is present. The flip becomes one paint.
 *
 *  2. The old hook waited on a React re-render before the DOM attribute was
 *     written. Now the attribute is written first, synchronously, so the
 *     browser can repaint immediately; React state catches up afterwards
 *     (it only drives the sun/moon icon).
 *
 *  3. `localStorage.setItem` is a synchronous, main-thread write. It ran in
 *     the same tick as the flip. It is now deferred until after the paint.
 *
 * Also: `toggleTheme` no longer closes over `theme`, so its identity is
 * stable and it can never act on a stale value.
 */
export function useTheme() {
  // Server render always assumes 'dark' (matches :root defaults), so this
  // never causes a hydration mismatch — we correct it after mount.
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readAttrTheme());
    setMounted(true);

    // Keep multiple open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next: Theme = e.newValue === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      setThemeState(next);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement;

    // 1. Suppress every transition for this frame.
    root.classList.add(SWITCH_CLASS);
    // 2. Flip the attribute — this is the paint the user sees.
    root.setAttribute('data-theme', next);
    // 3. Let React catch up (icon only).
    setThemeState(next);

    // 4. After the browser has painted, restore transitions and persist.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove(SWITCH_CLASS);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Private mode / storage blocked — theme still applies for this
          // session via the attribute, it just won't persist.
        }
      });
    });
  }, []);

  const toggleTheme = useCallback(() => {
    // Read from the DOM, not from state — always current, never stale.
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'dark' : 'light');
  }, [setTheme]);

  return { theme, setTheme, toggleTheme, mounted };
}
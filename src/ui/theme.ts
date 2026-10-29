import {useEffect, useSyncExternalStore} from 'react';

/** Theme preference: 'system' follows prefers-color-scheme (including live changes). Stored apart from the backup schema. */
export type ThemePref = 'system' | 'light' | 'dark';
export const THEME_KEY = 'swello-theme';
export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];
/** Keep in sync with the inline pre-paint script and meta theme-color in index.html. */
const META_COLOR = {light: '#f5f5f7', dark: '#07111a'} as const;

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'light'; // light (Apple-style) is the default since 2026-10-29
  } catch {
    return 'light';
  }
}

const systemDark = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)').matches : false);
/** Keep in sync with the inline script in index.html: 'dark' wins, else 'light', else the OS setting. */
export const resolveTheme = (pref: ThemePref): 'light' | 'dark' => (pref === 'system' ? (systemDark() ? 'dark' : 'light') : pref);

/** Sets data-theme on <html> (the inline script in index.html does the same before first paint). */
export function applyTheme(pref: ThemePref) {
  const t = resolveTheme(pref);
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[t]);
}

const listeners = new Set<() => void>();
let current: ThemePref | null = null;
const getPref = () => (current ??= readThemePref());

export function setThemePref(pref: ThemePref) {
  current = pref;
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* storage unavailable: the choice lasts for this session only */ }
  applyTheme(pref);
  listeners.forEach((l) => l());
}

/** Another tab changed the preference: refresh the cached value, re-apply and notify. */
const onStorage = (e: StorageEvent) => {
  if (e.key !== null && e.key !== THEME_KEY) return;
  current = readThemePref();
  applyTheme(current);
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  if (listeners.size === 0 && typeof addEventListener === 'function') addEventListener('storage', onStorage);
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0 && typeof removeEventListener === 'function') removeEventListener('storage', onStorage);
  };
};

/** Current preference, a setter, and the live DOM sync (mount once via useThemeSync in App). */
export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  return [useSyncExternalStore(subscribe, getPref, () => 'light' as ThemePref), setThemePref];
}

export function useThemeSync() {
  const [pref] = useThemePref();
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system' || typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);
}

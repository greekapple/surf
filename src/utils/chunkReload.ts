/** After a deploy, an already-open tab can ask for a lazy chunk of the OLD version: the hashed file is gone and the SPA fallback answers with index.html, so the import fails ("Failed to load module script ... MIME type", "error loading dynamically imported module"). One reload fetches the new index and its chunks; a sessionStorage flag stops it ever looping. */
const KEY = 'swello-chunk-reload-at', WINDOW_MS = 60_000;
export const isChunkLoadError = (e: unknown): boolean => {
  const m = String((e as {message?: unknown} | null)?.message ?? e ?? '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Failed to load module script|Importing a module script failed|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(m);
};
interface Env {storage?: Pick<Storage, 'getItem' | 'setItem'> | null; reload: () => void; now?: () => number}
/** Reloads once per minute at most. Returns true when it reloaded, false when it had already reloaded just now (the failure is then left to surface) or storage is unusable (no guard means no reload, never a loop). */
export function reloadOnce(env: Env): boolean {
  const now = (env.now ?? Date.now)();
  try {
    const last = Number(env.storage?.getItem(KEY) ?? 0);
    if (!env.storage || (Number.isFinite(last) && last > 0 && now - last < WINDOW_MS)) return false;
    env.storage.setItem(KEY, String(now));
  } catch { return false; }
  env.reload(); return true;
}
interface Target {addEventListener: (t: string, f: (e: any) => void) => void}
export function installChunkReload(win: Target & {location: {reload: () => void}; sessionStorage?: Storage}, now?: () => number) {
  const go = () => { let storage: Storage | null = null; try { storage = win.sessionStorage ?? null; } catch { /* blocked */ } return reloadOnce({storage, reload: () => win.location.reload(), now}); };
  win.addEventListener('vite:preloadError', (e) => { if (go()) e.preventDefault?.(); });
  win.addEventListener('unhandledrejection', (e) => { if (isChunkLoadError(e.reason)) go(); });
}

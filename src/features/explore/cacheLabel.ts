/** T-128 first paint: a frame drawn from this device's cache (engineering's IndexedDB frame cache sets `cached` on it) is labelled with its OWN valid time
 * and says it is cached until fresh data replaces it. A network frame has no `cached` and gets no label (the normal source line applies). */
export interface CachedMark {cached?: {savedAt: string} | null}
export interface CacheLabel {chip: string; line: string}

export function cacheLabel(f: ({validAt: string} & CachedMark) | null | undefined, updating: boolean, when: (iso: string) => string): CacheLabel | null {
  if (!f?.cached || !Number.isFinite(Date.parse(f.validAt))) return null;
  const valid = when(f.validAt), saved = Number.isFinite(Date.parse(f.cached.savedAt)) ? ` (saved ${when(f.cached.savedAt)})` : '';
  return updating
    ? {chip: `cached ${valid} · updating…`, line: `Showing the ${valid} model frame from this device's cache${saved} · updating…`}
    : {chip: `cached ${valid} · not updated`, line: `Showing the ${valid} model frame from this device's cache${saved} · fresh data could not be loaded.`};
}

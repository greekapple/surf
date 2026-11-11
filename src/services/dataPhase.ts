/** Where the forecast data is (T-055): 'loading' until a retrieval has either produced data or actually failed, so a surface never says
 *  "No forecast data", "none" or "No good daylight window left" while it is still waiting.
 *  The ocean hook starts with loading=false and no error for one render before its effect runs, so "no bundle, no error" is still loading. */
export type DataPhase = 'loading' | 'ready' | 'failed';
export function dataPhase(o: {loading?: boolean; bundle?: unknown; error?: string | null}, live = true): DataPhase {
  if (!live) return 'ready'; // demonstration data is local
  if (o.bundle) return 'ready';
  if (o.loading) return 'loading';
  return o.error ? 'failed' : 'loading';
}

/** Audit A6: one spot's phase. 'loading' while the retrieval is pending OR the spot is outside the loaded scope (it loads on demand), so
 *  Quiver, Board Match, Personal and search never call a spot's surf "missing" before its forecast has arrived or definitely failed. */
export function spotPhase(o: {loading?: boolean; bundle?: unknown; error?: string | null; isSpotLoaded?: (id: string) => boolean; isSpotFailed?: (id: string) => boolean}, id: string, live = true): DataPhase {
  const p = dataPhase(o, live);
  if (p !== 'ready' || !live) return p;
  if (o.isSpotFailed?.(id)) return 'failed';   // review HIGH: the load that should have covered this spot failed; never an endless skeleton
  return o.isSpotLoaded && !o.isSpotLoaded(id) ? 'loading' : 'ready';
}

/** Review HIGH: the ids a retrieval tried and did not deliver. A failed load (rejected, or "no usable wave data") marks every attempted id
 *  that the kept bundle does not already have; a good load clears the ids it delivered. `attempted` null = the whole catalogue (nothing to mark). */
export function nextFailed(prev: ReadonlySet<string>, attempted: readonly string[] | null, delivered: readonly string[] | null | undefined, ok: boolean, have: ReadonlySet<string> | null): Set<string> {
  const next = new Set(prev);
  if (ok) { for (const id of delivered ?? attempted ?? []) next.delete(id); return next; }
  for (const id of attempted ?? []) if (!have?.has(id)) next.add(id);
  return next;
}

/** Whether a spot's forecast counts as arrived for display: false while there is no bundle yet and no error (the first load is pending),
 *  true once it failed (the "no data" states are then true), else whether the spot is in the loaded scope. */
export function spotLoaded(o: {enabled: boolean; bundle: unknown; error: string; loading: boolean; loaded: Set<string> | null; failed?: ReadonlySet<string>}, id: string): boolean {
  if (!o.enabled) return true;
  if (o.failed?.has(id) && !o.loading) return true;   // its load failed: "no data" is now true (search rows), not "loading" forever
  if (!o.bundle) return !!o.error && !o.loading;
  return o.loaded ? o.loaded.has(id) : true;
}

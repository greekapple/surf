import type {CoastSnapshot, SnapshotEntry} from '../../services/coastSnapshot';

/** The daily forecast for the coast pills (`/api/coast-ratings?t=<hour>`): what the Worker re-rated for every spot at one hour from the newest complete daily capture. One request per hour, kept for
 *  10 minutes (a new capture is picked up within that); a failed request (HTTP error or network) is tried once more after a few seconds; an hour outside the capture's 48 hours or no capture is `null`
 *  at once (the pill then says "Not loaded yet"), and is not remembered. No Open-Meteo call is made from the browser. */
export interface ClientSnapshot {capturedAt: string; t: string; /** the oldest and newest model-run retrieval among the rated spots */ retrievedFrom: string; retrievedTo: string; byId: ReadonlyMap<string, SnapshotEntry>}
const HOUR = 3600000;
export const SNAPSHOT_TTL_MS = 600000, SNAPSHOT_RETRY_MS = 3000;
const memo = new Map<string, {p: Promise<ClientSnapshot | null>; at: number}>();
export const snapshotHour = (iso: string | null | undefined): string | null => { const ms = Date.parse(iso ?? ''); return Number.isFinite(ms) && ms % HOUR === 0 ? new Date(ms).toISOString() : null; };
/** Parse the endpoint's answer; null unless it is an ok answer for this very hour. */
export function parseSnapshot(body: unknown, t: string): ClientSnapshot | null {
  const b = body as Partial<Extract<CoastSnapshot, {ok: true}>> | null;
  if (!b || b.ok !== true || b.t !== t || typeof b.capturedAt !== 'string' || !b.spots || typeof b.spots !== 'object') return null;
  return {capturedAt: b.capturedAt, t, retrievedFrom: b.retrievedFrom ?? b.capturedAt, retrievedTo: b.retrievedTo ?? b.capturedAt, byId: new Map(Object.entries(b.spots))};
}
/** One request, and one more after `retryMs` when the answer is an HTTP error or the network failed. A well-formed "not available" answer (outside the 48 h, no capture) is final. */
async function fetchOnce(t: string, fetcher: typeof fetch, retryMs: number): Promise<ClientSnapshot | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { const r = await fetcher(`/api/coast-ratings?t=${encodeURIComponent(t)}`); if (r.ok) return parseSnapshot(await r.json(), t); } catch { /* retry once */ }
    if (attempt === 0 && retryMs > 0) await new Promise((res) => setTimeout(res, retryMs)); else if (attempt === 0) continue;
  }
  return null;
}
export function loadSnapshot(iso: string | null | undefined, fetcher: typeof fetch = fetch, opts: {now?: () => number; retryMs?: number} = {}): Promise<ClientSnapshot | null> {
  const t = snapshotHour(iso); if (!t) return Promise.resolve(null);
  const now = opts.now ?? Date.now, hit = memo.get(t);
  if (hit && now() - hit.at < SNAPSHOT_TTL_MS) return hit.p;
  const p = fetchOnce(t, fetcher, opts.retryMs ?? SNAPSHOT_RETRY_MS); memo.set(t, {p, at: now()}); p.then((v) => { if (!v && memo.get(t)?.p === p) memo.delete(t); });
  return p;
}
export const clearSnapshotCache = () => memo.clear();

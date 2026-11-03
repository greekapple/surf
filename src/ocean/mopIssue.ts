import {request} from './request.ts';
import {sourceMetadata} from './server.ts';
import {mopDasURL, parseMopDas, type MopIssue} from './mop.ts';

/** The MOP forecast file's issue time (its DAS attributes), loaded ON DEMAND (T-097): 40 small requests used to run on every first load although only the Nearshore card shows the issue time.
 *  Keeps the freshness flag the headline reads (T-084): `delivery: 'saved'` when the Worker served its saved copy. */
export interface MopIssueInfo {state: 'loading' | 'ok' | 'error'; issue: MopIssue | null; delivery?: 'saved'; retrievedAt?: string}
const store = new Map<string, MopIssueInfo>(), inflight = new Map<string, Promise<void>>(), subs = new Set<() => void>();
const notify = () => subs.forEach((f) => { try { f(); } catch { /* one subscriber must not break the others */ } });
export const getMopIssue = (mopId: string | null | undefined): MopIssueInfo | null => (mopId ? store.get(mopId) ?? null : null);
export const subscribeMopIssue = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export function setMopIssue(mopId: string, info: MopIssueInfo) { store.set(mopId, info); notify(); }
export const clearMopIssues = () => { store.clear(); inflight.clear(); notify(); };

/** Fetches the issue time for one MOP point once (a failure can be retried by calling again). `fetchText` and `meta` are injectable for tests. */
export function loadMopIssue(mopId: string, fetchText: (url: string) => Promise<unknown> = (u) => request(u, 'text'), meta: (url: string) => {cache?: string; retrievedAt?: string} | undefined = sourceMetadata): Promise<void> {
  if (store.get(mopId)?.state === 'ok') return Promise.resolve();
  const have = inflight.get(mopId); if (have) return have;
  const url = mopDasURL(mopId);
  if (!store.has(mopId)) { store.set(mopId, {state: 'loading', issue: null}); notify(); }
  const p = (async () => {
    try {
      const raw = await fetchText(url) as any, text = typeof raw === 'string' ? raw : raw?.text, m = meta(url);
      setMopIssue(mopId, {state: 'ok', issue: typeof text === 'string' ? parseMopDas(text) : null, ...(m?.cache === 'stale' ? {delivery: 'saved' as const} : {}), ...(m?.retrievedAt ? {retrievedAt: m.retrievedAt} : {})});
    } catch { setMopIssue(mopId, {state: 'error', issue: null}); } finally { inflight.delete(mopId); }
  })();
  inflight.set(mopId, p); return p;
}

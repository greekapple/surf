import {loadLog, saveLog, SESSION_LOG_KEY, type SessionObservation} from './sessionLog.ts';
/** The one in-memory copy of the session log (T-059), shared by the headline, the journal and the quick log so they all see the same observations.
 *  Persisted through sessionLog.ts (localStorage `swello-session-log`); re-read when another tab writes. Subscribers are told after every change. */
let cache: SessionObservation[] | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => { try { f(); } catch { /* a subscriber must not break the others */ } });
export const getObservations = (): SessionObservation[] => (cache ??= loadLog());
/** Replaces the log (persisting it). Returns false when the browser refused the write; the in-memory copy still updates so the page stays consistent this session. */
export function setObservations(log: SessionObservation[]): boolean { cache = log; const ok = saveLog(log); notify(); return ok; }
export function subscribeObservations(cb: () => void): () => void { subs.add(cb); return () => { subs.delete(cb); }; }
/** Test hook: forget the cache (and optionally seed it). */
export function resetObservationCache(seed: SessionObservation[] | null = null) { cache = seed; notify(); }
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('storage', (e) => { if (e.key === SESSION_LOG_KEY || e.key === null) { cache = null; notify(); } });

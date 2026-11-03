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
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('storage', (e) => { if (e.key === SESSION_LOG_KEY || e.key === FELT_KEY || e.key === null) { cache = null; feltCache = null; notify(); } });

/** "Felt right?" signals (T-064): a separate, weaker store than the observations. Direction only. Key `swello-felt-right`. */
export const FELT_KEY = 'swello-felt-right';
export type FeltSignal = 'low' | 'right' | 'high';
export interface FeltEntry {id: string; spotId: string; hour: string; felt: FeltSignal; loggedAt: string; predicted: {/** true = a surf-height (convention) prediction; entries without it predate T-077 and are ignored by the felt nudge */ conv?: true; loFt: number; hiFt: number; method: 'mop-v2' | 'v1'; source: 'archived' | 'current'} | null}
let feltCache: FeltEntry[] | null = null;
const okFelt = (o: any): o is FeltEntry => o && typeof o.id === 'string' && typeof o.spotId === 'string' && Number.isFinite(Date.parse(o.hour)) && ['low', 'right', 'high'].includes(o.felt);
export function getFelt(): FeltEntry[] { if (feltCache) return feltCache; try { const v = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem(FELT_KEY) : null) ?? '[]'); feltCache = Array.isArray(v) ? v.filter(okFelt) : []; } catch { feltCache = []; } return feltCache; }
export function setFelt(list: FeltEntry[]): boolean { feltCache = list; let ok = true; try { if (typeof localStorage !== 'undefined') localStorage.setItem(FELT_KEY, JSON.stringify(list)); else ok = false; } catch { ok = false; } notify(); return ok; }
export function resetFeltCache(seed: FeltEntry[] | null = null) { feltCache = seed; notify(); }

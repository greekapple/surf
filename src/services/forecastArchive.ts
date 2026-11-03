import type {Forecast} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {headlineSurf} from './headlineSurf.ts';

/** Forecast archive (T-064): a local ring of the forecast values a surfer's device has VIEWED, so an observation or a "felt right?" tap can be paired with what was PREDICTED,
 *  not with a later re-run. Local to this browser (localStorage), never uploaded. About two weeks, compact, bounded.
 *  `run` is when WE retrieved the data (the provider does not supply the model issue time), so `lead` is hours from our retrieval to the hour predicted. */
export const ARCHIVE_KEY = 'swello-forecast-archive';
export const ARCHIVE_DAYS = 14, ARCHIVE_MAX = 6000, ARCHIVE_THROTTLE_MS = 30 * 60000;
export interface ArchivedHour {s: string; v: string; lo: number | null; hi: number | null; k: 'estimate' | 'demonstration' | 'offshore' | 'none'; m: 'mop-v2' | 'v1' | null; off: number | null; tp: number | null; run: string; seen: string; lead: number}
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStore = (): Store | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };
const ok = (o: any): o is ArchivedHour => o && typeof o.s === 'string' && Number.isFinite(Date.parse(o.v)) && Number.isFinite(Date.parse(o.seen)) && typeof o.k === 'string';
export function loadArchive(store: Store | null = defaultStore()): ArchivedHour[] { try { const v = JSON.parse(store?.getItem(ARCHIVE_KEY) ?? '[]'); return Array.isArray(v) ? v.filter(ok) : []; } catch { return []; } }
function saveArchive(a: ArchivedHour[], store: Store | null): boolean { try { if (!store) return false; store.setItem(ARCHIVE_KEY, JSON.stringify(a)); return true; } catch { return false; } }
const leadBucket = (h: number) => (h < 6 ? 0 : h < 24 ? 1 : h < 72 ? 2 : 3);
const lastRun = new Map<string, number>();

/** Records the spot's hours from 6 h ago to 72 h ahead as predicted now (uncalibrated headline), keeping the latest entry per spot-hour and lead bucket.
 *  Throttled to once per 30 minutes per spot. Returns how many entries were written. */
export function archiveHours(spotId: string, records: Forecast[], bundle: Pick<OceanBundle, 'nearshore' | 'mop'> | null | undefined, nowMs: number, store: Store | null = defaultStore()): number {
  if (!store || nowMs - (lastRun.get(spotId) ?? -Infinity) < ARCHIVE_THROTTLE_MS) return 0;
  const mine = records.filter((f) => f.spotId === spotId && Date.parse(f.timestamp) >= nowMs - 6 * 3600000 && Date.parse(f.timestamp) <= nowMs + 72 * 3600000);
  if (!mine.length) return 0;
  lastRun.set(spotId, nowMs);
  const cutoff = nowMs - ARCHIVE_DAYS * 86400000, all = loadArchive(store).filter((a) => Date.parse(a.v) >= cutoff), index = new Map<string, number>(all.map((a, i): [string, number] => [`${a.s}|${a.v}|${leadBucket(a.lead)}`, i]));
  let n = 0;
  for (const f of mine) {
    const h = headlineSurf(spotId, f, {nowMs, observations: [], bundle}), run = f.evidence?.offshore.source.retrievedAt, runMs = Date.parse(run ?? ''), v = Date.parse(f.timestamp);
    const lead = Number.isFinite(runMs) ? Math.max(0, (v - runMs) / 3600000) : Math.max(0, (v - nowMs) / 3600000);
    const e: ArchivedHour = {s: spotId, v: f.timestamp, lo: h.kind === 'estimate' ? h.loFt : h.kind === 'none' ? null : h.kind === 'offshore' || h.kind === 'demonstration' ? h.ft : null, hi: h.kind === 'estimate' ? h.hiFt : h.kind === 'none' ? null : h.ft,
      k: h.kind, m: h.kind === 'estimate' ? h.method : null, off: Number.isFinite(f.offshore) ? Math.round(f.offshore * 10) / 10 : null, tp: Number.isFinite(f.primary?.period) ? f.primary.period : null,
      run: Number.isFinite(runMs) ? run! : new Date(nowMs).toISOString(), seen: new Date(nowMs).toISOString(), lead: Math.round(lead * 10) / 10};
    const key = `${spotId}|${f.timestamp}|${leadBucket(lead)}`, at = index.get(key);
    if (at === undefined) { index.set(key, all.length); all.push(e); } else all[at] = e;
    n++;
  }
  all.sort((a, b) => Date.parse(a.v) - Date.parse(b.v));
  saveArchive(all.length > ARCHIVE_MAX ? all.slice(all.length - ARCHIVE_MAX) : all, store);
  return n;
}
/** What was predicted for one spot-hour before `beforeMs` (the latest entry seen at or before it), or null. */
export function predictedFor(spotId: string, validAtIso: string, beforeMs: number, store: Store | null = defaultStore()): ArchivedHour | null {
  const v = Date.parse(validAtIso); let best: ArchivedHour | null = null;
  for (const a of loadArchive(store)) if (a.s === spotId && Date.parse(a.v) === v && Date.parse(a.seen) <= beforeMs && (!best || Date.parse(a.seen) > Date.parse(best.seen))) best = a;
  return best;
}
export const resetArchiveThrottle = () => lastRun.clear();

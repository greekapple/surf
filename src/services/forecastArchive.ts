import type {Forecast} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {headlineSurf} from './headlineSurf.ts';
import {canonicalSpotId} from '../data/spotAliases.ts';
import {forecastInputs} from './sessionInputs.ts';
import {allSpots} from '../data/catalog.ts';

/** Forecast archive (T-064): a local ring of the forecast values a surfer's device has VIEWED, so an observation or a "felt right?" tap can be paired with what was PREDICTED,
 *  not with a later re-run. Local to this browser (localStorage), never uploaded. About two weeks, compact, bounded.
 *  `run` is when WE retrieved the data (the provider does not supply the model issue time), so `lead` is hours from our retrieval to the hour predicted. */
export const ARCHIVE_KEY = 'swello-forecast-archive';
export const ARCHIVE_DAYS = 14, ARCHIVE_MAX = 8000, ARCHIVE_THROTTLE_MS = 30 * 60000, MAX_PER_HOUR = 4;
export interface ArchivedHour {/** T-131 phase 2: v1 only, the buoy-transfer factor already in cs/lo/hi (1 = none; absent = archived before it existed) */ tf?: number; s: string; v: string; lo: number | null; hi: number | null; /** the surf height by the common convention (T-077); entries without it predate the convention */ cs?: number; /** quiver item 3: the other forecast inputs at that hour, when the record had them (absent on entries archived before they were kept): primary swell direction (deg), wind mph, its relation to the beach, tide stage */ dir?: number | null; ws?: number | null; wr?: string | null; ti?: 'rising' | 'falling' | null; /** the headline was a saved or stale copy when archived (such entries are never compared) */ st?: boolean; /** the headline was MOP's nearshore-only point (a different kind of number from the breaking rule's) */ np?: boolean; /** under the flat threshold */ fl?: boolean; k: 'estimate' | 'demonstration' | 'offshore' | 'none'; m: 'mop-v2' | 'v1' | null; off: number | null; tp: number | null; run: string; seen: string; lead: number}
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStore = (): Store | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };
const ok = (o: any): o is ArchivedHour => o && typeof o.s === 'string' && Number.isFinite(Date.parse(o.v)) && Number.isFinite(Date.parse(o.seen)) && typeof o.k === 'string';
export function loadArchive(store: Store | null = defaultStore()): ArchivedHour[] { try { const v = JSON.parse(store?.getItem(ARCHIVE_KEY) ?? '[]'); return Array.isArray(v) ? v.filter(ok).map((a) => (canonicalSpotId(a.s) === a.s ? a : {...a, s: canonicalSpotId(a.s)})) : []; } catch { return []; } }
function saveArchive(a: ArchivedHour[], store: Store | null): boolean { try { if (!store) return false; store.setItem(ARCHIVE_KEY, JSON.stringify(a)); return true; } catch { return false; } }
const lastRun = new Map<string, number>();

/** Records the spot's hours from 6 h ago to 72 h ahead as predicted now (uncalibrated headline), appending a snapshot per spot-hour (at most 4 kept: the earliest and the latest).
 *  Throttled to once per 30 minutes per spot. Returns how many entries were written. */
export function archiveHours(spotId: string, records: Forecast[], bundle: Pick<OceanBundle, 'nearshore' | 'mop' | 'srf'> | null | undefined, nowMs: number, store: Store | null = defaultStore()): number {
  if (!store || nowMs - (lastRun.get(spotId) ?? -Infinity) < ARCHIVE_THROTTLE_MS) return 0;
  const mine = records.filter((f) => f.spotId === spotId && Date.parse(f.timestamp) >= nowMs - 6 * 3600000 && Date.parse(f.timestamp) <= nowMs + 72 * 3600000);
  if (!mine.length) return 0;
  lastRun.set(spotId, nowMs);
  const cutoff = nowMs - ARCHIVE_DAYS * 86400000, all = loadArchive(store).filter((a) => Date.parse(a.v) >= cutoff);
  const byHour = new Map<string, ArchivedHour[]>(); for (const a of all) { const k = `${a.s}|${a.v}`; (byHour.get(k) ?? byHour.set(k, []).get(k)!).push(a); }
  let n = 0; const spotObj = allSpots.find((x) => x.id === spotId);
  for (const f of mine) {
    const h = headlineSurf(spotId, f, {nowMs, observations: [], bundle}), run = f.evidence?.offshore.source.retrievedAt, runMs = Date.parse(run ?? ''), v = Date.parse(f.timestamp);
    const lead = Number.isFinite(runMs) ? Math.max(0, (v - runMs) / 3600000) : Math.max(0, (v - nowMs) / 3600000);
    if (h.kind === 'official') continue;   // offshore-surf: the NWS's number is not ours; it never enters the archive that scores OUR forecasts
    if (h.kind === 'estimate' && h.method === 'swan-v2') continue;   // swan-hawaii: an unchecked source never enters the archive that scores forecasts
    const e: ArchivedHour = {s: spotId, v: f.timestamp, ...(h.kind === 'estimate' && Number.isFinite(h.centralFt) ? {cs: h.centralFt} : {}), lo: h.kind === 'estimate' ? h.loFt : h.kind === 'none' ? null : h.kind === 'offshore' || h.kind === 'demonstration' ? h.ft : null, hi: h.kind === 'estimate' ? h.hiFt : h.kind === 'none' ? null : h.ft,
      ...(h.kind === 'estimate' && h.method === 'v1' ? {tf: h.transfer?.factor ?? 1} : {}), ...((x) => ({dir: x.dirDeg, ws: x.windMph, wr: x.windRel, ti: x.tide}))(forecastInputs(spotObj, f, nowMs)), ...(h.kind === 'offshore' && h.saved || h.kind === 'estimate' && (h as {saved?: unknown}).saved ? {st: true} : {}), ...(h.kind === 'estimate' && h.nearshoreOnly ? {np: true} : {}), ...(h.kind === 'estimate' && h.nearshoreOnly?.flat ? {fl: true} : {}), k: h.kind, m: h.kind === 'estimate' && h.method !== 'swan-v2' ? h.method : null, off: Number.isFinite(f.offshore) ? Math.round(f.offshore * 10) / 10 : null, tp: Number.isFinite(f.primary?.period) ? f.primary.period : null,
      run: Number.isFinite(runMs) ? run! : new Date(nowMs).toISOString(), seen: new Date(nowMs).toISOString(), lead: Math.round(lead * 10) / 10};
    // Snapshots are APPENDED, never overwritten: a later visit (even in the same lead bucket) must not erase what was shown before a session. At most MAX_PER_HOUR are kept per spot-hour: the earliest and the most recent ones.
    const list = byHour.get(`${spotId}|${f.timestamp}`) ?? []; list.sort((x, y) => Date.parse(x.seen) - Date.parse(y.seen));
    if (!list.length || nowMs - Date.parse(list[list.length - 1].seen) >= ARCHIVE_THROTTLE_MS) { list.push(e); while (list.length > MAX_PER_HOUR) list.splice(1, 1); byHour.set(`${spotId}|${f.timestamp}`, list); n++; }
  }
  all.length = 0; for (const l of byHour.values()) all.push(...l);
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

/** The coast pills' "daily forecast" values (pills-snapshot): for ONE hour, every captured spot re-rated with the CURRENT engine (rateForecast, the onshore cap included) from the marine and
 *  wind hours stored in the day's capture (howright/v2/shown/<date>.json, services/how-right-all.mjs). The score stored in the capture is never read: the capture of a day predates the engine
 *  changes made after it. Each spot is judged at its own `ratedAt` (the moment its inputs were captured), not at the visitor's clock, so the answer for one capture and one hour is the same for
 *  everyone and can be cached; the data is that old, and the rating's lead-dependent ceiling says so. No network, no Open-Meteo. The same normaliser, converter and rating as a pin. */
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {allSpots} from '../data/catalog.ts';
import {rateForecast} from '../ratings/adapters.ts';
import type {ShownCapture, ShownSpot} from './howRightAll.ts';

const HOUR = 3600000;
/** One spot at the hour: score (null = not rated), the engine's category (the client derives the band and the word from it, exactly as for a pin), whether the hour is after dark there,
 *  and when the model run behind it was retrieved (minutes since the epoch; the older of the marine and the wind copy). */
export type SnapshotEntry = [score: number | null, category: string | null, dark: 0 | 1, retrievedMin: number];
export type CoastSnapshot =
  | {ok: true; date: string; capturedAt: string; t: string; /** the first and last captured hour */ from: string; to: string; /** the oldest and the newest model-run retrieval among the rated spots */ retrievedFrom: string; retrievedTo: string; spots: Record<string, SnapshotEntry>}
  | {ok: false; reason: 'no-capture' | 'outside-capture' | 'bad-hour'; capturedAt?: string; from?: string; to?: string};

const spotById = new Map(allSpots.map((s) => [s.id, s]));
type Hourly = ShownSpot['marine'];
const oneHour = (h: Hourly, i: number): Hourly => { const out: Hourly = {time: [h.time[i]]}; for (const k of Object.keys(h)) if (k !== 'time') out[k] = [h[k][i] ?? null]; return out; };
const asResponse = (h: Hourly, units: Record<string, string>) => ({hourly: h as unknown as Record<string, unknown[]>, hourly_units: {time: 'unixtime', ...units}});

/** When the model run behind a captured spot was retrieved: the OLDER of its marine and wind copies (a cached copy can be hours old). The rating is judged at that moment, "as of the run": its lead-dependent ceiling counts the hours from the run to the hour shown. */
export function retrievedMs(c: ShownSpot): number {
  const a = Date.parse(c.retrievedAt), b = Date.parse(c.windRetrievedAt), ok = [a, b].filter(Number.isFinite); return ok.length ? Math.min(...ok) : Date.parse(c.ratedAt);
}
/** Re-rate one captured spot at one hour (unix seconds). Null when the capture has no marine or no wind value at that hour, or the spot is no longer in the catalogue. */
export function ratingAt(spotId: string, c: ShownSpot, tSec: number): SnapshotEntry | null {
  const ev = evidenceSpot(spotId), spot = spotById.get(spotId), i = c.marine?.time?.indexOf(tSec) ?? -1, j = c.wind?.time?.indexOf(tSec) ?? -1;
  if (!ev || !spot || i < 0 || j < 0) return null;
  try {
    const recs = normalizeOpenMeteo(ev, asResponse(oneHour(c.marine, i), c.marineUnits ?? {}), asResponse(oneHour(c.wind, j), c.windUnits ?? {}), c.retrievedAt), r = recs.find((x) => Date.parse(x.timestamp) === tSec * 1000);
    if (!r) return null;
    const got = retrievedMs(c), rt = rateForecast(spot, toLegacy(r), got);   // night is not suppressed: the rating carries `dark`
    return [typeof rt.score === 'number' && Number.isFinite(rt.score) ? rt.score : null, rt.score === null || rt.score === undefined ? null : rt.category ?? null, rt.dark ? 1 : 0, Math.floor(got / 60000)];
  } catch { return null; }
}
/** The captured hours: those present in the first spot that has any (every spot is captured from the same whole hour for the same 48). */
export function captureWindow(cap: ShownCapture): {from: number; to: number} | null {
  for (const s of Object.values(cap.spots)) { const t = s?.marine?.time; if (Array.isArray(t) && t.length) return {from: t[0] * 1000, to: t[t.length - 1] * 1000}; }
  return null;
}
/** The whole catalogue's snapshot at `tMs` (a whole hour) from one capture. `spots` has an entry only for spots rated at that hour. */
export function snapshotAt(cap: ShownCapture | null, tMs: number): CoastSnapshot {
  if (!Number.isFinite(tMs) || tMs % HOUR !== 0) return {ok: false, reason: 'bad-hour'};
  const w = cap ? captureWindow(cap) : null; if (!cap || !w) return {ok: false, reason: 'no-capture'};
  const iso = (ms: number) => new Date(ms).toISOString();
  if (tMs < w.from || tMs > w.to) return {ok: false, reason: 'outside-capture', capturedAt: cap.capturedAt, from: iso(w.from), to: iso(w.to)};
  const spots: Record<string, SnapshotEntry> = {}; let lo = Infinity, hi = -Infinity;
  for (const [id, s] of Object.entries(cap.spots)) { const e = ratingAt(id, s, tMs / 1000); if (e) { spots[id] = e; lo = Math.min(lo, e[3]); hi = Math.max(hi, e[3]); } }
  if (!Object.keys(spots).length) return {ok: false, reason: 'no-capture'};
  return {ok: true, date: cap.date, capturedAt: cap.capturedAt, t: iso(tMs), from: iso(w.from), to: iso(w.to), retrievedFrom: iso(lo * 60000), retrievedTo: iso(hi * 60000), spots};
}

/** "How right we've been" for every spot (round 4C). Beyond the California MOP check (services/howRight.ts), this scores the OFFSHORE forecast and the RATING for any spot
 *  that has an eligible buoy (src/ocean/scoringBuoys.ts), and says plainly when it has none.
 *  Each day the Worker captures what we SHOWED for the next 48 h (howright/v2/shown/<date>.json):
 *    - per spot: the Open-Meteo marine and wind hourly arrays at the app's points, and the app's rating for each of those hours (same engine as the page: rateForecast on normalizeOpenMeteo);
 *    - per buoy used: the Open-Meteo marine forecast at the BUOY's position (what the offshore forecast said where the buoy floats).
 *  Scoring (daily) compares, for hours whose shown copy is at least 12 h old:
 *    - OFFSHORE: the buoy-position forecast against the buoy's measured total Hs (NDBC realtime2 `.spec` WVHT), and against NDBC's published swell partition (SwH, SwP, SwD) where it has one;
 *    - RATING: the rating we showed for the spot against the OBSERVED-FED rating: the same engine fed the buoy's measured Hs and swell split, and the wind of the spot's shore station where one exists
 *      (the forecast wind otherwise, said so). Judged on daylight hours, per local day, in bands.
 *  Never a number from a thin sample: "collecting: N days so far". Pure apart from nothing: callers hand in the data. */
import {normalizeOpenMeteo, faceEstimate} from '../ocean/openMeteo.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {allSpots} from '../data/catalog.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {categoryForScore, ratingBands} from '../ratings/engine.ts';
import {isDark} from './daylight.ts';
import {timeZoneOf} from '../ocean/spotZone.ts';
import {dateInMs} from '../ocean/time.ts';
import type {OceanRecord, Measurement} from '../ocean/types.ts';
import type {BuoyPick} from '../ocean/scoringBuoys.ts';
import {silentBuoyNear, silentBuoyWords, silentBuoyNearerThan, nearerBuoyNotUsed, SCORING_RULE, windowOf} from '../ocean/scoringBuoys.ts';

const HOUR = 3600000, DAY = 86400000, FT = 1 / 0.3048, KT_MPH = 1.150779, MS_MPH = 2.236936;
export const HRA_RULE = {
  /** hours captured each day, from the next whole hour */ captureHours: 48,
  /** "what we showed" for an hour = the latest capture made at least this long before it */ shownMinLeadH: 12,
  /** a buoy reading counts for an hour when it is within this of the hour */ obsToleranceMin: 30,
  /** a day counts as a day of data with at least half a day of paired hours */ minHoursPerDay: 12,
  /** the 7-day figure needs this many days of data, the 30-day figure this many; below that: "collecting" */ minDays7: 3, minDays30: 14,
  /** a rating day needs this many daylight hours paired */ minDaylightHours: 4,
  /** a swell-height / direction pair counts only above this swell height (m): at "flat" the direction is noise */ minSwellM: 0.5,
  windows: [7, 30] as const,
  /** a cached copy of a spot's marine / wind forecast at most this old is "what we showed"; older is fetched again */ cacheMaxAgeH: {marine: 6, weather: 4},
} as const;

/* ---------- capture: what we showed ---------- */
type Hourly = {time: number[]} & Record<string, (number | null)[]>;
type Units = Record<string, string>;
export interface ShownSpot {retrievedAt: string; windRetrievedAt: string; /** the `now` the rating was judged at (its lead-dependent ceiling): the observed-fed rating is judged at the same one */ ratedAt: string; source: 'cache' | 'fetched'; marine: Hourly; wind: Hourly; /** the providers' native units (the record builder checks them) */ marineUnits: Units; windUnits: Units; /** the rating (score 0-100) of each captured hour, null when it could not be rated */ rating: (number | null)[]}
export interface ShownBuoy {lat: number; lon: number; /** the model cell Open-Meteo actually returned for the buoy's position */ grid?: {lat: number; lon: number}; retrievedAt: string; marine: Hourly; marineUnits: Units}
export interface ShownCapture {schema: 2; date: string; capturedAt: string; spots: Record<string, ShownSpot>; buoys: Record<string, ShownBuoy>}
export const MARINE_KEEP = ['wave_height', 'swell_wave_height', 'swell_wave_direction', 'swell_wave_period', 'secondary_swell_wave_height', 'secondary_swell_wave_direction', 'secondary_swell_wave_period', 'sea_surface_temperature'] as const;
export const WIND_KEEP = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'] as const;
type Payload = {hourly?: Record<string, unknown[]>; hourly_units?: Record<string, string>; latitude?: number; longitude?: number} | null | undefined;
const unitsOf = (p: Payload, keep: readonly string[]): Units => Object.fromEntries(keep.filter((k) => typeof p?.hourly_units?.[k] === 'string').map((k) => [k, p!.hourly_units![k]]));
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The hours [from, from + captureHours) of an Open-Meteo payload (unixtime, GMT), only the fields we keep. Null when the payload has no hours in range. */
export function sliceHourly(p: Payload, keep: readonly string[], fromMs: number, hours = HRA_RULE.captureHours): Hourly | null {
  const time = p?.hourly?.time; if (!Array.isArray(time)) return null;
  const idx: number[] = []; time.forEach((t, i) => { const ms = (num(t) ?? NaN) * 1000; if (ms >= fromMs && ms < fromMs + hours * HOUR) idx.push(i); });
  if (!idx.length) return null;
  const out: Hourly = {time: idx.map((i) => time[i] as number)};
  for (const k of keep) { const a = p!.hourly![k]; out[k] = idx.map((i) => (Array.isArray(a) ? num(a[i]) : null)); }
  return out;
}
const asResponse = (h: Hourly, units: Units, lat?: number, lon?: number) => ({hourly: h as unknown as Record<string, unknown[]>, hourly_units: {time: 'unixtime', ...units}, latitude: lat, longitude: lon});
const spotById = new Map(allSpots.map((s) => [s.id, s]));
/** The rating of each captured hour, with the engine the page uses (rateForecast on the normalised Open-Meteo record; no dark mark; judged at `nowMs`). */
export function ratingsFor(spotId: string, marine: Hourly, mu: Units, wind: Hourly, wu: Units, retrievedAt: string, nowMs: number): (number | null)[] {
  const ev = evidenceSpot(spotId), spot = spotById.get(spotId); if (!ev || !spot) return marine.time.map(() => null);
  const recs = normalizeOpenMeteo(ev, asResponse(marine, mu), asResponse(wind, wu), retrievedAt), byT = new Map(recs.map((r) => [Date.parse(r.timestamp), r]));
  return marine.time.map((t) => { const r = byT.get(t * 1000); if (!r) return null; try { const s = rateForecast(spot, toLegacy(r), nowMs, {night: false}).score; return Number.isFinite(s) ? s : null; } catch { return null; } });
}
/** One spot's entry of the day's capture, from the marine and wind payloads we hold (the cached copies the page reads, or a fresh fetch). Null when either has no hours. */
export function captureSpot(spotId: string, marine: Payload, wind: Payload, marineAt: string, windAt: string, source: ShownSpot['source'], nowMs: number): ShownSpot | null {
  const from = Math.ceil(nowMs / HOUR) * HOUR, m = sliceHourly(marine, MARINE_KEEP, from), w = sliceHourly(wind, WIND_KEEP, from);
  if (!m || !w) return null;
  const mu = unitsOf(marine, MARINE_KEEP), wu = unitsOf(wind, WIND_KEEP);
  return {retrievedAt: marineAt, windRetrievedAt: windAt, ratedAt: new Date(nowMs).toISOString(), source, marine: m, wind: w, marineUnits: mu, windUnits: wu, rating: ratingsFor(spotId, m, mu, w, wu, marineAt, nowMs)};
}
export function captureBuoy(lat: number, lon: number, marine: Payload, retrievedAt: string, nowMs: number): ShownBuoy | null {
  const m = sliceHourly(marine, MARINE_KEEP, Math.ceil(nowMs / HOUR) * HOUR); const g = num(marine?.latitude) !== null && num(marine?.longitude) !== null ? {grid: {lat: marine!.latitude as number, lon: marine!.longitude as number}} : {};
  return m ? {lat, lon, ...g, retrievedAt, marine: m, marineUnits: unitsOf(marine, MARINE_KEEP)} : null;
}

/* ---------- observations ---------- */
export interface BuoyHour {hsM: number | null; swH: number | null; swP: number | null; swD: number | null; wwH: number | null; wwP: number | null; wwD: number | null}
const COMPASS16: Record<string, number> = {N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5};
const nn = (s: string | undefined) => (s === undefined || s === 'MM' || s === '' || !Number.isFinite(Number(s)) ? null : Number(s));
/** NDBC realtime2 `.spec` (metres, seconds, compass points) -> the reading nearest each whole hour, within `obsToleranceMin` of it. Lines newest first or oldest first. */
export function parseSpec(text: string, tolMin = HRA_RULE.obsToleranceMin): Map<number, BuoyHour> {
  const best = new Map<number, {d: number; h: BuoyHour}>();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const c = line.trim().split(/\s+/); if (c.length < 12) continue;
    const t = Date.UTC(+c[0], +c[1] - 1, +c[2], +c[3], +c[4]); if (!Number.isFinite(t)) continue;
    const hr = Math.round(t / HOUR) * HOUR, d = Math.abs(t - hr); if (d > tolMin * 60000) continue;
    const dir = (s: string) => (s in COMPASS16 ? COMPASS16[s] : null);
    const h: BuoyHour = {hsM: nn(c[5]), swH: nn(c[6]), swP: nn(c[7]), wwH: nn(c[8]), wwP: nn(c[9]), swD: dir(c[10]), wwD: dir(c[11])};
    const old = best.get(hr); if (!old || d < old.d) best.set(hr, {d, h});
  }
  return new Map([...best].map(([t, v]) => [t, v.h]));
}
export interface WindObs {mph: number; dir: number; gust: number | null}
/** NDBC realtime2 `.txt` (WDIR degT, WSPD m/s, GST m/s) -> the reading nearest each whole hour within 10 minutes. */
export function parseNdbcWind(text: string): Map<number, WindObs> {
  const out = new Map<number, {d: number; w: WindObs}>(), lines = text.split(/\r?\n/), head = lines.find((l) => l.startsWith('#YY'))?.replace('#', '').trim().split(/\s+/) ?? [];
  const iD = head.indexOf('WDIR'), iS = head.indexOf('WSPD'), iG = head.indexOf('GST'); if (iD < 0 || iS < 0) return new Map();
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const c = line.trim().split(/\s+/), t = Date.UTC(+c[0], +c[1] - 1, +c[2], +c[3], +c[4]); if (!Number.isFinite(t)) continue;
    const hr = Math.round(t / HOUR) * HOUR, d = Math.abs(t - hr); if (d > 10 * 60000) continue;
    const dir = nn(c[iD]), sp = nn(c[iS]); if (dir === null || sp === null || dir < 0 || dir > 360 || sp < 0 || sp > 60) continue;
    const g = iG >= 0 ? nn(c[iG]) : null, old = out.get(hr); if (!old || d < old.d) out.set(hr, {d, w: {mph: sp * MS_MPH, dir, gust: g === null ? null : g * MS_MPH}});
  }
  return new Map([...out].map(([t, v]) => [t, v.w]));
}
/** IEM ASOS CSV (station,valid,drct,sknt,gust; UTC) -> the reading nearest each whole hour within 10 minutes. Calm / variable direction readings are dropped. */
export function parseAsosWind(csv: string): Map<number, WindObs> {
  const out = new Map<number, {d: number; w: WindObs}>(), lines = csv.trim().split(/\r?\n/);
  if (!/^station,valid,drct,sknt/.test(lines[0] ?? '')) return new Map();
  for (const l of lines.slice(1)) {
    const [, v, wd, ws, gs] = l.split(','), t = Date.parse((v ?? '').replace(' ', 'T') + ':00Z'); if (!Number.isFinite(t) || ws === 'M' || ws === undefined || wd === 'M') continue;
    const hr = Math.round(t / HOUR) * HOUR, d = Math.abs(t - hr); if (d > 10 * 60000) continue;
    const mph = Number(ws) * KT_MPH, dir = Number(wd); if (!(mph >= 0 && mph <= 70) || !Number.isFinite(dir)) continue;
    const g = gs === undefined || gs === 'M' ? null : Number(gs) * KT_MPH, old = out.get(hr); if (!old || d < old.d) out.set(hr, {d, w: {mph, dir, gust: Number.isFinite(g as number) ? g : null}});
  }
  return new Map([...out].map(([t, v]) => [t, v.w]));
}
/** IEM ASOS request for a station over the window (UTC days). */
export function iemAsosURL(id: string, fromMs: number, toMs: number): string {
  const a = new Date(fromMs), b = new Date(toMs + DAY);
  const q = new URLSearchParams({station: id, tz: 'Etc/UTC', format: 'onlycomma', latlon: 'no', missing: 'M', trace: 'T', report_type: '3', year1: String(a.getUTCFullYear()), month1: String(a.getUTCMonth() + 1), day1: String(a.getUTCDate()), year2: String(b.getUTCFullYear()), month2: String(b.getUTCMonth() + 1), day2: String(b.getUTCDate())});
  return `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?${q}&data=drct&data=sknt&data=gust`;
}

/* ---------- which shown copy: the latest made at least shownMinLeadH before the hour ---------- */
export interface ShownRef {cap: number; i: number; leadH: number}
/** For every hour covered by `pick(capture)`'s time array, the latest capture whose retrieval was >= shownMinLeadH before it. `pick` returns that capture's `time` (unixtime s) and when it was retrieved. */
export function shownIndex(captures: ShownCapture[], pick: (c: ShownCapture) => {time: number[]; retrievedAt: string} | undefined, minLeadH = HRA_RULE.shownMinLeadH): Map<number, ShownRef & {r: number}> {
  const out = new Map<number, ShownRef & {r: number}>();
  captures.forEach((c, cap) => {
    const p = pick(c), r = Date.parse(p?.retrievedAt ?? ''); if (!p || !Number.isFinite(r)) return;
    p.time.forEach((ts, i) => { const t = ts * 1000, lead = (t - r) / HOUR; if (lead < minLeadH) return; const old = out.get(t); if (!old || r > old.r) out.set(t, {cap, i, leadH: lead, r}); });
  });
  return out;
}
/** Streaming form of `shownIndex`: captures are handed over NEWEST FIRST, one at a time (the Worker never holds more than one parsed capture), and each hour is CLAIMED by the first (= latest) capture
 *  that is old enough, whether or not it ends up paired: an hour is never filled from an older copy. Same result as `shownIndex` on the same captures. */
export const newestFirst = <T extends {capturedAt: string}>(captures: T[]): T[] => [...captures].sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
const claimHours = (time: number[], retrievedAt: string, claimed: Set<number>, minLeadH = HRA_RULE.shownMinLeadH): {t: number; i: number; leadH: number}[] => {
  const r = Date.parse(retrievedAt); if (!Number.isFinite(r)) return [];
  const out: {t: number; i: number; leadH: number}[] = [];
  time.forEach((ts, i) => { const t = ts * 1000, lead = (t - r) / HOUR; if (lead < minLeadH || claimed.has(t)) return; claimed.add(t); out.push({t, i, leadH: lead}); });
  return out;
};

/* ---------- statistics ---------- */
const median = (x: number[]) => { const s = [...x].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = (n: number) => Math.round(n * 100) / 100, r1 = (n: number) => Math.round(n * 10) / 10;
const angDiff = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
export interface ErrStat {n: number; /** median |forecast - buoy|: half the hours were closer than this */ typical: number; /** mean (forecast - buoy): + = ran high */ bias: number; mae: number}
export function errStat(pairs: {fc: number; ob: number}[], circular = false): ErrStat | null {
  if (!pairs.length) return null;
  const d = pairs.map((p) => (circular ? angDiff(p.fc, p.ob) : Math.abs(p.fc - p.ob)));
  return {n: pairs.length, typical: r2(median(d)), bias: circular ? 0 : r2(pairs.reduce((a, p) => a + (p.fc - p.ob), 0) / pairs.length), mae: r2(d.reduce((a, x) => a + x, 0) / d.length)};
}

export interface OffshorePair {t: number; leadH: number; fcHs: number | null; obHs: number | null; fcSw: number | null; obSw: number | null; fcSwP: number | null; obSwP: number | null; fcSwD: number | null; obSwD: number | null}
/** One capture's pairs for a buoy (the claimed hours of `claimed` are skipped and the new ones added): hours in (fromMs, toMs] that the buoy also reported. */
export function offshoreRows(c: ShownCapture, buoyId: string, obs: Map<number, BuoyHour>, claimed: Set<number>, fromMs: number, toMs: number): OffshorePair[] {
  const b = c.buoys[buoyId]; if (!b) return [];
  const out: OffshorePair[] = [];
  for (const h of claimHours(b.marine.time, b.retrievedAt, claimed)) {
    if (h.t <= fromMs || h.t > toMs) continue; const o = obs.get(h.t); if (!o) continue;
    const g = (k: string) => b.marine[k]?.[h.i] ?? null;
    out.push({t: h.t, leadH: h.leadH, fcHs: g('wave_height'), obHs: o.hsM, fcSw: g('swell_wave_height'), obSw: o.swH, fcSwP: g('swell_wave_period'), obSwP: o.swP, fcSwD: g('swell_wave_direction'), obSwD: o.swD});
  }
  return out;
}
/** Pairs of (forecast at the buoy position as we showed it) and (the buoy) for every hour in (fromMs, toMs]. */
export function offshorePairs(captures: ShownCapture[], buoyId: string, obs: Map<number, BuoyHour>, fromMs: number, toMs: number): OffshorePair[] {
  const claimed = new Set<number>(); return newestFirst(captures).flatMap((c) => offshoreRows(c, buoyId, obs, claimed, fromMs, toMs)).sort((a, b) => a.t - b.t);
}
export interface OffshoreWindow {days: number; /** days (UTC) with at least minHoursPerDay paired hours */ daysWithData: number; n: number; from: string; to: string; hs: ErrStat | null; /** the buoy's published swell partition vs ours: only with the same minimum days as the height, else null ("too few hours") */ swell: {height: ErrStat | null; periodS: ErrStat | null; directionDeg: ErrStat | null} | null}
const dayCount = (ts: number[]) => { const m = new Map<string, number>(); for (const t of ts) { const d = new Date(t).toISOString().slice(0, 10); m.set(d, (m.get(d) ?? 0) + 1); } return [...m.values()].filter((n) => n >= HRA_RULE.minHoursPerDay).length; };
/** the minimum days of data a window needs before it shows a number: 7 days -> 3, 30 days -> 14 */
export const minDaysFor = (days: number) => (days <= 7 ? HRA_RULE.minDays7 : HRA_RULE.minDays30);
export function offshoreWindow(pairs: OffshorePair[], nowMs: number, days: number): OffshoreWindow {
  const p = pairs.filter((x) => x.t > nowMs - days * DAY && x.t <= nowMs), hs = p.filter((x) => x.fcHs !== null && x.obHs !== null), sw = p.filter((x) => x.fcSw !== null && x.obSw !== null);
  const big = sw.filter((x) => x.fcSw! >= HRA_RULE.minSwellM && x.obSw! >= HRA_RULE.minSwellM), need = minDaysFor(days);
  const enough = (xs: {t: number}[]) => Math.min(days, dayCount(xs.map((x) => x.t))) >= need;   // the same minimum as the height
  const per = big.filter((x) => x.fcSwP !== null && x.obSwP !== null), dir = big.filter((x) => x.fcSwD !== null && x.obSwD !== null);
  const swell = sw.length ? {height: enough(sw) ? errStat(sw.map((x) => ({fc: x.fcSw!, ob: x.obSw!}))) : null, periodS: enough(per) ? errStat(per.map((x) => ({fc: x.fcSwP!, ob: x.obSwP!}))) : null, directionDeg: enough(dir) ? errStat(dir.map((x) => ({fc: x.fcSwD!, ob: x.obSwD!})), true) : null} : null;
  return {days, daysWithData: Math.min(days, dayCount(hs.map((x) => x.t))), n: hs.length, from: hs.length ? new Date(hs[0].t).toISOString() : '', to: hs.length ? new Date(hs[hs.length - 1].t).toISOString() : '', hs: errStat(hs.map((x) => ({fc: x.fcHs!, ob: x.obHs!}))), swell};
}

/* ---------- the observed-fed rating ---------- */
const meas = (value: number | null, unit: Measurement['unit'], base: Measurement, provider: string, note: string): Measurement => ({value, unit, source: {...base.source, provider, kind: 'observation' as never, notes: note}});
/** The rating the engine gives when fed the BUOY'S READINGS (offshore, not at the break): its total Hs (combined), its published swell as the primary swell, no secondary; the shore station's wind where one exists
 *  (else `base`'s own forecast wind). Everything else is `base` (the record we showed). Judged at `nowMs`: callers pass the `now` the SHOWN rating was judged at, so both share the lead-dependent ceiling.
 *  Null when the buoy published no swell split for that hour. */
export function observedRating(spotId: string, base: OceanRecord, o: BuoyHour, wind: WindObs | null, nowMs: number): number | null {
  if (o.hsM === null || o.swH === null || o.swP === null || o.swD === null) return null;
  const ev = evidenceSpot(spotId), spot = spotById.get(spotId); if (!ev || !spot) return null;
  const offshore = meas(o.hsM * FT, 'ft', base.offshore, 'buoy', 'Buoy total height (NDBC .spec WVHT).');
  const primary = {height: meas(o.swH * FT, 'ft', base.primary.height, 'buoy', 'Buoy swell height (NDBC .spec SwH).'), period: meas(o.swP, 's', base.primary.period, 'buoy', 'Buoy swell period (NDBC .spec SwP).'), direction: meas(o.swD, 'deg', base.primary.direction, 'buoy', 'Buoy swell direction (NDBC .spec SwD).')};
  const rec: OceanRecord = {...base, offshore, primary, secondary: null, faceEstimate: faceEstimate(ev, offshore, primary, null),
    ...(wind ? {windSpeed: meas(wind.mph, 'mph', base.windSpeed, 'station', 'Shore station wind.'), windDirection: meas(wind.dir, 'deg', base.windDirection, 'station', 'Shore station wind.'), gusts: meas(wind.gust, 'mph', base.gusts, 'station', 'Shore station wind.')} : {})};
  try { const s = rateForecast(spot, toLegacy(rec), nowMs, {night: false}).score; return Number.isFinite(s) ? s : null; } catch { return null; }
}
export interface RatingPair {t: number; day: string; shown: number; observed: number; /** the shore station's wind fed this hour (else the shown forecast wind) */ station: boolean}
/** One capture's rating pairs for a spot, newest capture first with `claimed` shared: daylight hours where we have both the rating we showed and the observed-fed one. The observed-fed rating is judged at the
 *  `ratedAt` of the shown one (its capture tick), so the lead-dependent ceiling is the same. `wind(t)` = the shore station's reading for an hour, or null. */
export function ratingRows(spotId: string, c: ShownCapture, obs: Map<number, BuoyHour>, wind: (t: number) => WindObs | null, claimed: Set<number>, fromMs: number, toMs: number): RatingPair[] {
  const s = c.spots[spotId]; if (!s) return [];
  const ev = evidenceSpot(spotId), tz = timeZoneOf(spotId), ratedMs = Date.parse(s.ratedAt ?? c.capturedAt), out: RatingPair[] = [];
  let recs: Map<number, OceanRecord> | null = null;
  for (const h of claimHours(s.marine.time, s.retrievedAt, claimed)) {
    if (h.t <= fromMs || h.t > toMs) continue;
    const o = obs.get(h.t), shown = s.rating[h.i]; if (!o || shown === null || shown === undefined) continue;
    if (isDark(spotId, new Date(h.t).toISOString())) continue;
    recs ??= new Map(normalizeOpenMeteo(ev, asResponse(s.marine, s.marineUnits), asResponse(s.wind, s.windUnits), s.retrievedAt).map((r) => [Date.parse(r.timestamp), r]));
    const base = recs.get(h.t); if (!base) continue; const w = wind(h.t), v = observedRating(spotId, base, o, w, Number.isFinite(ratedMs) ? ratedMs : Date.parse(c.capturedAt)); if (v === null) continue;
    out.push({t: h.t, day: dateInMs(tz, h.t), shown, observed: v, station: !!w});
  }
  return out;
}
export function ratingPairs(spotId: string, captures: ShownCapture[], obs: Map<number, BuoyHour>, wind: (t: number) => WindObs | null, fromMs: number, toMs: number): {pairs: RatingPair[]; windHours: number} {
  const claimed = new Set<number>(), pairs = newestFirst(captures).flatMap((c) => ratingRows(spotId, c, obs, wind, claimed, fromMs, toMs)).sort((a, b) => a.t - b.t);
  return {pairs, windHours: pairs.filter((x) => x.station).length};
}
const bandIndex = (score: number) => ratingBands.findIndex((b) => score >= b.min);   // 0 = EPIC ... 7 = POOR
export interface RatingWindow {days: number; /** local days with enough daylight hours paired */ daysScored: number; withinOneBand: number; exact: number; /** days we showed a band (or more) BETTER / WORSE than the buoy-readings rating */ high: number; low: number; /** median |shown - buoy-readings rating| over the days, points of 100 */ typicalPoints: number}
export function ratingWindow(pairs: RatingPair[], nowMs: number, days: number): RatingWindow {
  const p = pairs.filter((x) => x.t > nowMs - days * DAY && x.t <= nowMs), byDay = new Map<string, RatingPair[]>();
  for (const x of p) (byDay.get(x.day) ?? byDay.set(x.day, []).get(x.day)!).push(x);
  let n = 0, within = 0, exact = 0, high = 0, low = 0; const diffs: number[] = [];
  for (const g of byDay.values()) {
    if (g.length < HRA_RULE.minDaylightHours) continue;
    const a = median(g.map((x) => x.shown)), b = median(g.map((x) => x.observed)), d = bandIndex(a) - bandIndex(b);   // band 0 = EPIC ... 7 = POOR: d < 0 means we showed a better band than the buoy-readings rating
    n++; diffs.push(Math.abs(a - b)); if (Math.abs(d) <= 1) within++; if (d === 0) exact++; if (d <= -1) high++; if (d >= 1) low++;
  }
  return {days, daysScored: n, withinOneBand: within, exact, high, low, typicalPoints: diffs.length ? Math.round(median(diffs)) : 0};
}
export const bandName = (score: number) => categoryForScore(score);

/* ---------- the card ---------- */
export interface HowRightAllBuoy {id: string; name: string; km: number; bearing: number; /** the spot's sourced swell window the bearing is inside */ window: [number, number]; split: boolean; /** why this buoy is classed as it is (e.g. an open embayment), when the list says */ note?: string | null; /** km from the buoy to the model cell Open-Meteo returned for its position, when known */ gridKm?: number | null}
type StationRef = {id: string; name: string; km: number};
export interface RatingBlock {d7: RatingWindow | null; d30: RatingWindow | null; /** local days scored in the 7- and 30-day windows, shown while collecting */ daysScored7: number; daysScored30: number; /** 'station' = every paired hour had the station's wind, 'mixed' = some, 'forecast' = none */ wind: 'station' | 'mixed' | 'forecast'; windHours: number; hours: number; station: StationRef | null; /** why no station wind: none assigned, or its data could not be fetched */ stationNote: string | null; why: string | null}
type Scored = {status: 'ok'; spotId: string; buoy: HowRightAllBuoy; haveDays: number; d7: OffshoreWindow | null; d30: OffshoreWindow | null; rating: RatingBlock}
type Collecting = {status: 'collecting'; spotId: string; buoy: HowRightAllBuoy; haveDays: number; needDays: number}
export type HowRightAllSpot = Scored | Collecting
  /** the buoy's data could not be fetched today: the history is kept as the last check (`last`, from `lastAt`) */
  | {status: 'skipped'; spotId: string; buoy: HowRightAllBuoy; reason: string; last: Scored | Collecting | null; lastAt: string | null}
  | {status: 'no-buoy'; spotId: string; reason: string; nearest: {id: string; name: string; km: number} | null};
export interface HowRightAllCard {schema: 2; computedAt: string; from: string; to: string; captureDays: number; firstCapture: string | null; rule: {minDays7: number; minDays30: number; shownMinLeadH: number; maxKm: number; windows: readonly number[]}; buoys: Record<string, {name: string; ok: boolean; why: string | null}>; spots: Record<string, HowRightAllSpot>}

export interface ResultOpts {ratingWhy?: string | null; stationFailed?: boolean; gridKm?: number | null}
/** Build one spot's entry from its pairs. `haveDays` = days (UTC) with enough paired offshore hours in the last 30 days. */
export function spotResult(spotId: string, pick: BuoyPick, split: boolean, pairs: OffshorePair[], rating: {pairs: RatingPair[]; windHours: number}, station: StationRef | null, nowMs: number, opts: ResultOpts = {}): Scored | Collecting {
  const buoy: HowRightAllBuoy = {id: pick.buoy.id, name: pick.buoy.name, km: pick.km, bearing: pick.bearing, window: [pick.window.fromDeg, pick.window.toDeg], split, note: pick.buoy.why ?? null, gridKm: opts.gridKm ?? null};
  const w7 = offshoreWindow(pairs, nowMs, 7), w30 = offshoreWindow(pairs, nowMs, 30), haveDays = w30.daysWithData;
  if (haveDays < HRA_RULE.minDays7) return {status: 'collecting', spotId, buoy, haveDays, needDays: HRA_RULE.minDays7};
  const r7 = ratingWindow(rating.pairs, nowMs, 7), r30 = ratingWindow(rating.pairs, nowMs, 30), hours = rating.pairs.length, wh = rating.windHours;
  const wind: RatingBlock['wind'] = !station || wh === 0 ? 'forecast' : wh === hours ? 'station' : 'mixed';
  return {status: 'ok', spotId, buoy, haveDays, d7: w7.daysWithData >= HRA_RULE.minDays7 ? w7 : null, d30: haveDays >= HRA_RULE.minDays30 ? w30 : null,
    rating: {d7: r7.daysScored >= HRA_RULE.minDays7 ? r7 : null, d30: r30.daysScored >= HRA_RULE.minDays30 ? r30 : null, daysScored7: r7.daysScored, daysScored30: r30.daysScored, wind, windHours: wind === 'forecast' ? 0 : wh, hours, station: wind === 'forecast' ? null : station,
      stationNote: wind !== 'forecast' ? null : opts.stationFailed && station ? `the station's data (${station.id}) could not be fetched` : station ? `the station (${station.id}) had no reading for these hours` : 'no shore station within 4 km', why: opts.ratingWhy ?? (split ? null : 'this buoy publishes no swell split, so we do not rate from it')}};
}

/* ---------- words (one function per line, every surface) ---------- */
/** a height difference in the person's unit, rounded to one decimal; "0.0" is not a difference, so it reads as no lean */
const mText = (m: number, unit: 'ft' | 'm') => (unit === 'm' ? `${(Math.round(Math.abs(m) * 10) / 10).toFixed(1)} m` : `${(Math.round(Math.abs(m) / 0.3048 * 10) / 10).toFixed(1)} ft`);
export const leanOf = (biasM: number, unit: 'ft' | 'm') => (mText(biasM, unit).startsWith('0.0') ? 'no lean high or low' : `ran ${mText(biasM, unit)} ${biasM > 0 ? 'high' : 'low'}`);
export const collectingText = (haveDays: number, needDays: number = HRA_RULE.minDays7) => `collecting: ${haveDays} ${haveDays === 1 ? 'day' : 'days'} so far (we need ${needDays} before showing a number)`;
/** One phrase on both lines: the median absolute difference. */
export const TYPICAL_DIFF = 'typical difference';
export const TYPICAL_DIFF_NOTE = 'Typical difference = the median absolute difference: half the hours were closer than this. Lean = our forecast minus the buoy.';
export const OFFSHORE_PREFIX = 'Offshore wave height at the buoy (not surf at the spot):';
/** What was compared, exactly: "Hs forecast at buoy 51201's position (Waimea Bay) vs the buoy, 18 km from this spot". */
export const comparedText = (b: HowRightAllBuoy, spotId?: string) => {
  let note = ''; if (spotId) { try { const ev = evidenceSpot(spotId), n = nearerBuoyNotUsed({lat: ev.latitude, lon: ev.longitude}, b.id, windowOf(spotId)); if (n) note = `; the nearer buoy ${n.name} (${n.id}, ${n.km} km) is not used because ${n.why}`; const sn = silentBuoyNearerThan(ev.latitude, ev.longitude, b.km); if (sn) note += `; ${silentBuoyWords(sn, false)}`; } catch { /* no position: no note */ } }
  return `Hs forecast at buoy ${b.id}'s position (${b.name}) vs the buoy, ${Math.round(b.km)} km from this spot${note}`;
};
const dayUtc = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const diffs = (w: OffshoreWindow, unit: 'ft' | 'm') => `${TYPICAL_DIFF} ${mText(w.hs!.typical, unit)}, ${leanOf(w.hs!.bias, unit)}`;
export function offshoreLine(s: HowRightAllSpot, unit: 'ft' | 'm' = 'ft'): {text: string; hasNumber: boolean} {
  if (s.status === 'no-buoy') { const sp = allSpots.find((x) => x.id === s.spotId), ev = sp ? (() => { try { return evidenceSpot(s.spotId); } catch { return null; } })() : null, silent = ev ? silentBuoyNear(ev.latitude, ev.longitude) : null;   // a stored "no wave buoy within 100 km" is said again at display time with the silent buoy named
    return {text: `No offshore check: ${silent && s.reason.startsWith(`no wave buoy within ${SCORING_RULE.maxKm} km`) ? silentBuoyWords(silent) : s.reason}.`, hasNumber: false}; }
  if (s.status === 'skipped') { const last = s.last ? offshoreLine(s.last, unit) : null; return {text: `Offshore check skipped today: buoy ${s.buoy.id}'s data could not be fetched.${last ? ` Last check${s.lastAt ? ` (${dayUtc(s.lastAt)} UTC)` : ''}: ${last.text}` : ''}`, hasNumber: !!last?.hasNumber}; }
  if (s.status === 'collecting') return {text: `${OFFSHORE_PREFIX} ${comparedText(s.buoy, s.spotId)}: ${collectingText(s.haveDays, s.needDays)}.`, hasNumber: false};
  const ws = [s.d7, s.d30].filter((w): w is OffshoreWindow => !!w?.hs); if (!ws.length) return {text: `${OFFSHORE_PREFIX} ${comparedText(s.buoy, s.spotId)}: too few hours to say.`, hasNumber: false};
  return {text: `${OFFSHORE_PREFIX} ${comparedText(s.buoy, s.spotId)}: ${ws.map((w, i) => `${i ? 'last 30 days: ' : ''}${diffs(w, unit)}${i ? '' : ` (last ${w.days} days)`}`).join('; ')}.`, hasNumber: true};
}
/** The wind that fed the buoy-readings rating, in a few words. */
export const windPhrase = (r: RatingBlock) => r.wind === 'station' && r.station ? `${r.station.id} wind` : r.wind === 'mixed' && r.station ? `${r.station.id} wind for ${r.windHours} of ${r.hours} hours, our forecast wind for the rest` : 'our forecast wind';
export const ratingSubject = (s: Scored | Collecting) => `Rating vs the rating from buoy ${s.buoy.id}'s readings${s.status === 'ok' ? ` (+ ${windPhrase(s.rating)})` : ''}, offshore, not at the break`;
export function ratingLine(s: HowRightAllSpot): {text: string; hasNumber: boolean} | null {
  if (s.status === 'no-buoy') return null;
  if (s.status === 'skipped') return s.last ? ratingLine(s.last) : null;
  if (s.status === 'collecting') return {text: `${ratingSubject(s)}: ${collectingText(s.haveDays, s.needDays)}.`, hasNumber: false};
  if (s.rating.why) return {text: `${ratingSubject(s)}: not compared, ${s.rating.why}.`, hasNumber: false};
  const w = s.rating.d7; if (!w) return {text: `${ratingSubject(s)}: ${collectingText(s.rating.daysScored7)}.`, hasNumber: false};
  const tail = w.high || w.low ? `; ${w.high ? `${w.high} ${w.high === 1 ? 'day' : 'days'} we showed a better band` : ''}${w.high && w.low ? ', ' : ''}${w.low ? `${w.low} ${w.low === 1 ? 'day' : 'days'} a worse one` : ''}` : '';
  const d30 = s.rating.d30 ? `; last 30 days: ${s.rating.d30.withinOneBand} of ${s.rating.d30.daysScored} scored days` : '';
  return {text: `${ratingSubject(s)}: ${w.withinOneBand} of ${w.daysScored} scored days within one band (last 7 days, daylight hours)${tail}${d30}.`, hasNumber: true};
}
/** What fed the buoy-readings rating, for the detail view. */
export function ratingBasis(s: Extract<HowRightAllSpot, {status: 'ok'}>): string {
  const r = s.rating, wind = r.wind === 'station' && r.station ? `the wind of ${r.station.name} (${r.station.id}, ${r.station.km} km) for every hour`
    : r.wind === 'mixed' && r.station ? `the wind of ${r.station.name} (${r.station.id}, ${r.station.km} km) for ${r.windHours} of ${r.hours} hours and our forecast wind for the rest` : `our forecast wind (${r.stationNote ?? 'no shore station'})`;
  return `The rating from buoy ${s.buoy.id}'s readings = our rating engine fed that buoy's height and published swell, with ${wind}. It describes the water at the buoy, not the break. Both ratings are judged at the same forecast lead; daylight hours, median per local day.`;
}
const POINTS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast', 'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
/** "north-northwest" for a bearing (the page needs it without importing the spot profiles). */
export const compassWord = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
export const round1 = r1;
/** Great-circle km between two points (for the model cell's distance from the buoy). */
export const kmBetween = (aLat: number, aLon: number, bLat: number, bLon: number) => { const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

// A fairer rating measurement (spec docs/specs/2026-11-09-round-3.md, 3D; 2026-11-09). A REPORT: no rating code changes.
// Run: ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/rating-audit-split.ts
// Public, keyless data only; at least 1.1 s between requests to one host; User-Agent "SWELLO surf forecast prototype"; same download cache (ACC_CACHE) as the two audits.
//
// The two rating audits (rating-audit.ts, California; rating-audit-hi-east.ts, Hawaii + US East) fed the engine's OBSERVED-FED rating the buoy's TOTAL
// wave height as the only swell (no wind-sea split, no secondary swell, no surf-range estimate), so the observed-fed number largely measured its own
// construction. This script rebuilds the observed-fed inputs the way the app builds its forecast inputs:
//   offshore (combined Hs)  = the buoy's total Hs (WVHT): swell AND wind-sea, as Open-Meteo's wave_height is for the app;
//   primary swell           = NDBC's published SWELL partition (SwH, SwP, SwD) from realtime2 `<id>.spec`;
//   wind-sea                = NDBC's WWH/WWP/WWD. The engine has no wind-sea input of its own (neither does the app's forecast record): wind-sea reaches it
//                             only through the combined Hs, exactly as in the app. So "wind-sea as wind-sea" = in the combined Hs, never in the swell.
//   secondary swell         = none (NDBC publishes one swell partition);
//   surf-range estimate     = faceEstimate() from src/ocean/openMeteo.ts on those inputs, as normalizeOpenMeteo does for the app.
// and rates it with rateForecast (src/ratings/adapters.ts, the engine both audits use; for an evidence record it is the provisional rating).
//
// Stations and spots are the two audits' own picks (read from rating-audit.json / rating-audit-hi-east.json), not re-chosen. "Poor" is each audit's own
// criterion, unchanged. Every split-method number is compared with the old method ON THE SAME HOURS.
//
// WINDOWS. NDBC publishes the split (.spec) only in realtime2, the last 45 days: the recent windows of both audits are covered. NDBC's historical archive
// (historical_data.shtml) has NO derived swell/wind-sea file, only the spectra (swden, swdir). Those exist only for NDBC-owned buoys; the CDIP-owned buoys
// that anchor every California spot and most HI/East spots are not in NDBC's historical swden (404). For the HI/East winter window the split is COMPUTED
// for the two NDBC-owned buoys with swden (44065, 41025) by Gilhousen & Hervey (2001) as implemented in ScientiMate seaswell1d (GH_RULE), checked first
// against NDBC's own published Sep_Freq / SwH on the realtime window (section "computed-split check"). The California archive window has no split: excluded.
// Writes docs/forecast/RATING-AUDIT-SPLIT.md (keeping anything after `<!-- notes -->`) and docs/forecast/data/rating-audit-split.json.
import fs from 'node:fs';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {allSpots} from '../../../src/data/catalog.ts';
import {assignmentFor} from '../../../src/ocean/mop.ts';
import {evidenceSpot} from '../../../src/ocean/spots.ts';
import {marineURL, weatherURL, normalizeOpenMeteo, faceEstimate} from '../../../src/ocean/openMeteo.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {rateForecast} from '../../../src/ratings/adapters.ts';
import {setOnshoreCapEnabled} from '../../../src/ratings/windRules.ts';
import {ONSHORE_BAD_MPH} from '../../../src/services/call.ts';
import {isDark} from '../../../src/services/daylight.ts';
import {asosURL, parseAsos} from './shore-wind.ts';
import {angle} from '../../../src/utils/units.ts';
import {OBSERVING_BUOYS, buoyFeedURL, parseCdipSeries, pairSeries, score, splitByTime, type HourSeries} from '../../../src/services/accuracy.ts';
import type {OceanRecord, Measurement} from '../../../src/ocean/types.ts';

const HOUR = 3600000, DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z'), day = (t: number) => iso(t).slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = 'SWELLO surf forecast prototype';
const CACHE = process.env.ACC_CACHE ?? null, cacheFile = (u: string) => `${CACHE}/${createHash('sha1').update(u).digest('hex')}.txt`;
const lastHit = new Map<string, number>(), failed: string[] = [];
/** Cached, polite GET. gz = gunzip the body (NDBC .txt.gz archives); the cache keeps the decompressed text. 404/400 = not published (null, not a failure). */
async function get(u: string, gz = false, tries = 4): Promise<string | null> {
  if (CACHE && fs.existsSync(cacheFile(u))) return fs.readFileSync(cacheFile(u), 'utf8');
  const host = new URL(u).host;
  for (let i = 0; i < tries; i++) {
    const wait = (lastHit.get(host) ?? 0) + 1100 - Date.now(); if (wait > 0) await sleep(wait); lastHit.set(host, Date.now());
    try {
      const r = await fetch(u, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(180000)});
      if (r.ok) { const t = gz ? zlib.gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8') : await r.text(); if (CACHE) { fs.mkdirSync(CACHE, {recursive: true}); fs.writeFileSync(cacheFile(u), t); } return t; }
      if (r.status === 400) return null;
      if (r.status === 404) { const body = await r.text(); if (!/erddap/.test(u) || /no matching results/i.test(body)) return null; }
    } catch { /* retry */ }
    await sleep(5000 * (i + 1));
  }
  console.warn('FAILED', u); failed.push(u);
  return null;
}
const FT = 1 / 0.3048, MPS_TO_MPH = 2.236936, FAIR = 40, LEAD_H = 24, ON_HOUR_MIN = 10, TINY_FT = 1, ASOS_CALM_MPH = 5;
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const num = (s: string | undefined) => (s === undefined || s === '' || s === 'NaN' || s === 'MM' || s === 'N/A' ? null : Number.isFinite(Number(s)) ? Number(s) : null);
const relOf = (orient: number | null, dir: number) => orient === null ? 'unknown' : angle(dir, orient + 180) < 45 ? 'offshore' : angle(dir, orient) < 45 ? 'onshore' : 'cross-shore';
const meas = (value: number | null, unit: Measurement['unit'], base: Measurement, provider: string): Measurement => ({value, unit, source: {...base.source, provider, kind: 'observation' as any, notes: 'Audit: observed input.'}});
/** Keep, per whole hour, the reading nearest the hour if within ON_HOUR_MIN minutes. */
function onHour<T>(rows: [number, T][]): Map<number, T> {
  const best = new Map<number, {d: number; v: T}>();
  for (const [ms, v] of rows) { const hr = Math.round(ms / HOUR) * HOUR, d = Math.abs(ms - hr); if (d > ON_HOUR_MIN * 60000) continue; const b = best.get(hr); if (!b || d < b.d) best.set(hr, {d, v}); }
  return new Map([...best].map(([t, x]) => [t, x.v]));
}
const ndbcTime = (c: string[]) => Date.UTC(+c[0], +c[1] - 1, +c[2], +c[3], +c[4]);

// ---------- the split ----------
interface Split {wvht: number; swh: number; swp: number; swd: number; wwh: number | null; wwp: number | null; wwd: number | null; kind: 'published' | 'computed'}
/** NDBC realtime2 `.spec`: #YY MM DD hh mm WVHT SwH SwP WWH WWP SwD WWD STEEPNESS APD MWD. SwD/WWD are 16-point compass names (22.5° resolution). Heights in m → ft. */
function parseSpec(t: string | null): Map<number, Split> {
  if (!t) return new Map();
  const rows: [number, Split][] = [];
  for (const l of t.split('\n')) {
    if (!l.trim() || l.startsWith('#')) continue; const c = l.trim().split(/\s+/); if (c.length < 12) continue;
    const wvht = num(c[5]), swh = num(c[6]), swp = num(c[7]), wwh = num(c[8]), wwp = num(c[9]), sd = COMPASS.indexOf(c[10]), wd = COMPASS.indexOf(c[11]);
    if (wvht === null || swh === null || swp === null || sd < 0 || wvht <= 0 || swp <= 0) continue;   // no published swell (e.g. "N/A"): left out
    rows.push([ndbcTime(c), {wvht: wvht * FT, swh: swh * FT, swp, swd: sd * 22.5, wwh: wwh === null ? null : wwh * FT, wwp, wwd: wd < 0 ? null : wd * 22.5, kind: 'published'}]);
  }
  return onHour(rows);
}
// Gilhousen & Hervey (2001), "Improved estimates of swell from moored buoys" (Ocean Wave Measurement and Analysis, ASCE), as implemented in
// ScientiMate 2.0 `seaswell1d(fsepCalcMethod='gilhousen')` (pypi scientimate 2.0, BSD): steepness alpha(f*) = 8·pi·m2(f*) / (g·sqrt(m0(f*))), moments over
// f >= f* (to 0.5 Hz); fx = the f* where alpha peaks; separation frequency fs = max(0.75·fx, 0.9·1.25/U) with U the buoy's wind speed (m/s). ScientiMate's
// optional 0.2 Hz cap (a Gulf of Mexico default) is NOT applied. Swell = bins with centre <= fs; SwH = 4·sqrt(sum S·df); SwP = 1/(centre of the most energetic
// swell bin); SwD = the swdir (alpha1, "from") of that bin, NDBC's definition (waveobs.shtml: "the direction from which the swells at SwP are coming").
// df per bin = half the distance to each neighbour centre (NDBC bands are not uniform).
const GH_RULE = 'Gilhousen & Hervey (2001) steepness method as implemented in ScientiMate 2.0 seaswell1d("gilhousen"): fs = max(0.75 × the frequency where 8π·m2(f*)/(g·√m0(f*)) peaks, 0.9 × 1.25/U), U = the buoy\'s measured wind (m/s); no 0.2 Hz cap; SwD = alpha1 at the swell peak bin';
const widths = (f: number[]) => f.map((x, i) => ((f[i + 1] ?? x + (x - f[i - 1])) - (f[i - 1] ?? x - (f[i + 1] - x))) / 2);
function sepFreq(f: number[], S: number[], uMs: number): number {
  const df = widths(f); let best = -1, fx = f[0];
  for (let i = 0; i < f.length; i++) {
    if (f[i] > 0.5) break; let m0 = 0, m2 = 0; for (let j = i; j < f.length && f[j] <= 0.5; j++) { m0 += S[j] * df[j]; m2 += S[j] * f[j] * f[j] * df[j]; }
    if (m0 <= 0) continue; const a = 8 * Math.PI * m2 / (9.81 * Math.sqrt(m0)); if (a > best) { best = a; fx = f[i]; }
  }
  return Math.max(0.75 * fx, uMs > 0 ? 0.9 * 1.25 / uMs : 0);
}
function splitOf(f: number[], S: number[], fs: number, dirs: number[] | null): {swh: number; swp: number; swd: number | null; wwh: number; m0: number} {
  const df = widths(f); let m0s = 0, m0w = 0, pk = -1, pv = -1;
  for (let i = 0; i < f.length; i++) { const e = S[i] * df[i]; if (f[i] <= fs) { m0s += e; if (S[i] > pv) { pv = S[i]; pk = i; } } else m0w += e; }
  return {swh: 4 * Math.sqrt(m0s), swp: pk >= 0 ? 1 / f[pk] : NaN, swd: pk >= 0 && dirs ? dirs[pk] : null, wwh: 4 * Math.sqrt(m0w), m0: m0s + m0w};
}
/** Historical swden/swdir: header "#YY MM DD hh mm .0200 .0325 …", one row per record. Returns time → values. 999/99 = missing. */
function parseSpectra(t: string | null): {f: number[]; rows: Map<number, number[]>} {
  const out = new Map<number, number[]>(); if (!t) return {f: [], rows: out};
  const lines = t.split('\n'), head = lines[0].trim().replace(/^#/, '').split(/\s+/), f = head.slice(5).map(Number);
  for (const l of lines.slice(1)) { if (!l.trim() || l.startsWith('#')) continue; const c = l.trim().split(/\s+/); out.set(ndbcTime(c), c.slice(5).map(Number)); }
  return {f, rows: out};
}
/** Realtime .data_spec: "YY MM DD hh mm Sep_Freq  S1 (f1) S2 (f2) …" */
function parseDataSpec(t: string | null) {
  const out = new Map<number, {sep: number | null; f: number[]; S: number[]}>(); if (!t) return out;
  for (const l of t.split('\n')) { if (!l.trim() || l.startsWith('#')) continue; const c = l.trim().split(/\s+/), f: number[] = [], S: number[] = [];
    for (let i = 6; i + 1 < c.length; i += 2) { S.push(Number(c[i])); f.push(Number(c[i + 1].replace(/[()]/g, ''))); }
    const sep = Number(c[5]); out.set(ndbcTime(c), {sep: sep >= 9.99 ? null : sep, f, S}); }
  return out;
}
/** Realtime stdmet .txt: WSPD (m/s) column 6. */
function parseRtWind(t: string | null) { const m = new Map<number, number>(); if (!t) return m; for (const l of t.split('\n')) { if (!l.trim() || l.startsWith('#')) continue; const c = l.trim().split(/\s+/), u = num(c[6]); if (u !== null) m.set(ndbcTime(c), u); } return m; }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** NDBC archive file URLs for a window: the yearly historical file for a closed year, the monthly file for the current year (month code 1–9, a–c). */
function archiveURLs(kind: 'swden' | 'swdir', id: string, [s, e]: [number, number]) {
  const letter = kind === 'swden' ? 'w' : 'd', out = new Set<string>(); const lid = id.toLowerCase();
  for (let t = s; t < e; t += DAY) { const d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth();
    out.add(y < 2026 ? `https://www.ndbc.noaa.gov/data/historical/${kind}/${lid}${letter}${y}.txt.gz` : `https://www.ndbc.noaa.gov/data/${kind}/${MON[m]}/${lid}${(m + 1).toString(16)}${y}.txt.gz`); }
  return [...out];
}
const erddap = (vars: string, id: string, [s, e]: [number, number]) => `https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet.csv?station,time,${vars}&station=%22${id}%22&time%3E=${iso(s)}&time%3C=${iso(e)}`;
const chunks = ([s, e]: [number, number]) => { const out: [number, number][] = []; for (let a = s; a < e; a += 31 * DAY) out.push([a, Math.min(e, a + 31 * DAY)]); return out; };
/** ERDDAP rows (station,time,…) to whole hours (nearest within ON_HOUR_MIN). */
async function erddapHourly<T>(vars: string, id: string, w: [number, number], row: (c: string[]) => T | null) {
  const rows: [number, T][] = [];
  for (const c of chunks(w)) { const t = await get(erddap(vars, id, c)); if (!t) continue; const ls = t.trim().split(/\r?\n/); if (!ls[0]?.startsWith(`station,time,${vars}`)) continue;
    for (const l of ls.slice(2)) { const x = l.split(','), ms = Date.parse(x[1]); if (!Number.isFinite(ms)) continue; const v = row(x); if (v !== null) rows.push([ms, v]); } }
  return new Map([...onHour(rows)].filter(([t]) => t >= w[0] && t <= w[1]));
}

/** Published split for a buoy (realtime2 .spec). */
const specCache = new Map<string, Map<number, Split>>();
async function publishedSplit(ndbcId: string) { if (!specCache.has(ndbcId)) specCache.set(ndbcId, parseSpec(await get(`https://www.ndbc.noaa.gov/data/realtime2/${ndbcId}.spec`))); return specCache.get(ndbcId)!; }
/** Computed split (GH_RULE) for a buoy over a window from the historical spectra + the buoy's ERDDAP wind. Empty when NDBC has no swden for it. */
const compMemo = new Map<string, Promise<{series: Map<number, Split>; published: boolean}>>();
function computedSplit(id: string, w: [number, number]) { const k = `${id}|${w[0]}`; if (!compMemo.has(k)) compMemo.set(k, computedSplitRaw(id, w)); return compMemo.get(k)!; }
async function computedSplitRaw(id: string, w: [number, number]) {
  const den = new Map<number, {f: number[]; v: number[]}>(), dir = new Map<number, number[]>(); let anyDen = false;
  for (const u of archiveURLs('swden', id, w)) { const p = parseSpectra(await get(u, true)); if (p.f.length) anyDen = true; for (const [t, v] of p.rows) den.set(t, {f: p.f, v}); }
  if (!anyDen) return {series: new Map<number, Split>(), published: false};
  for (const u of archiveURLs('swdir', id, w)) { const p = parseSpectra(await get(u, true)); for (const [t, v] of p.rows) dir.set(t, v); }
  const wind = await erddapHourly('WSPD', id, [w[0] - HOUR, w[1] + HOUR], (c) => { const u = num(c[2]); return u === null || u < 0 || u > 60 ? null : u; });
  const rows: [number, Split][] = [];
  for (const [t, {f, v}] of den) {
    const hr = Math.round(t / HOUR) * HOUR, u = wind.get(hr); if (u === undefined || v.some((x) => !(x >= 0) || x >= 999)) continue;
    const fs = sepFreq(f, v, u), d = dir.get(t), s = splitOf(f, v, fs, d && d.length === f.length && d.every((x) => x >= 0 && x <= 360) ? d : null);
    if (s.swd === null || !(s.swp > 0) || s.m0 <= 0) continue;
    rows.push([t, {wvht: 4 * Math.sqrt(s.m0) * FT, swh: s.swh * FT, swp: s.swp, swd: s.swd, wwh: s.wwh * FT, wwp: null, wwd: null, kind: 'computed'}]);
  }
  return {series: onHour(rows), published: true};
}

// ---------- the observed-fed records ----------
interface Obs {hs: number; tp: number | null; dp: number | null}
interface WindObs {mph: number; dir: number; gust: number | null}
/** OLD: bulk Hs as the only swell, no secondary, no surf-range estimate (both audits). */
function bulkRecord(r: OceanRecord, bo: Obs, wo: WindObs): OceanRecord | null {
  if (bo.tp === null || bo.dp === null) return null;
  return {...r, offshore: meas(bo.hs, 'ft', r.offshore, 'buoy'), primary: {height: meas(bo.hs, 'ft', r.primary.height, 'buoy'), period: meas(bo.tp, 's', r.primary.period, 'buoy'), direction: meas(bo.dp, 'deg', r.primary.direction, 'buoy')}, secondary: null,
    windSpeed: meas(wo.mph, 'mph', r.windSpeed, 'station'), windDirection: meas(wo.dir, 'deg', r.windDirection, 'station'), gusts: meas(wo.gust, 'mph', r.gusts, 'station'), faceEstimate: undefined};
}
/** NEW: combined Hs = WVHT (swell + wind-sea), primary = the swell partition, no secondary, surf-range estimate as the app builds it. */
function splitRecord(ev: any, r: OceanRecord, sp: Split, wo: WindObs): OceanRecord {
  const offshore = meas(sp.wvht, 'ft', r.offshore, 'buoy'), primary = {height: meas(sp.swh, 'ft', r.primary.height, 'buoy'), period: meas(sp.swp, 's', r.primary.period, 'buoy'), direction: meas(sp.swd, 'deg', r.primary.direction, 'buoy')};
  return {...r, offshore, primary, secondary: null, faceEstimate: faceEstimate(ev, offshore, primary, null),
    windSpeed: meas(wo.mph, 'mph', r.windSpeed, 'station'), windDirection: meas(wo.dir, 'deg', r.windDirection, 'station'), gusts: meas(wo.gust, 'mph', r.gusts, 'station')};
}
/** CONTROL: the forecast's own inputs built like the split record (primary swell + combined Hs + estimate, secondary swell dropped). */
const fcNoSecondary = (ev: any, r: OceanRecord): OceanRecord => ({...r, secondary: null, faceEstimate: faceEstimate(ev, r.offshore, r.primary, null)});
const rate = (spot: any, r: OceanRecord, nowMs: number) => rateForecast(spot, toLegacy(r), nowMs, {night: false}).score;

interface Hour {area: 'California' | 'HI/East'; region: string; spot: string; win: string; t: number; poor: boolean; tiny: boolean; blown: boolean; fc: number; fcNoSec: number;
  obBulk: number | null; obSplit: number | null; splitKind: 'published' | 'computed' | null; swShare: number | null}

const spotById = new Map(allSpots.map((s) => [s.id, s]));
const span = (win: 'recent' | 'past', w: [number, number]) => win === 'recent' ? `forecast_days=1&past_days=${Math.min(92, Math.ceil((Date.now() - w[0]) / DAY) + 1)}` : `start_date=${day(w[0])}&end_date=${day(w[1])}`;
async function openMeteo(ev: any, win: 'recent' | 'past', w: [number, number]) {
  const sp = span(win, w), mt = await get(marineURL(ev).replace('forecast_days=7', sp));
  const wt = await get(win === 'recent' ? weatherURL(ev).replace('forecast_days=7', sp) : weatherURL(ev).replace('https://api.open-meteo.com/', 'https://historical-forecast-api.open-meteo.com/').replace('forecast_days=7', sp));
  return mt && wt ? normalizeOpenMeteo(ev, JSON.parse(mt), JSON.parse(wt), iso(w[1])) : null;
}

// ---------- California (rating-audit.ts recent window; its archive window has no published or computable split) ----------
const CA = JSON.parse(fs.readFileSync('docs/forecast/data/rating-audit.json', 'utf8'));
const caWin = {recent: [Date.parse(CA.recent.start), Date.parse(CA.recent.end)] as [number, number], archive: [Date.parse(CA.archive.start), Date.parse(CA.archive.end)] as [number, number]};
const ncss = (path: string, [s, e]: [number, number]) => `https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/${path}?` + new URLSearchParams({var: 'waveHs,waveTp,waveDp,waveFlagPrimary', time_start: iso(s), time_end: iso(e), accept: 'csv'});
const mopNowcastURL = (id: string, w: [number, number]) => ncss(`model/${/^BP/.test(id) ? 'MOP_validation' : 'MOP_alongshore'}/${id}_nowcast.nc`, w);
const clip = (s: HourSeries, [a, b]: [number, number]) => new Map([...s].filter(([t]) => t >= a && t <= b));
const windURL = (id: string, [s, e]: [number, number]) => `https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet.csv?station,time,WD,WSPD,GST&station=%22${id}%22&time%3E=${iso(s)}&time%3C=${iso(e)}`;
function parseWindOnHour(csv: string | null): Map<number, WindObs> {   // as rating-audit.ts: the reading ON the hour
  const out = new Map<number, WindObs>(); if (!csv) return out; const lines = csv.trim().split(/\r?\n/); if (!/^station,time,WD,WSPD,GST/.test(lines[0] ?? '')) return out;
  for (const l of lines.slice(2)) { const [, t, wd, ws, gs] = l.split(','), ms = Date.parse(t); const dir = num(wd), spd = num(ws);
    if (!Number.isFinite(ms) || ms % HOUR !== 0 || dir === null || spd === null || dir < 0 || dir > 360 || spd < 0 || spd > 60) continue;
    out.set(ms, {mph: spd * MPS_TO_MPH, dir, gust: num(gs) === null ? null : num(gs)! * MPS_TO_MPH}); }
  return out;
}
const caExcluded: {spot: string; name: string; window: string; why: string}[] = [];
async function runCA(): Promise<Hour[]> {
  const w = caWin.recent, hours: Hour[] = [], obs = new Map<string, HourSeries>(), bp = new Map<string, HourSeries>();
  const st = CA.recent.stations.filter((x: any) => x.n > 0);
  const anchorIds = new Set(st.map((x: any) => x.anchor?.id).filter(Boolean));
  for (const x of OBSERVING_BUOYS.filter((b) => anchorIds.has(b.id))) {
    const u = buoyFeedURL(x, 'recent', iso(w[0]), iso(w[1])); if (!u) continue; const t = await get(u); if (!t) continue;
    obs.set(x.id, clip(parseCdipSeries(t), w)); if (x.mopPoint) { const m = await get(mopNowcastURL(x.mopPoint.id, w)); bp.set(x.id, m ? clip(parseCdipSeries(m), w) : new Map()); }
  }
  for (const m of st) {
    const spot = spotById.get(m.spot), ev = evidenceSpot(m.spot); if (!spot) continue;
    const ax = m.anchor ? OBSERVING_BUOYS.find((b) => b.id === m.anchor.id)! : null;
    const split = ax?.ndbc ? await publishedSplit(ax.ndbc) : new Map<number, Split>();
    if (ax && !split.size) caExcluded.push({spot: m.spot, name: m.name, window: 'recent', why: `anchor CDIP ${ax.id}${ax.ndbc ? ` (NDBC ${ax.ndbc})` : ' (no NDBC id)'}: NDBC publishes no swell/wind-sea split (.spec) for it`});
    // anchored observed surf (rating-audit.ts)
    const a = assignmentFor(m.spot), mopText = a ? await get(mopNowcastURL(a.mopId, w)) : null, sp = mopText ? clip(parseCdipSeries(mopText), w) : new Map();
    const anchored = new Map<number, number>();
    if (ax && obs.has(ax.id)) { const o = obs.get(ax.id)!, bps = bp.get(ax.id) ?? new Map(); for (const [ts, y] of o) { const p = sp.get(ts)?.hs, q = bps.get(ts)?.hs; if (p !== undefined && q !== undefined && q > 0.15) anchored.set(ts, y.hs * p / q); } }
    const wind = m.wind ? (m.wind.type === 'asos' ? parseAsos((await get(asosURL(m.wind.id, iso(w[0]), iso(w[1])))) ?? '', ASOS_CALM_MPH) as unknown as Map<number, WindObs> : parseWindOnHour(await get(windURL(m.wind.id, w)))) : new Map<number, WindObs>();
    const recs = await openMeteo(ev, 'recent', w); if (!recs) { caExcluded.push({spot: m.spot, name: m.name, window: 'recent', why: 'Open-Meteo hours missing'}); continue; }
    for (const r of recs) {
      const ts = Date.parse(r.timestamp); if (ts < w[0] || ts > w[1] || isDark(m.spot, r.timestamp)) continue;
      const surf = anchored.get(ts) ?? null, wo = wind.get(ts) ?? null; if (surf === null && !wo) continue;
      const nowMs = ts - LEAD_H * HOUR, fc = rate(spot, r, nowMs); if (fc === null) continue;
      const tiny = surf !== null && surf < TINY_FT, blown = !!wo && relOf(ev.orientation, wo.dir) === 'onshore' && wo.mph > ONSHORE_BAD_MPH;
      const bo = ax ? obs.get(ax.id)?.get(ts) : undefined, s = split.get(ts);
      const rb = bo && wo ? bulkRecord(r, {hs: bo.hs, tp: bo.tp ?? null, dp: bo.dp ?? null}, wo) : null;
      hours.push({area: 'California', region: ev.region, spot: m.spot, win: 'ca-recent', t: ts, poor: tiny || blown, tiny, blown, fc, fcNoSec: rate(spot, fcNoSecondary(ev, r), nowMs) ?? fc,
        obBulk: rb ? rate(spot, rb, nowMs) : null, obSplit: s && wo && rb ? rate(spot, splitRecord(ev, r, s, wo), nowMs) : null, splitKind: s ? 'published' : null, swShare: s ? s.swh ** 2 / s.wvht ** 2 : null});
    }
    console.log(`CA recent ${m.name}: anchor ${ax?.id ?? '-'}${ax?.ndbc ? `/${ax.ndbc}` : ''} split ${split.size} h, wind ${m.wind?.id ?? '-'}`);
  }
  // the archive window: every anchor is a CDIP buoy; NDBC's historical archive has no derived split and no swden for CDIP-owned buoys
  for (const m of CA.archive.stations.filter((x: any) => x.n > 0 && x.anchor && x.wind)) {
    const ax = OBSERVING_BUOYS.find((b) => b.id === m.anchor.id)!;
    caExcluded.push({spot: m.spot, name: m.name, window: 'archive', why: `anchor CDIP ${ax.id}${ax.ndbc ? ` (NDBC ${ax.ndbc})` : ''}: no published split for ${day(caWin.archive[0])}–${day(caWin.archive[1])} (NDBC's historical archive has no derived swell file; no NDBC swden for this CDIP-owned buoy)`});
  }
  return hours;
}

// ---------- Hawaii + US East (rating-audit-hi-east.ts, both windows) ----------
const HE = JSON.parse(fs.readFileSync('docs/forecast/data/rating-audit-hi-east.json', 'utf8'));
const heWin = (k: 'recent' | 'winter') => [Date.parse(HE.windows[k].start), Date.parse(HE.windows[k].end)] as [number, number];
const heExcluded: {spot: string; name: string; window: string; why: string}[] = [];
async function heWaves(id: string, w: [number, number]) {
  return erddapHourly('WVHT,DPD,MWD', id, w, (c) => { const h = num(c[2]); if (h === null || h < 0 || h > 25) return null; const tp = num(c[3]), dp = num(c[4]);
    return {hs: h * FT, tp: tp !== null && tp > 0 && tp < 30 ? tp : null, dp: dp !== null && dp >= 0 && dp <= 360 ? dp : null} as Obs; });
}
async function heWind(st: any, w: [number, number]): Promise<Map<number, WindObs>> {
  if (st.type === 'asos') { const t = await get(asosURL(st.id, iso(w[0]), iso(w[1] + DAY))); return t ? new Map([...parseAsos(t, ASOS_CALM_MPH) as unknown as Map<number, WindObs>].filter(([ts]) => ts >= w[0] && ts <= w[1])) : new Map(); }
  return erddapHourly('WD,WSPD,GST', st.id, w, (c) => { const dir = num(c[2]), spd = num(c[3]), g = num(c[4]); if (dir === null || spd === null || dir < 0 || dir > 360 || spd < 0 || spd > 60) return null; return {mph: spd * MPS_TO_MPH, dir, gust: g === null ? null : g * MPS_TO_MPH}; });
}
async function runHE(k: 'recent' | 'winter'): Promise<Hour[]> {
  const w = heWin(k), hours: Hour[] = [];
  for (const m of HE.windows[k].spots.filter((x: any) => x.n > 0)) {
    const spot = spotById.get(m.spot), ev = evidenceSpot(m.spot); if (!spot) continue;
    const comp = k === 'winter' ? await computedSplit(m.buoy.id, w) : null;
    const split = k === 'recent' ? await publishedSplit(m.buoy.id) : comp!.series;
    if (!split.size) { heExcluded.push({spot: m.spot, name: m.name, window: k, why: k === 'recent' ? `buoy ${m.buoy.id}: NDBC's .spec carries no swell values for it (SwH/SwP/SwD published as MM on every record)` : `buoy ${m.buoy.id} (${m.buoy.owner}): no published split for this window (NDBC's historical archive has no derived swell file)${comp!.published ? '' : ' and no NDBC swden spectra to compute one from'}`}); }
    const bw = await heWaves(m.buoy.id, w), wind = m.wind ? await heWind(m.wind, w) : new Map<number, WindObs>();
    const recs = await openMeteo(ev, k === 'recent' ? 'recent' : 'past', w); if (!recs) continue;
    for (const r of recs) {
      const ts = Date.parse(r.timestamp); if (ts < w[0] || ts >= w[1] || isDark(m.spot, r.timestamp)) continue;
      const bo = bw.get(ts); if (!bo) continue;
      const nowMs = ts - LEAD_H * HOUR, fc = rate(spot, r, nowMs); if (fc === null) continue;
      const wo = wind.get(ts) ?? null, tiny = bo.hs < TINY_FT, blown = m.windJudged && !!wo && relOf(ev.orientation, wo.dir) === 'onshore' && wo.mph > ONSHORE_BAD_MPH;
      const rb = wo ? bulkRecord(r, bo, wo) : null, s = split.get(ts);
      hours.push({area: 'HI/East', region: m.group, spot: m.spot, win: `he-${k}`, t: ts, poor: tiny || blown, tiny, blown, fc, fcNoSec: rate(spot, fcNoSecondary(ev, r), nowMs) ?? fc,
        obBulk: rb ? rate(spot, rb, nowMs) : null, obSplit: s && wo && rb ? rate(spot, splitRecord(ev, r, s, wo), nowMs) : null, splitKind: s?.kind ?? null, swShare: s ? s.swh ** 2 / s.wvht ** 2 : null});
    }
    console.log(`HE ${k} ${m.name}: buoy ${m.buoy.id} split ${split.size} h, wind ${m.wind?.id ?? '-'}`);
  }
  return hours;
}

// ---------- computed-split check: GH_RULE against NDBC's own published Sep_Freq and SwH (realtime, where both exist) ----------
async function ghCheck(ids: string[]) {
  const out: any[] = [];
  for (const id of ids) {
    const ds = parseDataSpec(await get(`https://www.ndbc.noaa.gov/data/realtime2/${id}.data_spec`)), rw = parseRtWind(await get(`https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`)), pub = await get(`https://www.ndbc.noaa.gov/data/realtime2/${id}.spec`);
    const pubSw = new Map<number, number>(); for (const l of (pub ?? '').split('\n')) { if (!l.trim() || l.startsWith('#')) continue; const c = l.trim().split(/\s+/), v = num(c[6]); if (v !== null) pubSw.set(ndbcTime(c), v); }
    const near = <T,>(m: Map<number, T>, t: number) => { for (const d of [0, -10, 10, -20, 20]) { const v = m.get(t + d * 60000); if (v !== undefined) return v; } return undefined; };
    const dfs: number[] = [], dSw: number[] = [], dSwPub: number[] = []; let n = 0;
    for (const [t, x] of ds) {
      const u = near(rw, t), sw = near(pubSw, t); if (u === undefined || x.sep === null || sw === undefined) continue;
      const fs = sepFreq(x.f, x.S, u); dfs.push(fs - x.sep); dSw.push(splitOf(x.f, x.S, fs, null).swh - sw); dSwPub.push(splitOf(x.f, x.S, x.sep, null).swh - sw); n++;
    }
    const mean = (a: number[]) => a.reduce((p, q) => p + q, 0) / (a.length || 1), mae = (a: number[]) => mean(a.map(Math.abs)), within = (a: number[], d: number) => a.filter((x) => Math.abs(x) <= d).length / (a.length || 1);
    out.push({id, records: n, sepFreqBiasHz: +mean(dfs).toFixed(4), sepFreqMaeHz: +mae(dfs).toFixed(4), sepWithin001Hz: +within(dfs, 0.0101).toFixed(3),
      swhMaeM: +mae(dSw).toFixed(3), swhBiasM: +mean(dSw).toFixed(3), swhWithin02m: +within(dSw, 0.2).toFixed(3), integrationCheckSwhMaeM: +mae(dSwPub).toFixed(3)});
  }
  return out;
}

setOnshoreCapEnabled(true);   // as both audits
const caHours = await runCA();
const heRecent = await runHE('recent'), heWinter = await runHE('winter');
const check = await ghCheck(['44065', '41025']);
console.log('GH check', JSON.stringify(check));

// ---------- rates (on the hours where BOTH observed-fed ratings exist: same hours, old vs new) ----------
const fairOf = (v: number | null) => v !== null && v >= FAIR;
function stats(hs: Hour[]) {
  const both = hs.filter((h) => h.obBulk !== null && h.obSplit !== null), p = both.filter((h) => h.poor);
  const sharePoor = (k: 'fc' | 'obBulk' | 'obSplit' | 'fcNoSec') => { const f = both.filter((h) => fairOf(h[k])); return {rated: f.length, poor: f.filter((h) => h.poor).length}; };
  const sw = both.map((h) => h.swShare!).sort((a, b) => a - b);
  return {hoursAll: hs.length, hours: both.length, poor: p.length, poorTiny: p.filter((h) => h.tiny).length, poorOnshore: p.filter((h) => h.blown).length,
    fairWhilePoor: {fc: p.filter((h) => fairOf(h.fc)).length, fcNoSecondary: p.filter((h) => fairOf(h.fcNoSec)).length, obBulk: p.filter((h) => fairOf(h.obBulk)).length, obSplit: p.filter((h) => fairOf(h.obSplit)).length},
    byCause: Object.fromEntries((['tiny', 'blown'] as const).map((k) => { const q = p.filter((h) => h[k]); return [k === 'tiny' ? 'sizeOnly' : 'onshore', {n: q.length, fc: q.filter((h) => fairOf(h.fc)).length, obBulk: q.filter((h) => fairOf(h.obBulk)).length, obSplit: q.filter((h) => fairOf(h.obSplit)).length}]; })) as Record<'sizeOnly' | 'onshore', {n: number; fc: number; obBulk: number; obSplit: number}>,
    poorWhileFair: {fc: sharePoor('fc'), obBulk: sharePoor('obBulk'), obSplit: sharePoor('obSplit')},
    meanScore: {fc: avg(both.map((h) => h.fc)), obBulk: avg(both.map((h) => h.obBulk!)), obSplit: avg(both.map((h) => h.obSplit!))},
    medianSwellShareOfEnergy: sw.length ? +sw[Math.floor(sw.length / 2)].toFixed(2) : null,
    splitKind: [...new Set(both.map((h) => h.splitKind))]};
}
function avg(a: number[]) { return a.length ? +(a.reduce((p, q) => p + q, 0) / a.length).toFixed(1) : null; }
type S = ReturnType<typeof stats>;
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '–');
const CA_ORDER = ['Del Norte', 'Humboldt', 'Mendocino', 'Marin', 'San Francisco', 'San Mateo', 'Santa Cruz', 'Monterey', 'San Luis Obispo', 'Ventura', 'Los Angeles', 'Orange County', 'San Diego'];
const HE_ORDER = ['Oahu North', 'Oahu South', 'Massachusetts', 'Rhode Island', 'New York', 'New Jersey', 'Virginia', 'North Carolina', 'South Carolina', 'Georgia', 'Florida'];
function byRegion(hs: Hour[], order: string[], allLabel: string, extra: [string, (h: Hour) => boolean][] = []) {
  const rows: [string, S, number][] = order.filter((g) => hs.some((h) => h.region === g)).map((g) => { const gh = hs.filter((h) => h.region === g); return [g, stats(gh), new Set(gh.filter((h) => h.obSplit !== null).map((h) => h.spot)).size]; });
  for (const [l, f] of extra) { const gh = hs.filter(f); if (gh.length) rows.push([l, stats(gh), new Set(gh.filter((h) => h.obSplit !== null).map((h) => h.spot)).size]); }
  rows.push([allLabel, stats(hs), new Set(hs.filter((h) => h.obSplit !== null).map((h) => h.spot)).size]);
  return rows.filter(([g, s]) => s.hours > 0 || g === allLabel);
}
const tbl = (rows: [string, S, number][]) => `| region (spots with split hours) | hours with both observed-fed ratings | observed poor (size / onshore) | **fair+ while poor:** forecast-fed (app) | old observed-fed (bulk Hs as swell) | **new observed-fed (split)** | **poor while rated fair+:** forecast-fed | old observed-fed | **new observed-fed** | mean score fc / old / new | median swell share of energy (SwH²/Hs²) |
|---|---|---|---|---|---|---|---|---|---|---|
${rows.map(([g, s, n]) => `| ${/all/.test(g) ? `**${g}**` : g} (${n}) | ${s.hours} | ${s.poor} (${s.poorTiny} / ${s.poorOnshore}) | ${pct(s.fairWhilePoor.fc, s.poor)} | ${pct(s.fairWhilePoor.obBulk, s.poor)} | **${pct(s.fairWhilePoor.obSplit, s.poor)}** | ${pct(s.poorWhileFair.fc.poor, s.poorWhileFair.fc.rated)} (${s.poorWhileFair.fc.poor}/${s.poorWhileFair.fc.rated}) | ${pct(s.poorWhileFair.obBulk.poor, s.poorWhileFair.obBulk.rated)} (${s.poorWhileFair.obBulk.poor}/${s.poorWhileFair.obBulk.rated}) | **${pct(s.poorWhileFair.obSplit.poor, s.poorWhileFair.obSplit.rated)}** (${s.poorWhileFair.obSplit.poor}/${s.poorWhileFair.obSplit.rated}) | ${s.meanScore.fc} / ${s.meanScore.obBulk} / ${s.meanScore.obSplit} | ${s.medianSwellShareOfEnergy ?? '–'} |`).join('\n')}`;
const ctlTbl = (rows: [string, S, number][]) => `| region | poor hours | forecast-fed (app: primary + secondary swell) | forecast-fed, secondary swell dropped (built like the split record) | new observed-fed (split) |\n|---|---|---|---|---|\n${rows.map(([g, s]) => `| ${g} | ${s.poor} | ${pct(s.fairWhilePoor.fc, s.poor)} | ${pct(s.fairWhilePoor.fcNoSecondary, s.poor)} | ${pct(s.fairWhilePoor.obSplit, s.poor)} |`).join('\n')}`;

const isNorCal = (h: Hour) => evidenceSpot(h.spot).latitude >= 34.45;
const caRows = byRegion(caHours, CA_ORDER, 'California, all', [['Northern + Central California (north of Pt Conception)', isNorCal]]);
const isEast = (h: Hour) => !h.region.startsWith('Oahu');
const heRRows = byRegion(heRecent, HE_ORDER, 'Hawaii + East, all', [['US East, all', isEast]]);
const heWRows = byRegion(heWinter, HE_ORDER, 'Hawaii + East, all', [['US East, all', isEast]]);
// the published audits' headline numbers for reference (their own hour sets; not the same hours as above)
const pubCA = CA.recent.poorRatedFair.find((x: any) => x.label === 'either'), pubCAa = CA.archive.poorRatedFair.find((x: any) => x.label === 'either');
const pubHE = (k: string) => HE.windows[k].byRegion.all;

// ---------- excluded spots ----------
const usedSplit = (hs: Hour[]) => new Set(hs.filter((h) => h.obSplit !== null).map((h) => h.spot));
const noWindNote = (hs: Hour[], label: string) => { const ids = new Set(hs.map((h) => h.spot)); const ok = usedSplit(hs); return [...ids].filter((i) => !ok.has(i) && !hs.some((h) => h.spot === i && h.obBulk !== null)).length; };
const exclList = (xs: {name: string; window: string; why: string}[]) => xs.length ? xs.map((x) => `- ${x.name} (${x.window}): ${x.why}`).join('\n') : '- none';

const W = {ca: caWin.recent, heR: heWin('recent'), heW: heWin('winter')};
const md = `# Rating audit on split swell (2026-11-09)

Generated ${new Date().toISOString().slice(0, 16)}Z by \`docs/forecast/data/rating-audit-split.ts\` (spec \`docs/specs/2026-11-09-round-3.md\`, 3D). Reproduce: \`ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/rating-audit-split.ts\` (NDBC's realtime \`.spec\` files keep 45 days, so the recent windows reproduce only from a cache made before ${day(W.ca[0] + 45 * DAY)}). **A report: no rating code was changed. The proposals at the end are not applied; any engine change is a separate spec.**

**The question.** Both rating audits (\`RATING-AUDIT.md\`, California; \`RATING-AUDIT-HI-EAST.md\`, Hawaii + US East) asked how often the rating says fair or better (score ${FAIR}+) when observed conditions were poor, and compared the app's forecast-fed rating with an observed-fed one. The observed-fed one fed the engine the buoy's TOTAL wave height as the only swell, with no surf-range estimate, so it mostly measured that construction (HI/East control: forecast inputs built the same way 53.4%, observed-fed 53.0%, the app 8.1%). This report rebuilds the observed-fed inputs with the swell split from the wind-sea and asks the question again.

**What changed in the observed-fed inputs.**
| engine input | old observed-fed | new observed-fed (split) | the app's forecast-fed |
|---|---|---|---|
| combined Hs (\`offshore\`) | buoy total Hs | buoy total Hs (WVHT: swell + wind-sea) | Open-Meteo \`wave_height\` (total) |
| primary swell height / period / direction | buoy total Hs / dominant period / mean direction | **NDBC's swell partition SwH / SwP / SwD** | Open-Meteo swell partition |
| wind-sea | inside the "swell" | **only in the combined Hs** (NDBC WWH; the engine has no separate wind-sea input, nor does the app's record) | only in the combined Hs |
| secondary swell | none | none (NDBC publishes one swell partition) | Open-Meteo secondary swell |
| surf-range estimate (wide-range ceiling) | none | \`faceEstimate()\` on these inputs, as the app builds it | \`faceEstimate()\` |
| wind | shore station | shore station (unchanged) | Open-Meteo |

Engine: \`rateForecast\` (for an evidence record, the provisional rating both audits call directly), lead-dependent parts judged ${LEAD_H} h ahead, onshore cap on, daylight hours only.

**Where the split comes from.**
- **Published (recent windows):** NDBC realtime2 \`<id>.spec\` (SwH, SwP, SwD, WWH, WWP, WWD), the record within ${ON_HOUR_MIN} minutes of the hour. SwD and WWD are published as 16-point compass names (22.5° steps); used at the sector centre. NDBC keeps 45 days, which covers the California recent window (${day(W.ca[0])} to ${day(W.ca[1])}) and the HI/East recent window (${day(W.heR[0])} to ${day(W.heR[1] - 1)}).
- **Historical windows: no published split.** NDBC's historical archive (historical_data.shtml) has stdmet and the spectra (swden, swdir alpha1/alpha2, r1/r2) but **no derived swell/wind-sea file**. The spectra exist only for NDBC-owned buoys: every CDIP-owned buoy the audits use (all of California's anchors, and in HI/East everything but 44065 and 41025) returns 404 for 2025 swden and 2026 monthly swden. So:
  - **California archive window (${day(caWin.archive[0])} to ${day(caWin.archive[1])}): excluded entirely** (no published split and no NDBC spectra for its CDIP anchors). CDIP publishes those buoys' spectra in its own archive, but computing a split from them is outside this brief (not NDBC swden); see proposal 3.
  - **HI/East winter (${day(W.heW[0])} to ${day(W.heW[1] - 1)}): COMPUTED split, labelled,** for the spots on 44065 and 41025 only: ${GH_RULE}. Checked against NDBC's own published Sep_Freq and SwH on the realtime window below before use.
- Stations and spots are the audits' own picks (read from their JSON), not re-chosen; observed "poor" is each audit's own criterion, unchanged (California: surf under 1 ft from the buoy carried to the MOP point, or measured onshore over ${ONSHORE_BAD_MPH} mph; HI/East: OFFSHORE buoy Hs under 1 ft, an offshore proxy, or measured onshore over ${ONSHORE_BAD_MPH} mph where a facing is stated).
- Every comparison below is on the SAME hours: hours where both the old and the new observed-fed rating exist (needs the anchor buoy's bulk reading, its split record, and the shore wind). ${failed.length ? `**${failed.length} downloads failed after retries** (listed in the JSON); their hours are missing, not filled.` : 'No download failed.'}

## 1. California, recent window (${day(W.ca[0])} to ${day(W.ca[1])}), published split

${tbl(caRows)}

Published audit for reference (its own hour set, all spots incl. hours without an observed-fed rating): recent window forecast-fed fair+ while poor ${pct(pubCA.fc.fair, pubCA.n)}, observed-fed ${pct(pubCA.ob.fair, pubCA.nBoth)}; archive window ${pct(pubCAa.fc.fair, pubCAa.n)} / ${pct(pubCAa.ob.fair, pubCAa.nBoth)} (archive: no split, not redone).

## 2. Hawaii + US East, recent window (${day(W.heR[0])} to ${day(W.heR[1] - 1)}), published split

${tbl(heRRows)}

## 3. Hawaii + US East, winter (${day(W.heW[0])} to ${day(W.heW[1] - 1)}), COMPUTED split (44065, 41025 only)

${tbl(heWRows)}

${stats(heWinter).hours ? '' : `**No comparable hours.** The computed split exists for ${new Set(heWinter.filter((h) => h.splitKind === 'computed').map((h) => h.spot)).size} spots (on 44065 and 41025), but none of them has a shore wind station by the audit's rule, so neither the old nor the new observed-fed rating exists there. **The winter window cannot be redone on split inputs.**`}

Published HI/East audit for reference (all hours with an observed-fed rating; its own hour sets): recent forecast-fed ${pct(pubHE('recent').fcFairWhilePoorSameHours, pubHE('recent').poorWithObs)}, observed-fed ${pct(pubHE('recent').obFairWhilePoor, pubHE('recent').poorWithObs)}, control ${pct(pubHE('recent').fcBulkFairWhilePoor, pubHE('recent').poorWithObs)}; winter ${pct(pubHE('winter').fcFairWhilePoorSameHours, pubHE('winter').poorWithObs)} / ${pct(pubHE('winter').obFairWhilePoor, pubHE('winter').poorWithObs)} / ${pct(pubHE('winter').fcBulkFairWhilePoor, pubHE('winter').poorWithObs)}.

## 3b. By cause (fair+ while poor): forecast-fed / old observed-fed / new observed-fed

| window, region | size-poor hours | … fc / old / new | onshore-poor hours | … fc / old / new |
|---|---|---|---|---|
${[['California recent', caRows], ['HI/East recent', heRRows]].flatMap(([w, rows]: any) => rows.filter(([, s]: any) => s.poor).map(([g, s]: [string, S]) => `| ${w}, ${g} | ${s.byCause.sizeOnly.n} | ${pct(s.byCause.sizeOnly.fc, s.byCause.sizeOnly.n)} / ${pct(s.byCause.sizeOnly.obBulk, s.byCause.sizeOnly.n)} / ${pct(s.byCause.sizeOnly.obSplit, s.byCause.sizeOnly.n)} | ${s.byCause.onshore.n} | ${pct(s.byCause.onshore.fc, s.byCause.onshore.n)} / ${pct(s.byCause.onshore.obBulk, s.byCause.onshore.n)} / ${pct(s.byCause.onshore.obSplit, s.byCause.onshore.n)} |`)).join('\n')}

("size-poor" counts hours poor by size, whether or not also onshore; an hour can be in both columns.)

## 4. Construction check: is the remaining gap the inputs or the construction?

The split record still differs from the app's in one way: no secondary swell (NDBC publishes one swell partition; the engine's crossing-swell penalty needs one). The middle column drops the forecast's secondary swell, the same construction as the split record. If it is close to the app's column, the construction gap is closed and what is left between forecast-fed and observed-fed is the inputs.

### California recent
${ctlTbl(caRows)}

### HI/East recent
${ctlTbl(heRRows)}

### HI/East winter (computed split)
${ctlTbl(heWRows)}

## 5. Computed-split check (GH_RULE vs NDBC's published values, realtime window)

For each NDBC-owned buoy used for the winter window, the realtime \`.data_spec\` (spectrum + NDBC's own Sep_Freq), the realtime stdmet wind (WSPD) and \`.spec\` SwH, each the record within 20 minutes of the spectrum's time. "Integration check" = SwH from the spectrum cut at NDBC's own Sep_Freq vs NDBC's SwH (tests the band integration alone).

| buoy | records | Sep_Freq bias (Hz) | Sep_Freq MAE (Hz) | within one 0.01 Hz band | SwH MAE (m) | SwH bias (m) | SwH within 0.2 m | integration check SwH MAE (m) |
|---|---|---|---|---|---|---|---|---|
${check.map((c) => `| ${c.id} | ${c.records} | ${c.sepFreqBiasHz} | ${c.sepFreqMaeHz} | ${(100 * c.sepWithin001Hz).toFixed(0)}% | ${c.swhMaeM} | ${c.swhBiasM} | ${(100 * c.swhWithin02m).toFixed(0)}% | ${c.integrationCheckSwhMaeM} |`).join('\n')}

## 6. Spots left out of the split comparison

**No split for the window:**
${exclList([...caExcluded, ...heExcluded])}

**No observed-fed rating at all (no shore wind station, so neither method rates them; the audits' swell-only spots):** California recent ${noWindNote(caHours, 'ca')}, HI/East recent ${noWindNote(heRecent, 'r')}, HI/East winter ${noWindNote(heWinter, 'w')} spots (listed per spot in the JSON).

`;
const OUT = 'docs/forecast/RATING-AUDIT-SPLIT.md', JSON_OUT = 'docs/forecast/data/rating-audit-split.json';
const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '', notes = prev.includes('<!-- notes -->') ? prev.slice(prev.indexOf('<!-- notes -->')) : '<!-- notes -->\n';
fs.writeFileSync(OUT, md + notes);
const perSpot = (hs: Hour[]) => [...new Set(hs.map((h) => h.spot))].map((id) => ({spot: id, name: spotById.get(id)?.name, region: hs.find((h) => h.spot === id)!.region, stats: stats(hs.filter((h) => h.spot === id))}));
const rowsJson = (rows: [string, S, number][]) => Object.fromEntries(rows.map(([g, s, n]) => [g, {spotsWithSplit: n, ...s}]));
fs.writeFileSync(JSON_OUT, JSON.stringify({generatedAt: new Date().toISOString(), note: 'Generated by docs/forecast/data/rating-audit-split.ts. Old = bulk buoy Hs as the only swell; new = NDBC swell partition as the primary swell, total Hs as combined Hs, faceEstimate as the app builds it. Same hours for old and new. Published split for recent windows; HI/East winter split COMPUTED (GH_RULE) for 44065/41025 only. Our thresholds. A report: no rating changed.',
  rules: {engine: 'rateForecast (provisional rating), lead 24 h, onshore cap on', fair: FAIR, onshoreBadMph: ONSHORE_BAD_MPH, tinyFt: TINY_FT, onHourMin: ON_HOUR_MIN, computedSplit: GH_RULE}, failedDownloads: failed,
  windows: {caRecent: {start: iso(W.ca[0]), end: iso(W.ca[1]), split: 'published (.spec)', byRegion: rowsJson(caRows), spots: perSpot(caHours)},
    caArchive: {start: iso(caWin.archive[0]), end: iso(caWin.archive[1]), split: 'none: excluded'},
    heRecent: {start: iso(W.heR[0]), end: iso(W.heR[1]), split: 'published (.spec)', byRegion: rowsJson(heRRows), spots: perSpot(heRecent)},
    heWinter: {start: iso(W.heW[0]), end: iso(W.heW[1]), split: 'computed (GH_RULE), 44065 and 41025 only', byRegion: rowsJson(heWRows), spots: perSpot(heWinter)}},
  computedSplitCheck: check, excluded: [...caExcluded, ...heExcluded],
  publishedAuditsForReference: {caRecentEither: pubCA, caArchiveEither: pubCAa, heRecentAll: pubHE('recent'), heWinterAll: pubHE('winter')}}, null, 1) + '\n');
console.log(`wrote ${OUT} and ${JSON_OUT}`);
for (const [l, rows] of [['CA', caRows], ['HE-R', heRRows], ['HE-W', heWRows]] as const) for (const [g, s] of rows) console.log(l, g, s.hours, s.poor, JSON.stringify(s.byCause), JSON.stringify(s.fairWhilePoor), JSON.stringify(s.poorWhileFair), JSON.stringify(s.meanScore), s.medianSwellShareOfEnergy);

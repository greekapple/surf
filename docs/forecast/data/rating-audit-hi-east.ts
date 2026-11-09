// Rating check for Hawaii and the US East Coast (spec docs/specs/2026-11-09-clock-perf-deselect.md, 2B; 2026-11-09). A REPORT: no rating code changes.
// Run: ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/rating-audit-hi-east.ts [--recent 2026-10-09T00:00:00Z/2026-11-09T00:00:00Z] [--winter 2025-12-01T00:00:00Z/2026-03-01T00:00:00Z]
// Public, keyless data only; polite fetches (at least 1 s between requests to one host); User-Agent "SWELLO surf forecast prototype". Same download cache (ACC_CACHE) as rating-audit.ts.
//
// A buoy-based variant of docs/forecast/data/rating-audit.ts (California), which cannot run here: its observed surf is the CDIP MOP nearshore model, California only.
// For every DAYLIGHT hour (the spot's own time zone, src/services/daylight.ts) at every Hawaii ('w-hawaii-*') and US East ('w-us-*') spot that has an eligible buoy:
//   OBSERVED SWELL = an OPEN-OCEAN wave buoy's measured significant wave height (Hs), dominant period and mean direction (NDBC stdmet via NOAA ERDDAP
//                    `cwwcNDBCMet`, the reading within 10 minutes of the hour). It is OFFSHORE SWELL measured at the buoy, NOT breaking surf at the spot,
//                    and is never called surf height. Eligible buoy (BUOY_RULE): an NDBC-listed buoy (activestations.xml, type "buoy") within 40 km,
//                    not one the app labels sheltered (src/ocean/buoys.ts: Cape Cod Bay, Buzzards Bay, Thimble Shoal), whose bearing FROM the spot
//                    lies inside the spot's swell window (WINDOW_RULE), with Hs on 200+ hours of the window. Nearest such buoy wins.
//   OBSERVED WIND  = the CA audit's shore rule (nearest shore station within 7 km with wind on 200+ hours), adapted where the repo's enclosed-water mask
//                    does not reach (it covers the US West Coast only; Hawaii and the East are outside it): an airport ASOS (IEM) is accepted with the
//                    label "no enclosed-water check"; an NDBC/NOS fixed station only when the app has checked its siting and shows it as beach wind
//                    (src/ocean/shoreWind.ts NDBC_EXPOSURE: pier or cove). No offshore buoys. No station → the spot's hours use the swell-only poor criterion.
//                    Wind can be judged onshore only where the engine has a stated facing (evidenceSpot().orientation); otherwise swell-only, labelled.
//   FORECAST-FED rating = rateForecast on the archived Open-Meteo Marine + Weather hours (exactly as rating-audit.ts: close to a nowcast, judged 24 h ahead).
//   OBSERVED-FED rating = provisionalRating (as rating-audit.ts) on the buoy's Hs / period / direction as the swell plus the station's wind; needs both.
// Poor = buoy Hs under 1 ft (OFFSHORE PROXY for "surf under 1 ft"; the CA audit's 1 ft is a nearshore height at the spot's point, so the two are not the
//        same quantity), OR measured onshore wind over 12 mph (ONSHORE_BAD_MPH). Fair or better = score 40+.
// Writes docs/forecast/RATING-AUDIT-HI-EAST.md (keeping anything after `<!-- notes -->`) and docs/forecast/data/rating-audit-hi-east.json.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {allSpots} from '../../../src/data/catalog.ts';
import {COAST_ROWS, UPGRADED_ROWS} from '../../../src/data/coast.ts';
import {evidenceSpot} from '../../../src/ocean/spots.ts';
import {guideFactsFor} from '../../../src/ocean/spotFactsSourced.ts';
import {clampWindow} from '../../../src/ocean/spotFactsRules.ts';
import {contextBuoys} from '../../../src/ocean/buoys.ts';
import {NDBC_EXPOSURE, exposureShown} from '../../../src/ocean/shoreWind.ts';
import {marineURL, weatherURL, normalizeOpenMeteo} from '../../../src/ocean/openMeteo.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {rateForecast} from '../../../src/ratings/adapters.ts';
import {provisionalRating} from '../../../src/ratings/provisional.ts';
import {setOnshoreCapEnabled} from '../../../src/ratings/windRules.ts';
import {ONSHORE_BAD_MPH} from '../../../src/services/call.ts';
import {isDark} from '../../../src/services/daylight.ts';
import {isEnclosedWater, enclosedCovers} from '../../../src/map/enclosed.ts';
import {ASOS_NETWORK_URL, parseAsosNetwork, asosURL, parseAsos} from './shore-wind.ts';
import {angle} from '../../../src/utils/units.ts';
import {distanceKm} from '../../../src/services/accuracy.ts';
import type {OceanRecord, Measurement} from '../../../src/ocean/types.ts';

const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const HOUR = 3600000, range = (s: string) => s.split('/').map((x) => Math.floor(Date.parse(x) / HOUR) * HOUR) as [number, number];
const WIN = {recent: range(arg('--recent', '2026-10-09T00:00:00Z/2026-11-09T00:00:00Z')), winter: range(arg('--winter', '2025-12-01T00:00:00Z/2026-03-01T00:00:00Z'))};
type WinKey = keyof typeof WIN;
const WIN_LABEL: Record<WinKey, string> = {recent: 'Last 30 days', winter: 'Last winter'};
const OUT = 'docs/forecast/RATING-AUDIT-HI-EAST.md', JSON_OUT = 'docs/forecast/data/rating-audit-hi-east.json';
const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z'), day = (t: number) => iso(t).slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = 'SWELLO surf forecast prototype';
const CACHE = process.env.ACC_CACHE ?? null, cacheFile = (u: string) => `${CACHE}/${createHash('sha1').update(u).digest('hex')}.txt`;
const lastHit = new Map<string, number>();
async function get(u: string, tries = 4): Promise<string | null> {
  if (CACHE && fs.existsSync(cacheFile(u))) return fs.readFileSync(cacheFile(u), 'utf8');
  const host = new URL(u).host;
  for (let i = 0; i < tries; i++) {
    const wait = (lastHit.get(host) ?? 0) + 1100 - Date.now(); if (wait > 0) await sleep(wait); lastHit.set(host, Date.now());
    try {
      const r = await fetch(u, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(180000)});
      if (r.ok) { const t = await r.text(); if (CACHE) { fs.mkdirSync(CACHE, {recursive: true}); fs.writeFileSync(cacheFile(u), t); } return t; }
      if (r.status === 400) return null;
      if (r.status === 404) { const body = await r.text(); if (!/erddap/.test(u) || /no matching results/i.test(body)) return null; }   // ERDDAP: 404 "no matching results" = a station with no rows in the window; any other 404 (e.g. "unknown datasetID" while the dataset reloads) is a failure, retried
    } catch { /* retry */ }
    await sleep(5000 * (i + 1));
  }
  console.warn('FAILED', u); failed.push(u);
  return null;
}
const failed: string[] = [];

// ---------- thresholds (OUR OWN CHOICES, each named where it is used) ----------
const FT = 1 / 0.3048, MPS_TO_MPH = 2.236936;
/** Offshore buoy Hs under this = "too small" (offshore proxy of the CA audit's 1 ft). SENS_FT: a second, looser line reported for sensitivity only. */
const TINY_FT = 1, SENS_FT = 2;
const FAIR = 40, NOT_BAD = 55;
const BUOY_KM = 40, WIND_KM = 7, MIN_OBS_HOURS = 200, LEAD_H = 24, ASOS_CALM_MPH = 5, ON_HOUR_MIN = 10;
const WINDOW_RULE = 'the spot\'s swell window: the published guide window (src/ocean/spotFactsSourced.ts) limited to ±60° of the stated facing (clampWindow, as the app does); with a window but no stated facing, the guide window as published; with neither, the catalogue\'s seaward bearing ±60° (a map-placement value, labelled "seaward ±60°")';
const BUOY_RULE = `nearest NDBC-listed buoy (activestations.xml, type "buoy") within ${BUOY_KM} km whose bearing from the spot lies inside ${WINDOW_RULE}; not one the app labels sheltered (src/ocean/buoys.ts); with Hs on ${MIN_OBS_HOURS}+ hours of the window`;
const WIND_RULE = `nearest shore station within ${WIND_KM} km with wind on ${MIN_OBS_HOURS}+ hours of the window: an airport ASOS (Iowa Environmental Mesonet), or a fixed NDBC/NOS met station the app shows as beach wind (NDBC_EXPOSURE pier or cove, src/ocean/shoreWind.ts); where the repo's enclosed-water mask covers the station it must also be outside enclosed water. The mask does not cover Hawaii or the East, so there the airports carry no enclosed-water check. No offshore buoys`;

// ---------- the spots ----------
const STATE: Record<string, string> = {'Northern New Jersey': 'New Jersey', 'Southern New Jersey': 'New Jersey', 'Northeast Florida': 'Florida', 'Southeast Florida': 'Florida', 'Space Coast': 'Florida', 'Treasure Coast': 'Florida', 'Outer Banks': 'North Carolina', 'Southern North Carolina': 'North Carolina', 'Oahu North Shore': 'Oahu North', 'Oahu South Shore': 'Oahu South'};
const groupOf = (region: string) => STATE[region] ?? region;
const GROUP_ORDER = ['Oahu North', 'Oahu South', 'Massachusetts', 'Rhode Island', 'New York', 'New Jersey', 'Virginia', 'North Carolina', 'South Carolina', 'Georgia', 'Florida'];
const seawardOf = new Map([...UPGRADED_ROWS, ...COAST_ROWS].map((r: any) => [r[0] as string, r[6] as number]));
const spots = allSpots.filter((s) => /^w-(us|hawaii)-/.test(s.id));
const norm = (d: number) => ((d % 360) + 360) % 360;
function bearing(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180, y = Math.sin((bLon - aLon) * r) * Math.cos(bLat * r), x = Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos((bLon - aLon) * r);
  return norm(Math.atan2(y, x) / r);
}
const inArc = (d: number, [a, b]: [number, number]) => (a <= b ? d >= a && d <= b : d >= a || d <= b);
function windowOf(id: string): {arc: [number, number]; basis: string} | null {
  const g = guideFactsFor(id), facing = evidenceSpot(id).orientation;
  if (g?.swellWindow && facing !== null) { const c = clampWindow(g.swellWindow.fromDeg, g.swellWindow.toDeg, facing); return c ? {arc: c, basis: `guide window "${g.swellWindow.text}" within ±60° of facing ${facing}°`} : null; }
  if (g?.swellWindow) return {arc: [g.swellWindow.fromDeg, g.swellWindow.toDeg], basis: `guide window "${g.swellWindow.text}" (no stated facing)`};
  const sw = seawardOf.get(id); return sw === undefined ? null : {arc: [norm(sw - 60), norm(sw + 60)], basis: `seaward ±60° (${sw}°, catalogue map placement; no guide window)`};
}

// ---------- the station catalogue (metadata, not data) ----------
interface Station {id: string; name: string; type: string; owner: string; lat: number; lon: number}
const actXml = await get('https://www.ndbc.noaa.gov/activestations.xml'); if (!actXml) throw new Error('NDBC activestations.xml unavailable');
const act: Station[] = [...actXml.matchAll(/<station ([^>]*)\/?>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]])) as any)
  .map((s: any) => ({id: String(s.id).toUpperCase(), name: s.name, type: s.type, owner: s.owner, lat: +s.lat, lon: +s.lon, met: s.met}));
const SHELTERED = new Set(contextBuoys.filter((b) => b.sheltered).map((b) => b.id.toUpperCase()));
const buoyList = act.filter((s) => s.type === 'buoy' && !SHELTERED.has(s.id));
const fixedMet = act.filter((s: any) => s.type === 'fixed' && s.met === 'y');
const ASOS_STATES = ['HI', 'MA', 'RI', 'NY', 'NJ', 'VA', 'NC', 'SC', 'GA', 'FL'];
const asos: Station[] = [];
for (const st of ASOS_STATES) { const t = await get(ASOS_NETWORK_URL.replace('CA_ASOS', `${st}_ASOS`)); if (t) asos.push(...parseAsosNetwork(t).map((a) => ({id: a.id, name: a.name, type: 'asos', owner: `airport ASOS (${st}) via Iowa Environmental Mesonet`, lat: a.lat, lon: a.lon}))); }

// ---------- series ----------
interface Wave {hs: number; tp: number | null; dp: number | null}
interface WindObs {mph: number; dir: number; gust: number | null}
const erddap = (vars: string, id: string, [s, e]: [number, number]) => `https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet.csv?station,time,${vars}&station=%22${id}%22&time%3E=${iso(s)}&time%3C=${iso(e)}`;
/** ERDDAP rows to whole hours: the reading nearest the hour, if within ON_HOUR_MIN minutes (many buoys report at :26 and :56). */
function hourly<T>(csv: string | null, head: RegExp, row: (c: string[]) => T | null): Map<number, T> {
  const best = new Map<number, {d: number; v: T}>(); if (!csv) return new Map();
  const lines = csv.trim().split(/\r?\n/); if (!head.test(lines[0] ?? '')) return new Map();
  for (const l of lines.slice(2)) {
    const c = l.split(','), ms = Date.parse(c[1]); if (!Number.isFinite(ms)) continue;
    const hr = Math.round(ms / HOUR) * HOUR, d = Math.abs(ms - hr); if (d > ON_HOUR_MIN * 60000) continue;
    const v = row(c); if (v === null) continue; const b = best.get(hr); if (!b || d < b.d) best.set(hr, {d, v});
  }
  return new Map([...best].map(([t, x]) => [t, x.v]));
}
/** ERDDAP in month-sized pieces (a 3-month 30-minute request can time out). */
const chunks = ([s, e]: [number, number]) => { const out: [number, number][] = []; for (let a = s; a < e; a += 31 * 86400000) out.push([a, Math.min(e, a + 31 * 86400000)]); return out; };
async function erddapHourly<T>(vars: string, id: string, w: [number, number], head: RegExp, row: (c: string[]) => T | null) { const m = new Map<number, T>(); for (const c of chunks(w)) for (const [t, v] of hourly(await get(erddap(vars, id, c)), head, row)) if (t >= w[0] && t <= w[1]) m.set(t, v); return m; }
const num = (s: string | undefined) => (s === undefined || s === '' || s === 'NaN' ? null : Number.isFinite(Number(s)) ? Number(s) : null);
const waveCache = new Map<string, Map<number, Wave>>(), windCache = new Map<string, Map<number, WindObs>>();
async function waves(id: string, w: [number, number]) {
  const k = `${id}|${w[0]}`; if (!waveCache.has(k)) waveCache.set(k, await erddapHourly('WVHT,DPD,MWD', id, w, /^station,time,WVHT,DPD,MWD/, (c) => {
    const h = num(c[2]); if (h === null || h < 0 || h > 25) return null; const tp = num(c[3]), dp = num(c[4]);
    return {hs: h * FT, tp: tp !== null && tp > 0 && tp < 30 ? tp : null, dp: dp !== null && dp >= 0 && dp <= 360 ? dp : null};
  }));
  return waveCache.get(k)!;
}
async function wind(st: Station, w: [number, number]) {
  const k = `${st.id}|${w[0]}`; if (!windCache.has(k)) {
    if (st.type === 'asos') { const t = await get(asosURL(st.id, iso(w[0]), iso(w[1] + 86400000))); windCache.set(k, t ? new Map([...parseAsos(t, ASOS_CALM_MPH)].filter(([ts]) => ts >= w[0] && ts <= w[1])) : new Map()); }
    else windCache.set(k, await erddapHourly('WD,WSPD,GST', st.id, w, /^station,time,WD,WSPD,GST/, (c) => {
      const dir = num(c[2]), spd = num(c[3]), g = num(c[4]); if (dir === null || spd === null || dir < 0 || dir > 360 || spd < 0 || spd > 60) return null;
      return {mph: spd * MPS_TO_MPH, dir, gust: g === null ? null : g * MPS_TO_MPH};
    }));
  }
  return windCache.get(k)!;
}

// ---------- one window ----------
interface Hour {spot: string; group: string; t: number; hs: number; wind: (WindObs & {rel: string}) | null; windJudged: boolean; fc: number; ob: number | null; /** control: the observed-fed construction (bulk Hs as the only swell, no secondary, no surf-range ceiling) applied to the FORECAST's own Hs / period / direction and forecast wind */ fcBulk: number | null}
const relOf = (orient: number | null, dir: number) => orient === null ? 'unknown' : angle(dir, orient + 180) < 45 ? 'offshore' : angle(dir, orient) < 45 ? 'onshore' : 'cross-shore';
const meas = (value: number | null, unit: Measurement['unit'], base: Measurement, provider: string): Measurement => ({value, unit, source: {...base.source, provider, kind: 'observation' as any, notes: 'Audit: observed input.'}});

async function runWindow(win: WinKey) {
  const w = WIN[win], hours: Hour[] = [], meta: any[] = [];
  for (const spot of spots) {
    const ev = evidenceSpot(spot.id), group = groupOf(spot.region), wdw = windowOf(spot.id), base = {spot: spot.id, name: spot.name, region: spot.region, group, facing: ev.orientation, window: wdw?.basis ?? null};
    // the buoy, by rule
    const near = buoyList.map((b) => ({b, km: distanceKm(ev.latitude, ev.longitude, b.lat, b.lon), brg: bearing(ev.latitude, ev.longitude, b.lat, b.lon)})).filter((x) => x.km <= BUOY_KM).sort((p, q) => p.km - q.km);
    const inWin = wdw ? near.filter((x) => inArc(x.brg, wdw.arc)) : [];
    let buoy: {b: Station; km: number; brg: number; data: Map<number, Wave>} | null = null; const tried: string[] = [];
    for (const x of inWin) { const d = await waves(x.b.id, w); if (d.size >= MIN_OBS_HOURS) { buoy = {...x, data: d}; break; } tried.push(`${x.b.id} (${x.km.toFixed(1)} km, ${d.size} h of Hs)`); }
    if (!buoy) {
      const why = !near.length ? `no open-ocean buoy within ${BUOY_KM} km` : !wdw ? 'no swell window to check the buoy bearing against' : !inWin.length ? `buoy(s) within ${BUOY_KM} km but outside the swell window: ${near.map((x) => `${x.b.id} ${x.km.toFixed(1)} km at ${Math.round(x.brg)}°`).join(', ')} (window ${Math.round(wdw.arc[0])}°–${Math.round(wdw.arc[1])}°)` : `buoy(s) in the window with under ${MIN_OBS_HOURS} h of Hs in the window: ${tried.join(', ')}`;
      meta.push({...base, buoy: null, why, n: 0}); continue;
    }
    // the wind station, by rule
    let st: {s: Station; km: number; data: Map<number, WindObs>; note: string} | null = null;
    const cands = [...fixedMet, ...asos].map((s) => ({s, km: distanceKm(ev.latitude, ev.longitude, s.lat, s.lon)})).filter((c) => c.km <= WIND_KM).filter((c) => {
      if (enclosedCovers(c.s.lat, c.s.lon) && isEnclosedWater(c.s.lat, c.s.lon)) return false;
      return c.s.type === 'asos' || exposureShown(NDBC_EXPOSURE[c.s.id]?.exposure ?? null);
    }).sort((p, q) => p.km - q.km);
    for (const c of cands) { const d = await wind(c.s, w); if (d.size >= MIN_OBS_HOURS) { st = {...c, data: d, note: c.s.type === 'asos' ? (enclosedCovers(c.s.lat, c.s.lon) ? 'airfield' : 'airfield, no enclosed-water check') : `${NDBC_EXPOSURE[c.s.id].exposure} (NDBC_EXPOSURE)`}; break; } }
    const windJudged = !!st && ev.orientation !== null;
    // the forecast inputs (exactly as rating-audit.ts)
    const span = win === 'recent' ? `forecast_days=1&past_days=${Math.min(92, Math.ceil((Date.now() - w[0]) / 86400000) + 1)}` : `start_date=${day(w[0])}&end_date=${day(w[1])}`;
    const mt = await get(marineURL(ev).replace('forecast_days=7', span));
    const wt = await get(win === 'recent' ? weatherURL(ev).replace('forecast_days=7', span) : weatherURL(ev).replace('https://api.open-meteo.com/', 'https://historical-forecast-api.open-meteo.com/').replace('forecast_days=7', span));
    const bm = {id: buoy.b.id, name: buoy.b.name, owner: buoy.b.owner, km: +buoy.km.toFixed(1), bearing: Math.round(buoy.brg), hours: buoy.data.size};
    const wm = st ? {id: st.s.id, name: st.s.name, type: st.s.type, owner: st.s.owner, km: +st.km.toFixed(1), hours: st.data.size, siting: st.note} : null;
    if (!mt || !wt) { meta.push({...base, buoy: bm, wind: wm, windJudged, n: 0, why: `Open-Meteo ${!mt ? 'marine' : 'weather'} hours missing`}); continue; }
    let n = 0;
    for (const r of normalizeOpenMeteo(ev, JSON.parse(mt), JSON.parse(wt), iso(w[1]))) {
      const ts = Date.parse(r.timestamp); if (ts < w[0] || ts >= w[1] || isDark(spot.id, r.timestamp)) continue;
      const bo = buoy.data.get(ts); if (!bo) continue;
      const f = toLegacy(r), nowMs = ts - LEAD_H * HOUR, fcR = rateForecast(spot as any, f, nowMs, {night: false}); if (fcR.score === null) continue;
      const wo = st?.data.get(ts) ?? null;
      const rObs: OceanRecord | null = bo.tp !== null && bo.dp !== null && wo ? {...r, offshore: meas(bo.hs, 'ft', r.offshore, 'buoy'), primary: {height: meas(bo.hs, 'ft', r.primary.height, 'buoy'), period: meas(bo.tp, 's', r.primary.period, 'buoy'), direction: meas(bo.dp, 'deg', r.primary.direction, 'buoy')}, secondary: null,
        windSpeed: meas(wo.mph, 'mph', r.windSpeed, 'station'), windDirection: meas(wo.dir, 'deg', r.windDirection, 'station'), gusts: meas(wo.gust, 'mph', r.gusts, 'station'), faceEstimate: undefined} : null;
      const obR = rObs ? provisionalRating(ev, rObs, nowMs) : null;
      const fh = r.offshore.value, fBulk: OceanRecord | null = rObs && fh !== null ? {...r, primary: {height: meas(fh, 'ft', r.primary.height, 'model'), period: r.primary.period, direction: r.primary.direction}, secondary: null, faceEstimate: undefined} : null;
      const fbR = fBulk ? provisionalRating(ev, fBulk, nowMs) : null;
      hours.push({spot: spot.id, group, t: ts, hs: bo.hs, wind: wo ? {...wo, rel: relOf(ev.orientation, wo.dir)} : null, windJudged, fc: fcR.score, ob: obR?.score ?? null, fcBulk: fbR?.score ?? null});
      n++;
    }
    meta.push({...base, buoy: bm, wind: wm, windJudged, n});
    console.log(`${win} ${spot.name}: buoy ${bm.id} ${bm.km} km, wind ${wm?.id ?? '-'} ${n} daylight hours`);
  }
  return {hours, meta};
}

setOnshoreCapEnabled(true);   // as rating-audit.ts
const res = {recent: await runWindow('recent'), winter: await runWindow('winter')};

// ---------- rates ----------
const tiny = (h: Hour, ft = TINY_FT) => h.hs < ft;
const blown = (h: Hour) => h.windJudged && !!h.wind && h.wind.rel === 'onshore' && h.wind.mph > ONSHORE_BAD_MPH;
const poor = (h: Hour, ft = TINY_FT) => tiny(h, ft) || blown(h);
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '–');
const fcFair = (h: Hour, min = FAIR) => h.fc >= min, obFair = (h: Hour, min = FAIR) => h.ob !== null && h.ob >= min;
function stats(hs: Hour[], ft = TINY_FT) {
  const p = hs.filter((h) => poor(h, ft)), pOb = p.filter((h) => h.ob !== null), rated = hs.filter((h) => fcFair(h));
  return {hours: hs.length, windJudgedHours: hs.filter((h) => h.windJudged && h.wind).length, poor: p.length, poorTiny: hs.filter((h) => tiny(h, ft)).length, poorBlown: hs.filter(blown).length,
    fcFairWhilePoor: p.filter((h) => fcFair(h)).length, fcNotBadWhilePoor: p.filter((h) => fcFair(h, NOT_BAD)).length,
    poorWithObs: pOb.length, obFairWhilePoor: pOb.filter((h) => obFair(h)).length, fcFairWhilePoorSameHours: pOb.filter((h) => fcFair(h)).length, fcBulkFairWhilePoor: pOb.filter((h) => h.fcBulk !== null && h.fcBulk >= FAIR).length,
    ratedFair: rated.length, ratedFairPoor: rated.filter((h) => poor(h, ft)).length};
}
type S = ReturnType<typeof stats>;
const cells = (s: S) => `${s.hours} | ${s.poor} (${s.poorTiny} Hs<${TINY_FT} ft, ${s.poorBlown} onshore) | ${pct(s.fcFairWhilePoor, s.poor)} (${s.fcFairWhilePoor}) | ${pct(s.obFairWhilePoor, s.poorWithObs)} (${s.obFairWhilePoor} of ${s.poorWithObs}) | ${pct(s.ratedFairPoor, s.ratedFair)} (${s.ratedFairPoor} of ${s.ratedFair})`;
const head = `| ${'%s'} | daylight hours | observed poor (buoy Hs under ${TINY_FT} ft offshore / measured onshore over ${ONSHORE_BAD_MPH} mph) | forecast-fed fair+ while poor | observed-fed fair+ while poor | of forecast-fed fair+ hours, observed poor |\n|---|---|---|---|---|---|`;
const groups = (hs: Hour[]) => GROUP_ORDER.filter((g) => hs.some((h) => h.group === g));
const eastOf = (hs: Hour[]) => hs.filter((h) => !h.group.startsWith('Oahu'));
function regionTable(win: WinKey) {
  const hs = res[win].hours, m = res[win].meta;
  const rows = groups(hs).map((g) => { const gh = hs.filter((h) => h.group === g); return `| ${g} (${m.filter((x) => x.group === g && x.n > 0).length} spots) | ${cells(stats(gh))} |`; });
  rows.push(`| **US East, all** | ${cells(stats(eastOf(hs)))} |`, `| **Hawaii + East, all** | ${cells(stats(hs))} |`);
  return `${head.replace('%s', 'region')}\n${rows.join('\n')}`;
}
function swellOnlyTable(win: WinKey) {
  const hs = res[win].hours;
  const rows = groups(hs).map((g) => { const gh = hs.filter((h) => h.group === g), s1 = stats(gh), s2 = stats(gh, SENS_FT); return `| ${g} | ${s1.hours} | ${s1.poorTiny} | ${pct(gh.filter((h) => tiny(h) && fcFair(h)).length, s1.poorTiny)} | ${s2.poorTiny} | ${pct(gh.filter((h) => tiny(h, SENS_FT) && fcFair(h)).length, s2.poorTiny)} | ${pct(gh.filter((h) => tiny(h, SENS_FT) && h.ob !== null && obFair(h)).length, gh.filter((h) => tiny(h, SENS_FT) && h.ob !== null).length)} |`; });
  return `| region | daylight hours | buoy Hs under ${TINY_FT} ft | … forecast-fed fair+ | buoy Hs under ${SENS_FT} ft (sensitivity) | … forecast-fed fair+ | … observed-fed fair+ (hours with wind) |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}`;
}
function controlTable(win: WinKey) {
  const hs = res[win].hours, rows = [...groups(hs).map((g) => [g, hs.filter((h) => h.group === g)] as const), ['**all**', hs] as const].map(([g, gh]) => { const s = stats(gh);
    return `| ${g} | ${s.poorWithObs} | ${pct(s.fcFairWhilePoorSameHours, s.poorWithObs)} | ${pct(s.fcBulkFairWhilePoor, s.poorWithObs)} | ${pct(s.obFairWhilePoor, s.poorWithObs)} |`; });
  return `| region | poor hours with both ratings | forecast-fed fair+ (the app's rating) | CONTROL: forecast inputs rebuilt like the observed-fed ones (bulk Hs as the only swell, no secondary swell, no surf-range ceiling) fair+ | observed-fed fair+ |\n|---|---|---|---|---|\n${rows.join('\n')}`;
}
function spotTable(win: WinKey) {
  const hs = res[win].hours, m = res[win].meta.filter((x: any) => x.n > 0);
  return GROUP_ORDER.filter((g) => m.some((x: any) => x.group === g)).map((g) => `**${g}**\n\n| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<${TINY_FT} / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |\n|---|---|---|---|---|---|---|---|\n` +
    m.filter((x: any) => x.group === g).map((x: any) => { const s = stats(hs.filter((h) => h.spot === x.spot));
      const wcell = x.wind ? `${x.wind.id} (${x.wind.name}; ${x.wind.siting}), ${x.wind.km} km${x.windJudged ? '' : ' (no stated facing: not judged onshore)'}` : 'none: swell-only';
      return `| ${x.name} | ${x.buoy.id} ${x.buoy.name}, ${x.buoy.km} km at ${x.buoy.bearing}° | ${wcell} | ${s.hours} | ${s.poor} (${s.poorTiny} / ${s.poorBlown}) | ${pct(s.fcFairWhilePoor, s.poor)} | ${pct(s.obFairWhilePoor, s.poorWithObs)} | ${pct(s.ratedFairPoor, s.ratedFair)} |`; }).join('\n')).join('\n\n');
}
function noBuoyList() {
  // a spot is listed if it has no eligible buoy in EITHER window (the reason given per window when they differ)
  const byId = new Map<string, any[]>(); for (const k of ['recent', 'winter'] as WinKey[]) for (const x of res[k].meta) if (!x.buoy) byId.set(x.spot, [...(byId.get(x.spot) ?? []), {...x, win: k}]);
  return GROUP_ORDER.map((g) => { const xs = [...byId.values()].filter((v) => v[0].group === g); if (!xs.length) return '';
    return `**${g}** (${xs.length})\n\n` + xs.map((v) => { const whys = [...new Set(v.map((x: any) => x.why))]; return `- ${v[0].name}${v.length === 1 ? ` (${WIN_LABEL[v[0].win as WinKey].toLowerCase()} only)` : ''}: ${whys.join('; ')}`; }).join('\n'); }).filter(Boolean).join('\n\n');
}
const sumOf = (k: WinKey) => ({...Object.fromEntries(groups(res[k].hours).map((g) => [g, stats(res[k].hours.filter((h) => h.group === g))])), 'US East, all': stats(eastOf(res[k].hours)), all: stats(res[k].hours)});
const spotsWith = (k: WinKey) => res[k].meta.filter((x: any) => x.n > 0).length;

const md = `# Rating check: Hawaii and the US East Coast (2026-11-09)

Generated ${new Date().toISOString().slice(0, 16)}Z by \`docs/forecast/data/rating-audit-hi-east.ts\` (spec \`docs/specs/2026-11-09-clock-perf-deselect.md\`, 2B). Reproduce: \`ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/rating-audit-hi-east.ts --recent ${iso(WIN.recent[0])}/${iso(WIN.recent[1])} --winter ${iso(WIN.winter[0])}/${iso(WIN.winter[1])}\`. **A report: no rating code was changed.** The California audit it mirrors: \`RATING-AUDIT.md\`.

**The question.** How often does the app's rating say fair or better (score ${FAIR}+) when the observed conditions were poor, at the ${spots.length} Hawaii and US East spots?

**What each number is. Read this first.**
- **Observed swell = OFFSHORE SWELL at a wave buoy, not surf.** The buoy's measured significant wave height (Hs), dominant period and mean direction (NDBC stdmet via NOAA ERDDAP \`cwwcNDBCMet\`, the reading within ${ON_HOUR_MIN} minutes of the hour). It is not the breaking wave height at the spot and this report never calls it surf height. Buoy rule: ${BUOY_RULE}.
- **"Poor" for size = buoy Hs under ${TINY_FT} ft, an OFFSHORE PROXY.** The California audit's "surf under 1 ft" is a nearshore height carried to the spot's point by CDIP MOP (California only). Offshore Hs under 1 ft (0.3 m) is a much rarer, flatter sea state than nearshore under 1 ft, so this size criterion catches only dead-flat hours and the size-poor counts here are NOT comparable with California's. A looser ${SENS_FT} ft line is shown as a sensitivity check only.
- **Observed wind = measured at a shore station, not at the break.** Rule: ${WIND_RULE}. A spot with no station, or with no stated facing (onshore cannot be judged), uses the swell-only poor criterion; the per-spot tables say which.
- **Forecast-fed rating** = \`rateForecast\` on the archived Open-Meteo Marine + Weather hours for the window (close to a nowcast, not the days-ahead forecast; lead-dependent parts judged ${LEAD_H} h ahead), exactly as the California audit.
- **Observed-fed rating** = the same engine (\`provisionalRating\`, as the California audit) on the buoy's Hs / period / direction as the swell (bulk values, no partition) plus the station's measured wind. Only hours with both, and with the buoy's period and direction present.
- **Poor** = buoy Hs under ${TINY_FT} ft OR measured onshore wind (within 45° of the facing) over ${ONSHORE_BAD_MPH} mph (\`ONSHORE_BAD_MPH\`). **Fair or better** = score ${FAIR}+. Daylight hours only, in each spot's own time zone.
- Windows: **${WIN_LABEL.recent.toLowerCase()}** ${day(WIN.recent[0])} to ${day(WIN.recent[1] - 1)}; **${WIN_LABEL.winter.toLowerCase()}** ${day(WIN.winter[0])} to ${day(WIN.winter[1] - 1)}. Every threshold is OUR OWN CHOICE; this is a check against observations at a distance, not a validated accuracy figure. Missing readings are left out, never filled.

Spots with an eligible buoy: ${spotsWith('recent')} of ${spots.length} (${WIN_LABEL.recent.toLowerCase()}), ${spotsWith('winter')} of ${spots.length} (${WIN_LABEL.winter.toLowerCase()}).${failed.length ? ` **${failed.length} downloads failed after retries** (listed in the JSON); their data is reported missing.` : ''}

## 1. Per region: how often a poor hour was rated fair or better

${(['recent', 'winter'] as WinKey[]).map((k) => `### ${WIN_LABEL[k]} (${day(WIN[k][0])} to ${day(WIN[k][1] - 1)})\n${regionTable(k)}`).join('\n\n')}

**California, for comparison** (\`RATING-AUDIT.md\`, different windows and a nearshore size criterion; "either" row and section 3): archive 2025-11-01 to 2026-05-01: forecast-fed fair+ while poor 36.9%, observed-fed 72.0%, of forecast-fed fair+ hours observed poor 2.7%; recent 2026-10-07 to 2026-11-06: 50.0%, 78.7%, 5.7%. California's onshore-wind row alone: 28.3% / 71.1% (archive), 50.0% / 78.7% (recent).

## 2. Size only: offshore buoy Hs under ${TINY_FT} ft, and the ${SENS_FT} ft sensitivity line

${(['recent', 'winter'] as WinKey[]).map((k) => `### ${WIN_LABEL[k]}\n${swellOnlyTable(k)}`).join('\n\n')}

## 2b. Is the observed-fed rating a fair comparison? (control)

The observed-fed rating feeds the engine the buoy's BULK Hs as the primary swell with no secondary swell and no surf-range estimate. The engine scores "organization" higher the larger the primary swell's share of Hs (100% with bulk input) and applies a wide-range ceiling only when a surf estimate exists, so that construction alone can raise a score. The control column rebuilds the FORECAST inputs the same way (Open-Meteo's combined Hs as the only swell, its period and direction, forecast wind) on the same poor hours. If the control is close to the observed-fed column, the gap to the app's rating is the construction, not the buoy.

${(['recent', 'winter'] as WinKey[]).map((k) => `### ${WIN_LABEL[k]}\n${controlTable(k)}`).join('\n\n')}

## 3. Per spot

${(['recent', 'winter'] as WinKey[]).map((k) => `### ${WIN_LABEL[k]}\n\n${spotTable(k)}`).join('\n\n')}

## 4. Spots with no eligible buoy (why)

${noBuoyList()}

`;
const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '', notes = prev.includes('<!-- notes -->') ? prev.slice(prev.indexOf('<!-- notes -->')) : '<!-- notes -->\n';
fs.writeFileSync(OUT, md + notes);
fs.writeFileSync(JSON_OUT, JSON.stringify({generatedAt: new Date().toISOString(), note: 'Generated by docs/forecast/data/rating-audit-hi-east.ts. Observed swell = OFFSHORE buoy Hs (not surf); "Hs under 1 ft" is an offshore proxy; observed wind = shore station. Our thresholds. A report: no rating changed.',
  rules: {buoy: BUOY_RULE, wind: WIND_RULE, tinyFt: TINY_FT, sensitivityFt: SENS_FT, onshoreBadMph: ONSHORE_BAD_MPH, fair: FAIR}, failedDownloads: failed,
  windows: Object.fromEntries((['recent', 'winter'] as WinKey[]).map((k) => [k, {start: iso(WIN[k][0]), end: iso(WIN[k][1]), byRegion: sumOf(k),
    spots: res[k].meta.map((x: any) => ({...x, ...(x.n > 0 ? {stats: stats(res[k].hours.filter((h) => h.spot === x.spot))} : {})}))}]))}, null, 1) + '\n');
console.log(`wrote ${OUT} and ${JSON_OUT}`);
for (const k of ['recent', 'winter'] as WinKey[]) for (const [g, s] of Object.entries(sumOf(k))) console.log(k, g, JSON.stringify(s));

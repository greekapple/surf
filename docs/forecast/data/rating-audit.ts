// Ratings that don't oversell (2026-11-06): how often the rating engine says "fair or better" when the OBSERVED conditions were poor.
// Run: ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/rating-audit.ts [--archive 2025-11-01T00:00:00Z/2026-05-01T00:00:00Z] [--recent 2026-10-07T00:00:00Z/2026-11-06T00:00:00Z]
// Public data only, no keys. Same windows, buoys, MOP files, Open-Meteo Marine hours and download cache (ACC_CACHE) as docs/forecast/data/accuracy-vs-buoys.ts.
//
// For every DAYLIGHT hour at every spot with an observation:
//   OBSERVED surf  = the T-131 "observation-anchored" height: a wave buoy's measured Hs carried to the spot's MOP point by MOP's own hourly ratio
//                    (point ÷ buoy site), only from a buoy within 40 km where MOP is right at the buoy (judged on the window's first 2/3). Model-assisted.
//   OBSERVED wind  = an NDBC / NOS meteorological station (NDBC's stdmet record via NOAA ERDDAP `cwwcNDBCMet`), the reading ON the hour, ids and positions
//                    read from NDBC's station metadata (activestations.xml). Chosen by rule (WIND_RULE below), not by hand.
//   FORECAST-FED rating = the app's own engine (rateForecast) on the Open-Meteo Marine + Open-Meteo Weather hours for the window (the archived
//                    short-range runs Open-Meteo serves for past dates, i.e. close to a nowcast: NOT the days-ahead forecast), judged as if seen 24 h ahead.
//   OBSERVED-FED rating = the same engine on the measured inputs: the buoy's Hs, peak period and peak direction as the swell, the station's wind.
// Poor = surf under 1 ft, OR onshore wind over 12 mph (the Call's own "Skip" line, ONSHORE_BAD_MPH), OR (for the Call) too big for the skill.
// Fair or better = the rating's "fair" or "good" colour band (score 40 and up: SURFABLE, NOT BAD, SOLID, GOOD, FIRING, EPIC).
// Writes docs/forecast/RATING-AUDIT.md (keeping anything after `<!-- notes -->`) and docs/forecast/data/rating-audit.json.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {allSpots} from '../../../src/data/catalog.ts';
import {defaultProfile} from '../../../src/data/demo.ts';
import {assignmentFor} from '../../../src/ocean/mop.ts';
import {evidenceSpot} from '../../../src/ocean/spots.ts';
import {marineURL, weatherURL, normalizeOpenMeteo} from '../../../src/ocean/openMeteo.ts';
import {normalizeNearshore} from '../../../src/ocean/nearshore.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {rateForecast} from '../../../src/ratings/adapters.ts';
import {provisionalRating} from '../../../src/ratings/provisional.ts';
import {setOnshoreCapEnabled} from '../../../src/ratings/windRules.ts';
import {hourCall, ONSHORE_BAD_MPH, SKILL_RANGE_FT} from '../../../src/services/call.ts';
import {isDark} from '../../../src/services/daylight.ts';
import {isEnclosedWater} from '../../../src/map/enclosed.ts';
import {ASOS_NETWORK_URL, parseAsosNetwork, asosURL, parseAsos} from './shore-wind.ts';
import {angle} from '../../../src/utils/units.ts';
import {OBSERVING_BUOYS, buoyFeedURL, parseCdipSeries, parseNdbcSeries, pairSeries, score, splitByTime, distanceKm, type HourSeries} from '../../../src/services/accuracy.ts';
import type {OceanRecord, Measurement} from '../../../src/ocean/types.ts';
import type {UserProfile} from '../../../src/models/index.ts';

const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const HOUR = 3600000, range = (s: string) => s.split('/').map((x) => Math.floor(Date.parse(x) / HOUR) * HOUR) as [number, number];
const WIN = {archive: range(arg('--archive', '2025-11-01T00:00:00Z/2026-05-01T00:00:00Z')), recent: range(arg('--recent', '2026-10-07T00:00:00Z/2026-11-06T00:00:00Z'))};
const OUT = arg('--out', 'docs/forecast/RATING-AUDIT.md'), JSON_OUT = 'docs/forecast/data/rating-audit.json';
const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z'), day = (t: number) => iso(t).slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CACHE = process.env.ACC_CACHE ?? null, cacheFile = (u: string) => `${CACHE}/${createHash('sha1').update(u).digest('hex')}.txt`;
async function get(u: string, tries = 3): Promise<string | null> {
  if (CACHE && fs.existsSync(cacheFile(u))) return fs.readFileSync(cacheFile(u), 'utf8');
  for (let i = 0; i < tries; i++) { try { const r = await fetch(u, {signal: AbortSignal.timeout(180000)}); if (r.ok) { const t = await r.text(); if (CACHE) { fs.mkdirSync(CACHE, {recursive: true}); fs.writeFileSync(cacheFile(u), t); } return t; } if (r.status === 404 || r.status === 400) return null; } catch { /* retry */ } await sleep(3000 * (i + 1)); }
  return null;
}
const ncss = (path: string, [s, e]: [number, number]) => `https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/${path}?` + new URLSearchParams({var: 'waveHs,waveTp,waveDp,waveFlagPrimary', time_start: iso(s), time_end: iso(e), accept: 'csv'});
const mopNowcastURL = (id: string, w: [number, number]) => ncss(`model/${/^BP/.test(id) ? 'MOP_validation' : 'MOP_alongshore'}/${id}_nowcast.nc`, w);
const clip = (s: HourSeries, [a, b]: [number, number]) => new Map([...s].filter(([t]) => t >= a && t <= b));
const MOP_OK = {bias: 0.5, mae: 1.0, n: 200}, MIN_OBS_HOURS = 200, ANCHOR_KM = 40;

// ---------- thresholds (OUR OWN CHOICES, each named where it is used) ----------
/** Observed surf under this is "too small to surf" (about 1 ft, the brief). In the convention the app uses (about the nearshore Hs). */
const TINY_FT = 1;
/** Fair or better: the rating's fair band starts at SURFABLE (40); NOT BAD starts at 55; the good band at SOLID (65). */
const FAIR = 40, NOT_BAD = 55, GOOD = 65;
/** Wind station rule (2026-11-08, was: nearest NDBC/NOS station within 40 km, which for most spots was an offshore buoy 22–40 km out at sea):
 *  the nearest SHORE station within WIND_KM of the spot: a fixed NDBC/NOS met station not in enclosed water by the repo's own mask
 *  (src/map/enclosed.ts: bays, harbours, estuaries), or an airport ASOS (IEM archive, docs/forecast/data/shore-wind.ts), that reports wind on at
 *  least 200 hours of the window. No offshore buoys. A spot with no such station has no observed wind. Anemometers stand 4–20 m up, on a pier,
 *  headland or airfield, not at the break; no height or exposure correction is made. */
/** Below this an airport's variable (VRB) direction is kept (as 0°, not scored for direction), so light-wind hours are not dropped. */
const ASOS_CALM_MPH = 5;
const WIND_KM = 7, WIND_RULE = `nearest shore station within ${WIND_KM} km (a fixed NDBC/NOS met station or an airport ASOS via the Iowa Environmental Mesonet, either kind not in enclosed water by src/map/enclosed.ts), with wind on 200+ hours of the window; no offshore buoys`;
const MPS_TO_MPH = 2.236936;
/** The app judges a forecast the day before (How right uses the same lead): the lead-dependent parts of the rating read nowMs = hour - LEAD_H. */
const LEAD_H = 24;

// ---------- the met-station catalogue (metadata, not data) ----------
interface Station {id: string; name: string; type: string; owner: string; lat: number; lon: number}
async function stations(): Promise<Station[]> {
  const x = await get('https://www.ndbc.noaa.gov/activestations.xml'); if (!x) throw new Error('NDBC activestations.xml unavailable');
  return [...x.matchAll(/<station ([^>]*)\/?>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]])) as any)
    .filter((s: any) => s.met === 'y').map((s: any) => ({id: String(s.id).toUpperCase(), name: s.name, type: s.type, owner: s.owner, lat: +s.lat, lon: +s.lon}));
}
interface WindObs {mph: number; dir: number; gust: number | null}
const windURL = (id: string, [s, e]: [number, number]) => `https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet.csv?station,time,WD,WSPD,GST&station=%22${id}%22&time%3E=${iso(s)}&time%3C=${iso(e)}`;
function parseWind(csv: string): Map<number, WindObs> {
  const out = new Map<number, WindObs>(), lines = csv.trim().split(/\r?\n/);
  if (!/^station,time,WD,WSPD,GST/.test(lines[0] ?? '')) return out;
  for (const l of lines.slice(2)) {
    const [, t, wd, ws, gs] = l.split(','), ms = Date.parse(t);
    if (!Number.isFinite(ms) || ms % HOUR !== 0 || wd === 'NaN' || ws === 'NaN' || wd === '' || ws === '') continue; // the reading ON the hour only
    const dir = Number(wd), spd = Number(ws); if (!Number.isFinite(dir) || !Number.isFinite(spd) || dir < 0 || dir > 360 || spd < 0 || spd > 60) continue;
    out.set(ms, {mph: spd * MPS_TO_MPH, dir, gust: gs && gs !== 'NaN' && Number.isFinite(Number(gs)) ? Number(gs) * MPS_TO_MPH : null});
  }
  return out;
}

// ---------- one hour ----------
type Verdict = 'Go' | 'Worth a look' | 'Skip' | 'Dark';
interface Hour {
  spot: string; t: number; fit: boolean;
  surfObs: number | null; windObs: (WindObs & {rel: string}) | null;
  fc: number | null; fcCat: string; ob: number | null; obCat: string | null;
  /** The forecast inputs the app had at that hour (for the candidate rules): onshore/cross/offshore and mph, the offshore Hs, the v1 surf height. */
  fcRel: string; fcMph: number; fcHs: number | null; fcV1: number | null;
  callI: Verdict; callB: Verdict; /** The Call's typical (central) surf estimate for the hour, ft; null without an estimate. */ central: number | null; callIPre: Verdict; callBPre: Verdict;
  /** Copies of the scores and verdicts used by the candidate evaluation (a candidate is applied on top of these). */
  fcPre: number | null; obPre: number | null;
}
const INTER: UserProfile = {...defaultProfile, skill: 'Intermediate', minWave: 0, maxWave: 0};
const BEGIN: UserProfile = {...defaultProfile, skill: 'Beginner', minWave: 0, maxWave: 0};
const relOf = (orient: number | null, dir: number) => orient === null ? 'unknown' : angle(dir, orient + 180) < 45 ? 'offshore' : angle(dir, orient) < 45 ? 'onshore' : 'cross-shore';
const meas = (value: number | null, unit: Measurement['unit'], base: Measurement, provider: string): Measurement => ({value, unit, source: {...base.source, provider, kind: 'observation' as any, notes: 'Audit: observed input.'}});

const asosNet = await get(ASOS_NETWORK_URL);
const statList: Station[] = [...(await stations()).filter((s) => s.type === 'fixed'),
  ...(asosNet ? parseAsosNetwork(asosNet).map((a) => ({id: a.id, name: a.name, type: 'asos', owner: 'airport ASOS via Iowa Environmental Mesonet', lat: a.lat, lon: a.lon})) : [])];
const windCache = new Map<string, Map<number, WindObs>>();
async function windFor(st: Station, w: [number, number]) { const k = `${st.id}|${w[0]}`; if (!windCache.has(k)) { const asos = st.type === 'asos', t = await get(asos ? asosURL(st.id, iso(w[0]), iso(w[1])) : windURL(st.id, w)); windCache.set(k, t ? (asos ? parseAsos(t, ASOS_CALM_MPH) : parseWind(t)) : new Map()); } return windCache.get(k)!; }

async function runWindow(win: 'archive' | 'recent') {
  const w = WIN[win], cut = w[0] + (w[1] - w[0]) * 2 / 3, obs = new Map<string, HourSeries>(), bp = new Map<string, HourSeries>();
  for (const x of OBSERVING_BUOYS) {
    const u = buoyFeedURL(x, win, iso(w[0]), iso(w[1])); if (!u) continue;
    const t = await get(u); const s = t ? clip(/ndbc\.noaa/.test(u) ? parseNdbcSeries(t) : parseCdipSeries(t), w) : new Map(); if (s.size < MIN_OBS_HOURS) continue;
    obs.set(x.id, s); if (x.mopPoint) { const m = await get(mopNowcastURL(x.mopPoint.id, w)); bp.set(x.id, m ? clip(parseCdipSeries(m), w) : new Map()); }
  }
  // "MOP right at the buoy", judged on the window's first 2/3 only (the T-131 rule)
  const ok = new Set([...obs.keys()].filter((id) => { const cp = pairSeries(obs.get(id)!, new Map([...(bp.get(id) ?? new Map())].map(([t, v]) => [t, v.hs]))), cf = score(splitByTime(cp).fit); return !!cf && cf.n >= MOP_OK.n && Math.abs(cf.biasFt) <= MOP_OK.bias && cf.maeFt <= MOP_OK.mae; }));
  const hours: Hour[] = [], meta: any[] = [];
  for (const spot of allSpots) {
    const ev = evidenceSpot(spot.id), a = assignmentFor(spot.id);
    const anchor = a ? OBSERVING_BUOYS.filter((x) => ok.has(x.id)).map((x) => ({x, km: distanceKm(ev.latitude, ev.longitude, x.lat, x.lon)})).filter((p) => p.km <= ANCHOR_KM).sort((p, q) => p.km - q.km)[0] ?? null : null;
    // wind station by rule
    let wind: {st: Station; km: number; data: Map<number, WindObs>} | null = null;
    for (const c of statList.map((st) => ({st, km: distanceKm(ev.latitude, ev.longitude, st.lat, st.lon)})).filter((c) => c.km <= WIND_KM && !isEnclosedWater(c.st.lat, c.st.lon)).sort((p, q) => p.km - q.km)) {
      const d = clip(await windFor(c.st, w) as any, w) as unknown as Map<number, WindObs>; if (d.size >= MIN_OBS_HOURS) { wind = {...c, data: d}; break; }
    }
    if (!anchor && !wind) { meta.push({spot: spot.id, name: spot.name, anchor: null, wind: null, n: 0}); continue; }
    // the spot's MOP nowcast (for the anchored height and as the Call's stand-in MOP forecast)
    const mopText = a ? await get(mopNowcastURL(a.mopId, w)) : null, sp = mopText ? clip(parseCdipSeries(mopText), w) : new Map();
    const mopRecs = mopText ? normalizeNearshore(mopText, iso(w[1]), mopNowcastURL(a!.mopId, w), 'forecast') : [], mopAt = new Map(mopRecs.map((r) => [Date.parse(r.timestamp), r]));
    const anchored = new Map<number, number>();
    if (anchor) { const o = obs.get(anchor.x.id)!, bps = bp.get(anchor.x.id)!; for (const [ts, y] of o) { const p = sp.get(ts)?.hs, q = bps.get(ts)?.hs; if (p !== undefined && q !== undefined && q > 0.15) anchored.set(ts, y.hs * p / q); } }
    // the forecast inputs: Open-Meteo Marine + Weather hours for the window (archived short-range runs)
    const span = win === 'recent' ? `forecast_days=1&past_days=${Math.min(92, Math.ceil((Date.now() - w[0]) / 86400000) + 1)}` : `start_date=${day(w[0])}&end_date=${day(w[1])}`;
    const mt = await get(marineURL(ev).replace('forecast_days=7', span));
    const wt = await get(win === 'recent' ? weatherURL(ev).replace('forecast_days=7', span) : weatherURL(ev).replace('https://api.open-meteo.com/', 'https://historical-forecast-api.open-meteo.com/').replace('forecast_days=7', span));
    if (!mt || !wt) { meta.push({spot: spot.id, name: spot.name, anchor: anchor ? {id: anchor.x.id, km: anchor.km} : null, wind: wind ? {id: wind.st.id, km: wind.km} : null, n: 0, missing: !mt ? 'marine' : 'weather'}); continue; }
    let n = 0;
    for (const r of normalizeOpenMeteo(ev, JSON.parse(mt), JSON.parse(wt), iso(w[1]))) {
      const ts = Date.parse(r.timestamp); if (ts < w[0] || ts > w[1] || isDark(spot.id, r.timestamp)) continue;
      const surfObs = anchored.get(ts) ?? null, wo = wind?.data.get(ts) ?? null; if (surfObs === null && !wo) continue;
      const f = toLegacy(r), nowMs = ts - LEAD_H * HOUR;
      const rate = () => rateForecast(spot as any, f, nowMs, {night: false});
      const fcR = rate(); if (fcR.score === null) continue;
      // observed-fed: the buoy's own Hs / Tp / Dp (bulk: no swell partition, no secondary) and the station's wind; needs both
      const bo = anchor ? obs.get(anchor.x.id)!.get(ts) : undefined;
      const rObs: OceanRecord | null = bo && bo.tp !== undefined && bo.dp !== undefined && wo ? {...r, offshore: meas(bo.hs, 'ft', r.offshore, 'buoy'), primary: {height: meas(bo.hs, 'ft', r.primary.height, 'buoy'), period: meas(bo.tp, 's', r.primary.period, 'buoy'), direction: meas(bo.dp, 'deg', r.primary.direction, 'buoy')}, secondary: null,
        windSpeed: meas(wo.mph, 'mph', r.windSpeed, 'station'), windDirection: meas(wo.dir, 'deg', r.windDirection, 'station'), gusts: meas(wo.gust, 'mph', r.gusts, 'station'), faceEstimate: undefined} : null;
      const obR = rObs ? provisionalRating(ev, rObs, nowMs) : null;
      const bundle = mopAt.has(ts) && a ? {mop: {[a.mopId]: {mopId: a.mopId, records: [mopAt.get(ts)!], issue: null, retrievedAt: iso(w[1]), url: ''}}} : null;
      const ctx = {records: [f], bundle: bundle as any, nowMs};
      const callI = hourCall(spot as any, f, INTER, ctx).verdict, cB = hourCall(spot as any, f, BEGIN, ctx), callB = cB.verdict, hl: any = cB.hour.surf.headline, central = hl?.kind === 'estimate' && !hl.nearshoreOnly?.flat && Number.isFinite(hl.centralFt) ? hl.centralFt as number : null;
      const fcPre = fcR.score, obPre = obR?.score ?? null, callIPre = callI, callBPre = callB;
      const fcWs = r.windSpeed.value ?? NaN, fcWd = r.windDirection.value ?? NaN;
      hours.push({spot: spot.id, t: ts, fit: ts < cut, surfObs, windObs: wo ? {...wo, rel: relOf(ev.orientation, wo.dir)} : null, fc: fcR.score, fcCat: fcR.category, ob: obR?.score ?? null, obCat: obR?.category ?? null,
        fcRel: Number.isFinite(fcWd) ? relOf(ev.orientation, fcWd) : 'unknown', fcMph: fcWs, fcHs: r.offshore.value, fcV1: (r.faceEstimate as any)?.centralFt ?? null, callI, callB, central, callIPre, callBPre, fcPre, obPre});
      n++;
    }
    meta.push({spot: spot.id, name: spot.name, region: ev.region, orientation: ev.orientation, anchor: anchor ? {id: anchor.x.id, name: anchor.x.name, km: +anchor.km.toFixed(1)} : null, mop: a?.mopId ?? null,
      wind: wind ? {id: wind.st.id, name: wind.st.name, type: wind.st.type, owner: wind.st.owner, km: +wind.km.toFixed(1), hours: wind.data.size} : null, n});
    console.log(`${win} ${spot.name}: anchor ${anchor?.x.id ?? '-'} wind ${wind?.st.id ?? '-'} ${n} daylight hours`);
    await sleep(200);
  }
  return {hours, meta, cut};
}

setOnshoreCapEnabled(true);
const archive = await runWindow('archive'), recent = await runWindow('recent');

// ---------- rates ----------
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '–');
const isTiny = (h: Hour) => h.surfObs !== null && h.surfObs < TINY_FT;
const isBlown = (h: Hour) => !!h.windObs && h.windObs.rel === 'onshore' && h.windObs.mph > ONSHORE_BAD_MPH;
const isPoor = (h: Hour) => isTiny(h) || isBlown(h);
const tooBig = (h: Hour, skill: 'Beginner' | 'Intermediate') => h.surfObs !== null && h.surfObs > SKILL_RANGE_FT[skill].max;
type Pick = 'fc' | 'ob' | 'fcPre' | 'obPre';
const fair = (h: Hour, k: Pick, min = FAIR) => { const v = h[k]; return v !== null && v >= min; };
interface Rate {poor: number; fair: number; notBad: number; good: number}
const rate = (hs: Hour[], k: Pick): Rate => ({poor: hs.length, fair: hs.filter((h) => fair(h, k)).length, notBad: hs.filter((h) => fair(h, k, NOT_BAD)).length, good: hs.filter((h) => fair(h, k, GOOD)).length});
const go = (v: Verdict) => v === 'Go' || v === 'Worth a look';

function summary(hs: Hour[], pre = false) {
  const fk: Pick = pre ? 'fcPre' : 'fc', ok: Pick = pre ? 'obPre' : 'ob';
  const both = hs.filter((h) => h.ob !== null);
  const conds = [['surf under 1 ft (observed, buoy carried to the point)', isTiny], [`onshore wind over ${ONSHORE_BAD_MPH} mph (observed, station)`, isBlown], ['either', isPoor]] as const;
  return conds.map(([label, f]) => {
    const p = hs.filter(f), pb = both.filter(f);
    // decomposition on hours with both ratings: rules oversell (observed-fed also fair+) vs inputs wrong (forecast-fed fair+, observed-fed not)
    const rules = pb.filter((h) => fair(h, fk) && fair(h, ok)).length, inputs = pb.filter((h) => fair(h, fk) && !fair(h, ok)).length;
    const callI = p.filter((h) => go(pre ? h.callIPre : h.callI)).length;
    return {label, n: p.length, fc: rate(p, fk), nBoth: pb.length, ob: rate(pb, ok), fcBoth: rate(pb, fk), rules, inputs, callI};
  });
}
/** The complaint itself: of the hours the engine rated fair or better, how many were observed poor. */
function precision(hs: Hour[], k: Pick, min = FAIR) {
  const judged = hs.filter((h) => h.surfObs !== null && h.windObs !== null); const rated = judged.filter((h) => fair(h, k, min));
  return {judged: judged.length, rated: rated.length, poor: rated.filter(isPoor).length, tiny: rated.filter(isTiny).length, blown: rated.filter(isBlown).length};
}
function skillRows(hs: Hour[], pre = false) {
  return (['Beginner', 'Intermediate'] as const).map((sk) => {
    const p = hs.filter((h) => tooBig(h, sk)), call = p.filter((h) => go(sk === 'Beginner' ? (pre ? h.callBPre : h.callB) : (pre ? h.callIPre : h.callI))).length;
    return {skill: sk, max: SKILL_RANGE_FT[sk].max, n: p.length, fair: p.filter((h) => fair(h, pre ? 'fcPre' : 'fc')).length, call, go: p.filter((h) => (sk === 'Beginner' ? (pre ? h.callBPre : h.callB) : (pre ? h.callIPre : h.callI)) === 'Go').length};
  });
}

// ---------- candidate rules (chosen on the first 2/3 of each window, reported on the last 1/3) ----------
// Each candidate is a cap on the forecast-fed score using only what the app has at the hour. It is judged by:
//   removed = poor hours that were fair+ and the cap takes below fair; lost = NOT-poor hours (observed fine) that were fair+ and the cap takes below fair.
// Acceptance rule (our own, set before looking at the held-out third): on the held-out hours of BOTH windows, removed > 2 × lost, at least 10 removed hours,
// and the share of fair+ hours that were observed poor falls by at least 2 percentage points.
interface Cand {id: string; text: string; cap: (h: Hour) => number | null}
const cands: Cand[] = [];
for (const mph of [8, 10, 12, 15]) for (const lim of [39]) cands.push({id: `onshore>${mph}->${lim}`, text: `forecast onshore wind over ${mph} mph caps at ${lim}`, cap: (h) => (h.fcRel === 'onshore' && h.fcMph > mph ? lim : null)});
for (const ft of [1, 1.5, 2]) cands.push({id: `v1<${ft}->39`, text: `v1 surf height under ${ft} ft caps at 39`, cap: (h) => (h.fcV1 !== null && h.fcV1 < ft ? 39 : null)});
for (const ft of [1.5, 2, 3]) cands.push({id: `hs<${ft}->39`, text: `offshore Hs under ${ft} ft caps at 39`, cap: (h) => (h.fcHs !== null && h.fcHs < ft ? 39 : null)});
const judgedOf = (hs: Hour[]) => hs.filter((h) => h.surfObs !== null && h.windObs !== null);
function evalCand(c: Cand, hs: Hour[], k: Pick = 'fcPre') {
  const js = judgedOf(hs); let removed = 0, lost = 0;
  const after = js.map((h) => { const cap = c.cap(h), v = h[k]; return v === null ? null : cap === null ? v : Math.min(v, cap); });
  js.forEach((h, i) => { const was = fair(h, k), now = after[i] !== null && after[i]! >= FAIR; if (was && !now) { if (isPoor(h)) removed++; else lost++; } });
  const rated = js.filter((h, i) => after[i] !== null && after[i]! >= FAIR), share = rated.length ? rated.filter(isPoor).length / rated.length : 0;
  const rated0 = js.filter((h) => fair(h, k)), share0 = rated0.length ? rated0.filter(isPoor).length / rated0.length : 0;
  return {removed, lost, ratedBefore: rated0.length, ratedAfter: rated.length, shareBefore: share0, shareAfter: share, judged: js.length};
}
const fitAll = [...archive.hours.filter((h) => h.fit), ...recent.hours.filter((h) => h.fit)];
const candRows = cands.map((c) => ({c, fit: evalCand(c, fitAll), heldA: evalCand(c, archive.hours.filter((h) => !h.fit)), heldR: evalCand(c, recent.hours.filter((h) => !h.fit))}));
const passes = (e: ReturnType<typeof evalCand>) => e.removed >= 10 && e.removed > 2 * e.lost && e.shareBefore - e.shareAfter >= 0.02;
// choose on the fit hours: the best net (removed − 2 × lost) among candidates that pass on the fit hours, per family (wind, size)
const family = (id: string) => (id.startsWith('onshore') ? 'wind' : 'size');
const chosen = ['wind', 'size'].map((fam) => candRows.filter((r) => family(r.c.id) === fam && passes(r.fit)).sort((p, q) => (q.fit.removed - 2 * q.fit.lost) - (p.fit.removed - 2 * p.fit.lost))[0] ?? null);

// The Call for a beginner (too big for the skill): Skip when the TYPICAL estimate (not only the band's low end) is above the skill's top. Same acceptance rule, with the share = of the
// hours observed above the range, the share the Call let through (Go or Worth a look).
const BEG_MAX = SKILL_RANGE_FT.Beginner.max;
const begSkip = (h: Hour) => h.central !== null && h.central > BEG_MAX;
function evalBeg(hs: Hour[]) {
  const js = hs.filter((h) => h.surfObs !== null && h.callBPre !== 'Dark'); let removed = 0, lost = 0;
  for (const h of js) if (go(h.callBPre) && begSkip(h)) { if (h.surfObs! > BEG_MAX) removed++; else lost++; }
  const big = js.filter((h) => h.surfObs! > BEG_MAX), before = big.filter((h) => go(h.callBPre)).length, after = big.filter((h) => go(h.callBPre) && !begSkip(h)).length;
  return {removed, lost, judged: js.length, ratedBefore: before, ratedAfter: after, shareBefore: big.length ? before / big.length : 0, shareAfter: big.length ? after / big.length : 0};
}
const begRow = {fit: evalBeg(fitAll), heldA: evalBeg(archive.hours.filter((h) => !h.fit)), heldR: evalBeg(recent.hours.filter((h) => !h.fit))};

// ---------- report ----------
const sumTable = (rows: ReturnType<typeof summary>) => rows.map((r) => `| ${r.label} | ${r.n} | ${pct(r.fc.fair, r.n)} (${r.fc.fair}) | ${pct(r.fc.notBad, r.n)} | ${pct(r.fc.good, r.n)} | ${r.nBoth} | ${pct(r.ob.fair, r.nBoth)} (${r.ob.fair}) | ${pct(r.rules, r.nBoth)} (${r.rules}) | ${pct(r.inputs, r.nBoth)} (${r.inputs}) | ${pct(r.callI, r.n)} (${r.callI}) |`).join('\n');
const sumHead = `| observed poor condition | daylight hours | forecast-fed rating fair or better | … NOT BAD or better | … good (SOLID+) | hours with observed inputs too | observed-fed rating fair or better | both fair+ ("the rules oversell") | forecast-fed only ("the inputs were wrong") | the Call (Intermediate) says Go or Worth a look |\n|---|---|---|---|---|---|---|---|---|---|`;
const precRow = (label: string, hs: Hour[], k: Pick) => { const p = precision(hs, k), q = precision(hs, k, NOT_BAD); return `| ${label} | ${p.judged} | ${p.rated} | ${pct(p.poor, p.rated)} (${p.poor}: ${p.tiny} under 1 ft, ${p.blown} onshore over ${ONSHORE_BAD_MPH} mph) | ${q.rated} | ${pct(q.poor, q.rated)} (${q.poor}) |`; };
const baseRow = (hs: Hour[]) => { const j = judgedOf(hs), p = j.filter(isPoor).length; return `| (base rate: every hour, whatever the rating) | ${j.length} | ${j.length} | ${pct(p, j.length)} (${p}) | – | – |`; };
const precHead = `| engine fed | hours with both observations | rated fair or better | of those, observed poor | rated NOT BAD or better | of those, observed poor |\n|---|---|---|---|---|---|`;
const skillTable = (hs: Hour[], pre = false) => skillRows(hs, pre).map((r) => `| ${r.skill} (up to ${r.max} ft) | ${r.n} | ${pct(r.fair, r.n)} (${r.fair}) | ${pct(r.call, r.n)} (${r.call}) | ${pct(r.go, r.n)} (${r.go}) |`).join('\n');
const skillHead = `| skill | daylight hours the observed surf was above the skill's range | rating fair or better (the rating has no skill input) | the Call says Go or Worth a look | the Call says Go |\n|---|---|---|---|---|`;
const metaTable = (m: any[]) => m.filter((x) => x.n > 0).map((x) => `| ${x.name} | ${x.orientation ?? 'unknown'}° | ${x.anchor ? `${x.anchor.id} ${x.anchor.name}, ${x.anchor.km} km` : '–'} | ${x.wind ? `${x.wind.id} (${x.wind.name}; ${x.wind.type}, ${x.wind.owner}), ${x.wind.km} km` : '–'} | ${x.n} |`).join('\n');
const perSpot = (hs: Hour[], m: any[]) => m.filter((x) => x.n > 0).map((x) => {
  const s = hs.filter((h) => h.spot === x.spot), tiny = s.filter(isTiny), blown = s.filter(isBlown), p = precision(s, 'fc');
  return `| ${x.name} | ${s.length} | ${tiny.length} | ${pct(tiny.filter((h) => fair(h, 'fc')).length, tiny.length)} | ${blown.length} | ${pct(blown.filter((h) => fair(h, 'fc')).length, blown.length)} | ${p.rated ? `${pct(p.poor, p.rated)} of ${p.rated}` : '–'} |`;
}).join('\n');
const eCell = (e: ReturnType<typeof evalCand>) => `${e.removed} / ${e.lost} | ${(100 * e.shareBefore).toFixed(1)}% → ${(100 * e.shareAfter).toFixed(1)}%`;
const candTable = candRows.map((r) => `| ${r.c.text} | ${eCell(r.fit)} | ${eCell(r.heldA)} | ${eCell(r.heldR)} | ${passes(r.heldA) && passes(r.heldR) ? '**passes**' : 'no'} |`).join('\n');
const latOf = (id: string) => evidenceSpot(id).latitude;
/** Northern and Central California: north of Point Conception (34.45° N). */
const norcal = (h: Hour) => latOf(h.spot) >= 34.45;
const both = (f: (hs: Hour[]) => string) => `### Archive window (${day(WIN.archive[0])} to ${day(WIN.archive[1])})\n${f(archive.hours)}\n\n### Recent window (${day(WIN.recent[0])} to ${day(WIN.recent[1])})\n${f(recent.hours)}`;

const md = `# Rating audit: does the rating oversell? (2026-11-06)

Generated ${new Date().toISOString().slice(0, 16)}Z by \`docs/forecast/data/rating-audit.ts\`. Reproduce: \`ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/rating-audit.ts --archive ${iso(WIN.archive[0])}/${iso(WIN.archive[1])} --recent ${iso(WIN.recent[0])}/${iso(WIN.recent[1])}\` (the cache is optional; the same public downloads as \`ACCURACY-VS-BUOYS.md\`). Findings and decisions: the notes at the end.

**The question.** Surfline's most common complaint is driving to a "fair" or "good" rating and finding it flat or blown out. How often does OUR rating say fair or better when the observed conditions were poor? Asked two ways, to separate "the rating rules oversell" from "the forecast inputs were wrong".

**What each number is.**
- **Observed surf** = **buoy carried to the point (model-assisted)**: a wave buoy's measured Hs × MOP's own hourly ratio (spot point ÷ buoy site), only from a buoy within ${ANCHOR_KM} km where MOP is right at the buoy (the T-131 rule, judged on each window's first 2/3). Not a measurement at the spot. "Under 1 ft" is in the app's surf-height convention (about the nearshore Hs).
- **Observed wind** = **measured at a coastal station**, not at the break: ${WIND_RULE}. NOAA stations: the reading on the hour (NDBC stdmet via NOAA ERDDAP \`cwwcNDBCMet\`), ids, names and positions from NDBC's \`activestations.xml\`. Airports: the routine hourly METAR within 10 minutes of the hour (IEM ASOS archive, \`docs/forecast/data/shore-wind.ts\`); an airfield reads land wind, often lighter than on the water. No anemometer-height correction (stations stand 4–20 m up; the forecast is 10 m).
- **Forecast-fed rating** = the app's engine (\`rateForecast\`, the provisional rating) on the **Open-Meteo Marine and Open-Meteo Weather hours for the window**: the archived short-range model runs Open-Meteo serves for past dates (historical-forecast API for the archive window, \`past_days\` for the recent one). That is close to a nowcast, NOT the days-ahead forecast a surfer plans with, so these are the best the inputs get. The lead-dependent ceiling is judged ${LEAD_H} h ahead. The rating never reads MOP (it judges the offshore swell; CONTRACTS T-130).
- **Observed-fed rating** = the same engine on the measured inputs: the anchor buoy's Hs, peak period and peak direction as the swell (bulk values: no swell partition, no secondary swell) and the station's wind and gust. Only hours with both.
- **The Call** (\`hourCall\`) uses the surf estimate, which in the app is MOP's forward forecast. That has no public archive, so the audit gives the Call **MOP's nowcast at the spot's point as a stand-in** (an upper bound on what the Call had) and the Open-Meteo hours above. Skill ranges only (no personal preferred range).
- **Poor** = observed surf under ${TINY_FT} ft, or observed onshore wind over ${ONSHORE_BAD_MPH} mph (the Call's own "Skip" line, \`ONSHORE_BAD_MPH\`; onshore = within 45° of the spot's facing, the engine's rule). **Fair or better** = score ${FAIR} and up (the fair and good colour bands: SURFABLE, NOT BAD, SOLID and up). Daylight hours only (the app does not rate dark hours).
- Every threshold here is OUR OWN CHOICE. This is an audit against observations at a distance, not a validated accuracy figure.

## 1. Stations per spot

Spots with an anchor buoy or a wind station in the window. Orientation = the spot's facing the engine uses.

### Archive window
| spot | facing | anchor buoy (observed surf) | wind station | daylight hours |
|---|---|---|---|---|
${metaTable(archive.meta)}

### Recent window
| spot | facing | anchor buoy (observed surf) | wind station | daylight hours |
|---|---|---|---|---|
${metaTable(recent.meta)}

## 2. How often a poor hour was rated fair or better

${both((hs) => `${sumHead}\n${sumTable(summary(hs, true))}`)}

## 3. The complaint: of the hours rated fair or better, how many were observed poor

Hours where both the observed surf and the observed wind exist.

${both((hs) => `${precHead}\n${baseRow(hs)}\n${precRow('forecast inputs', hs, 'fcPre')}\n${precRow('observed inputs', hs.filter((h) => h.obPre !== null), 'obPre')}\n${baseRow(hs.filter(norcal)).replace('every hour,', 'Northern and Central California, every hour,')}\n${precRow('forecast inputs, Northern and Central California only', hs.filter(norcal), 'fcPre')}`)}

## 4. Too big for the skill

The rating has no skill input, so this is the Call's job (Skip when the estimated typical wave is above the skill's range, \`SKILL_RANGE_FT\`). Observed surf (buoy carried to the point) above the range's top.

${both((hs) => `${skillHead}\n${skillTable(hs, true)}`)}

## 5. Per spot (forecast-fed)

${both((hs) => `| spot | daylight hours | observed under 1 ft | … rated fair+ | observed onshore > ${ONSHORE_BAD_MPH} mph | … rated fair+ | of hours rated fair+, observed poor |\n|---|---|---|---|---|---|---|\n${perSpot(hs.map((h) => ({...h, fc: h.fcPre})), hs === archive.hours ? archive.meta : recent.meta)}`)}

## 6. Candidate fixes, chosen on the first 2/3 and reported on the last 1/3

Each candidate caps the forecast-fed score using only what the app has at that hour. "removed / lost" = observed-poor hours the cap takes from fair+ to below fair / observed-fine hours it takes below fair (a cost: those were fine). The share = of hours rated fair+, the share observed poor. Fit = the first 2/3 of both windows pooled; held-out = the last 1/3 of each window. **Rule (our own, fixed before the held-out numbers were read):** on the held-out hours of BOTH windows, at least 10 removed, removed more than twice lost, and the share down by at least 2 points. The chosen candidate per family is the best net (removed − 2 × lost) among those passing on the fit hours.

| candidate | fit: removed / lost | fit: share before → after | archive held-out: removed / lost | share | recent held-out: removed / lost | share | passes on both held-out sets |
|---|---|---|---|---|---|---|---|
${candTable}

**The Call for a beginner** (too big for the skill): Skip when the typical estimate is above ${BEG_MAX} ft. removed / lost = hours the change turns to Skip that were observed above / within the range; share = of the hours observed above ${BEG_MAX} ft, the share the Call let through (Go or Worth a look).

| candidate | fit: removed / lost | fit: share before → after | archive held-out: removed / lost | share | recent held-out: removed / lost | share | passes on both held-out sets |
|---|---|---|---|---|---|---|---|
| beginner Call: Skip when the typical estimate is above ${BEG_MAX} ft | ${eCell(begRow.fit)} | ${eCell(begRow.heldA)} | ${eCell(begRow.heldR)} | ${passes(begRow.heldA) && passes(begRow.heldR) ? '**passes**' : 'no'} |

Chosen on the fit hours: ${chosen.map((r, i) => `${['wind', 'size'][i]}: ${r ? `**${r.c.text}** (held-out ${passes(r.heldA) && passes(r.heldR) ? 'passes' : 'does NOT pass'})` : 'none passes on the fit hours'}`).join('; ')}.

`;
const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '', notes = prev.includes('<!-- notes -->') ? '\n' + prev.slice(prev.indexOf('<!-- notes -->')) : '';
fs.writeFileSync(OUT, md + notes);
const slimW = (x: typeof archive, w: [number, number]) => ({start: iso(w[0]), end: iso(w[1]), cut: iso(x.cut), stations: x.meta, poorRatedFair: summary(x.hours), precisionForecastFed: precision(x.hours, 'fc'), precisionObservedFed: precision(x.hours.filter((h) => h.ob !== null), 'ob'), precisionNorCal: precision(x.hours.filter(norcal), 'fc'), tooBig: skillRows(x.hours)});
fs.writeFileSync(JSON_OUT, JSON.stringify({generatedAt: new Date().toISOString(), note: 'Generated by docs/forecast/data/rating-audit.ts. Observed surf = buoy carried to the point by MOP (model-assisted); observed wind = coastal station. Our thresholds.',
  archive: slimW(archive, WIN.archive), recent: slimW(recent, WIN.recent), candidates: candRows.map((r) => ({id: r.c.id, text: r.c.text, fit: r.fit, heldOutArchive: r.heldA, heldOutRecent: r.heldR, passes: passes(r.heldA) && passes(r.heldR)})), chosen: chosen.map((r) => r?.c.id ?? null), beginnerCall: {...begRow, passes: passes(begRow.heldA) && passes(begRow.heldR)}}, null, 1) + '\n');
console.log(`wrote ${OUT} and ${JSON_OUT}`);
for (const r of candRows) console.log(r.c.id, 'fit', r.fit.removed, r.fit.lost, (r.fit.shareBefore * 100).toFixed(1), (r.fit.shareAfter * 100).toFixed(1), '| A', r.heldA.removed, r.heldA.lost, '| R', r.heldR.removed, r.heldR.lost);

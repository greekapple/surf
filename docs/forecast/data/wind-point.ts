// Wind point study (2026-11-08): which Open-Meteo grid cell best represents the wind at the shore?
//
// The app asks Open-Meteo for 10 m wind at each spot's beach coordinate with the API's default cell selection ("land": the
// nearest land cell of similar elevation). Over a 3 km HRRR grid a coastal land cell can carry land wind (lighter, more
// variable, turned by terrain) when surfers feel the wind coming off the water. This compares, at every open-coast NDBC/NOS
// met station on the Northern and Central California coast, the archived model hours at that station's own position with
// cell_selection = land (today's behaviour), sea and nearest, plus ECMWF IFS 0.25° as an outside reference, against what the
// station measured.
//
// OBSERVED  = NDBC stdmet via NOAA ERDDAP cwwcNDBCMet, the reading on the hour (the same feed and parser rule as rating-audit.ts).
//             Stations stand 4–20 m up; no height correction. A station is not a surf break: this asks which CELL rule tracks
//             shoreline wind, not how right the wind is at any one break.
// FORECAST  = Open-Meteo historical-forecast API (the archived first hours of each run: close to a nowcast, NOT days ahead).
// Stations  = every NDBC "met" station of type fixed between 34.4° and 42.1° N that is NOT in enclosed water by the repo's mask
//             (src/map/enclosed.ts) and reports wind on 300+ hours of the window. Chosen by rule, not by hand.
// Metrics   = speed bias and mean absolute error (mph), median direction error (°, hours with observed wind ≥ 5 mph), and the
//             share of those hours where the direction is off by more than 90° — far enough to turn offshore into onshore at
//             ANY beach facing (facing-free, so no station facing has to be assumed).
//
// Run: ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/wind-point.ts [startDate endDate]
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {isEnclosedWater} from '../../../src/map/enclosed.ts';
import {evidenceSpots} from '../../../src/ocean/spots.ts';

const HOUR = 3600000, MPS_TO_MPH = 2.236936, CALM_MPH = 5, MIN_HOURS = 300;
const [START, END] = [process.argv[2] ?? '2026-08-01', process.argv[3] ?? '2026-11-06'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CACHE = process.env.ACC_CACHE ?? null, cacheFile = (u: string) => `${CACHE}/${createHash('sha1').update(u).digest('hex')}.txt`;
async function get(u: string, tries = 3): Promise<string | null> {
  if (CACHE && fs.existsSync(cacheFile(u))) return fs.readFileSync(cacheFile(u), 'utf8');
  for (let i = 0; i < tries; i++) { try { const r = await fetch(u, {signal: AbortSignal.timeout(180000)}); if (r.ok) { const t = await r.text(); if (CACHE) { fs.mkdirSync(CACHE, {recursive: true}); fs.writeFileSync(cacheFile(u), t); } return t; } if (r.status === 404 || r.status === 400) return null; } catch { /* retry */ } await sleep(3000 * (i + 1)); }
  return null;
}

interface Station {id: string; name: string; type: string; lat: number; lon: number}
const xml = await get('https://www.ndbc.noaa.gov/activestations.xml'); if (!xml) throw new Error('activestations.xml unavailable');
const stations: Station[] = [...xml.matchAll(/<station ([^>]*)\/?>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]])) as any)
  .filter((s: any) => s.met === 'y' && s.type === 'fixed').map((s: any) => ({id: String(s.id).toUpperCase(), name: s.name, type: s.type, lat: +s.lat, lon: +s.lon}))
  .filter((s) => s.lat > 34.4 && s.lat < 42.1 && s.lon > -125 && s.lon < -119.5 && !isEnclosedWater(s.lat, s.lon));

interface Obs {mph: number; dir: number}
async function observed(id: string): Promise<Map<number, Obs>> {
  const u = `https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet.csv?station,time,WD,WSPD&station=%22${id}%22&time%3E=${START}T00:00:00Z&time%3C=${END}T23:00:00Z`;
  const t = await get(u), out = new Map<number, Obs>(); if (!t) return out;
  for (const l of t.trim().split(/\r?\n/).slice(2)) {
    const [, ts, wd, ws] = l.split(','), ms = Date.parse(ts);
    if (!Number.isFinite(ms) || ms % HOUR !== 0 || wd === 'NaN' || ws === 'NaN' || wd === '' || ws === '') continue;
    const dir = Number(wd), spd = Number(ws); if (!(dir >= 0 && dir <= 360 && spd >= 0 && spd <= 60)) continue;
    out.set(ms, {mph: spd * MPS_TO_MPH, dir});
  }
  return out;
}

interface Variant {key: string; label: string; params: Record<string, string>}
const VARIANTS: Variant[] = [
  {key: 'land', label: 'best match, cell land (today)', params: {}},
  {key: 'sea', label: 'best match, cell sea', params: {cell_selection: 'sea'}},
  {key: 'nearest', label: 'best match, cell nearest', params: {cell_selection: 'nearest'}},
  {key: 'ecmwf', label: 'ECMWF IFS 0.25°, cell land', params: {models: 'ecmwf_ifs025'}},
];
interface Model {cellLat: number; cellLon: number; elev: number; hours: Map<number, Obs>}
async function model(lat: number, lon: number, v: Variant): Promise<Model | null> {
  const q = new URLSearchParams({latitude: String(lat), longitude: String(lon), hourly: 'wind_speed_10m,wind_direction_10m', wind_speed_unit: 'mph', timezone: 'GMT', timeformat: 'unixtime', start_date: START, end_date: END, ...v.params});
  const t = await get(`https://historical-forecast-api.open-meteo.com/v1/forecast?${q}`); if (!t) return null;
  const j = JSON.parse(t), hours = new Map<number, Obs>();
  j.hourly.time.forEach((s: number, i: number) => { const m = j.hourly.wind_speed_10m[i], d = j.hourly.wind_direction_10m[i]; if (m != null && d != null) hours.set(s * 1000, {mph: m, dir: d}); });
  return {cellLat: j.latitude, cellLon: j.longitude, elev: j.elevation, hours};
}

const km = (a: number, b: number, c: number, d: number) => { const r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r; return 6371 * Math.hypot(x, y); };
const angDiff = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const r1 = (x: number) => Math.round(x * 10) / 10;

interface Score {n: number; bias: number; mae: number; nDir: number; dirMed: number; flip: number}
function score(obs: Map<number, Obs>, m: Map<number, Obs>, keys: number[]): Score {
  let n = 0, b = 0, a = 0; const de: number[] = []; let flip = 0;
  for (const t of keys) { const o = obs.get(t)!, f = m.get(t)!; n++; b += f.mph - o.mph; a += Math.abs(f.mph - o.mph); if (o.mph >= CALM_MPH) { const e = angDiff(o.dir, f.dir); de.push(e); if (e > 90) flip++; } }
  return {n, bias: r1(b / n), mae: r1(a / n), nDir: de.length, dirMed: Math.round(median(de)), flip: Math.round((100 * flip) / Math.max(1, de.length))};
}

const rows: any[] = [];
for (const s of stations) {
  const obs = await observed(s.id); if (obs.size < MIN_HOURS) { rows.push({id: s.id, name: s.name, skipped: `${obs.size} observed hours (< ${MIN_HOURS})`}); continue; }
  const ms: Record<string, Model | null> = {};
  for (const v of VARIANTS) { ms[v.key] = await model(s.lat, s.lon, v); await sleep(300); }
  if (VARIANTS.some((v) => !ms[v.key])) { rows.push({id: s.id, name: s.name, skipped: 'model hours unavailable'}); continue; }
  // The same hours for every variant, so the comparison is like for like.
  const keys = [...obs.keys()].filter((t) => VARIANTS.every((v) => ms[v.key]!.hours.has(t)));
  const out: any = {id: s.id, name: s.name, lat: s.lat, lon: s.lon, hours: keys.length, obsMeanMph: r1(keys.reduce((x, t) => x + obs.get(t)!.mph, 0) / keys.length), variants: {}};
  for (const v of VARIANTS) { const m = ms[v.key]!; out.variants[v.key] = {cell: [m.cellLat, m.cellLon], cellKm: r1(km(s.lat, s.lon, m.cellLat, m.cellLon)), elevM: m.elev, ...score(obs, m.hours, keys)}; }
  rows.push(out);
}

// The spots themselves: which cell each rule picks for the app's wind query point (no observations; geometry only).
const spotCells: any[] = [];
for (const sp of evidenceSpots) {
  const c: any = {id: sp.id, name: sp.name, query: [sp.latitude, sp.longitude]};
  for (const v of VARIANTS.slice(0, 3)) { const m = await model(sp.latitude, sp.longitude, {...v, params: {...v.params}}); if (m) c[v.key] = {cell: [m.cellLat, m.cellLon], km: r1(km(sp.latitude, sp.longitude, m.cellLat, m.cellLon)), elevM: m.elev}; await sleep(300); }
  spotCells.push(c);
}

const res = {generated: new Date().toISOString(), window: [START, END], calmMph: CALM_MPH, variants: VARIANTS.map(({key, label}) => ({key, label})), stations: rows, spotCells};
fs.writeFileSync(new URL(`./wind-point-${START}.json`, import.meta.url), JSON.stringify(res, null, 1));
for (const r of rows) {
  if (r.skipped) { console.log(`${r.id} ${r.name}: skipped, ${r.skipped}`); continue; }
  console.log(`\n${r.id} ${r.name} (${r.hours} h, observed mean ${r.obsMeanMph} mph)`);
  for (const v of VARIANTS) { const x = r.variants[v.key]; console.log(`  ${v.key.padEnd(8)} cell ${x.cellKm} km elev ${x.elevM} m | bias ${x.bias} MAE ${x.mae} mph | dir median ${x.dirMed}° | >90° off ${x.flip}% of ${x.nDir}`); }
}
console.log('\nSpot cells:'); for (const c of spotCells) console.log(c.name, JSON.stringify({land: c.land, sea: c.sea, nearest: c.nearest}));

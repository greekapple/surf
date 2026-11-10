// Measures the daily SCORE of "how right we've been" on 31 synthetic days of full captures (492 spots, real engine): CPU time and peak parsed-capture heap, streamed (what the Worker does) vs all captures held at once (what it did before).
//   node --expose-gc scripts/how-right-all-measure.mjs
import {evidenceSpots} from '../src/ocean/spots.ts';
import {captureSpot, captureBuoy} from '../src/services/howRightAll.ts';
import {createHowRightAll, spotPicks, HRA_KEYS} from '../services/how-right-all.mjs';

const HOUR = 3600000, DAY = 86400000, T0 = Date.UTC(2026, 10, 20, 0, 20), DAYS = 31;
const MU = {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'}, WU = {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'};
const hs = (t) => 1.5 + 0.5 * Math.sin(t / 21600000);
const pay = (kind, from) => { const time = Array.from({length: 72}, (_, i) => from / 1000 + i * 3600), u = kind === 'm' ? MU : WU; return {latitude: 1, longitude: 1, hourly_units: u, hourly: {time, ...Object.fromEntries(Object.keys(u).map((k) => [k, time.map((t, i) => (kind === 'm' ? {wave_height: hs(t * 1000), swell_wave_height: 1.2, swell_wave_direction: 290, swell_wave_period: 12, secondary_swell_wave_height: 0.3, secondary_swell_wave_direction: 200, secondary_swell_wave_period: 8, sea_surface_temperature: 15}[k] : {wind_speed_10m: 4 + (i % 9), wind_direction_10m: 90, wind_gusts_10m: 8}[k]))]))}}; };
const picks = spotPicks(), buoys = new Map(picks.filter((p) => p.choice.ok).map((p) => [p.choice.pick.buoy.id, p.choice.pick.buoy]));
const store = new Map(); const tBuild = performance.now();
for (let d = 0; d < DAYS; d++) {
  const now = T0 - (DAYS - 1 - d) * DAY, from = Math.ceil(now / HOUR) * HOUR, cap = {schema: 2, date: new Date(now).toISOString().slice(0, 10), capturedAt: new Date(now).toISOString(), spots: {}, buoys: {}};
  const m = pay('m', from), w = pay('w', from);
  for (const s of evidenceSpots) cap.spots[s.id] = captureSpot(s.id, m, w, new Date(now - 1800000).toISOString(), new Date(now - 1800000).toISOString(), 'cache', now);
  for (const [id, b] of buoys) cap.buoys[id] = captureBuoy(b.lat, b.lon, m, new Date(now - 1800000).toISOString(), now);
  store.set(HRA_KEYS.shown(cap.date), JSON.stringify(cap));
}
console.log(`built ${DAYS} synthetic days in ${((performance.now() - tBuild) / 1000).toFixed(0)} s; ${(store.get(HRA_KEYS.shown(new Date(T0).toISOString().slice(0, 10))).length / 1048576).toFixed(2)} MB each`);
const spec = (id) => { const rows = []; for (let t = Math.floor(T0 / HOUR) * HOUR; t > T0 - 45 * DAY; t -= HOUR) { const d = new Date(t); rows.push(`${d.getUTCFullYear()} ${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')} 00  ${(hs(t) + 0.3).toFixed(2)}  1.40 14.0  0.5  5.0 WNW   S    SWELL  7.0 300`); } return '#YY  MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD\n#yr  mo dy hr mn    m    m  sec    m  sec  -  degT     -      sec degT\n' + rows.join('\n') + '\n'; };
const specs = new Map([...buoys.keys()].map((id) => [id, spec(id)]));
const bucket = {get: async (k) => (store.has(k) ? {json: async () => JSON.parse(store.get(k))} : null), put: async (k, v) => { store.set(k, v); }};
let peak = 0, base = 0; const sample = () => { global.gc(); peak = Math.max(peak, process.memoryUsage().heapUsed - base); };
const fetcher = async (u) => { const m = /realtime2\/(\w+)\.spec$/.exec(String(u)); return m && specs.has(m[1]) ? new Response(specs.get(m[1])) : new Response('', {status: 404}); };
const job = createHowRightAll({fetcher, now: () => T0 + 2 * HOUR, sleep: async () => {}, readLatest: async () => null, hotIds: async () => new Set(), onCapture: sample});
const stages = []; let rep;
do { global.gc(); base = process.memoryUsage().heapUsed; const c0 = process.cpuUsage(), t0 = performance.now(); rep = await job.score({BUCKET: bucket}); const c = process.cpuUsage(c0); stages.push({cpu: (c.user + c.system) / 1e6, wall: (performance.now() - t0) / 1000, step: rep.step, used: rep.used}); } while (rep.step === 'score-stage');
console.log(JSON.stringify(rep));
const tot = stages.reduce((a, x) => a + x.cpu, 0);
console.log(`STAGED score (70 spots a stage, one capture parsed at a time): ${stages.length} stages, CPU per stage ${stages.map((x) => x.cpu.toFixed(1)).join(' / ')} s (max ${Math.max(...stages.map((x) => x.cpu)).toFixed(1)} s, total ${tot.toFixed(1)} s; the cron limit is 30 s), subrequests per stage ${stages.map((x) => x.used).join(' / ')}; peak heap above baseline after each capture ${(peak / 1048576).toFixed(0)} MB`);
global.gc(); const h0 = process.memoryUsage().heapUsed; const all = [...store].filter(([k]) => k.includes('/shown/')).map(([, v]) => JSON.parse(v)); global.gc();
console.log(`ALL ${all.length} captures held at once (the previous code): heap +${((process.memoryUsage().heapUsed - h0) / 1048576).toFixed(0)} MB`);

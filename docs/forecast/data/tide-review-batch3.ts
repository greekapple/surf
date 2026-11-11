// Batch 3 tide-station review: for each CO-OPS prediction station that is one of the three nearest (within 40 km) to a new spot of the batch and has no review yet, the 7-day NOAA predicted high/low
// timing against the nearest station already reviewed OPEN (the tide progresses along the coast, so a neighbour on the exposed coast is the yardstick; see tide-timing.ts for the metric).
//   node --experimental-strip-types --no-warnings docs/forecast/data/tide-review-batch3.ts [--from 2026-11-10] > /tmp/tide-review-b3.json
// Output: one JSON line per candidate station {id, name, lat, lon, spots:[...], ref, refKm, meanMin, sdMin, n, rangeRatio, refs2:[...]} plus a printed table. Read-only: it changes nothing; the decisions go in src/ocean/tideStations.ts (EAST3_REVIEWED).
import fs from 'node:fs';
import {COAST_ROWS, UPGRADED_ROWS} from '../../../src/data/coast.ts';
import {tideStationExposure} from '../../../src/ocean/tideStations.ts';
import {hilo, compare} from './tide-timing.ts';
const dir = new URL('./world-spots/', import.meta.url).pathname, batch = new Set(['east', 'gulf', 'pr'].flatMap((t) => JSON.parse(fs.readFileSync(dir + `us-east-gulf-pr-batch3-${t}-ids.json`, 'utf8'))));
const rows = [...UPGRADED_ROWS, ...COAST_ROWS].filter((r: any) => batch.has(r[0])).map((r: any) => ({id: r[0], name: r[1], lat: r[4], lon: r[5]}));
const km = (aLat: number, aLon: number, bLat: number, bLon: number) => { const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const list: {id: string; name: string; lat: number; lon: number}[] = ((await (await fetch('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions', {signal: AbortSignal.timeout(60000)})).json()).stations ?? []).filter((x: any) => Number.isFinite(x.lat) && Number.isFinite(x.lng)).map((x: any) => ({id: x.id, name: x.name, lat: x.lat, lon: x.lng}));
const cand = new Map<string, {st: any; spots: {name: string; km: number}[]}>();
for (const s of rows) for (const st of list.map((x) => ({x, d: km(s.lat, s.lon, x.lat, x.lon)})).filter((c) => c.d <= 40).sort((a, b) => a.d - b.d).slice(0, 3)) {
  if (tideStationExposure(st.x.name, st.x.id).why.startsWith('reviewed')) continue;   // already reviewed (open, closed or closed-if-alternative)
  const c = cand.get(st.x.id) ?? cand.set(st.x.id, {st: st.x, spots: []}).get(st.x.id)!; c.spots.push({name: s.name, km: Math.round(st.d * 10) / 10});
}
/** An open-coast gauge by its own name (the station home page says pier on the ocean, "(ocean)", a coastal light, an ocean-side point): usable as a yardstick for its neighbours once its timing agrees with the reviewed-open ones. */
const OPEN_NAME = /\bpier\b|\(ocean\)|\(coastal\)|\blight\b|\bbeach pier|\bocean pier|Cape Lookout|Gay Head|Great Point|Wasque|Watch Hill Point|Ponquoque|Eel Point|Mobile Point|Chandeleur|Bob Hall/i;
const CLOSED_NAME = /\b(river|creek|canal|bridge|icw+|icww|sound|lake|lagoon|bay|thorofare|channel|marina|basin|cove|narrows|yacht|inside|harbor|harbour|airport|causeway|slough|bayou|park)\b/i;
const nameOpen = [...cand.values()].map((c) => c.st).filter((x) => OPEN_NAME.test(x.name) && !/inside|bridge|\bbay\b|river/i.test(x.name));
const open = [...list.filter((x) => tideStationExposure(x.name, x.id).exposure === 'open' && tideStationExposure(x.name, x.id).why.startsWith('reviewed')), ...nameOpen];
const cache = new Map<string, any>();
/** Predicted high/low of one station, retried with a growing pause when NOAA answers with an error or nothing (it throttles a long run); an empty result after 4 tries is kept as empty and printed as extrema 0. */
const get = async (id: string) => { if (!cache.has(id)) { let e: any[] = []; for (let k = 0; k < 4 && !e.length; k++) { e = await hilo(id).catch(() => []); await sleep(400 * (k + 1)); } cache.set(id, e); } return cache.get(id); };
console.error(`${rows.length} spots, ${cand.size} candidate stations, ${open.length} reviewed-open yardsticks`);
for (const {st, spots} of [...cand.values()].sort((a, b) => a.st.lat - b.st.lat)) {
  const refs = open.map((o) => ({o, d: km(st.lat, st.lon, o.lat, o.lon)})).filter((c) => c.d <= 150 && c.o.id !== st.id).sort((a, b) => a.d - b.d).slice(0, 2), r: any[] = [];
  const me = await get(st.id);
  for (const ref of refs) { const c = compare(await get(ref.o.id), me); r.push({ref: ref.o.id, refName: ref.o.name, refKm: Math.round(ref.d), ...c}); }
  console.log(JSON.stringify({id: st.id, name: st.name, lat: st.lat, lon: st.lon, nSpots: spots.length, spots: spots.slice(0, 4), extrema: me.length, refs: r}));
}

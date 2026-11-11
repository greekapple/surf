#!/usr/bin/env node
// swan-hawaii (docs/specs/DRAFT-nearshore-wiring.md, Phase 1 step 1): proposes ONE PacIOOS SWAN cell for each Hawaii spot. Keyless, at most 1 request per second, cached so a rerun asks for nothing it already has.
//   node scripts/nearshore-scan.mjs > src/ocean/swanPointsSourced.ts      (progress on stderr)
// Rule (the spec's): the cell must be (a) seaward of the pin: its bearing from the pin within 60 degrees of the spot's seaward bearing (the `seaward` column of src/data/coast.ts), (b) 8 to 20 m deep on the UH/PacIOOS 50 m
// bathymetry (hmrg_bathytopo_50m_mhi, value at the node nearest the cell centre), (c) the nearest such cell within 1.5 km of the pin. A spot with no such cell gets NO point and the reason; never a shallower or land-adjacent cell.
// Every row is "unreviewed". Evidence only: nothing is shown to a user from this file until the flag in src/ocean/swanFlag.ts is turned on after the data-honesty review.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const BASE = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/', UA = 'SWELLO surf forecast prototype', CACHE = path.join(os.homedir(), 'Development', 'swello-data', 'swan', 'scan-cache.json');   // the cache is about 15 MB of ERDDAP answers: kept OUTSIDE the repo
const GRIDS = {swan_oahu: {lat: [21.20, 21.75], lon: [-158.35, -157.60]}, swan_maui: {lat: [20.40, 21.30], lon: [-157.40, -155.90]}, swan_bigi: {lat: [18.85, 20.35], lon: [-156.20, -154.70]}, swan_kauai: {lat: [21.70, 22.35], lon: [-160.35, -159.20]}};
const ISLAND = (region) => (/^Oahu/.test(region) ? 'swan_oahu' : /^(Maui|Molokai|Lanai)$/.test(region) ? 'swan_maui' : region === 'Big Island' ? 'swan_bigi' : /^(Kauai|Niihau)$/.test(region) ? 'swan_kauai' : null);
const rows = [...fs.readFileSync(new URL('../src/data/coast.ts', import.meta.url), 'utf8').matchAll(/^  \['((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', (?:'[^']*'|null), ([-\d.]+), ([-\d.]+), ([-\d.]+), 'Pacific\/Honolulu'/gm)].map((m) => ({id: m[1], name: m[2].replace(/\\'/g, "'"), region: m[3], lat: +m[4], lon: +m[5], seaward: +m[6]}));
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {retrievedOn: new Date().toISOString().slice(0, 10), requests: {}};
let last = 0; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  if (cache.requests[url]) return cache.requests[url];
  const wait = 1100 - (Date.now() - last); if (wait > 0) await sleep(wait); last = Date.now();
  for (let a = 0; a < 3; a++) { try { const r = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(60000)}); if (r.ok) { const j = (await r.json()).table; cache.requests[url] = {columnNames: j.columnNames, rows: j.rows}; return cache.requests[url]; } if (r.status === 404) break; } catch { /* retry */ } await sleep(2000); }
  cache.requests[url] = {error: 'no data'}; return cache.requests[url];
}
const rad = Math.PI / 180, kmBetween = (aLat, aLon, bLat, bLon) => { const dLa = (bLat - aLat) * rad, dLo = (bLon - aLon) * rad, h = Math.sin(dLa / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLo / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const bearing = (aLat, aLon, bLat, bLon) => { const y = Math.sin((bLon - aLon) * rad) * Math.cos(bLat * rad), x = Math.cos(aLat * rad) * Math.sin(bLat * rad) - Math.sin(aLat * rad) * Math.cos(bLat * rad) * Math.cos((bLon - aLon) * rad); return (Math.atan2(y, x) / rad + 360) % 360; };
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const R4 = (n) => Math.round(n * 1e4) / 1e4;
const out = [], none = [];
for (const s of rows) {
  const g = ISLAND(s.region), grid = g && GRIDS[g];
  if (!grid || s.lat < grid.lat[0] || s.lat > grid.lat[1] || s.lon < grid.lon[0] || s.lon > grid.lon[1]) { none.push({spotId: s.id, reason: 'outside the PacIOOS SWAN grids'}); continue; }
  const dLat = 1.5 / 111.2, dLon = 1.5 / (111.2 * Math.cos(s.lat * rad)), la0 = R4(s.lat - dLat), la1 = R4(s.lat + dLat), lo0 = R4(s.lon - dLon), lo1 = R4(s.lon + dLon);
  const swan = await get(`${BASE}${g}_lon180.json?shgt%5B(last)%5D%5B(0)%5D%5B(${la0}):1:(${la1})%5D%5B(${lo0}):1:(${lo1})%5D`);
  const bathy = await get(`${BASE}hmrg_bathytopo_50m_mhi.json?z%5B(${la0}):1:(${la1})%5D%5B(${lo0}):1:(${lo1})%5D`);
  if (swan.error || bathy.error) { none.push({spotId: s.id, reason: 'the model or bathymetry request returned no data'}); continue; }
  const nodes = bathy.rows.filter((r) => Number.isFinite(r[2])), depthAt = (lat, lon) => { let best = null, bd = Infinity; for (const n of nodes) { const d = (n[0] - lat) ** 2 + ((n[1] - lon) * Math.cos(lat * rad)) ** 2; if (d < bd) { bd = d; best = n; } } return best && Math.sqrt(bd) / rad * 111.2 < 0.06 ? -best[2] : null; };
  const wet = swan.rows.filter((r) => Number.isFinite(r[4])).map((r) => ({lat: r[2], lon: r[3], hsM: r[4], d: kmBetween(s.lat, s.lon, r[2], r[3]), b: bearing(s.lat, s.lon, r[2], r[3])})).filter((c) => c.d <= 1.5);
  const cells = wet.map((c) => ({...c, depth: depthAt(c.lat, c.lon), seaward: angDiff(c.b, s.seaward) <= 60 }));
  const ok = cells.filter((c) => c.seaward && c.depth !== null && c.depth >= 8 && c.depth <= 20).sort((a, b) => a.d - b.d);
  if (!ok.length) { const sea = cells.filter((c) => c.seaward), dep = sea.map((c) => c.depth).filter((d) => d !== null); none.push({spotId: s.id, reason: `no SWAN cell within 1.5 km is seaward of the pin AND 8 to 20 m deep on the 50 m bathymetry: the pin has ${wet.length} wet cells within 1.5 km, ${sea.length} of them on the seaward side${dep.length ? `, and those are ${Math.round(Math.min(...dep))} to ${Math.round(Math.max(...dep))} m deep (too ${Math.max(...dep) < 8 ? 'shallow' : Math.min(...dep) > 20 ? 'deep' : 'shallow or too deep'})` : ' (none has a bathymetry value)'}`}); continue; }
  const c = ok[0]; out.push({spotId: s.id, dataset: g, lat: c.lat, lon: c.lon, depthM: Math.round(c.depth * 10) / 10, distanceKm: Math.round(c.d * 100) / 100, bearingDeg: Math.round(c.b), shoreNormalDeg: s.seaward, candidates: ok.length});
  process.stderr.write(`${s.id} ${c.d.toFixed(2)} km ${c.depth.toFixed(1)} m\n`);
}
fs.mkdirSync(path.dirname(CACHE), {recursive: true}); fs.writeFileSync(CACHE, JSON.stringify(cache));
console.log(`// GENERATED by scripts/nearshore-scan.mjs from PacIOOS SWAN (ERDDAP ${BASE}) and the UH/PacIOOS 50 m bathymetry. Do not edit. Cache: ~/Development/swello-data/swan/scan-cache.json, outside the repo (read ${cache.retrievedOn}).
// One SWAN cell per Hawaii spot, chosen by the rule in the script header. EVERY ROW IS UNREVIEWED: no person has looked at it. Evidence only; nothing in the app reads it unless the flag in swanFlag.ts is on.
export interface SwanPoint {spotId: string; /** the ERDDAP dataset: swan_oahu, swan_maui, swan_bigi or swan_kauai (read through its _lon180 twin) */ dataset: string; lat: number; lon: number; /** depth at the cell centre from the 50 m UH/PacIOOS bathymetry (the model cell averages about 500 m) */ depthM: number; distanceKm: number; bearingDeg: number; /** the spot's seaward bearing */ shoreNormalDeg: number; status: 'sourced'; review: 'unreviewed'; provenance: string}
export const SWAN_PROVENANCE = 'chosen by the depth-and-facing rule from PacIOOS SWAN cells (seaward of the pin, 8 to 20 m deep on the 50 m bathymetry, nearest); not reviewed';
export const SWAN_POINTS: readonly SwanPoint[] = ${JSON.stringify(out.map((p) => ({spotId: p.spotId, dataset: p.dataset, lat: p.lat, lon: p.lon, depthM: p.depthM, distanceKm: p.distanceKm, bearingDeg: p.bearingDeg, shoreNormalDeg: p.shoreNormalDeg, status: 'sourced', review: 'unreviewed', provenance: '@PROV@'})), null, 1).replace(/"([a-zA-Z]+)":/g, '$1:').replace(/'/g, "\\'").replace(/"/g, "'").replace("'@PROV@'", 'SWAN_PROVENANCE').replaceAll("'@PROV@'", 'SWAN_PROVENANCE')};
/** Spots with no proposed cell, and why (never a silent fallback to a shallower or land-adjacent cell). */
export const SWAN_NO_POINT: readonly {spotId: string; reason: string}[] = ${JSON.stringify(none, null, 1).replace(/"([a-zA-Z]+)":/g, '$1:').replace(/'/g, "\\'").replace(/"/g, "'")};`);

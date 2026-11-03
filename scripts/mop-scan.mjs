#!/usr/bin/env node
// T-073: finds the CDIP MOP points nearest each spot along the whole California coast (every county prefix in the MOP_alongshore catalogue).
// Reads only each point's own metadata (position, depth, shore normal) from public CDIP THREDDS. It never assigns a point: src/ocean/mop.ts applies the facing-match rule.
// Usage: node scripts/mop-scan.mjs spots.json [--out docs/forecast/data/mop-candidates-all.json]
//   spots.json: [{id, name, lat, lon}]
import fs from 'node:fs';
const BASE = 'https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/';
const CATALOG = 'https://thredds.cdip.ucsd.edu/thredds/catalog/cdip/model/MOP_alongshore/catalog.xml';
const args = process.argv.slice(2), outIdx = args.indexOf('--out'), out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : null;
const spots = JSON.parse(fs.readFileSync(args[0], 'utf8'));
const km = (aLat, aLon, bLat, bLon) => { const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const cache = new Map();
async function meta(id) {
  if (cache.has(id)) return cache.get(id);
  let row = null;
  for (let a = 0; a < 3 && !row; a++) {
    try {
      const res = await fetch(`${BASE}${id}_forecast.nc.ascii?metaLatitude,metaLongitude,metaWaterDepth,metaShoreNormal`, {signal: AbortSignal.timeout(30000)});
      if (!res.ok) break;
      const t = await res.text(), g = (k) => Number((t.match(new RegExp(`${k}, (-?[\\d.]+)`)) ?? [])[1]);
      const r = {id, lat: g('metaLatitude'), lon: g('metaLongitude'), depthM: g('metaWaterDepth'), shoreNormalDeg: g('metaShoreNormal')};
      row = Object.values(r).slice(1).every(Number.isFinite) ? r : null;
    } catch { /* retry */ }
  }
  cache.set(id, row); return row;
}
const pool = async (ids, n = 8) => { const res = []; let i = 0; await Promise.all(Array.from({length: n}, async () => { while (i < ids.length) { const id = ids[i++]; const m = await meta(id); if (m) res.push(m); } })); return res; };
const cat = await (await fetch(CATALOG)).text();
const ids = [...new Set([...cat.matchAll(/name="([A-Z]+\d+)_forecast\.nc"/g)].map((m) => m[1]))];
const byPre = {}; for (const id of ids) { const [, p, n] = id.match(/^([A-Z]+)(\d+)$/); (byPre[p] ??= []).push({id, n: Number(n)}); }
for (const p in byPre) byPre[p].sort((a, b) => a.n - b.n);
const STEP = 20;
const coarse = await pool(Object.values(byPre).flatMap((l) => l.filter((_, i) => i % STEP === 0 || i === l.length - 1).map((x) => x.id)));
console.error(`coarse: ${coarse.length} points`);
const result = {retrievedOn: new Date().toISOString().slice(0, 10), source: BASE, catalog: CATALOG, note: 'Nearest CDIP MOP points to each spot query coordinate (a map position, not a surveyed takeoff). Evidence only; src/ocean/mop.ts assigns by the facing-match rule.', spots: []};
for (const s of spots) {
  const near = coarse.map((p) => ({...p, d: km(s.lat, s.lon, p.lat, p.lon)})).sort((a, b) => a.d - b.d).slice(0, 2);
  const want = near.flatMap((p) => { const [, pre, n] = p.id.match(/^([A-Z]+)(\d+)$/), l = byPre[pre], i = l.findIndex((x) => x.n === Number(n)); return l.slice(Math.max(0, i - STEP), i + STEP + 1).map((x) => x.id); });
  const fine = await pool([...new Set(want)]);
  const nearest = fine.map((p) => ({...p, distanceKm: Math.round(km(s.lat, s.lon, p.lat, p.lon) * 100) / 100})).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
  result.spots.push({id: s.id, name: s.name, lat: s.lat, lon: s.lon, nearest});
  console.error(`${s.name}: ${nearest.slice(0, 3).map((p) => `${p.id} ${p.shoreNormalDeg}° ${p.distanceKm} km`).join(' | ')}`);
}
if (out) fs.writeFileSync(out, JSON.stringify(result, null, 1) + '\n'); else console.log(JSON.stringify(result, null, 1));

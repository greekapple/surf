#!/usr/bin/env node
// T-041: reads CDIP MOP point metadata (position, water depth, shore normal) for ID ranges and ranks them by distance to a spot.
// Usage: node scripts/mop-lookup.mjs SM370-SM410 MA140-MA160 SF020-SF026 [--out docs/forecast/data/mop-candidates.json]
// Output is evidence for a human review (data/mop-assignments.ts); it never assigns a point. Public CDIP THREDDS only.
import fs from 'node:fs';
const BASE = 'https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/';
const SPOTS = [
  {id: 'spot-2', name: 'Ocean Beach', lat: 37.759, lon: -122.51},
  {id: 'spot-3', name: 'Linda Mar', lat: 37.6, lon: -122.5},
  {id: 'spot-0', name: 'Bolinas', lat: 37.90835046, lon: -122.682137},
];
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : null;
const ids = args.flatMap((r) => {
  const m = r.match(/^([A-Z]+)(\d+)-(?:[A-Z]+)?(\d+)$/);
  if (!m) return [r];
  const [, pre, a, b] = m, width = a.length;
  return Array.from({length: Number(b) - Number(a) + 1}, (_, i) => pre + String(Number(a) + i).padStart(width, '0'));
});
const km = (aLat, aLon, bLat, bLon) => {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
async function meta(id) {
  const res = await fetch(`${BASE}${id}_forecast.nc.ascii?metaLatitude,metaLongitude,metaWaterDepth,metaShoreNormal`, {signal: AbortSignal.timeout(30000)});
  if (!res.ok) return null;
  const t = await res.text(), g = (k) => Number((t.match(new RegExp(`${k}, (-?[\\d.]+)`)) ?? [])[1]);
  const row = {id, lat: g('metaLatitude'), lon: g('metaLongitude'), depthM: g('metaWaterDepth'), shoreNormalDeg: g('metaShoreNormal')};
  return Object.values(row).slice(1).every(Number.isFinite) ? row : null;
}
const points = [];
for (const id of ids) { const m = await meta(id); if (m) points.push(m); else console.error(`skip ${id} (no metadata)`); }
const result = {retrievedOn: new Date().toISOString().slice(0, 10), source: BASE, note: 'Distance is from the spot query coordinate (a model sampling point, not a surveyed takeoff). Candidates only; assignment needs review.', spots: SPOTS.map((s) => ({
  ...s,
  nearest: points.map((p) => ({...p, distanceKm: Math.round(km(s.lat, s.lon, p.lat, p.lon) * 100) / 100})).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 5),
}))};
for (const s of result.spots) {
  console.log(`\n${s.name} (${s.id})`);
  for (const p of s.nearest) console.log(`  ${p.id}  ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}  depth ${p.depthM} m  normal ${p.shoreNormalDeg}°  ${p.distanceKm} km`);
}
if (out) fs.writeFileSync(out, JSON.stringify(result, null, 1) + '\n');

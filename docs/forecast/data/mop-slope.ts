// T-064 addendum: mean seabed slope from a reviewed MOP point's depth to the shoreline = depth / distance to the nearest coastline.
// Coastline: Natural Earth 10m land v5.1.2 (public domain) as shipped in src/map/coast.json. COARSE (1:10m map accuracy, a few hundred metres), so the result is an order-of-magnitude mean slope,
// not the surf-zone slope. Prints the entries committed in src/ocean/nearshoreSlope.ts. Run: node --experimental-strip-types docs/forecast/data/mop-slope.ts
import fs from 'node:fs';
import {mopAssignments, mopPoint} from '../../../src/ocean/mop.ts';
const coast = JSON.parse(fs.readFileSync(new URL('../../../src/map/coast.json', import.meta.url), 'utf8'));
const R = 6371008.8, rad = Math.PI / 180;
function distToSegM(lat: number, lon: number, a: [number, number], b: [number, number]) { // local equirectangular metres around the point
  const kx = Math.cos(lat * rad) * R * rad, ky = R * rad, ax = (a[0] - lon) * kx, ay = (a[1] - lat) * ky, bx = (b[0] - lon) * kx, by = (b[1] - lat) * ky;
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(ax + t * dx, ay + t * dy);
}
for (const a of mopAssignments) {
  const p = mopPoint(a.mopId)!; let best = Infinity;
  for (const ring of coast.rings as [number, number][][]) for (let i = 1; i < ring.length; i++) { if (Math.abs(ring[i][0] - p.lon) > 0.5 || Math.abs(ring[i][1] - p.lat) > 0.5) continue; best = Math.min(best, distToSegM(p.lat, p.lon, ring[i - 1], ring[i])); }
  console.log(JSON.stringify({spotId: a.spotId, mopId: a.mopId, depthM: p.depthM, distanceM: Math.round(best), tanBeta: Math.round(1e5 * p.depthM / best) / 1e5}));
}

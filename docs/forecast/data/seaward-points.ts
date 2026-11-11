// For marine query points that fail the importer's depth guard (ETOPO 2022 shallower than 10 m, or land): step the point further out along the spot's seaward direction in 0.02 degree steps (to 0.30)
// until it is deeper than 10 m and not on the land polygons, and print the marine-point override lines (the reason says what the default read and what the new point reads). The spot's own position and facing do not change.
//   node --experimental-strip-types --no-warnings docs/forecast/data/seaward-points.ts <id,id,...>   -> prints MARINE_POINT_OVERRIDES entries to paste into src/data/marinePoints.ts
import {COAST_ROWS, UPGRADED_ROWS} from '../../../src/data/coast.ts';
import {pointOnLand} from '../../../src/map/landCheck.ts';
const ids = (process.argv[2] ?? '').split(',').filter(Boolean), rows = new Map<string, any[]>([...UPGRADED_ROWS, ...COAST_ROWS].map((r: any) => [r[0], r]));
const r3 = (n: number) => Math.round(n * 1000) / 1000, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const at = (lat: number, lon: number, sea: number, d: number) => { const th = (sea * Math.PI) / 180; return {lat: r3(lat + d * Math.cos(th)), lon: r3(lon + (d * Math.sin(th)) / Math.cos((lat * Math.PI) / 180))}; };
async function depth(lat: number, lon: number): Promise<number | null> {
  for (let k = 0; k < 4; k++) { try { const r = await fetch(`https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.csv?z%5B(${lat.toFixed(4)})%5D%5B(${lon.toFixed(4)})%5D`, {signal: AbortSignal.timeout(30000), headers: {'User-Agent': 'SWELLO surf forecast prototype'}}); if (r.ok) { const v = Number((await r.text()).trim().split('\n').pop()!.split(',').pop()); if (Number.isFinite(v)) { await sleep(450); return v; } } } catch { /* retry */ } await sleep(900 * (k + 1)); }
  return null;
}
const compass = (d: number) => ['north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east', 'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west'][Math.round(d / 22.5) % 16];
for (const id of ids) {
  const r = rows.get(id); if (!r) { console.log(`// ${id}: not in coast.ts`); continue; }
  const [, name, , , lat, lon, sea] = r, def = at(lat, lon, sea, 0.08), z0 = await depth(def.lat, def.lon); let found: any = null;
  for (let d = 0.1; d <= 0.3001 && !found; d += 0.02) { const p = at(lat, lon, sea, d); if (pointOnLand(p.lat, p.lon)) continue; const z = await depth(p.lat, p.lon); if (z !== null && z <= -10) found = {...p, z, d: Math.round(d * 100) / 100}; }
  if (!found) { console.log(`// ${id} (${name}): NO point out to 0.30 degrees along ${sea} degrees is deeper than 10 m and off the land polygons: place by hand (default ${def.lat}, ${def.lon} reads ${z0} m)`); continue; }
  console.log(`  '${id}': {lat: ${found.lat}, lon: ${found.lon}, reason: 'The row faces ${compass(sea)} (${sea} degrees); the default marine point (0.08 degrees out that way) reads ${z0 === null ? 'no depth' : Math.round(z0 * 10) / 10 + ' m'} in ETOPO 2022, shallower than the 10 m guard of the importer (a shoal, a shallow shelf or land), so the point is ${found.d} degrees out along the same direction, where ETOPO reads ${Math.round(found.z)} m and the land polygons say sea'},`);
}

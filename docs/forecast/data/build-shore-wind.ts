// Builds src/ocean/shoreWind.json: for every spot in evidenceSpots, the nearest SHORE wind station within MAX_KM, if one reported wind in the
// last 7 days. Two kinds, picked by the same rule (spec docs/specs/2026-11-08-wind-now.md):
//   ndbc = a fixed NDBC/NOS met station (activestations.xml, met="y", type="fixed");  asos = a West Coast airport ASOS (IEM CA_ASOS, OR_ASOS and WA_ASOS networks).
// Both kinds go through the enclosed-water mask (src/map/enclosed.ts: an airfield or pier on a bay shore reads bay wind). No latitude band.
// A candidate counts only if its live feed answered at build time with a wind reading from the last 7 days (NDBC realtime2 file; ASOS the NWS
// observations the app will call). A station in a harbour basin or estuary, or an NDBC/NOS station whose siting is not checked in NDBC_EXPOSURE, is skipped. The display rule (4 km) is stricter than the audit rule (7 km, wind-point.ts).
// Usage: node docs/forecast/data/build-shore-wind.ts   (network; writes src/ocean/shoreWind.json)
import fs from 'node:fs';
import {pointInUs} from '../../../src/ocean/coverage.ts';
import {isEnclosedWater} from '../../../src/map/enclosed.ts';
import {evidenceSpots} from '../../../src/ocean/spots.ts';
import {distanceKm} from '../../../src/ocean/mop.ts';
import {ASOS_NETWORK_URL, parseAsosNetwork} from './shore-wind.ts';
import {keepExistingAssignments, shoreWindRegistry, ndbcWindURL, nwsObservationURL, SHORE_WIND_MAX_KM, SHORE_WIND_RULE, SHORE_WIND_WINDOW_DAYS, stationsWithin, exposureOf, exposureShown, normalizeNdbcWind, normalizeNwsWind, type ShoreStation} from '../../../src/ocean/shoreWind.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function get(u: string, headers: Record<string, string> = {}, tries = 3): Promise<string | null> {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(u, {headers, signal: AbortSignal.timeout(60000)}); if (r.ok) return await r.text(); if (r.status === 404 || r.status === 400) return null; } catch { /* retry */ } await sleep(2000 * (i + 1)); }
  return null;
}
const UA = {'User-Agent': 'SWELLO surf forecast prototype'};
const now = Date.now(), week = SHORE_WIND_WINDOW_DAYS * 86400000;

const xml = await get('https://www.ndbc.noaa.gov/activestations.xml'); if (!xml) throw new Error('activestations.xml unavailable');
const ndbc: ShoreStation[] = [...xml.matchAll(/<station ([^>]*)\/?>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]])) as any)
  .filter((s: any) => s.met === 'y' && s.type === 'fixed').map((s: any) => ({id: String(s.id).toUpperCase(), name: String(s.name), kind: 'ndbc' as const, lat: +s.lat, lon: +s.lon}))
  .filter((s) => pointInUs(s.lat, s.lon) && !isEnclosedWater(s.lat, s.lon));   // the West Coast, Hawaii and Alaska boxes (coverage.ts)
const asosLists = await Promise.all(['CA', 'OR', 'WA'].map((st) => get(ASOS_NETWORK_URL.replace('CA_ASOS', st + '_ASOS')))); if (asosLists.some((x) => !x)) throw new Error('IEM CA/OR/WA ASOS network unavailable');
const asos: ShoreStation[] = asosLists.flatMap((x) => parseAsosNetwork(x!)).filter((x) => !isEnclosedWater(x.lat, x.lon)).map((x) => ({...x, kind: 'asos' as const}));
const all = [...ndbc, ...asos];

// Does the station's own live feed carry a wind reading from the last 7 days? (the same normalisers the app uses, with a 7-day instead of a 2-hour window)
const recent = new Map<string, boolean>();
async function reportedWind(s: ShoreStation): Promise<boolean> {
  const key = s.kind + s.id; if (recent.has(key)) return recent.get(key)!;
  let ok = false;
  if (s.kind === 'ndbc') { const t = await get(ndbcWindURL(s.id)); const r = t ? normalizeNdbcWind(t, s, now, week) : null; ok = !!r && r.mph !== null; }
  else { const t = await get(nwsObservationURL(s.id), {...UA, Accept: 'application/geo+json'}); const r = t ? normalizeNwsWind(t, s, now, week) : null; ok = !!r && r.mph !== null; }
  recent.set(key, ok); return ok;
}

const assignments: any[] = [], none: string[] = [], skipped = new Set<string>();
for (const sp of evidenceSpots) {
  const near = stationsWithin(sp.latitude, sp.longitude, all, distanceKm);
  let pick: (typeof near)[number] | null = null;
  for (const c of near) { if (!exposureShown(exposureOf(c.s))) { skipped.add(`${c.s.id} (${exposureOf(c.s) ?? 'siting not checked'})`); continue; } if (await reportedWind(c.s)) { pick = c; break; } }   // a silent station falls through to the next one inside the radius
  if (!pick) { none.push(sp.name); continue; }
  assignments.push({lastSeen: new Date(now).toISOString(), spotId: sp.id, spotName: sp.name, stationId: pick.s.id, stationName: pick.s.name, kind: pick.s.kind, exposure: exposureOf(pick.s), lat: pick.s.lat, lon: pick.s.lon, distanceKm: Math.round(pick.km * 10) / 10,
    url: pick.s.kind === 'ndbc' ? `https://www.ndbc.noaa.gov/station_page.php?station=${pick.s.id}` : nwsObservationURL(pick.s.id)});
}
// An existing entry stays unless its station is decommissioned (gone from the live lists): a quiet week is not a reason to drop it.
const order = new Map(evidenceSpots.map((x, i) => [x.id, i])), kept = keepExistingAssignments(shoreWindRegistry.assignments, assignments, all, evidenceSpots, distanceKm, now, shoreWindRegistry.builtAt).filter((a) => order.has(a.spotId));
for (const a of kept.slice(assignments.length)) console.log(`kept ${a.spotName} <- ${a.stationId} (no recent wind reading, station still listed)`);
const out = {builtAt: new Date(now).toISOString(), maxKm: SHORE_WIND_MAX_KM, windowDays: SHORE_WIND_WINDOW_DAYS, rule: SHORE_WIND_RULE, spotsChecked: evidenceSpots.length, assignments: kept.sort((a, b) => order.get(a.spotId)! - order.get(b.spotId)!)};
fs.writeFileSync(new URL('../../../src/ocean/shoreWind.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${kept.length} of ${evidenceSpots.length} spots have a station within ${SHORE_WIND_MAX_KM} km:`);
for (const a of kept) console.log(`  ${a.spotName} <- ${a.stationId} (${a.kind}) ${a.stationName}, ${a.distanceKm} km`);
console.log('none:', none.join(', '));
console.log('stations inside a radius but not shown:', [...skipped].join(', '));

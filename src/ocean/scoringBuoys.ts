/** The buoys "How right we've been" may score a spot against (round 4C), and the rule for which one a spot gets.
 *  Universe: the NDBC-hosted wave buoys the app already shows plus the audited ones (the same 54 the realtime2 archive keeps, services/ndbc-archive.mjs ARCHIVE_BUOYS).
 *  Each has a realtime2 `.spec` file (total Hs, and NDBC's own swell / wind-sea split where it publishes one). Positions: the app's context buoys, and NDBC's activestations.xml (read 2026-11-10) for the rest.
 *  A spot's buoy: the nearest NOT-sheltered buoy within 100 km whose bearing from the spot lies inside the spot's SOURCED swell window (spot profile). Never borrowed: no window, no buoy in reach, or none that sees the same sea = "no buoy", with the reason. */
import {contextBuoys, buoyKm, type ContextBuoy} from './buoys.ts';
import {spotProfile} from './spotProfiles.ts';

export interface ScoringBuoy {id: string; name: string; lat: number; lon: number; /** inside a bay, sound or harbour: its waves are not the open ocean's */ sheltered: boolean; why?: string}
/** Buoys not in `contextBuoys`: NDBC activestations.xml (lat, lon, name), classification by name and owner. */
const EXTRA: ScoringBuoy[] = [
  {id: '46026', name: 'San Francisco, 18 NM west', lat: 37.75, lon: -122.838, sheltered: false},
  {id: '46221', name: 'Santa Monica Bay', lat: 33.86, lon: -118.641, sheltered: false, why: 'an open embayment, the buoy sits outside the harbour breakwaters'},
  {id: '46235', name: 'Imperial Beach Nearshore', lat: 32.57, lon: -117.169, sheltered: false},
  {id: '46236', name: 'Monterey Canyon Outer', lat: 36.759, lon: -121.95, sheltered: false},
  {id: '46237', name: 'San Francisco Bar', lat: 37.788, lon: -122.634, sheltered: false},
  {id: '46254', name: 'Scripps Nearshore', lat: 32.868, lon: -117.267, sheltered: false},
  {id: '46275', name: 'Red Beach Nearshore', lat: 33.291, lon: -117.501, sheltered: false},
  {id: '51201', name: 'Waimea Bay', lat: 21.671, lon: -158.118, sheltered: false},
  {id: '51202', name: 'Mokapu Point', lat: 21.414, lon: -157.681, sheltered: false},
  {id: '51207', name: 'Kaneohe Bay', lat: 21.477, lon: -157.752, sheltered: true, why: 'inside Kaneohe Bay, behind the barrier reef'},
  {id: '51210', name: 'Kaneohe Bay (WETS)', lat: 21.477, lon: -157.757, sheltered: true, why: 'inside Kaneohe Bay, behind the barrier reef'},
  {id: '51211', name: 'Pearl Harbor Entrance', lat: 21.297, lon: -157.959, sheltered: false},
  {id: '51212', name: 'Barbers Point', lat: 21.323, lon: -158.149, sheltered: false},
  {id: '41024', name: 'Sunset Nearshore', lat: 33.837, lon: -78.477, sheltered: false},
  {id: '41025', name: 'Diamond Shoals', lat: 35.026, lon: -75.38, sheltered: false},
  {id: '41029', name: 'Capers Nearshore', lat: 32.803, lon: -79.624, sheltered: false},
  {id: '41033', name: 'Fripp Nearshore', lat: 32.279, lon: -80.406, sheltered: false},
  {id: '41038', name: 'Wrightsville Beach Nearshore', lat: 34.141, lon: -77.715, sheltered: false},
  {id: '41066', name: 'CHR60', lat: 32.536, lon: -79.656, sheltered: false},
  {id: '41068', name: 'Fort Pierce', lat: 27.593, lon: -80.189, sheltered: false},
  {id: '41069', name: 'Ponce de Leon Inlet', lat: 29.289, lon: -80.803, sheltered: false},
  {id: '44013', name: 'Boston, 16 NM east', lat: 42.346, lon: -70.651, sheltered: false},
  {id: '44022', name: 'Execution Rocks', lat: 40.883, lon: -73.728, sheltered: true, why: 'inside Long Island Sound'},
  {id: '44029', name: 'Buoy A01, Massachusetts Bay', lat: 42.523, lon: -70.566, sheltered: true, why: 'inside Massachusetts Bay'},
  {id: '44064', name: 'First Landing, VA', lat: 36.998, lon: -76.087, sheltered: true, why: 'inside the Chesapeake Bay'},
  {id: '44065', name: 'New York Harbor Entrance', lat: 40.368, lon: -73.701, sheltered: false},
  {id: '44069', name: 'Great South Bay', lat: 40.699, lon: -73.087, sheltered: true, why: 'inside Great South Bay'},
  {id: '44100', name: 'Duck FRF 26 m', lat: 36.257, lon: -75.593, sheltered: false},
  // US West round 4 (2026-11-10): the live wave buoys within 50 km of the west-ca spots; each has a realtime2 `.spec` file (checked)
  {id: '46244', name: 'Humboldt Bay, North Spit, CA', lat: 40.896, lon: -124.358, sheltered: false},
  {id: '46014', name: 'PT ARENA - 19NM North of Point Arena, CA', lat: 39.225, lon: -123.98, sheltered: false},
  {id: '46042', name: 'MONTEREY - 27NM WNW of Monterey, CA', lat: 36.787, lon: -122.408, sheltered: false},
  {id: '46028', name: 'CAPE SAN MARTIN - 55NM West NW of Morro Bay, CA', lat: 35.763, lon: -121.9, sheltered: false},
  {id: '46215', name: 'Diablo Canyon, CA', lat: 35.204, lon: -120.859, sheltered: false},
  {id: '46286', name: 'Avila Beach Nearshore, CA', lat: 35.164, lon: -120.737, sheltered: false},
  {id: '46218', name: 'Harvest, CA', lat: 34.452, lon: -120.78, sheltered: false},
  {id: '46053', name: 'EAST SANTA BARBARA - 12NM Southwest of Santa Barbara, CA', lat: 34.246, lon: -119.842, sheltered: false},
  {id: '46268', name: 'Topanga Nearshore, CA', lat: 34.022, lon: -118.578, sheltered: false},
  {id: '46025', name: 'Santa Monica Basin - 33NM WSW of Santa Monica, CA', lat: 33.765, lon: -119.077, sheltered: false},
  {id: '46256', name: 'Long Beach Channel, CA', lat: 33.7, lon: -118.201, sheltered: false},
  {id: '46222', name: 'San Pedro, CA', lat: 33.614, lon: -118.314, sheltered: false},
  {id: '46253', name: 'San Pedro South, CA', lat: 33.576, lon: -118.182, sheltered: false},
  {id: '46285', name: 'Capistrano Beach Nearshore, CA', lat: 33.445, lon: -117.68, sheltered: false},
  {id: '46277', name: 'Green Beach Offshore, CA', lat: 33.336, lon: -117.659, sheltered: false},
  {id: '46274', name: 'Leucadia Nearshore, CA', lat: 33.062, lon: -117.314, sheltered: false},
  {id: '46266', name: 'Del Mar Nearshore, CA', lat: 32.957, lon: -117.279, sheltered: false},
  {id: 'LJPC1', name: 'La Jolla, CA', lat: 32.867, lon: -117.257, sheltered: false},
  {id: '46232', name: 'Point Loma South, CA', lat: 32.517, lon: -117.425, sheltered: false},
  // US West batch 2 (2026-11-10): the live wave buoys within 50 km of the Oregon, Washington and Sitka spots; each has a realtime2 `.spec` file (checked)
  {id: '46084', name: 'CAPE EDGECUMBE - 25NM SSW of Cape Edgecumbe, AK', lat: 56.614, lon: -136.04, sheltered: false},
  {id: '46087', name: 'Neah Bay - 6 NM North of Cape Flattery, WA (Traffic Separation Lighted Buoy)', lat: 48.493, lon: -124.727, sheltered: false},
  {id: '46088', name: 'NEW DUNGENESS - 17 NM NE of Port Angeles, WA', lat: 48.332, lon: -123.179, sheltered: true, why: 'inside the Strait of Juan de Fuca (New Dungeness)'},
  {id: '46267', name: 'Angeles Point, WA', lat: 48.171, lon: -123.6, sheltered: true, why: 'inside the Strait of Juan de Fuca (Angeles Point, Port Angeles)'},
  {id: '46211', name: 'Grays Harbor, WA', lat: 46.857, lon: -124.243, sheltered: false},
  {id: '46243', name: 'Clatsop Spit, OR', lat: 46.215, lon: -124.129, sheltered: false},
  {id: '46278', name: 'Tillamook Bay South Jetty, OR', lat: 45.559, lon: -123.991, sheltered: false},
  {id: '46050', name: 'STONEWALL BANK - 20NM West of Newport, OR', lat: 44.679, lon: -124.535, sheltered: false},
  {id: '46229', name: 'UMPQUA OFFSHORE, OR', lat: 43.772, lon: -124.549, sheltered: false},
  {id: '46015', name: 'PORT ORFORD - 15 NM West of Port Orford, OR', lat: 42.754, lon: -124.839, sheltered: false},
];
/** The CDIP ids of context buoys that are the same instrument as an NDBC buoy in the list: scored through the NDBC feed (it has the swell split). */
const TWINS = new Set(['029p1', '098p1', '106p1']);
const fromContext = (b: ContextBuoy): ScoringBuoy => ({id: b.id, name: b.place.replace(/ \(\d+\)$/, ''), lat: b.lat, lon: b.lon, sheltered: !!b.sheltered, ...(b.sheltered ? {why: 'a bay buoy: inside a bay, not the open ocean'} : {})});
/** Buoys whose realtime2 `.spec` file does not exist (404 on 2026-11-10; the realtime archive records the same): they publish no wave file we can score against, so they are not offered to any spot (the spot's next buoy, or "no buoy"). */
export const NO_SPEC_FILE = new Set(['41029', '41033', '46235']);
/** NDBC ids that are not wave BUOYS (the La Jolla pier gauge LJPC1 hangs under Scripps Pier, no direction): never offered as "the buoy" for a spot. */
export const NOT_A_BUOY = new Set(['LJPC1']);
export const scoringBuoys: ScoringBuoy[] = [...contextBuoys.filter((b) => b.provider === 'NDBC' && !TWINS.has(b.id)).map(fromContext), ...EXTRA.filter((e) => !contextBuoys.some((b) => b.id === e.id))].filter((b) => !NO_SPEC_FILE.has(b.id) && !NOT_A_BUOY.has(b.id));
export const scoringBuoy = (id: string) => scoringBuoys.find((b) => b.id === id) ?? null;

export const SCORING_RULE = {maxKm: 100, /** the same limit as the Worker captures a buoy-position forecast for */ buoyListedAt: '2026-11-10'} as const;

/** Initial bearing (deg true) from a to b: for a buoy offshore of a spot it is the direction a swell that passes the buoy comes from. */
export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180, dl = (bLon - aLon) * r, y = Math.sin(dl) * Math.cos(bLat * r), x = Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos(dl);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}
/** `d` inside the arc from `from` clockwise to `to` (degrees true, wraps through north). */
export const inArc = (d: number, from: number, to: number): boolean => { const a = ((from % 360) + 360) % 360, b = ((to % 360) + 360) % 360, x = ((d % 360) + 360) % 360; return a <= b ? x >= a && x <= b : x >= a || x <= b; };

export interface BuoyPick {buoy: ScoringBuoy; km: number; bearing: number; window: {fromDeg: number; toDeg: number}}
export type BuoyChoice = {ok: true; pick: BuoyPick} | {ok: false; reason: string; nearest: {id: string; name: string; km: number} | null};
/** The spot's sourced swell window (directions swell comes from), or null. */
export const windowOf = (spotId: string): {fromDeg: number; toDeg: number} | null => { const w = spotProfile(spotId)?.swellWindow?.value as {fromDeg: number; toDeg: number} | null | undefined; return w && Number.isFinite(w.fromDeg) && Number.isFinite(w.toDeg) ? {fromDeg: w.fromDeg, toDeg: w.toDeg} : null; };

/** Choose the buoy for a spot, or say plainly why none is eligible. Pure given the window. `buoys` default = the scoring universe. */
export function chooseBuoy(spot: {lat: number; lon: number}, window: {fromDeg: number; toDeg: number} | null, buoys: ScoringBuoy[] = scoringBuoys, maxKm = SCORING_RULE.maxKm): BuoyChoice {
  const all = buoys.map((b) => ({b, km: buoyKm(b, spot.lat, spot.lon)})).filter((x) => x.km <= maxKm).sort((p, q) => p.km - q.km);
  const open = all.filter((x) => !x.b.sheltered), nearest = (open[0] ?? all[0]) ? {id: (open[0] ?? all[0]).b.id, name: (open[0] ?? all[0]).b.name, km: Math.round((open[0] ?? all[0]).km)} : null;
  if (!all.length) return {ok: false, reason: `no wave buoy within ${maxKm} km`, nearest: null};
  if (!open.length) return {ok: false, reason: `every buoy within ${maxKm} km of this spot (${all.map((x) => `${x.b.name}, ${Math.round(x.km)} km`).join('; ')}) is inside a bay, sound or harbour, so none reports the sea outside it`, nearest};
  if (!window) return {ok: false, reason: `no sourced swell window for this spot, so we cannot say whether ${open[0].b.name} (${Math.round(open[0].km)} km) sees the swell that reaches it`, nearest};
  const seen = open.map((x) => ({...x, bearing: bearingDeg(spot.lat, spot.lon, x.b.lat, x.b.lon)})).filter((x) => inArc(x.bearing, window.fromDeg, window.toDeg));
  if (!seen.length) { const o = open[0]; return {ok: false, reason: `the buoys within ${maxKm} km (nearest ${o.b.name}, ${Math.round(o.km)} km, to the ${compass(bearingDeg(spot.lat, spot.lon, o.b.lat, o.b.lon))}) lie outside this spot's swell window (${Math.round(window.fromDeg)}°–${Math.round(window.toDeg)}°)`, nearest}; }
  const x = seen[0]; return {ok: true, pick: {buoy: x.b, km: Math.round(x.km * 10) / 10, bearing: Math.round(x.bearing), window}};
}
const POINTS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast', 'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
export const compass = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

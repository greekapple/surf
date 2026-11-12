import {evidenceSpots} from './spots.ts';

/** Which spots the browser loads data for (spec 2026-11-09 subset loading). Everything beyond this set loads on demand when it is opened, panned into view or requested by a screen,
 *  so the requests and the Open-Meteo calls follow what people look at, not the size of the catalogue.
 *  scope = the selected spot + favourites + the spots near the selected spot and near the first favourite (what Home ranks "nearby" from) + the pins visible on the map + any screen's extra request. */
export const SCOPE_NEAR_KM = 100, SCOPE_NEAR_N = 60, SCOPE_MAX = 400;
/** map-fill (lead, 2026-11-11): the map's background list may take the scope up to this many spots (the largest seaboard, the East Coast, is 541; everything
 *  else stays under SCOPE_MAX and goes first). Requests stay polite: the per-URL cache means each step fetches only the region it adds. */
export const SCOPE_FILL_MAX = 600;
const dist = (aLat: number, aLon: number, bLat: number, bLon: number) => { const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
export function nearIds(id: string, spots: {id: string; latitude: number; longitude: number}[] = evidenceSpots, km = SCOPE_NEAR_KM, n = SCOPE_NEAR_N): string[] {
  const c = spots.find((s) => s.id === id); if (!c) return [];
  return spots.filter((s) => s.id !== id).map((s) => ({id: s.id, d: dist(c.latitude, c.longitude, s.latitude, s.longitude)})).filter((x) => x.d <= km).sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.id);
}
/** The spots nearest a point (a search anchor: the user's location or home region), nearest first. */
export function nearPoint(lat: number, lon: number, spots: {id: string; latitude: number; longitude: number}[] = evidenceSpots, km = 130, n = SCOPE_NEAR_N * 2): string[] {
  return spots.map((s) => ({id: s.id, d: dist(lat, lon, s.latitude, s.longitude)})).filter((x) => x.d <= km).sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.id);
}
/** Ordered, de-duplicated, capped: the selected spot and favourites first (they are never dropped by the cap), then nearby, visible and requested spots. Unknown ids are ignored. */
export function computeScope(selected: string, favorites: string[], visible: string[] = [], extra: string[] = [], spots: {id: string; latitude: number; longitude: number}[] = evidenceSpots, max = SCOPE_MAX, fill: string[] = []): string[] {
  const known = new Set(spots.map((s) => s.id)), out: string[] = [], seen = new Set<string>();
  const add = (ids: string[], hard = false) => { for (const id of ids) if (known.has(id) && !seen.has(id) && (hard || out.length < max)) { seen.add(id); out.push(id); } };
  add([selected, ...favorites], true); add(nearIds(selected, spots)); if (favorites[0]) add(nearIds(favorites[0], spots)); add(visible); add(extra);
  // the map's background fill goes last, with its own allowance
  for (const id of fill) if (known.has(id) && !seen.has(id) && out.length < Math.max(max, SCOPE_FILL_MAX)) { seen.add(id); out.push(id); }
  return out;
}

import {zoneOf} from '../../data/zones.ts';
import {distanceKm} from '../../ocean/mop.ts';

/** Favorite spots page (personal-spots): the catalogue is large, so the page filters (name, region or zone text; one region chip), puts SAVED spots first, then the spots nearest the selected spot, and shows one window of
 *  SPOTS_PER_PAGE cards at a time. Pure. Spots with no known position sort after the ones with one (then by name). */
export const SPOTS_PER_PAGE = 40;
export interface ListSpot {id: string; name: string; region: string}
export interface Position {id: string; latitude: number; longitude: number}
export function orderSpots<T extends ListSpot>(spots: T[], positions: Position[], selectedId: string, favourites: string[], query: string, zone: string): T[] {
  const pos = new Map(positions.map((p) => [p.id, p])), here = pos.get(selectedId), q = query.trim().toLowerCase(), favs = new Set(favourites);
  const km = (id: string) => { const e = pos.get(id); return here && e ? distanceKm(here.latitude, here.longitude, e.latitude, e.longitude) : Infinity; };
  return spots.filter((s) => (zone === 'All' || zoneOf(s.region) === zone) && (!q || `${s.name} ${s.region} ${zoneOf(s.region)}`.toLowerCase().includes(q)))
    .map((s) => ({s, fav: favs.has(s.id), km: km(s.id)})).sort((a, b) => Number(b.fav) - Number(a.fav) || a.km - b.km || a.s.name.localeCompare(b.s.name)).map((x) => x.s);
}
export const pageWindow = (total: number, page: number) => { const pages = Math.max(1, Math.ceil(total / SPOTS_PER_PAGE)), p = Math.min(Math.max(0, page), pages - 1); return {pages, page: p, from: p * SPOTS_PER_PAGE, to: Math.min(total, (p + 1) * SPOTS_PER_PAGE)}; };

import {COASTS, SEABOARDS, mapZoneOf} from './coastGroups.ts';

/** map-fill (lead, 2026-11-11): the map loads its spots in view first; after that it fills in the rest of the seaboard in view in the background, one region at
 *  a time, nearest region first, so the region pills go live without panning. This module only orders the work; ExploreView paces it (one region per settled
 *  load, paused while the time is playing or being scrubbed) and the store puts the list last in the scope. */
export interface FillSpot {id: string; region: string; latitude: number; longitude: number}

const COAST_OF_ZONE = new Map(COASTS.flatMap(([coast, zones]) => zones.map((z) => [z, coast] as const)));
const SEABOARD_OF_COAST = new Map(SEABOARDS.flatMap(([board, coasts]) => coasts.map((c) => [c, board] as const)));
/** The seaboard a region belongs to (West Coast, Hawaii, East Coast), or null for a region outside the map's grouping. */
export const seaboardOf = (region: string): string | null => SEABOARD_OF_COAST.get(COAST_OF_ZONE.get(mapZoneOf(region)) ?? '') ?? null;

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** The regions of the anchor's seaboard as id lists, nearest region first (by its spot nearest the anchor); inside a region, nearest spot first.
 *  The anchor's own seaboard only: a West Coast map never starts loading the East Coast. Deterministic. */
export function fillQueue(anchor: {lat: number; lon: number; region: string}, spots: readonly FillSpot[]): string[][] {
  const board = seaboardOf(anchor.region);
  if (!board) return [];
  const by = new Map<string, {d: number; ids: {id: string; d: number}[]}>();
  for (const s of spots) {
    if (seaboardOf(s.region) !== board) continue;
    const d = km(anchor.lat, anchor.lon, s.latitude, s.longitude), g = by.get(s.region) ?? {d: Infinity, ids: []};
    g.d = Math.min(g.d, d); g.ids.push({id: s.id, d}); by.set(s.region, g);
  }
  return [...by.entries()].sort((a, b) => a[1].d - b[1].d || (a[0] < b[0] ? -1 : 1))
    .map(([, g]) => g.ids.sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1)).map((x) => x.id));
}

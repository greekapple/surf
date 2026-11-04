/** Map-seamless Stage 1 (product): the map's view lives in the URL like Windy's, so a reload or a shared link restores the exact view with no flash.
 *  ?layer=waves|swell|wind|period &lat= &lon= &z= &t=<ISO hour> (and the existing ?spot=<slug>, written by the store). Written with
 *  history.replaceState (no history entry per pan); parsed once on load. Pure, so it is unit-tested; library-agnostic (Leaflet or MapLibre). */
export type MapLayerId = 'waves' | 'swell' | 'wind' | 'period';
export interface MapUrlView {layer: MapLayerId | null; lat: number | null; lon: number | null; z: number | null; t: string | null}
const LAYERS: readonly MapLayerId[] = ['waves', 'swell', 'wind', 'period'];
const wrapLon = (lon: number) => (lon >= -180 && lon <= 180 ? lon : ((((lon + 180) % 360) + 360) % 360) - 180);
const num = (s: string | null, lo: number, hi: number) => { if (s === null || s.trim() === '') return null; const v = Number(s); return Number.isFinite(v) && v >= lo && v <= hi ? v : null; };

export function parseMapUrl(search: string): MapUrlView {
  const q = new URLSearchParams(search), layer = q.get('layer');
  const t = q.get('t'), tOk = t !== null && /^\d{4}-\d{2}-\d{2}T\d{2}(:\d{2}(:\d{2}(\.\d+)?)?)?Z?$/.test(t) && Number.isFinite(Date.parse(t)) ? new Date(Date.parse(t)).toISOString() : null;
  const lat = num(q.get('lat'), -85, 85), lon = num(q.get('lon'), -540, 540);
  return {layer: LAYERS.includes(layer as MapLayerId) ? (layer as MapLayerId) : null, lat: lat !== null && lon !== null ? lat : null, lon: lat !== null && lon !== null ? wrapLon(lon) : null, z: num(q.get('z'), 1, 18), t: tOk};
}

/** The search string with the map's keys set from `v` (other keys such as ?spot= are kept); null values remove their key. */
export function mapSearch(search: string, v: Partial<MapUrlView>): string {
  const q = new URLSearchParams(search);
  const set = (k: string, val: string | null | undefined) => { if (val === undefined) return; if (val === null) q.delete(k); else q.set(k, val); };
  set('layer', v.layer === undefined ? undefined : v.layer);
  set('lat', v.lat === undefined ? undefined : v.lat === null ? null : v.lat.toFixed(4));
  set('lon', v.lon === undefined ? undefined : v.lon === null ? null : wrapLon(v.lon).toFixed(4));
  set('z', v.z === undefined ? undefined : v.z === null ? null : String(Math.round(v.z * 10) / 10));
  set('t', v.t === undefined ? undefined : v.t);
  const s = q.toString(); return s ? `?${s}` : '';
}

/** Writes the view into the current URL without a history entry (and only when it changed). */
export function writeMapUrl(v: Partial<MapUrlView>) {
  if (typeof location === 'undefined') return;
  const next = mapSearch(location.search, v);
  if (next !== location.search) history.replaceState(history.state, '', `${location.pathname}${next}${location.hash}`);
}

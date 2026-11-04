import type {SpatialFrame} from './spatial.ts';
import {isEnclosedWater} from './enclosed.ts';

// Field data (T-117): the gridded sea-state field the map paints, and the SAME sampling the point label uses. Pure (no Leaflet), so it is unit-tested.
/** A regular lat/lon grid built from the provider's cells. Land cells (null) are filled from their nearest
 * sea neighbours so the field reaches the coastline; the land mask then trims it. Display only, never a reading. */
export type FieldLayer = 'WAVES' | 'SWELL' | 'WIND' | 'PERIOD';
export interface Field {lats: number[]; lons: number[]; val: Float32Array; u: Float32Array; v: Float32Array; unit: SpatialFrame['unit']; filled: number; wrap: boolean; layer: FieldLayer; validAt: string; source: string}
/** Which layer a frame is. Frames carry the WW3/GFS dataset variable as `variable` (spatial.ts: `spec.scalar`): swell is `shgt` (height) and `sper` (period); the total sea is `Thgt` and `Tper`; wind is `ugrd10m`. Wind and period are told apart by unit; a height is SWELL only for the swell scalar, otherwise WAVES
 *  (the offshore wave height, "Offshore Hs"). The colour ramp and the LUT key on the UNIT, never on this, so the classification only labels the point value. */
export const layerOfFrame = (f: Pick<SpatialFrame, 'unit' | 'variable'>): FieldLayer => (f.unit === 'm/s' ? 'WIND' : f.unit === 's' ? 'PERIOD' : /^(shgt|sper|sdir)$|swell/i.test(f.variable) ? 'SWELL' : 'WAVES');
export function buildField(frame: SpatialFrame, wind: boolean): Field | null {
  const lats = [...new Set(frame.cells.map((c) => c.lat))].sort((a, b) => a - b), lons = [...new Set(frame.cells.map((c) => c.lon))].sort((a, b) => a - b);
  const W = lons.length, H = lats.length;
  if (W < 2 || H < 2) return null;
  const val = new Float32Array(W * H).fill(NaN), u = new Float32Array(W * H).fill(NaN), v = new Float32Array(W * H).fill(NaN);
  for (const c of frame.cells) {
    const k = lats.indexOf(c.lat) * W + lons.indexOf(c.lon);
    if (c.value !== null) val[k] = c.value;
    if (c.direction !== null) {
      // Direction is "from"; particles travel toward direction + 180°.
      const mag = wind ? c.speed ?? 0 : 1, th = (c.direction * Math.PI) / 180;
      u[k] = -Math.sin(th) * mag; v[k] = -Math.cos(th) * mag;
    }
  }
  let filled = 0;
  for (const arr of [val, u, v]) {
    for (let pass = 0; pass < 8; pass++) {
      const next = arr.slice(); let changed = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = y * W + x; if (!Number.isNaN(arr[k])) continue;
        let s = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const q = arr[yy * W + xx]; if (!Number.isNaN(q)) { s += q; n++; }
        }
        if (n) { next[k] = s / n; changed++; }
      }
      arr.set(next); if (arr === val) filled += changed;
      if (!changed) break;
    }
  }
  if (val.every((x) => Number.isNaN(x))) return null;
  return {lats, lons, val, u, v, unit: frame.unit, filled, wrap: frame.resolution >= 2, layer: layerOfFrame(frame), validAt: frame.validAt, source: frame.provider}; // coarse frames are global and wrap at the date line
}

/** Bilinear sample; NaN outside the grid. */
export function sample(f: Field, arr: Float32Array, lat: number, lon: number) {
  const {lats, lons} = f, W = lons.length, dLon = (lons[W - 1] - lons[0]) / (W - 1);
  if (f.wrap) lon = ((((lon - lons[0]) % 360) + 360) % 360) + lons[0];
  if (lat < lats[0] || lat > lats[lats.length - 1] || lon < lons[0] || (!f.wrap && lon > lons[W - 1])) return NaN;
  const gx = (lon - lons[0]) / dLon, gy = ((lat - lats[0]) / (lats[lats.length - 1] - lats[0])) * (lats.length - 1);
  const x0 = f.wrap ? Math.floor(gx) % W : Math.min(W - 2, Math.floor(gx)), x1 = f.wrap ? (x0 + 1) % W : x0 + 1;
  const y0 = Math.min(lats.length - 2, Math.floor(gy)), fx = gx - Math.floor(gx), fy = gy - y0;
  const a = arr[y0 * W + x0], b = arr[y0 * W + x1], c = arr[(y0 + 1) * W + x0], d = arr[(y0 + 1) * W + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}


/** First field with a value wins (the regional 0.5° grid, then the global 2° grid underneath); NaN on enclosed water ("Not covered": the wave-model grid does not resolve bays, T-092) or outside every grid. This IS the value the map paints. */
export function sampleAll(fields: Field[], k: 'val' | 'u' | 'v', lat: number, lon: number): number {
  if (isEnclosedWater(lat, lon)) return NaN;
  for (const f of fields) { const v = sample(f, f[k], lat, lon); if (!Number.isNaN(v)) return v; }
  return NaN;
}
/** The point value behind a tap label (T-117 API). */
export interface PointValue {value: number | null; unit: 'm' | 's' | 'm/s'; dirFrom: number | null; layer: FieldLayer; validAt: string; source: string}
/** Samples the field exactly as the map paints it (same grids, same bilinear interpolation, same enclosed-water rule), so the label equals the colour under the pin. Null on land or enclosed water or outside the grid.
 *  Land: the wave grid is filled to the shore for display and trimmed by the coastline, so a point is "land" when the caller's land test says so (`isLand`), e.g. the coast polygons; this module stays geometry-free. */
export function sampleField(fields: Field[], lat: number, lon: number, isLand?: (lat: number, lon: number) => boolean): PointValue | null {
  if (!fields.length || isLand?.(lat, lon)) return null;
  const value = sampleAll(fields, 'val', lat, lon); if (Number.isNaN(value)) return null;
  const f = fields.find((x) => !Number.isNaN(sample(x, x.val, lat, lon))) ?? fields[0];
  const u = sampleAll(fields, 'u', lat, lon), v = sampleAll(fields, 'v', lat, lon), dirFrom = Number.isNaN(u) || Number.isNaN(v) || (u === 0 && v === 0) ? null : ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
  return {value, unit: f.unit === 'deg' ? 'm' : f.unit, dirFrom, layer: f.layer, validAt: f.validAt, source: f.source};
}

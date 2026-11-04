import type {SpatialFrame} from './spatial.ts';
import {isEnclosedWater} from './enclosed.ts';
import {mapConfig} from './mapConfig.ts';

// Field data (T-117): the gridded sea-state field the map paints, and the SAME sampling the point label uses. Pure (no Leaflet), so it is unit-tested.
/** A regular lat/lon grid built from the provider's cells. Land cells (null) are filled from their nearest
 * sea neighbours so the field reaches the coastline; the land mask then trims it. Display only, never a reading. */
export type FieldLayer = 'WAVES' | 'SWELL' | 'WIND' | 'PERIOD';
export interface Field {lats: number[]; lons: number[]; val: Float32Array; u: Float32Array; v: Float32Array; unit: SpatialFrame['unit']; filled: number; /** 1 where the cell has a real model value; 0 where it was empty and the coastal fill painted it (display only, never a reading) */ real: Uint8Array; wrap: boolean; layer: FieldLayer; validAt: string; source: string}
/** Which layer a frame is. Frames carry the WW3/GFS dataset variable as `variable` (spatial.ts: `spec.scalar`): swell is `shgt` (height) and `sper` (period); the total sea is `Thgt` and `Tper`; wind is `ugrd10m`. Wind and period are told apart by unit; a height is SWELL only for the swell scalar, otherwise WAVES
 *  (the offshore wave height, "Offshore Hs"). The colour ramp and the LUT key on the UNIT, never on this, so the classification only labels the point value. */
export const layerOfFrame = (f: Pick<SpatialFrame, 'unit' | 'variable'>): FieldLayer => (f.unit === 'm/s' ? 'WIND' : f.unit === 's' ? 'PERIOD' : /^(shgt|sper|sdir)$|swell/i.test(f.variable) ? 'SWELL' : 'WAVES');
export function buildField(frame: SpatialFrame, wind: boolean): Field | null {
  let lats: number[], lons: number[], W: number, H: number, val: Float32Array, u: Float32Array, v: Float32Array;
  if (frame.grid) { // gridded frame (Stage 2a): typed arrays straight from the wire, latitude ascending
    const g = frame.grid; H = g.nlat; W = g.nlon; lats = Array.from({length: H}, (_, i) => g.lat0 + i * g.dlat); lons = Array.from({length: W}, (_, i) => g.lon0 + i * g.dlon);
    val = Float32Array.from(g.val); u = new Float32Array(W * H).fill(NaN); v = new Float32Array(W * H).fill(NaN);
    // calm air has no direction: zero flow, not a neighbour's
    if (g.dir) for (let k = 0; k < W * H; k++) { const d = g.dir[k]; if (Number.isNaN(d)) { if (wind && !Number.isNaN(g.val[k])) { u[k] = 0; v[k] = 0; } continue; } const th = (d * Math.PI) / 180, mag = wind ? (Number.isNaN(g.val[k]) ? 0 : g.val[k]) : 1; u[k] = -Math.sin(th) * mag; v[k] = -Math.cos(th) * mag; }
  } else {
    lats = [...new Set(frame.cells.map((c) => c.lat))].sort((a, b) => a - b); lons = [...new Set(frame.cells.map((c) => c.lon))].sort((a, b) => a - b); W = lons.length; H = lats.length;
    if (W < 2 || H < 2) return null;
    val = new Float32Array(W * H).fill(NaN); u = new Float32Array(W * H).fill(NaN); v = new Float32Array(W * H).fill(NaN);
    for (const c of frame.cells) {
      const k = lats.indexOf(c.lat) * W + lons.indexOf(c.lon);
      if (c.value !== null) val[k] = c.value;
      if (c.direction !== null) {
        // Direction is "from"; particles travel toward direction + 180°.
        const mag = wind ? c.speed ?? 0 : 1, th = (c.direction * Math.PI) / 180;
        u[k] = -Math.sin(th) * mag; v[k] = -Math.cos(th) * mag;
      }
    }
  }
  if (W < 2 || H < 2) return null;
  const real = Uint8Array.from(val, (x) => (Number.isNaN(x) ? 0 : 1));
  let filled = 0;
  for (const arr of [val, u, v]) {
    for (let pass = 0; pass < mapConfig.fill.coastCells; pass++) { // capped: the fill reaches the shoreline, not the interior (Stage 2a)
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
  return {lats, lons, val, u, v, unit: frame.unit, filled, real, wrap: frame.global ?? frame.resolution >= 2, layer: layerOfFrame(frame), validAt: frame.validAt, source: frame.provider}; // coarse frames are global and wrap at the date line
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
  const nest = fields[0];
  if (fields.length > 1 && nest && !nest.wrap) { // the regional nest is blended into the global grid over a few cells inside its own boundary: no rectangle (Stage 2a)
    const r = sample(nest, nest[k], lat, lon); let g = NaN; for (const f of fields.slice(1)) { g = sample(f, f[k], lat, lon); if (!Number.isNaN(g)) break; }
    if (Number.isNaN(r)) return g; if (Number.isNaN(g)) return r;
    return g + (r - g) * nestWeight(nest, lat, lon);
  }
  for (const f of fields) { const v = sample(f, f[k], lat, lon); if (!Number.isNaN(v)) return v; }
  return NaN;
}
/** 0 at the nest's boundary rising smoothly (smoothstep) to 1 `nestFeatherDeg` inside it. */
export function nestWeight(f: Pick<Field, 'lats' | 'lons'>, lat: number, lon: number, featherDeg: number = mapConfig.fill.nestFeatherDeg): number {
  const d = Math.min(lat - f.lats[0], f.lats[f.lats.length - 1] - lat, lon - f.lons[0], f.lons[f.lons.length - 1] - lon), t = Math.max(0, Math.min(1, d / featherDeg));
  return t * t * (3 - 2 * t);
}
/** The point value behind a tap label (T-117 API). */
export interface PointValue {value: number | null; unit: 'm' | 's' | 'm/s'; dirFrom: number | null; layer: FieldLayer; validAt: string; source: string}
/** Samples the field exactly as the map paints it (same grids, same bilinear interpolation, same enclosed-water rule), so the label equals the colour under the pin. Null on land or enclosed water or outside the grid.
 *  Land: the wave grid is filled to the shore for display and trimmed by the coastline, so a point is "land" when the caller's land test says so (`isLand`), e.g. the coast polygons; this module stays geometry-free. */
export function sampleField(fields: Field[], lat: number, lon: number, isLand?: (lat: number, lon: number) => boolean): PointValue | null {
  if (!fields.length || isLand?.(lat, lon)) return null;
  const value = sampleAll(fields, 'val', lat, lon); if (Number.isNaN(value)) return null;
  const f = fields.find((x) => !Number.isNaN(sample(x, x.val, lat, lon))) ?? fields[0];
  if (!isRealCell(f, lat, lon)) return null; // inside the coastal fill: painted for the eye, but no model reading there
  const blended = fields.length > 1 && f === fields[0] && !f.wrap && nestWeight(f, lat, lon) < 1;
  const u = sampleAll(fields, 'u', lat, lon), v = sampleAll(fields, 'v', lat, lon), dirFrom = Number.isNaN(u) || Number.isNaN(v) || (u === 0 && v === 0) ? null : ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
  return {value, unit: f.unit === 'deg' ? 'm' : f.unit, dirFrom, layer: f.layer, validAt: f.validAt, source: blended ? `${f.source} (blended into the global grid near the nest edge)` : f.source};
}
/** True when the nearest grid cell holds a real model value (not one the coastal fill painted). */
export function isRealCell(f: Field, lat: number, lon: number): boolean {
  const W = f.lons.length, dLon = (f.lons[W - 1] - f.lons[0]) / (W - 1), dLat = (f.lats[f.lats.length - 1] - f.lats[0]) / (f.lats.length - 1);
  const dx = f.wrap ? (((lon - f.lons[0]) % 360) + 360) % 360 : lon - f.lons[0]; let x = Math.round(dx / dLon); if (f.wrap) x %= W; x = Math.max(0, Math.min(W - 1, x));
  const y = Math.max(0, Math.min(f.lats.length - 1, Math.round((lat - f.lats[0]) / dLat)));
  return f.real[y * W + x] === 1;
}

import type {SpatialFrame} from './spatial.ts';
import {isEnclosedWater} from './enclosed.ts';
import {mapConfig} from './mapConfig.ts';

// Field data (T-117): the gridded sea-state field the map paints, and the SAME sampling the point label uses. Pure (no Leaflet), so it is unit-tested.
/** A regular lat/lon grid built from the provider's cells. Land cells (null) are filled from their nearest
 * sea neighbours so the field reaches the coastline; the land mask then trims it. Display only, never a reading. */
export type FieldLayer = 'WAVES' | 'SWELL' | 'WIND' | 'PERIOD';
export interface Field {/** swell height: an exact 0 = "no swell partition: wind sea only" (WW3 and GFS-Wave leave the partition empty where the sea is all wind sea) */ noPartition?: boolean; lats: number[]; lons: number[]; val: Float32Array; u: Float32Array; v: Float32Array; unit: SpatialFrame['unit']; filled: number; /** 1 where the cell has a real model value; 0 where it was empty and the coastal fill painted it (display only, never a reading) */ real: Uint8Array; wrap: boolean; layer: FieldLayer; validAt: string; source: string}
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
  return {lats, lons, val, u, v, unit: frame.unit, noPartition: frame.noPartition, filled, real, wrap: frame.global ?? frame.resolution >= 2, layer: layerOfFrame(frame), validAt: frame.validAt, source: frame.provider}; // coarse frames are global and wrap at the date line
}

/** Catmull-Rom weights for the four samples at offsets -1, 0, 1, 2 around a cell, at fraction t of the cell (map-smooth). Interpolating (the value at a grid node IS the model value) and C1 (no creases on the grid lines). */
export const catmullRom = (t: number): [number, number, number, number] => { const t2 = t * t, t3 = t2 * t; return [0.5 * (-t3 + 2 * t2 - t), 0.5 * (3 * t3 - 5 * t2 + 2), 0.5 * (-3 * t3 + 4 * t2 + t), 0.5 * (t3 - t2)]; };
/** The ONE field kernel (map-smooth, 2026-11-06), shared with the GL shader (glCommon.ts `samp`): bicubic Catmull-Rom over the 4x4 cells around the point.
 *  - Coverage = the bilinear weight of the VALID corners of the cell the point is in (1 inside the field, falling smoothly to 0 over the last cell); no valid corner: NaN.
 *  - A missing sample in the 4x4 stencil takes the cell's renormalised bilinear value, so an edge never pulls the colour towards zero.
 *  - The result is clamped to the range of the valid stencil samples, so the cubic never overshoots (no negative height, no ring of invented values).
 *  `valid` is optional: by default a sample is valid when it is not NaN. Inside the field (all corners valid) the GL colour and this value are the same function. */
export function sampleSmooth(f: Pick<Field, 'lats' | 'lons' | 'wrap'>, arr: Float32Array, lat: number, lon: number, valid?: Uint8Array): {v: number; cov: number} {
  const {lats, lons} = f, W = lons.length, H = lats.length, dLon = (lons[W - 1] - lons[0]) / (W - 1);
  if (f.wrap) lon = ((((lon - lons[0]) % 360) + 360) % 360) + lons[0];
  if (!(lat >= lats[0] && lat <= lats[H - 1] && lon >= lons[0] && (f.wrap || lon <= lons[W - 1]))) return {v: NaN, cov: 0};
  const gx = (lon - lons[0]) / dLon, gy = ((lat - lats[0]) / (lats[H - 1] - lats[0])) * (H - 1);
  const ix = f.wrap ? Math.floor(gx) : Math.min(W - 2, Math.floor(gx)), iy = Math.min(H - 2, Math.floor(gy)), fx = gx - ix, fy = gy - iy;
  const col = (x: number) => (f.wrap ? ((x % W) + W) % W : Math.max(0, Math.min(W - 1, x))), row = (y: number) => Math.max(0, Math.min(H - 1, y));
  const ok = (k: number) => !Number.isNaN(arr[k]) && (!valid || valid[k] === 1);
  const c0 = row(iy) * W, c1 = row(iy + 1) * W, x0 = col(ix), x1 = col(ix + 1), inner = [c0 + x0, c0 + x1, c1 + x0, c1 + x1], bw = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  let cov = 0, bs = 0; for (let i = 0; i < 4; i++) if (ok(inner[i])) { cov += bw[i]; bs += bw[i] * arr[inner[i]]; }
  if (cov <= 0.02) return {v: NaN, cov: 0};
  const B = bs / cov, wx = catmullRom(fx), wy = catmullRom(fy);
  let s = 0, lo = Infinity, hi = -Infinity;
  for (let j = 0; j < 4; j++) { const r = row(iy - 1 + j) * W; for (let i = 0; i < 4; i++) { const k = r + col(ix - 1 + i); let v = B; if (ok(k)) { v = arr[k]; if (v < lo) lo = v; if (v > hi) hi = v; } s += wx[i] * wy[j] * v; } }
  return {v: Math.max(lo, Math.min(hi, s)), cov};
}
/** The strict sample the pin label reads: the shared kernel, but NaN unless all four corners of the cell are valid (no value is read off a coverage fade). NaN outside the grid. */
export function sample(f: Pick<Field, 'lats' | 'lons' | 'wrap'>, arr: Float32Array, lat: number, lon: number) {
  const s = sampleSmooth(f, arr, lat, lon); return s.cov >= 1 - 1e-6 ? s.v : NaN;
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
/** For PAINTING only (the pin label keeps the strict `sample`): the shared kernel with its soft coverage (1 inside the field, falling smoothly to 0 over the last cell, so a coverage edge is smooth instead of a stair of grid squares).
 *  Every value cell is painted, the two-cell coastal fill included (map-smooth): the fill runs under the land, the land and coastline draw over it, so the colour reaches the shoreline. Inside the field it equals `sample`. */
export function sampleSoft(f: Field, lat: number, lon: number): {v: number; cov: number} { return sampleSmooth(f, f.val, lat, lon); }
/** `sampleAll` for painting: the regional nest feathered into the global grid, each with soft coverage. */
export function sampleAllSoft(fields: Field[], lat: number, lon: number): {v: number; cov: number} {
  if (isEnclosedWater(lat, lon)) return {v: NaN, cov: 0};
  const nest = fields[0];
  if (fields.length > 1 && nest && !nest.wrap) { const r = sampleSoft(nest, lat, lon); let g = {v: NaN, cov: 0}; for (const f of fields.slice(1)) { g = sampleSoft(f, lat, lon); if (g.cov > 0) break; } if (r.cov <= 0) return g; if (g.cov <= 0) return r; const w = nestWeight(nest, lat, lon); return {v: g.v + (r.v - g.v) * w, cov: g.cov + (r.cov - g.cov) * w}; }
  for (const f of fields) { const s = sampleSoft(f, lat, lon); if (s.cov > 0) return s; }
  return {v: NaN, cov: 0};
}
export const coverageAlpha = (cov: number) => { const t = Math.max(0, Math.min(1, (cov - 0.35) / 0.5)); return t * t * (3 - 2 * t); };
/** 0 at the nest's boundary rising smoothly (smoothstep) to 1 `nestFeatherDeg` inside it. */
export function nestWeight(f: Pick<Field, 'lats' | 'lons'>, lat: number, lon: number, featherDeg: number = mapConfig.fill.nestFeatherDeg): number {
  const d = Math.min(lat - f.lats[0], f.lats[f.lats.length - 1] - lat, lon - f.lons[0], f.lons[f.lons.length - 1] - lon), t = Math.max(0, Math.min(1, d / featherDeg));
  return t * t * (3 - 2 * t);
}
/** The point value behind a tap label (T-117 API). */
export const NO_SWELL_NOTE = 'no swell partition: wind sea only';
export interface PointValue {/** set where the value is not a measurement of calm: see NO_SWELL_NOTE */ note?: string; value: number | null; unit: 'm' | 's' | 'm/s'; dirFrom: number | null; layer: FieldLayer; validAt: string; source: string}
/** Samples the field exactly as the map paints it (same grids, same bilinear interpolation, same enclosed-water rule), so the label equals the colour under the pin. Null on land or enclosed water or outside the grid.
 *  Land: the wave grid is filled to the shore for display and trimmed by the coastline, so a point is "land" when the caller's land test says so (`isLand`), e.g. the coast polygons; this module stays geometry-free. */
export function sampleField(fields: Field[], lat: number, lon: number, isLand?: (lat: number, lon: number) => boolean): PointValue | null {
  if (!fields.length || isLand?.(lat, lon)) return null;
  const value = sampleAll(fields, 'val', lat, lon); if (Number.isNaN(value)) return null;
  const f = fields.find((x) => !Number.isNaN(sample(x, x.val, lat, lon))) ?? fields[0];
  if (!isRealCell(f, lat, lon)) return null; // inside the coastal fill: painted for the eye, but no model reading there
  const blended = fields.length > 1 && f === fields[0] && !f.wrap && nestWeight(f, lat, lon) < 1;
  const u = sampleAll(fields, 'u', lat, lon), v = sampleAll(fields, 'v', lat, lon), dirFrom = Number.isNaN(u) || Number.isNaN(v) || (u === 0 && v === 0) ? null : ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
  return {...(f.noPartition && value === 0 ? {note: NO_SWELL_NOTE} : {}), value, unit: f.unit === 'deg' ? 'm' : f.unit, dirFrom, layer: f.layer, validAt: f.validAt, source: blended ? `${f.source} (blended into the global grid near the nest edge)` : f.source};
}
/** True when the nearest grid cell holds a real model value (not one the coastal fill painted). */
export function isRealCell(f: Field, lat: number, lon: number): boolean {
  const W = f.lons.length, dLon = (f.lons[W - 1] - f.lons[0]) / (W - 1), dLat = (f.lats[f.lats.length - 1] - f.lats[0]) / (f.lats.length - 1);
  const dx = f.wrap ? (((lon - f.lons[0]) % 360) + 360) % 360 : lon - f.lons[0]; let x = Math.round(dx / dLon); if (f.wrap) x %= W; x = Math.max(0, Math.min(W - 1, x));
  const y = Math.max(0, Math.min(f.lats.length - 1, Math.round((lat - f.lats[0]) / dLat)));
  return f.real[y * W + x] === 1;
}

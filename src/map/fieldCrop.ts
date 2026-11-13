// sea-field (B8): the colour pass uploads only the part of a global grid the view needs. A 0.25° world grid is a 4 MB texture; re-uploading it on every hour of a scrub
// blocked the main thread whenever the GPU was busy. The shader keeps its original index math over the FULL grid (so every value it reads is bit-identical) and only shifts
// the texel address by the crop's origin (glCommon.ts sampV). Pure, so the "every texel the view reads is inside the crop" rule is tested (src/tests/sea-field.test.ts).
export interface Crop {/** first column (0..W-1; the crop wraps past the date line) */ c0: number; /** first row */ r0: number; /** width and height in cells; 0 = the whole grid, uncropped */ cw: number; ch: number}
export interface ViewBox {lonW: number; lonE: number; latS: number; latN: number}
export interface GridGeo {lat0: number; dlat: number; lon0: number; dlon: number; W: number; H: number; wrap: boolean}
export const FULL: Crop = {c0: 0, r0: 0, cw: 0, ch: 0};
/** Cropping pays only for large wrapping grids; a regional nest (not wrapping, small, and feathered by its own bounds) is always uploaded whole. */
const MIN_CELLS = 65_536, MARGIN = 4;
/** The cells the shader reads for a view, plus `padFrac` of the view on every side and a margin of MARGIN cells (the 4x4 stencil reaches 2 cells out; the rest absorbs float rounding). */
export function cropFor(g: GridGeo, v: ViewBox, padFrac: number): Crop {
  if (!g.wrap || g.W * g.H < MIN_CELLS) return FULL;
  const span = v.lonE - v.lonW, padLon = span * padFrac + MARGIN * g.dlon, padLat = (v.latN - v.latS) * padFrac + MARGIN * g.dlat;
  if (!(span >= 0) || span + 2 * padLon >= 360 * 0.8) return FULL; // (almost) the whole world in view
  const west = v.lonW - padLon, gx = (((west - g.lon0) % 360) + 360) % 360 / g.dlon, c0 = Math.floor(gx) - 2, cw = Math.ceil((span + 2 * padLon) / g.dlon) + 6;
  if (cw >= g.W) return FULL;
  const gyS = (v.latS - padLat - g.lat0) / g.dlat, gyN = (v.latN + padLat - g.lat0) / g.dlat;
  const r0 = Math.max(0, Math.min(g.H - 1, Math.floor(gyS) - 2)), r1 = Math.min(g.H - 1, Math.max(0, Math.floor(gyN) + 3));
  if (r1 - r0 + 1 >= g.H || r1 < r0) return r1 < r0 ? FULL : {c0: ((c0 % g.W) + g.W) % g.W, r0: 0, cw, ch: g.H};
  return {c0: ((c0 % g.W) + g.W) % g.W, r0, cw, ch: r1 - r0 + 1};
}
/** True when crop `a` holds every cell of crop `b` (both of the same grid). */
export function covers(a: Crop, b: Crop, W: number): boolean {
  if (!a.cw) return true; if (!b.cw) return false;
  const dx = (((b.c0 - a.c0) % W) + W) % W;
  return dx + b.cw <= a.cw && b.r0 >= a.r0 && b.r0 + b.ch <= a.r0 + a.ch;
}
/** The crop's values, empty cells as -1e30 (the value texture's "no value"), rows from r0, columns from c0 wrapping at W. */
export function cropValues(val: Float32Array, W: number, H: number, c: Crop): Float32Array {
  if (!c.cw) { const out = new Float32Array(W * H); for (let k = 0; k < W * H; k++) out[k] = Number.isNaN(val[k]) ? -1e30 : val[k]; return out; }
  const out = new Float32Array(c.cw * c.ch);
  for (let r = 0; r < c.ch; r++) { const row = (c.r0 + r) * W; for (let i = 0; i < c.cw; i++) { const x = val[row + ((c.c0 + i) % W)]; out[r * c.cw + i] = Number.isNaN(x) ? -1e30 : x; } }
  return out;
}

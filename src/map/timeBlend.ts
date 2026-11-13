// Timeline interpolation (Windy P1): the model steps are 3-hourly, the scrubber is hourly. Between two steps the map shows a LINEAR BLEND of the two frames by the fractional hour (values by weight, directions as vectors),
// never a held frame that jumps every third hour. The blended frame says so in its source text; it is a display interpolation, not a model output.
import type {GridData} from './spatial.ts';

export const STEP_MS = 10_800_000;
/** The 3-hourly steps around a time and the fraction between them (0 = exactly the first step). */
export function bracket(timeMs: number): {t0: number; t1: number; f: number} { const t0 = Math.floor(timeMs / STEP_MS) * STEP_MS; return {t0, t1: t0 + STEP_MS, f: (timeMs - t0) / STEP_MS}; }

/** Blends two grids of the same shape. NaN on one side takes the other side's value (coverage is the union); NaN on both stays NaN. Directions (degrees FROM) are blended through their unit vectors, so 350 and 10 give 0, never 180. */
export function blendGrids(a: GridData, b: GridData, f: number): GridData {
  if (a.nlat !== b.nlat || a.nlon !== b.nlon || f <= 0) return a; if (f >= 1) return b;
  const n = a.val.length, val = new Float32Array(n), w0 = 1 - f;
  for (let k = 0; k < n; k++) { const x = a.val[k], y = b.val[k]; val[k] = Number.isNaN(x) ? y : Number.isNaN(y) ? x : x * w0 + y * f; }
  const out: GridData = {...a, val, dir: null};
  // sea-field (B8): the directions feed only the flow vectors, which are built on first read (fieldData.ts), so they are blended on first read too, not on every hour of a scrub. Same numbers.
  if (a.dir && b.dir) { const ad = a.dir, bd = b.dir; let dir: Float32Array | null = null; Object.defineProperty(out, 'dir', {get: () => (dir ??= blendDirs(ad, bd, f)), enumerable: true, configurable: true}); }
  return out;
}
function blendDirs(ad: Float32Array, bd: Float32Array, f: number): Float32Array {
  const n = ad.length, dir = new Float32Array(n), w0 = 1 - f;
  for (let k = 0; k < n; k++) {
    const x = ad[k], y = bd[k]; if (Number.isNaN(x) || Number.isNaN(y)) { dir[k] = Number.isNaN(x) ? y : x; continue; }
    const rx = (x * Math.PI) / 180, ry = (y * Math.PI) / 180, sx = Math.sin(rx) * w0 + Math.sin(ry) * f, cx = Math.cos(rx) * w0 + Math.cos(ry) * f;
    dir[k] = Math.hypot(sx, cx) < 1e-6 ? x : ((Math.atan2(sx, cx) * 180) / Math.PI + 360) % 360;
  }
  return dir;
}

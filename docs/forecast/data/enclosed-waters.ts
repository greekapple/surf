// T-092: which WATER points on the map are enclosed (bays, harbours, estuaries), where a 0.25 to 0.5 degree wave-model grid is not meaningful, so the sea-state raster must not paint them.
// Method (no hand-drawn polygons), on the repo's Natural Earth 10m coastline (src/map/coast.json, public domain), 0.01 degree grid:
//   1. land = even-odd inside the coastline rings; d = distance from each water cell to the nearest land (exact Euclidean distance transform, km).
//   2. OPEN CORE = water cells with d >= R_OPEN (3 km) connected, through such cells only, to the open Pacific (the western edge of the grid). Channels narrower than about 2 R_OPEN (the Golden Gate, harbour mouths, estuary mouths)
//      cannot carry the core, so bays behind them are disconnected from it.
//   3. OPEN = every water cell within R_DILATE (3.6 km) of the open core (so the coastal fringe of the open sea stays open).
//   4. ENCLOSED = water that is not OPEN.
// R_OPEN and R_DILATE are heuristics (about the width of the narrowest strait we want to count as a closed mouth, and the width of the coastal fringe); src/tests/enclosed-waters.test.ts pins named cases both ways
// (SF Bay, Richardson Bay and Tomales Bay enclosed; the open coast, Monterey Bay and Santa Monica Bay not).
// Output: src/map/enclosed-waters.json (run-length rows), read by src/map/enclosed.ts. Run: node --experimental-strip-types docs/forecast/data/enclosed-waters.ts
import fs from 'node:fs';
const coast = JSON.parse(fs.readFileSync(new URL('../../../src/map/coast.json', import.meta.url), 'utf8')) as {rings: [number, number][][]};
export const GRID = {lon0: -124.8, lat0: 31.8, step: 0.01, w: 0, h: 0};
GRID.w = Math.round((-114.4 - GRID.lon0) / GRID.step); GRID.h = Math.round((43.6 - GRID.lat0) / GRID.step);
const R_OPEN = 3, R_DILATE = 3.6, KX = Math.cos((37 * Math.PI) / 180) * 111.19, KY = 111.19, W = GRID.w, H = GRID.h;
const segs: [number, number, number, number][] = []; for (const r of coast.rings) for (let i = 1; i < r.length; i++) segs.push([r[i - 1][0], r[i - 1][1], r[i][0], r[i][1]]);
function landGrid() { // scanline even-odd: for each row, x-crossings of all segments, sorted
  const land = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) {
    const lat = GRID.lat0 + (j + 0.5) * GRID.step, xs: number[] = [];
    for (const [x1, y1, x2, y2] of segs) if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) { const i0 = Math.max(0, Math.ceil((xs[k] - GRID.lon0) / GRID.step - 0.5)), i1 = Math.min(W - 1, Math.floor((xs[k + 1] - GRID.lon0) / GRID.step - 0.5)); for (let i = i0; i <= i1; i++) land[j * W + i] = 1; }
  }
  return land;
}
/** Exact squared Euclidean distance transform (Felzenszwalb and Huttenlocher), in km^2, to the nearest cell where `src` is 1. */
function edt(src: Uint8Array) {
  const INF = 1e12, f = new Float64Array(Math.max(W, H)), v = new Int32Array(Math.max(W, H)), z = new Float64Array(Math.max(W, H) + 1), out = new Float64Array(W * H);
  const pass = (n: number, scale: number, get: (i: number) => number, put: (i: number, d: number) => void) => {
    let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < n; q++) { let s: number; do { const p = v[k]; s = ((f[q] + (q * scale) ** 2) - (f[p] + (p * scale) ** 2)) / (2 * q * scale - 2 * p * scale); if (s <= z[k]) k--; else break; } while (k >= 0); if (k < 0) { k = 0; v[0] = q; z[0] = -Infinity; z[1] = Infinity; continue; } k++; v[k] = q; z[k] = s; z[k + 1] = Infinity; }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q * scale) k++; put(q, (q * scale - v[k] * scale) ** 2 + f[v[k]]); }
  };
  const col = new Float64Array(W * H);
  for (let i = 0; i < W; i++) { for (let j = 0; j < H; j++) f[j] = src[j * W + i] ? 0 : INF; pass(H, KY * GRID.step, (j) => f[j], (j, d) => { col[j * W + i] = d; }); }
  for (let j = 0; j < H; j++) { for (let i = 0; i < W; i++) f[i] = col[j * W + i]; pass(W, KX * GRID.step, (i) => f[i], (i, d) => { out[j * W + i] = d; }); }
  return out;
}
export function build() {
  const land = landGrid(), dLand = edt(land), nCore = R_OPEN * R_OPEN, core = new Uint8Array(W * H);
  // flood the open core from the open Pacific: water cells at the western edge with d >= R_OPEN
  const stack: number[] = []; for (let j = 0; j < H; j++) { const k = j * W; if (!land[k] && dLand[k] >= nCore) { core[k] = 1; stack.push(k); } }
  while (stack.length) { const k = stack.pop()!, i = k % W, j = (k / W) | 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const n = jj * W + ii; if (!core[n] && !land[n] && dLand[n] >= nCore) { core[n] = 1; stack.push(n); } } }
  const dCore = edt(core), nDil = R_DILATE * R_DILATE, rows: number[][] = []; let cells = 0, enc0 = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const lon = GRID.lon0 + (i + 0.5) * GRID.step; if (!land[j * W + i] && dCore[j * W + i] > nDil && lon > -124.7 && lon < -115.4) enc0[j * W + i] = 1; }
  // grow the enclosed set by one cell (about 1 km) over the shoreline: shore cells that are land on this grid but water on the screen would otherwise keep a thin line of colour (land cells are trimmed by the land mask anyway)
  const enc = new Uint8Array(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { if (!enc0[j * W + i]) continue; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < W && jj < H) enc[jj * W + ii] = 1; } }
  for (let j = 0; j < H; j++) {
    const runs: number[] = []; let start = -1;
    for (let i = 0; i <= W; i++) { const e = i < W && enc[j * W + i] === 1; if (e) cells++; if (e && start < 0) start = i; if (!e && start >= 0) { runs.push(start, i - start); start = -1; } }
    rows.push(runs);
  }
  return {rows, cells};
}
if (process.argv[1]?.endsWith('enclosed-waters.ts')) {
  const {rows, cells} = build();
  fs.writeFileSync(new URL('../../../src/map/enclosed-waters.json', import.meta.url), JSON.stringify({source: 'Natural Earth 10m land v5.1.2 (src/map/coast.json); docs/forecast/data/enclosed-waters.ts', rule: `water not within ${R_DILATE} km of the open core (water cells at least ${R_OPEN} km from land, connected to the open Pacific)`, ...GRID, rows}));
  console.log(`enclosed water cells: ${cells} of ${W * H} (about ${(cells * 0.01 * 0.01 * KX * KY).toFixed(0)} km2)`);
}

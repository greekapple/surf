import test from 'node:test';
import assert from 'node:assert/strict';
import {buildField, fillCoast} from '../map/fieldData.ts';
import {mapConfig} from '../map/mapConfig.ts';
import {cropFor, covers, cropValues, FULL, type GridGeo, type ViewBox} from '../map/fieldCrop.ts';
import type {SpatialFrame, GridData} from '../map/spatial.ts';

// sea-field (B8): the coastal fill visits only the empty cells. The colours at rest must be pixel-identical, so the field must be BIT-identical to the original whole-grid fill (kept here as the reference).
function fillReference(arr: Float32Array, W: number, H: number, passes: number): number {
  let filled = 0;
  for (let pass = 0; pass < passes; pass++) {
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
    arr.set(next); filled += changed;
    if (!changed) break;
  }
  return filled;
}
// a seeded random sea with land blobs, so every case is the same on every run
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
function sea(W: number, H: number, seed: number, landShare: number): Float32Array {
  const r = rng(seed), a = new Float32Array(W * H);
  for (let k = 0; k < a.length; k++) a[k] = r() * 7 + 0.1;
  for (let b = 0; b < Math.round(W * H * landShare / 12); b++) { const cx = Math.floor(r() * W), cy = Math.floor(r() * H), rad = 1 + Math.floor(r() * 5); for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) if (x >= 0 && y >= 0 && x < W && y < H) a[y * W + x] = NaN; }
  return a;
}
const sameBits = (a: Float32Array, b: Float32Array) => { const x = new Uint32Array(a.buffer, a.byteOffset, a.length), y = new Uint32Array(b.buffer, b.byteOffset, b.length); for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return k; return -1; };

test('the sparse coastal fill is bit-identical to the whole-grid fill (values, NaNs and the filled count), on many random coasts', () => {
  for (const [W, H, share] of [[40, 30, 0.2], [97, 61, 0.5], [12, 9, 0.9], [200, 120, 0.35], [5, 3, 0], [8, 8, 1]] as const) for (let seed = 1; seed <= 6; seed++) {
    const a = sea(W, H, seed * 7919 + W, share), b = a.slice();
    for (const passes of [1, mapConfig.fill.coastCells, 4]) {
      const a2 = a.slice(), b2 = b.slice();
      assert.equal(fillCoast(a2, W, H, passes), fillReference(b2, W, H, passes), `filled count ${W}x${H} seed ${seed} passes ${passes}`);
      assert.equal(sameBits(a2, b2), -1, `same bits ${W}x${H} seed ${seed} passes ${passes}`);
    }
  }
});
test('an all-empty grid stays empty and fills nothing (no neighbour to average)', () => {
  const a = new Float32Array(20).fill(NaN); assert.equal(fillCoast(a, 5, 4, 2), 0); assert.ok(a.every(Number.isNaN));
});
test('buildField on a gridded frame equals the reference fill for val, u and v', () => {
  const W = 60, H = 40, val = sea(W, H, 42, 0.4), r = rng(5), dir = Float32Array.from(val, (v) => (Number.isNaN(v) ? NaN : r() * 360));
  const g: GridData = {lat0: 30, dlat: 0.5, nlat: H, lon0: 200, dlon: 0.5, nlon: W, val, dir};
  const frame: SpatialFrame = {cells: [], grid: g, validAt: '2026-11-13T03:00:00Z', retrievedAt: 'x', provider: 'WW3', url: 'x', unit: 'm', resolution: 0.5, variable: 'Thgt'};
  for (const wind of [false, true]) {
    const f = buildField(frame, wind)!;
    // the reference: the same unfilled arrays the builder starts from, filled the old way
    const v0 = Float32Array.from(val), u0 = new Float32Array(W * H).fill(NaN), w0 = new Float32Array(W * H).fill(NaN);
    for (let k = 0; k < W * H; k++) { const d = dir[k]; if (Number.isNaN(d)) { if (wind && !Number.isNaN(val[k])) { u0[k] = 0; w0[k] = 0; } continue; } const th = (d * Math.PI) / 180, mag = wind ? val[k] : 1; u0[k] = -Math.sin(th) * mag; w0[k] = -Math.cos(th) * mag; }
    const filled = fillReference(v0, W, H, mapConfig.fill.coastCells); fillReference(u0, W, H, mapConfig.fill.coastCells); fillReference(w0, W, H, mapConfig.fill.coastCells);
    assert.equal(sameBits(f.val, v0), -1); assert.equal(sameBits(f.u, u0), -1); assert.equal(sameBits(f.v, w0), -1); assert.equal(f.filled, filled);
  }
});
test('a cached fill plan (same land mask, new hour) still gives the reference bits; a changed mask gets its own plan', () => {
  const W = 50, H = 30, base = sea(W, H, 99, 0.4);
  for (let hour = 0; hour < 4; hour++) {
    const a = Float32Array.from(base, (v, k) => (Number.isNaN(v) ? NaN : v * (1 + hour * 0.13) + (k % 7) * 0.01)), b = a.slice();
    if (hour === 3) { a[W * 10 + 10] = NaN; b[W * 10 + 10] = NaN; } // one more empty cell: a different mask
    assert.equal(fillCoast(a, W, H, 2), fillReference(b, W, H, 2)); assert.equal(sameBits(a, b), -1, `hour ${hour}`);
  }
});

// The colour shader's own index math (glCommon.ts sampV) for one point, in float32 like the GPU: the 4x4 texels it fetches, as full-grid (column, row).
const f32 = Math.fround;
function texelsOf(g: GridGeo, lat: number, lon: number): [number, number][] | null {
  const latN = f32(g.lat0 + f32(g.dlat * (g.H - 1))); if (lat < g.lat0 || lat > latN) return null;
  if (g.wrap) lon = f32(f32(f32(f32(lon - g.lon0) % 360 + 360) % 360) + g.lon0);
  const gx = f32(f32(lon - g.lon0) / g.dlon), gy = f32(f32(lat - g.lat0) / g.dlat);
  const ix = g.wrap ? Math.floor(gx) : Math.min(g.W - 2, Math.floor(gx)), iy = Math.min(g.H - 2, Math.floor(gy)), out: [number, number][] = [];
  for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) { const x = ix + i; out.push([g.wrap ? ((x % g.W) + g.W) % g.W : Math.max(0, Math.min(g.W - 1, x)), Math.max(0, Math.min(g.H - 1, iy + j))]); }
  return out;
}
const world: GridGeo = {lat0: -90, dlat: 0.25, lon0: 0, dlon: 0.25, W: 1440, H: 721, wrap: true};
test('the value-texture crop holds every texel the colour pass reads anywhere in the view (random views, both sides of the date line, poles, every zoom)', () => {
  const r = rng(2026);
  for (let n = 0; n < 400; n++) {
    const span = 0.3 + r() ** 2 * 250, cLon = -200 + r() * 400, cLat = -85 + r() * 170, h = span * (0.4 + r() * 0.5);
    const view: ViewBox = {lonW: cLon - span / 2, lonE: cLon + span / 2, latS: Math.max(-85, cLat - h / 2), latN: Math.min(85, cLat + h / 2)};
    for (const pad of [0, 0.25]) {
      const c = cropFor(world, view, pad); if (!c.cw) continue;
      for (let a = 0; a <= 30; a++) for (let b = 0; b <= 30; b++) {
        const lat = f32(view.latS + (view.latN - view.latS) * a / 30), lon = f32(view.lonW + (view.lonE - view.lonW) * b / 30);
        for (const [x, y] of texelsOf(world, lat, lon) ?? []) {
          const cx = (x - c.c0 + world.W) % world.W, cy = y - c.r0;
          assert.ok(cx < c.cw && cy >= 0 && cy < c.ch, `view ${JSON.stringify(view)} pad ${pad}: texel ${x},${y} outside crop ${JSON.stringify(c)}`);
        }
      }
    }
  }
});
test('a crop uploads the grid\'s own values (wrapping past the grid\'s seam), and a wider view or a regional nest gets the whole grid', () => {
  const W = 1440, H = 721, val = Float32Array.from({length: W * H}, (_, k) => (k % 97 === 0 ? NaN : (k % 1009) / 100));
  const c = cropFor(world, {lonW: -10, lonE: 20, latS: 10, latN: 30}, 0.25); // the 0..360° grid's seam is at 0°
  assert.ok(c.cw > 0 && c.c0 + c.cw > W, 'this crop crosses the seam'); const out = cropValues(val, W, H, c);
  for (let r = 0; r < c.ch; r++) for (let i = 0; i < c.cw; i++) { const v = val[(c.r0 + r) * W + ((c.c0 + i) % W)]; assert.equal(out[r * c.cw + i], Number.isNaN(v) ? f32(-1e30) : v); }
  assert.deepEqual(cropFor(world, {lonW: -170, lonE: 170, latS: -60, latN: 60}, 0.25), FULL, 'most of the world in view: whole grid');
  assert.deepEqual(cropFor({...world, wrap: false, W: 60, H: 40}, {lonW: 237, lonE: 238, latS: 37, latN: 38}, 0.25), FULL, 'a regional nest is never cropped');
  const full = cropValues(val, W, H, FULL); assert.equal(full.length, W * H); assert.equal(full[0], f32(-1e30)); assert.equal(full[1], val[1]);
  assert.ok(covers(c, cropFor(world, {lonW: -5, lonE: 15, latS: 15, latN: 25}, 0), W), 'a smaller view inside the crop needs no upload');
  assert.ok(!covers(c, cropFor(world, {lonW: 40, lonE: 60, latS: 15, latN: 25}, 0), W), 'a view that left the crop needs a new one');
});

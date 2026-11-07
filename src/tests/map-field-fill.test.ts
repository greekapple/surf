import test from 'node:test';
import assert from 'node:assert/strict';
import {buildField, sampleAll, nestWeight} from '../map/fieldData.ts';
import {decodeOceanGrid} from '../map/spatial.ts';
import {mapConfig} from '../map/mapConfig.ts';
import type {SpatialFrame, GridData} from '../map/spatial.ts';

// Stage 2a: native gridded frames, a coastal fill capped at two cells, the nest feathered into the global grid.
const grid = (nlat: number, nlon: number, f: (y: number, x: number) => number, dir = 270): GridData => ({lat0: 30, dlat: 0.5, nlat, lon0: 200, dlon: 0.5, nlon, val: Float32Array.from({length: nlat * nlon}, (_, k) => f(Math.floor(k / nlon), k % nlon)), dir: Float32Array.from({length: nlat * nlon}, (_, k) => (Number.isNaN(f(Math.floor(k / nlon), k % nlon)) ? NaN : dir))});
const frame = (g: GridData, over: Partial<SpatialFrame> = {}): SpatialFrame => ({cells: [], grid: g, validAt: '2026-11-04T03:00:00Z', retrievedAt: 'x', provider: 'WW3', url: 'x', unit: 'm', resolution: 0.5, variable: 'Thgt', ...over});

test('a gridded frame builds a field straight from the typed arrays (latitude ascending, direction as a "from" bearing)', () => {
  const f = buildField(frame(grid(6, 8, () => 2)), false)!;
  assert.equal(f.lats[0], 30); assert.equal(f.lats[5], 32.5); assert.equal(f.lons[7], 203.5); assert.equal(f.val[10], 2); assert.ok(f.u[10] > 0.99 && Math.abs(f.v[10]) < 1e-6, 'from 270° (west) is travelling east');
  assert.equal(f.layer, 'WAVES'); assert.equal(f.wrap, false); assert.equal(buildField(frame(grid(6, 8, () => 2), {global: true}), false)!.wrap, true);
});
test('the coastal fill is capped at two cells: a model-less cell more than two cells from any ocean value stays EMPTY', () => {
  // ocean on the left 3 columns, 7 columns of "land/ice" (NaN) to the right
  const f = buildField(frame(grid(5, 10, (_, x) => (x < 3 ? 3 : NaN))), false)!;
  assert.equal(mapConfig.fill.coastCells, 2);
  const row = (x: number) => f.val[2 * 10 + x];
  assert.equal(row(2), 3, 'ocean'); assert.ok(Math.abs(row(3) - 3) < 1e-6 && Math.abs(row(4) - 3) < 1e-6, 'the two cells next to the coast are filled from their ocean neighbours');
  assert.ok(Number.isNaN(row(5)) && Number.isNaN(row(9)), 'beyond two cells nothing is painted: no field over land or ice');
  assert.equal(f.filled > 0, true);
});
test('the regional nest is feathered into the global grid: global at its boundary, regional deep inside, continuous between', () => {
  const nest = buildField(frame(grid(21, 21, () => 6)), false)!;              // 10 deg x 10 deg box, value 6
  const world = buildField(frame({...grid(41, 41, () => 2), lat0: 20, lon0: 190}, {global: false, resolution: 2}), false)!; // coarser/wider, value 2 (same units, disagreeing values)
  const lat = 35, atEdge = sampleAll([nest, world], 'val', lat, 200.01), inside = sampleAll([nest, world], 'val', lat, 205);
  assert.ok(Math.abs(atEdge - 2) < 0.3, `at the nest boundary the field equals the global one (${atEdge})`); assert.ok(Math.abs(inside - 6) < 1e-5, `deep inside it is the nest (${inside})`);
  let last = sampleAll([nest, world], 'val', lat, 199.9), maxStep = 0; for (let lon = 200; lon <= 203; lon += 0.05) { const v = sampleAll([nest, world], 'val', lat, lon); maxStep = Math.max(maxStep, Math.abs(v - last)); last = v; }
  assert.ok(maxStep < 0.35, `no step at the boundary: the largest 0.05 degree change is ${maxStep.toFixed(2)} of a 4 unit disagreement`);
  assert.equal(nestWeight(nest, 35, 200), 0); assert.ok(nestWeight(nest, 35, 200.75) > 0.4 && nestWeight(nest, 35, 200.75) < 0.6); assert.equal(nestWeight(nest, 35, 205), 1);
});
test('decodeOceanGrid: packed Int16 to Float32, NaN preserved', () => {
  const q = new Int16Array([1500, -32768, 250]), bin = String.fromCharCode(...new Uint8Array(q.buffer)), g = decodeOceanGrid({lat0: 0, dlat: 0.5, nlat: 1, lon0: 0, dlon: 0.5, nlon: 3, scale: 1000, q: btoa(bin), retrievedAt: 'x', url: 'u'});
  assert.equal(g.values[0], 1.5); assert.ok(Number.isNaN(g.values[1])); assert.equal(g.values[2], 0.25);
  assert.throws(() => decodeOceanGrid({lat0: 0, dlat: 0.5, nlat: 2, lon0: 0, dlon: 0.5, nlon: 3, scale: 1000, q: btoa(bin), retrievedAt: 'x', url: 'u'}));
});
test('a coastal-fill cell gives no pin reading; a real cell does; calm wind has zero flow, not a neighbour\'s', async () => {
  const {sampleField} = await import('../map/fieldData.ts');
  const f = buildField(frame(grid(5, 10, (_, x) => (x < 3 ? 3 : NaN))), false)!;
  assert.equal(sampleField([f], 32, 201.0)?.value, 3, 'a real ocean cell reads');
  assert.equal(sampleField([f], 32, 201.75), null, 'a filled cell (empty in the model) gives no reading');
  const calm = grid(5, 10, (_, x) => (x < 3 ? 0 : NaN)); calm.dir = Float32Array.from(calm.val, () => NaN);
  const w = buildField(frame(calm, {unit: 'm/s', variable: 'ugrd10m'}), true)!; assert.equal(w.u[2 * 10 + 1], 0); assert.equal(w.v[2 * 10 + 1], 0);
});

test('painting is soft at a coverage edge: coverage falls smoothly over the last cell (no 0.5 degree stair), equals the strict sample inside the field', async () => {
  const {sampleSoft, sampleAllSoft, coverageAlpha, sample} = await import('../map/fieldData.ts');
  const f = buildField(frame(grid(5, 12, (_, x) => (x < 6 ? 3 : NaN))), false)!; // ocean 6 columns, then no data
  assert.equal(sampleSoft(f, 32, 200.5).v, sample(f, f.val, 32, 200.5), 'inside: identical to the strict sample'); assert.equal(sampleSoft(f, 32, 200.5).cov, 1);
  const cov = (lon: number) => sampleSoft(f, 32, lon).cov; let last = 2, steps = 0, maxStep = 0; for (let lon = 202.5; lon <= 204.2; lon += 0.02) { const c = cov(lon); if (c > last + 1e-9) assert.fail('coverage must not rise'); if (last !== 2) maxStep = Math.max(maxStep, last - c); last = c; steps += c > 0 && c < 1 ? 1 : 0; }
  assert.ok(steps > 8, `a fade over many samples, not a step (${steps})`); assert.ok(maxStep < 0.15, `largest change per 0.02 deg ${maxStep.toFixed(3)}`); assert.equal(coverageAlpha(1), 1); assert.equal(coverageAlpha(0), 0); assert.ok(coverageAlpha(0.6) > 0.3 && coverageAlpha(0.6) < 0.9);
  assert.equal(sampleAllSoft([f], 37.8, -122.4).cov, 0, 'outside the grid / enclosed: nothing painted');
});

test('map-smooth: the field kernel is bicubic Catmull-Rom: it passes through the model values, has no crease on the grid lines, never overshoots, and the pin reads what is painted', async () => {
  const {sample, sampleSoft, sampleSmooth, sampleField} = await import('../map/fieldData.ts');
  const smooth = buildField(frame(grid(10, 12, (y, x) => 1 + 0.08 * (x - 4) ** 2 + 0.05 * y * x)), false)!; // a curved surface
  for (const [y, x] of [[3, 4], [5, 7], [6, 2]]) assert.ok(Math.abs(sample(smooth, smooth.val, 30 + y * 0.5, 200 + x * 0.5) - smooth.val[y * 12 + x]) < 1e-5, 'at a grid node the value IS the model value');
  // slope on either side of the grid line x = 5 (lon 202.5): bilinear has a kink there (the "diamond" creases); the cubic does not
  const lat = 32.2, h = 0.002, at = (lon: number) => sample(smooth, smooth.val, lat, lon), bil = (lon: number) => { const gx = (lon - 200) / 0.5, x0 = Math.floor(gx), fx = gx - x0, gy = (lat - 30) / 0.5, y0 = Math.floor(gy), fy = gy - y0, v = (yy: number, xx: number) => smooth.val[yy * 12 + xx]; return (v(y0, x0) * (1 - fx) + v(y0, x0 + 1) * fx) * (1 - fy) + (v(y0 + 1, x0) * (1 - fx) + v(y0 + 1, x0 + 1) * fx) * fy; };
  const kink = (f: (l: number) => number) => Math.abs((f(202.5 + h) - f(202.5)) / h - (f(202.5) - f(202.5 - h)) / h);
  assert.ok(kink(at) < 0.02, `cubic: slope continuous across the grid line (jump ${kink(at).toFixed(4)})`); assert.ok(kink(bil) > 0.05, `bilinear reference has the crease (jump ${kink(bil).toFixed(4)})`);
  // a sharp front (0 to 10): Catmull-Rom alone would ring below 0 and above 10; the clamp keeps every value inside the data's range
  const step = buildField(frame(grid(6, 12, (_, x) => (x < 6 ? 0 : 10))), false)!; let lo = Infinity, hi = -Infinity; for (let lon = 200.2; lon < 205.3; lon += 0.01) { const v = sample(step, step.val, 32, lon); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(lo >= 0 && hi <= 10, `no overshoot: ${lo.toFixed(3)}..${hi.toFixed(3)}`);
  // the pin and the painter: same value everywhere inside the field
  for (const [la, lo2] of [[31.3, 201.7], [32.9, 203.1], [33.4, 204.6]]) { const pv = sampleField([smooth], la, lo2)!; assert.equal(pv.value, sampleSoft(smooth, la, lo2).v); assert.equal(pv.value, sampleSmooth(smooth, smooth.val, la, lo2).v); }
});
test('map-smooth: the colour reaches the coast: the two-cell coastal fill is painted at full coverage, the fade happens beyond it (under the land)', async () => {
  const {sampleSoft} = await import('../map/fieldData.ts');
  const f = buildField(frame(grid(5, 12, (_, x) => (x < 4 ? 3 : NaN))), false)!; // sea in columns 0-3; columns 4 and 5 are the coastal fill
  assert.equal(sampleSoft(f, 32, 201.5).cov, 1, 'between the last sea column and the first fill column: full colour (it used to fade here, short of the shore)');
  assert.equal(sampleSoft(f, 32, 202.3).cov, 1, 'inside the fill: full colour');
  assert.ok(sampleSoft(f, 32, 202.75).cov < 1 && sampleSoft(f, 32, 202.75).cov > 0, 'past the fill: the fade'); assert.ok(Number.isNaN(sampleSoft(f, 32, 203.2).v), 'beyond: nothing');
});

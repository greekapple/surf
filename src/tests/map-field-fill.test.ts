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

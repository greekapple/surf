import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePackedPixels, frameAt, packedGroupOf, type PackedManifest} from '../map/packedFrame.ts';
import {buildField} from '../map/fieldData.ts';

// Stage 2b: the packed GFS-Wave frame, as written by tools/map-pipeline/build_frames.py (R,G = 16-bit value, B = direction, row 0 = north).
const grid = {nlon: 4, nlat: 3, lon0: 0, lat0: 90, dlon: 0.25, dlat: -0.25};
const px = (rows: [number, number, number][][]) => Uint8Array.from(rows.flatMap((r) => r.flatMap((p) => [p[0], p[1], p[2]])));
const q = (v: number, scale: number) => { const n = Math.round(v * scale); return [n >> 8, n & 255]; };
test('decodePackedPixels: 16-bit value, direction in 360/255 degree steps, no-data as NaN, latitude flipped to ascending', () => {
  const [a0, a1] = q(2.5, 1000), [b0, b1] = q(10.123, 1000);
  const rows: [number, number, number][][] = [
    [[a0, a1, 128], [255, 255, 255], [0, 0, 0], [a0, a1, 255]],     // north row (lat 90)
    [[b0, b1, 64], [b0, b1, 64], [255, 255, 128], [0, 0, 0]],       // middle
    [[0, 0, 0], [0, 0, 0], [0, 0, 0], [255, 255, 0]],               // south row
  ];
  const g = decodePackedPixels(px(rows), 3, grid, 1000);
  assert.equal(g.nlat, 3); assert.equal(g.dlat, 0.25); assert.equal(g.lat0, 89.5, 'row 0 of the output is the SOUTH edge (north row was at 90 going down 0.25 each)');
  // output row 0 = input south row, output row 2 = input north row
  assert.ok(Number.isNaN(g.val[3]), 'no data in the south-east cell'); assert.equal(g.val[0], 0);
  assert.ok(Math.abs(g.val[2 * 4 + 0] - 2.5) < 1e-6); assert.ok(Math.abs(g.dir![2 * 4 + 0] - (128 * 360) / 255) < 1e-4);
  assert.ok(Math.abs(g.val[1 * 4 + 1] - 10.123) < 1e-3); assert.ok(Number.isNaN(g.dir![2 * 4 + 3]), 'direction 255 = none');
  assert.ok(Number.isNaN(g.val[2 * 4 + 1]), '65535 = no data');
});
test('a packed grid builds a field the painter can use (wrap at the date line, lat ascending)', () => {
  const W = 8, H = 5, rows = Array.from({length: H}, () => Array.from({length: W}, () => [...q(3, 1000), 64] as [number, number, number]));
  const g = decodePackedPixels(px(rows), 3, {nlon: W, nlat: H, lon0: 0, lat0: 1, dlon: 0.25, dlat: -0.25}, 1000);
  const f = buildField({cells: [], grid: g, global: true, validAt: 'x', retrievedAt: 'x', provider: 'GFS-Wave', url: 'x', unit: 'm', resolution: 0.25, variable: 'Thgt'}, false)!;
  assert.ok(f.lats[0] < f.lats[4]); assert.equal(f.wrap, true); assert.ok(Math.abs(f.val[7] - 3) < 1e-6);
});
test('frameAt is exact: a different hour is never shifted onto the requested one; groups map the WW3 names', () => {
  const man = {frames: [{fh: 0, validAt: '2026-11-04T00:00:00Z', files: {waves: 'a'}}, {fh: 3, validAt: '2026-11-04T03:00:00Z', files: {waves: 'b'}}]} as unknown as PackedManifest;
  assert.equal(frameAt(man, '2026-11-04T03:00:00.000Z')?.files.waves, 'b'); assert.equal(frameAt(man, '2026-11-04T04:00:00Z'), null);
  assert.equal(packedGroupOf('Thgt'), 'waves'); assert.equal(packedGroupOf('shgt'), 'swell'); assert.equal(packedGroupOf('ugrd10m'), 'wind'); assert.equal(packedGroupOf('Tdir'), null);
});

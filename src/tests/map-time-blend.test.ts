import test from 'node:test';
import assert from 'node:assert/strict';
import {bracket, blendGrids, STEP_MS} from '../map/timeBlend.ts';
import type {GridData} from '../map/spatial.ts';

const g = (val: number[], dir: number[] | null = null): GridData => ({lat0: 0, dlat: 1, nlat: 1, lon0: 0, dlon: 1, nlon: val.length, val: Float32Array.from(val), dir: dir ? Float32Array.from(dir) : null});
test('bracket: the 3-hourly steps around a time and the fraction between them', () => {
  const t = Date.parse('2026-11-04T07:00:00Z'), b = bracket(t); assert.equal(new Date(b.t0).toISOString(), '2026-11-04T06:00:00.000Z'); assert.equal(new Date(b.t1).toISOString(), '2026-11-04T09:00:00.000Z'); assert.ok(Math.abs(b.f - 1 / 3) < 1e-9);
  assert.equal(bracket(Date.parse('2026-11-04T06:00:00Z')).f, 0); assert.equal(bracket(t).t1 - bracket(t).t0, STEP_MS);
});
test('blendGrids: values by weight, exact at the ends, union where one side is missing', () => {
  const a = g([2, NaN, 4]), b = g([4, 6, NaN]); assert.deepEqual([...blendGrids(a, b, 0.5).val], [3, 6, 4]); assert.equal(blendGrids(a, b, 0), a); assert.equal(blendGrids(a, b, 1), b);
  const x = g([0, 0]), y = g([9, 3]); assert.ok(Math.abs(blendGrids(x, y, 1 / 3).val[0] - 3) < 1e-6 && Math.abs(blendGrids(x, y, 1 / 3).val[1] - 1) < 1e-6);
  assert.equal(blendGrids(g([1]), g([1, 2]), 0.5).val.length, 1, 'different shapes are never blended');
});
test('blendGrids: directions go through unit vectors (350 and 10 meet at 0, not 180), and a half-way blend of 0 and 90 is 45', () => {
  const r = blendGrids(g([1, 1], [350, 0]), g([1, 1], [10, 90]), 0.5).dir!; const d = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b)); assert.ok(d(r[0], 0) < 1e-3, String(r[0])); assert.ok(d(r[1], 45) < 1e-3, String(r[1]));
  assert.ok(Number.isNaN(blendGrids(g([1], [NaN]), g([1], [NaN]), 0.5).dir![0]), 'no direction on either side stays none');
});

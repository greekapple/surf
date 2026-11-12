import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceSpots} from '../ocean/spots.ts';
import {fillQueue, seaboardOf} from '../features/explore/mapFill.ts';
import {computeScope, SCOPE_MAX, SCOPE_FILL_MAX} from '../ocean/spotScope.ts';

const at = (id: string) => { const s = evidenceSpots.find((x) => x.id === id)!; return {lat: s.latitude, lon: s.longitude, region: s.region}; };

test('map-fill queue: the anchor seaboard only, nearest region first, every spot once', () => {
  const q = fillQueue(at('spot-2'), evidenceSpots), ids = q.flat();
  const west = evidenceSpots.filter((s) => seaboardOf(s.region) === 'West Coast');
  assert.equal(ids.length, west.length); assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => seaboardOf(evidenceSpots.find((s) => s.id === id)!.region) === 'West Coast'), 'a West Coast map never queues the East Coast');
  assert.equal(evidenceSpots.find((s) => s.id === q[0][0])!.region, 'San Francisco', 'the anchor region first');
  const regions = q.map((r) => evidenceSpots.find((s) => s.id === r[0])!.region);
  assert.ok(regions.indexOf('San Diego') < regions.indexOf('Sitka'), 'nearer regions first');
  assert.deepEqual(fillQueue(at('spot-2'), evidenceSpots), q, 'deterministic');
  assert.deepEqual(fillQueue({lat: 0, lon: 0, region: 'Nowhere'}, evidenceSpots), [], 'a region outside the grouping queues nothing');
});

test('map-fill scope: the fill goes last, with its own allowance; the rest stays under SCOPE_MAX', () => {
  const fill = fillQueue(at('spot-2'), evidenceSpots).flat();
  const scope = computeScope('spot-2', [], [], [], evidenceSpots, SCOPE_MAX, fill);
  assert.ok(scope.length <= SCOPE_FILL_MAX); assert.equal(scope[0], 'spot-2');
  assert.ok(fill.every((id) => scope.includes(id)), 'the whole West Coast seaboard fits');
  const noFill = computeScope('spot-2', [], [], evidenceSpots.map((s) => s.id), evidenceSpots, SCOPE_MAX);
  assert.equal(noFill.length, SCOPE_MAX, 'without the fill the cap is unchanged');
  const east = fillQueue(at(evidenceSpots.find((s) => seaboardOf(s.region) === 'East Coast')!.id), evidenceSpots).flat();
  assert.ok(east.length > SCOPE_MAX && east.length <= SCOPE_FILL_MAX, `the largest seaboard (${east.length}) fits the fill allowance`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {coastEvidence, COAST_ROWS, nearSanFrancisco} from '../data/coast.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {allSpots} from '../data/catalog.ts';
import {coastServiceSpots, serviceSpots} from '../../services/forecast-service.mjs';

test('service spot list matches the app coast spots exactly (ids and coordinates)', () => {
  assert.deepEqual(coastServiceSpots, coastEvidence.map((e) => ({id: e.id, lat: e.latitude, lon: e.longitude, mlat: e.marineLatitude, mlon: e.marineLongitude})));
  for (const e of evidenceSpots) assert.ok(serviceSpots.some((s: {id: string}) => s.id === e.id), `service has ${e.id}`);
});
test('every live spot has a profile and unique id; coast covers Del Norte to San Diego', () => {
  const ids = evidenceSpots.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(allSpots.some((s) => s.id === id), `profile for ${id}`);
  const lats = COAST_ROWS.map((r) => r[4]);
  assert.ok(Math.max(...lats) > 41.5 && Math.min(...lats) < 32.7);
});
test('marine query points lie seaward of the beach point', () => {
  for (const e of coastEvidence) assert.ok(e.marineLongitude < e.longitude + 0.05, `${e.id} marine point not inland`);
});
test('the San Francisco tide station is only used near the Bay', () => {
  assert.ok(nearSanFrancisco(37.759, -122.51)); // Ocean Beach
  assert.ok(nearSanFrancisco(37.6, -122.5)); // Linda Mar
  assert.ok(!nearSanFrancisco(36.951, -122.026)); // Steamer Lane
  assert.ok(!nearSanFrancisco(32.749, -117.253)); // Ocean Beach San Diego
});

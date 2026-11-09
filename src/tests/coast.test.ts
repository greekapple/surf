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
test('every spot region belongs to a browsing zone (no spot sits under "Other"), and the zone names its state', async () => {
  const {zoneOf, stateOfZone, ZONES} = await import('../data/zones.ts');
  const lost = evidenceSpots.filter((e) => zoneOf(e.region) === 'Other').map((e) => `${e.name} (${e.region})`);
  assert.deepEqual(lost, [], 'spots whose county is in no zone: ' + lost.join(', '));
  assert.equal(stateOfZone(zoneOf('Clatsop')), 'Oregon'); assert.equal(stateOfZone(zoneOf('Grays Harbor')), 'Washington'); assert.equal(stateOfZone(zoneOf('Curry')), 'Oregon'); assert.equal(stateOfZone(zoneOf('San Diego')), 'California'); assert.equal(stateOfZone(zoneOf('Marin')), 'California');
  assert.deepEqual(ZONES.map(([z]) => z).slice(0, 3), ['Washington Coast', 'Oregon North Coast', 'Oregon South Coast'], 'north to south');
});

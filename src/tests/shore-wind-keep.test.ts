import test from 'node:test';
import assert from 'node:assert/strict';
import {keepExistingAssignments, SHORE_WIND_KEEP_DAYS, type ShoreAssignment} from '../ocean/shoreWind.ts';
import {distanceKm} from '../ocean/mop.ts';

const NOW = Date.parse('2026-11-10T00:00:00Z'), DAY = 86400000, built = new Date(NOW - 7 * DAY).toISOString();
const a = (spotId: string, stationId: string, extra: Partial<ShoreAssignment> = {}): ShoreAssignment => ({spotId, spotName: spotId, stationId, stationName: stationId, kind: 'asos', exposure: 'airfield', lat: 42.4, lon: -124.4, distanceKm: 1, url: '', ...extra} as ShoreAssignment);
const st = (id: string, lat = 42.4, lon = -124.4) => ({id, name: id, kind: 'asos' as const, lat, lon});
const spot = (id: string, latitude = 42.405, longitude = -124.4) => ({id, latitude, longitude});
const run = (prev: ShoreAssignment[], fresh: ShoreAssignment[], stations: ReturnType<typeof st>[], spots: ReturnType<typeof spot>[]) => keepExistingAssignments(prev, fresh, stations, spots, distanceKm, NOW, built).map((x) => x.spotId + ':' + x.stationId);

test('a rebuild keeps an existing shore-wind entry with no new reading, drops one whose station is gone, and never overrides a fresh pick', () => {
  const prev = [a('gold', '4S1'), a('x', 'GONE'), a('y', 'OLD')];
  assert.deepEqual(run(prev, [a('y', 'NEW')], [st('4S1'), st('NEW'), st('OLD')], [spot('gold'), spot('x'), spot('y')]), ['y:NEW', 'gold:4S1']);
});
test('a moved pin drops a station now beyond the radius; the current coordinates decide', () => {
  assert.deepEqual(run([a('gold', '4S1')], [], [st('4S1')], [spot('gold', 42.405)]), ['gold:4S1']);
  assert.deepEqual(run([a('gold', '4S1')], [], [st('4S1')], [spot('gold', 42.5)]), [], '11 km away now');
  assert.deepEqual(run([a('gold', '4S1')], [], [st('4S1')], []), [], 'a spot no longer in the catalogue');
});
test('silence is capped: a station last seen more than 30 days ago is dropped, 29 days is kept, an old registry without lastSeen counts from the previous build', () => {
  const seen = (d: number) => new Date(NOW - d * DAY).toISOString();
  assert.equal(SHORE_WIND_KEEP_DAYS, 30);
  assert.deepEqual(run([a('gold', '4S1', {lastSeen: seen(29)})], [], [st('4S1')], [spot('gold')]), ['gold:4S1']);
  assert.deepEqual(run([a('gold', '4S1', {lastSeen: seen(31)})], [], [st('4S1')], [spot('gold')]), []);
  assert.deepEqual(run([a('gold', '4S1')], [], [st('4S1')], [spot('gold')]), ['gold:4S1'], 'built 7 days ago');
});

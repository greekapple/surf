import test from 'node:test';
import assert from 'node:assert/strict';
import {coastEvidence, COAST_ROWS, UPGRADED_ROWS, nearSanFrancisco} from '../data/coast.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {allSpots} from '../data/catalog.ts';
import {MARINE_POINT_OVERRIDES} from '../data/marinePoints.ts';
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
  // seaward = the direction the beach faces: the marine point must lie on that side of the beach point (west for the Pacific coast, east for the Atlantic, south for Oahu's south shore)
  const seaward = new Map<string, number>([...COAST_ROWS, ...UPGRADED_ROWS].map((r) => [r[0], r[6]]));
  for (const e of coastEvidence) {
    if (MARINE_POINT_OVERRIDES[e.id]) continue;   // an explicit sea point (marinePoints.ts) is chosen by hand, with its reason
    const d = seaward.get(e.id)! * Math.PI / 180, dx = (e.marineLongitude - e.longitude) * Math.cos(e.latitude * Math.PI / 180), dy = e.marineLatitude - e.latitude;
    assert.ok(dx * Math.sin(d) + dy * Math.cos(d) > -1e-9, `${e.id} marine point not on the seaward side`);
  }
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
  assert.deepEqual(ZONES.map(([z]) => z).slice(0, 4), ['Alaska · Sitka', 'Washington Coast', 'Oregon North Coast', 'Oregon South Coast'], 'north to south'); assert.equal(stateOfZone(zoneOf('Sitka')), 'Alaska'); assert.equal(zoneOf('Island'), 'Washington Coast'); assert.equal(zoneOf('Douglas'), 'Oregon South Coast');
});

test('no spot asks the marine model for a point on land: every marine point is sea (Natural Earth land polygons), and the explicit ones carry a reason', async () => {
  const {pointOnLand} = await import('../map/landCheck.ts'), {MARINE_POINT_OVERRIDES} = await import('../data/marinePoints.ts'), {evidenceSpots} = await import('../ocean/spots.ts');
  assert.equal(pointOnLand(37.85, -122.5), true, 'the Marin Headlands are land'); assert.equal(pointOnLand(37.75, -122.6), false, 'off Ocean Beach is sea'); assert.equal(pointOnLand(45.976, -123.947), true, 'Seaside beach point'); assert.equal(pointOnLand(21.5, -158.0), true, 'Oahu (Wahiawa)'); assert.equal(pointOnLand(21.3, -157.5 - 5), false);
  const land = evidenceSpots.filter((s) => pointOnLand(s.marineLatitude, s.marineLongitude)).map((s) => s.id); assert.deepEqual(land, [], 'spots whose marine query point is on land');
  for (const [id, o] of Object.entries(MARINE_POINT_OVERRIDES)) { assert.ok(o.reason.length > 40, id); const s = evidenceSpots.find((x) => x.id === id)!; assert.ok(s, id + ' exists'); assert.equal(s.marineLatitude, o.lat); assert.equal(s.marineLongitude, o.lon); }
});

test('no spot asks the marine model for a point on land: every marine point is sea (Natural Earth land polygons), and the explicit ones carry a reason', async () => {
  const {pointOnLand} = await import('../map/landCheck.ts'), {MARINE_POINT_OVERRIDES} = await import('../data/marinePoints.ts'), {evidenceSpots} = await import('../ocean/spots.ts');
  assert.equal(pointOnLand(37.85, -122.5), true, 'the Marin Headlands are land'); assert.equal(pointOnLand(37.75, -122.6), false, 'off Ocean Beach is sea'); assert.equal(pointOnLand(45.976, -123.947), true, 'Seaside beach point'); assert.equal(pointOnLand(21.5, -158.0), true, 'Oahu (Wahiawa)'); assert.equal(pointOnLand(21.3, -157.5 - 5), false);
  const land = evidenceSpots.filter((s) => pointOnLand(s.marineLatitude, s.marineLongitude)).map((s) => s.id); assert.deepEqual(land, [], 'spots whose marine query point is on land');
  for (const [id, o] of Object.entries(MARINE_POINT_OVERRIDES)) { assert.ok(o.reason.length > 40, id); const s = evidenceSpots.find((x) => x.id === id)!; assert.ok(s, id + ' exists'); assert.equal(s.marineLatitude, o.lat); assert.equal(s.marineLongitude, o.lon); }
});

test('no spot asks the marine model for a point on land: every marine point is sea (Natural Earth land polygons), and the explicit ones carry a reason', async () => {
  const {pointOnLand} = await import('../map/landCheck.ts'), {MARINE_POINT_OVERRIDES} = await import('../data/marinePoints.ts'), {evidenceSpots} = await import('../ocean/spots.ts');
  assert.equal(pointOnLand(37.85, -122.5), true, 'the Marin Headlands are land'); assert.equal(pointOnLand(37.75, -122.6), false, 'off Ocean Beach is sea'); assert.equal(pointOnLand(45.976, -123.947), true, 'Seaside beach point'); assert.equal(pointOnLand(21.5, -158.0), true, 'Oahu (Wahiawa)'); assert.equal(pointOnLand(21.3, -157.5 - 5), false);
  const land = evidenceSpots.filter((s) => pointOnLand(s.marineLatitude, s.marineLongitude)).map((s) => s.id); assert.deepEqual(land, [], 'spots whose marine query point is on land');
  for (const [id, o] of Object.entries(MARINE_POINT_OVERRIDES)) { assert.ok(o.reason.length > 40, id); const s = evidenceSpots.find((x) => x.id === id)!; assert.ok(s, id + ' exists'); assert.equal(s.marineLatitude, o.lat); assert.equal(s.marineLongitude, o.lon); }
});

test('batch 3 review round: one row per break (the merged name variants are gone, their sources live on the kept row), and the query note states the real distance to the marine point', async () => {
  const {evidenceSpots} = await import('../ocean/spots.ts'), {guideFactsFor} = await import('../ocean/spotFactsSourced.ts'), ids = new Set(evidenceSpots.map((s) => s.id));
  for (const gone of ['w-us-rockaway', 'w-us-matanuck', 'w-us-fox-hill', 'w-carib-wilderness-puerto-rico', 'w-us-fishermans-island-virginia', 'w-us-san-jose-island']) assert.ok(!ids.has(gone), gone);
  for (const kept of ['w-us-rockaways', 'w-us-matunuck', 'w-us-foxhill-point', 'w-carib-wilderness-aguadilla', 'w-us-fishermans-island', 'w-us-st-joes-island']) assert.ok(ids.has(kept), kept);
  assert.ok(guideFactsFor('w-us-rockaways')!.sources.some((x) => /surfnerd\.com\/surf-forecast\/rockaway$/.test(x.url)), 'the merged surfnerd page is a source of the kept row'); assert.ok(guideFactsFor('w-us-matunuck')!.sources.some((x) => /surfnerd\.com\/surf-forecast\/matanuck/.test(x.url)));
  const poc = evidenceSpots.find((s) => s.id === 'w-us-port-o-connor-jetties')!; assert.deepEqual([poc.marineLatitude, poc.marineLongitude], [28.36, -96.27]); assert.match(poc.queryNote ?? '', /~8 km away, an explicit sea point/);
  const plain = evidenceSpots.find((s) => s.id === 'w-us-pawleys-island')!; if (plain) assert.match(plain.queryNote ?? '', /~9 km seaward/);
});

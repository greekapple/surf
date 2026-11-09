import test from 'node:test';
import assert from 'node:assert/strict';
import {tideStations, tideStation, extraTideStationIds, hiloTideStationIds, tideAssignments, nearestTideStations, SF_STATION} from '../ocean/tideStations.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {tideURL, tideExtremaURL, normalizeTides, normalizeTideExtrema, stationOf} from '../ocean/noaa.ts';
import {serverProviderPath} from '../ocean/server.ts';
import {ingestionTargets, tideServiceStationIds, tideHiloServiceStationIds} from '../../services/forecast-service.mjs';

const payload = {predictions: [{t: '2026-11-01 05:26', v: '-0.437', type: 'L'}, {t: '2026-11-01 12:51', v: '4.251', type: 'H'}]};

test('registry holds the three stations; the two new ones are ingested but assigned to no spot until review', () => {
  assert.deepEqual(tideStations.slice(0, 3).map((s) => s.id), ['9414290', '9414131', '9415020']); // T-082 appends the nearest station of every covered spot
  assert.deepEqual(extraTideStationIds, ['9414131', '9415020']);
  assert.deepEqual(tideServiceStationIds, extraTideStationIds, 'service and registry agree');
  assert.deepEqual(tideAssignments, []);
  assert.equal(tideStation('9414131')?.name, 'Pillar Point Harbor'); assert.equal(tideStation('9415020')?.name, 'Point Reyes'); assert.equal(tideStation('0000000'), null);
});

test('URLs are station-specific; default stays San Francisco', () => {
  assert.equal(stationOf(tideURL('predictions')), '9414290');
  assert.equal(stationOf(tideURL('predictions', new Date('2026-11-01T00:00:00Z'), '9414131')), '9414131');
  const hilo = new URL(tideExtremaURL(new Date('2026-11-01T00:00:00Z'), '9415020'));
  assert.equal(hilo.searchParams.get('station'), '9415020'); assert.equal(hilo.searchParams.get('interval'), 'hilo'); assert.equal(hilo.searchParams.get('datum'), 'MLLW');
});

test('normalizers keep the station id and say "station tide, not a beach tide"; San Francisco wording is unchanged', () => {
  const pp = normalizeTides(payload, '2026-11-01T01:00:00Z', tideURL('predictions', new Date('2026-11-01T00:00:00Z'), '9414131'));
  const m = [...pp.values()][0]; assert.equal(m.source.provider, 'NOAA CO-OPS 9414131'); assert.match(m.source.location, /Pillar Point Harbor station 9414131; station tide, not a beach tide/); assert.equal(m.source.nativeUnit, 'ft MLLW');
  const sf = [...normalizeTides(payload, '2026-11-01T01:00:00Z', tideURL('predictions')).values()][0];
  assert.equal(sf.source.provider, 'NOAA CO-OPS 9414290'); assert.equal(sf.source.location, 'San Francisco station 9414290; regional reference, not a beach tide');
  const ex = normalizeTideExtrema(payload, '2026-11-01T01:00:00Z', tideExtremaURL(new Date('2026-11-01T00:00:00Z'), '9415020'));
  assert.deepEqual(ex.map((e) => e.type), ['Low', 'High']); assert.equal(ex[0].height.source.provider, 'NOAA CO-OPS 9415020');
});

test('server routes the new stations by fixed keys and nothing else', () => {
  assert.equal(serverProviderPath(tideURL('predictions', new Date(), '9414131')), '/api/provider?key=tides-9414131');
  assert.equal(serverProviderPath(tideExtremaURL(new Date(), '9415020')), '/api/provider?key=tide-extrema-9415020');
  assert.equal(serverProviderPath(tideURL('predictions')), '/api/provider?key=tides');
  assert.equal(serverProviderPath(tideURL('predictions', new Date(), '9413745')), null, 'an unregistered station is never proxied');
  assert.equal(serverProviderPath(tideURL('water_level', new Date(), '9414131')), null, 'water level exists only for the SF gauge');
  const keys = ingestionTargets(Date.parse('2026-11-01T12:00:00Z')).map((t: any) => t.key);
  for (const id of extraTideStationIds) { assert.ok(keys.includes('tides-' + id)); assert.ok(keys.includes('tide-extrema-' + id)); }
});

test('nearest stations for the review list: Linda Mar is closest to Pillar Point; the list never assigns', () => {
  const near = nearestTideStations(37.6, -122.5);
  assert.equal(near[0].station.id, '9414131'); assert.ok(near[0].distanceKm < 15 && near[0].distanceKm < near[1].distanceKm);
  assert.deepEqual(tideAssignments, []);
});

// T-082: Home's "Next tide" must never be a dash where a CO-OPS prediction station is within 40 km.
test('every covered spot has its nearest prediction station within 40 km, and that station is ingested', () => {
  const ingested = new Set([SF_STATION, ...extraTideStationIds, ...hiloTideStationIds]);
  const none: string[] = [];
  for (const e of evidenceSpots) {
    const near = nearestTideStations(e.latitude, e.longitude)[0];
    if (!near || near.distanceKm > 40) { none.push(e.name); continue; }
    assert.ok(ingested.has(near.station.id), `${e.name}: nearest station ${near.station.id} (${near.distanceKm} km) is not ingested`);
  }
  assert.deepEqual(none, [], 'spots with no station within 40 km');
  assert.ok(evidenceSpots.length >= 45, 'the check above covers every spot, however many there are');
});
test('the high/low stations: registry and service agree, the server routes their high/low only, and they have hilo targets', () => {
  assert.deepEqual(tideHiloServiceStationIds, hiloTideStationIds);
  for (const id of hiloTideStationIds) assert.ok(tideStation(id), id);
  assert.equal(serverProviderPath(tideExtremaURL(new Date(), '9413745')), '/api/provider?key=tide-extrema-9413745');
  const keys = ingestionTargets(Date.parse('2026-11-01T12:00:00Z')).map((t: any) => t.key);
  for (const id of hiloTideStationIds) { assert.ok(keys.includes('tide-extrema-' + id), id); assert.ok(!keys.includes('tides-' + id), id + ' has no hourly series'); }
});

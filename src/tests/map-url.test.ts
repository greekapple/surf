import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapSearch, parseMapUrl} from '../features/explore/mapUrl.ts';

test('map URL: a full view round-trips (layer, lat, lon, zoom, time), other keys kept', () => {
  const s = mapSearch('?spot=ocean-beach', {layer: 'period', lat: 37.76543, lon: -122.51234, z: 9.5, t: '2026-11-04T18:00:00.000Z'});
  assert.equal(s, '?spot=ocean-beach&layer=period&lat=37.7654&lon=-122.5123&z=9.5&t=2026-11-04T18%3A00%3A00.000Z');
  assert.deepEqual(parseMapUrl(s), {layer: 'period', lat: 37.7654, lon: -122.5123, z: 9.5, t: '2026-11-04T18:00:00.000Z'});
});

test('map URL: bad or partial values are ignored, never guessed', () => {
  assert.deepEqual(parseMapUrl('?layer=rain&lat=95&lon=-122&z=40&t=yesterday'), {layer: null, lat: null, lon: null, z: null, t: null});
  assert.deepEqual(parseMapUrl('?lat=37&z=8'), {layer: null, lat: null, lon: null, z: 8, t: null}, 'a latitude without a longitude is no position');
  assert.deepEqual(parseMapUrl(''), {layer: null, lat: null, lon: null, z: null, t: null});
});

test('map URL: longitudes past the antimeridian (world copies) are wrapped; null removes a key', () => {
  assert.equal(parseMapUrl('?lat=10&lon=200').lon, -160);
  assert.equal(mapSearch('?lat=1&lon=2&z=3&spot=x', {lat: null, lon: null, z: null}), '?spot=x');
  assert.equal(mapSearch('?spot=x', {lon: 190, lat: 0}), '?spot=x&lat=0.0000&lon=-170.0000');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recordOrPlaceholder} from '../services/forecast.ts';
import {forecasts} from '../data/demo.ts';
import {allSpots} from '../data/catalog.ts';
import {rateForecast} from '../ratings/adapters.ts';

// Audit B4 (R10): opening a catalogue spot from the header search threw "Cannot read properties of undefined (reading 'includes')" in
// adapters.ts, because the store's placeholder record for a spot outside the demonstration week was `{...undefined, face: NaN, ...}`.
test('a spot outside the demonstration week gets a complete placeholder with every input missing', () => {
  const demoIds = new Set(forecasts.map((f) => f.spotId));
  const spot = allSpots.find((s) => !demoIds.has(s.id));
  assert.ok(spot, 'the catalogue has spots outside the demonstration week');
  const f = recordOrPlaceholder(forecasts, spot!.id, 0, 9);
  assert.equal(f.spotId, spot!.id);
  assert.equal(typeof f.source, 'string');
  assert.equal(typeof f.timestamp, 'string');
  assert.deepEqual(f.availability, {face: false, swell: false, wind: false, tide: false, organization: false});
  assert.ok(Number.isNaN(f.face) && Number.isNaN(f.offshore) && Number.isNaN(f.primary.height) && Number.isNaN(f.wind.speed));
  assert.equal(f.character, 'Unknown');
  assert.equal(f.placeholder, true); assert.equal(f.source, 'none'); assert.equal(f.timestamp, '', 'no time borrowed from a demonstration record');
  assert.doesNotThrow(() => rateForecast(spot!, f, Date.now()));
});

test('a demonstration spot still gets its own record', () => {
  const d = forecasts[0];
  assert.equal(recordOrPlaceholder(forecasts, d.spotId, d.day, d.hour), d);
});

test('the store no longer asserts a demonstration record exists', () => {
  assert.doesNotMatch(readFileSync('src/hooks/useForecast.ts', 'utf8'), /selectRecord\(forecasts,selected,day,hour\)!/);
});

test('the live store stand-in is the explicit placeholder, not a demonstration record', () => {
  const src = readFileSync('src/hooks/useForecast.ts', 'utf8');
  assert.match(src, /dataMode==='Retrieved'\?placeholderRecord\(selected,day,hour\)/);
  assert.doesNotMatch(src, /\{\.\.\.demoOriginal,face:NaN/);
});

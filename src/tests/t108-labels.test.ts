import test from 'node:test';
import assert from 'node:assert/strict';
import {callFor, bestWindowFrom, windowHour} from '../services/call.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {isDark} from '../services/daylight.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';

// T-108: one best-window function, and the call names the person's own preferred range. Ocean Beach (spot-2) fixture, 1.1 m waves (was 1.6 m; lowered with T-131 phase 2, whose buoy-evidenced ×1.48 at Ocean Beach would otherwise put the fixture above the intermediate range this test does not exercise).
const profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const t = 1792454400, now = t * 1000 + 600000, times = Array.from({length: 48}, (_, i) => t - 3600 + i * 3600);
const marine = {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'},
  hourly: {time: times, wave_height: times.map(() => 1.1), swell_wave_height: times.map(() => 1.0), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 270), secondary_swell_wave_period: times.map(() => 10)}};
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 6)}};
const records = normalizeOpenMeteo(evidenceSpot('spot-2'), marine as any, weather as any, new Date(now).toISOString()).map(toLegacy);
const spot = allSpots.find((s) => s.id === 'spot-2')!, ctx = {records, nowMs: now};

test('T-108: the call\'s next window IS bestWindowFrom (one best-window function)', () => {
  const dark = records.find((f) => Date.parse(f.timestamp) > now && isDark('spot-2', f.timestamp))!;
  const c = callFor(spot, dark, profile, ctx), w = bestWindowFrom(spot, profile, ctx, Math.max(Date.parse(dark.timestamp), now));
  assert.ok(w, 'a window exists in the fixture'); assert.ok(c.nextWindow); assert.equal(c.nextWindow!.label, w!.label); assert.equal(c.nextWindow!.start, w!.start);
  assert.match(w!.when, /^(today|tomorrow|[A-Z][a-z]+day)$/);
});
test('T-108: the call names the range the person prefers (Personal), not the skill table\'s 8 ft', () => {
  const day = records.find((f) => !isDark('spot-2', f.timestamp) && Date.parse(f.timestamp) > now)!;
  const small = {...profile, minWave: 2, maxWave: 3}, c = callFor(spot, day, small, ctx), text = c.why.join(' ');
  assert.doesNotMatch(text, /up to 8 ft/, text);
  assert.match(text, /range you prefer \(/, text);
  const wide = {...profile, minWave: 1, maxWave: 30}; assert.doesNotMatch(callFor(spot, day, wide, ctx).why.join(' '), /above the range you prefer/);
});
test('a window that starts at first light (not on the hour) still finds its forecast hour, so Home never drops that spot from the best bet', () => {
  const h = records.find((f) => Date.parse(f.timestamp) > now)!, w = {start: new Date(Date.parse(h.timestamp) + 20 * 60000).toISOString()}; // e.g. first light 6:20
  assert.ok(!records.some((f) => f.timestamp === w.start), 'an exact-time match would miss it');
  assert.equal(windowHour(records, 'spot-2', w)?.timestamp, h.timestamp); assert.equal(windowHour(records, 'spot-9', w), undefined, 'only the same spot');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {capOnshore, ONSHORE_LIGHT_MPH, ONSHORE_SCORE_CEILING, ONSHORE_SOURCE} from '../ratings/windRules.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {rateOcean} from '../ratings/adapters.ts';
import {evidenceQuality} from '../ocean/quality.ts';

const now = Date.parse('2026-10-20T06:00:00Z');
const MPH = 1; // the weather feed is requested in mph
/** Ocean Beach (shore normal 263.49°, so onshore wind comes from ~W and offshore from ~E). */
const rec = (mph: number, dir: number) => normalizeOpenMeteo(evidenceSpot('spot-2'),
  {hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_period: 's', swell_wave_direction: '°'}, hourly: {time: [now / 1000], wave_height: [2], swell_wave_height: [1.7], swell_wave_period: [13], swell_wave_direction: [270]}},
  {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: [now / 1000], wind_speed_10m: [mph * MPH], wind_direction_10m: [dir], wind_gusts_10m: [mph * MPH]}}, new Date(now).toISOString())[0];
const wind = (mph: number, dir: number) => rateOcean(evidenceSpot('spot-2'), rec(mph, dir), now).factors.find((f) => f.name === 'Wind influence')!;
const tick = (score: number) => (score >= 70 ? '✓' : score >= 40 ? '~' : '✗'); // the spot page's tick thresholds

test('rule: documented threshold and source; only onshore above 3 mph is capped', () => {
  assert.equal(ONSHORE_LIGHT_MPH, 3); assert.match(ONSHORE_SOURCE, /Beaufort/); assert.ok(ONSHORE_SCORE_CEILING < 60);
  assert.equal(capOnshore(95, 'onshore', 3), 95, 'at the threshold: unchanged');
  assert.equal(capOnshore(95, 'Onshore', 3.1), ONSHORE_SCORE_CEILING, 'case-insensitive, just above the threshold: capped');
  assert.equal(capOnshore(40, 'onshore', 20), 40, 'a lower score is never raised');
  for (const rel of ['offshore', 'Offshore', 'cross-shore', 'Cross-shore', 'Unknown', 'unknown']) assert.equal(capOnshore(95, rel, 25), 95);
  assert.equal(capOnshore(95, 'onshore', NaN), 95);
});

test('Ocean Beach, 4.9 mph from the west (onshore): the wind tick is "~", not "✓", and Wind is not a positive factor', () => {
  const f = wind(4.9, 270);
  assert.ok(f.score! <= ONSHORE_SCORE_CEILING, `score ${f.score}`); assert.equal(tick(f.score!), '~');
  const q = rateOcean(evidenceSpot('spot-2'), rec(4.9, 270), now);
  assert.ok(!q.positive.includes('Wind influence'));
});
test('onshore at or below 3 mph, offshore and cross-shore keep their previous scores (no other change)', () => {
  assert.ok(wind(2, 270).score! >= 90, 'light onshore up to 3 mph keeps the old score');
  assert.ok(wind(4.9, 90).score! >= 90 && tick(wind(4.9, 90).score!) === '✓', 'offshore 4.9 mph stays good');
  assert.equal(tick(wind(4.9, 180).score!), '✓', 'cross-shore 4.9 mph: unchanged formula');
  assert.equal(wind(4.9, 180).score, Math.max(0, Math.min(100, 100 - 4.9 * 2.8)));
  assert.equal(wind(4.9, 90).score, Math.max(0, Math.min(100, 100 - 4.9 * 1.6)));
});
test('stronger onshore is still lowered by the original slope (the cap only removes the "good" band)', () => {
  assert.equal(wind(10, 270).score, ONSHORE_SCORE_CEILING, '100 − 10×4 = 60 is held to the ceiling');
  assert.equal(wind(20, 270).score, 20, '100 − 20×4 = 20 is below the ceiling and unchanged');
});
test('the same rule holds for the evidence quality factor used by Board Match and the model estimate path', () => {
  const r = rec(4.9, 270), q = evidenceQuality(evidenceSpot('spot-2'), r);
  assert.ok(q.factors[1].score === null || q.factors[1].score <= ONSHORE_SCORE_CEILING);
});

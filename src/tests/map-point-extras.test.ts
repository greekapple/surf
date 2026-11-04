import test from 'node:test';
import assert from 'node:assert/strict';
import {pointExtras} from '../map/pointExtras.ts';
test('pointExtras reads the gust and the swell period and direction at the hour nearest the selected time, and nothing when that hour is more than 90 minutes away', () => {
  const t0 = Date.parse('2026-11-04T06:00:00Z') / 1000, d = {time: [t0, t0 + 3600, t0 + 7200], windGust: [9.5, 8.6, null], swellPeriod: [12.3, 12.35, 12.3], swellDirection: [298, 298, 297]};
  const a = pointExtras(d, '2026-11-04T07:00:00Z'); assert.deepEqual(a, {gustMs: 8.6, swellPeriodS: 12.35, swellDirDeg: 298});
  assert.equal(pointExtras(d, '2026-11-04T08:10:00Z').gustMs, null, 'a missing value stays missing'); assert.equal(pointExtras(d, '2026-11-04T12:00:00Z').swellPeriodS, null, 'too far from any forecast hour');
  assert.deepEqual(pointExtras(null, '2026-11-04T07:00:00Z'), {gustMs: null, swellPeriodS: null, swellDirDeg: null});
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordSurfRange} from '../services/surfRange.ts';
import {uncertaintyCeiling} from '../ratings/windRules.ts';
import {estimateBreaking} from '../ocean/breakingEstimate.ts';
import {breakingProfile} from '../ocean/localCalibration.ts';

const input = {kind: 'breaking-estimate' as const, valueFt: null, rangeFt: [4, 6] as [number, number], rangeMethod: 'test estimate v1'};
const NOW = Date.parse('2026-11-02T20:00:00Z');
test('recordSurfRange reads the convention height, not the legacy breaking range; none for records without it', () => {
  const r = recordSurfRange({spotId: 'spot-2', timestamp: new Date(NOW).toISOString(), faceEstimate: {input, centralFt: 8, breakingFt: 10}} as any, NOW)!;
  assert.ok(r.loFt <= 8 && r.hiFt >= 8 && r.centralFt === 8); assert.ok(r.hiFt - r.loFt >= 2, 'wider than the legacy 4-6 band would suggest for a central of 8');
  assert.equal(recordSurfRange({spotId: 'spot-2', timestamp: new Date(NOW).toISOString(), faceEstimate: {input}} as any, NOW), null, 'cached record without the convention fields');
  assert.equal(recordSurfRange({spotId: 'spot-2', timestamp: new Date(NOW).toISOString()} as any, NOW), null);
});
test('the rating ceiling follows the headline uncertainty: long lead caps at SOLID, a near-term hour does not', () => {
  assert.equal(uncertaintyCeiling(0.156), null); assert.equal(uncertaintyCeiling(undefined), null); assert.equal(uncertaintyCeiling(NaN), null);
  const c = uncertaintyCeiling(0.32)!; assert.equal(c.id, 'wide-range'); assert.match(c.reason, /±38%/);
});
test('v1 starts from the total Hs when it is larger than the swell partition (T-081)', () => {
  const p = breakingProfile('spot-2')!, swell = {swellHsFt: 4, periodS: 14, directionDeg: 263.49, secondaryHsFt: null};
  const a = estimateBreaking({...swell, combinedHsFt: 4}, p, 263.49), b = estimateBreaking({...swell, combinedHsFt: 5}, p, 263.49);
  assert.ok(a.ok && b.ok); if (a.ok && b.ok) { assert.ok(Math.abs(b.nearshoreFt / a.nearshoreFt - 1.25) < 1e-9); assert.equal(b.centralFt, a.centralFt, 'the breaking height stays on the swell partition'); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {iribarren, classify, deepWavelengthM, breakerType, characterFromBreaker, BREAKER_LABEL, SPILLING_MAX, PLUNGING_MAX} from '../services/breaker.ts';
import {slopeFor, nearshoreSlopes} from '../ocean/nearshoreSlope.ts';
import {evidenceSpots} from '../ocean/spots.ts';

const FT = 1 / 0.3048;
const hour = (hsFt: number, tp: number) => ({primary: {height: hsFt, period: tp, direction: 270}}) as any;

test('deep-water wavelength L0 = gT²/2π (T = 10 s → 156 m; 14 s → 306 m)', () => { assert.ok(Math.abs(deepWavelengthM(10) - 156.1) < 0.1); assert.ok(Math.abs(deepWavelengthM(14) - 306) < 0.5); });
test('textbook cases: a gentle beach slope with a long swell is spilling', () => {
  const xi = iribarren(0.02, 2, 10)!; assert.ok(Math.abs(xi - 0.177) < 0.003); assert.equal(classify(xi), 'spilling');
});
test('textbook cases: a steep slope with a short, small swell is plunging (ξ about 1)', () => {
  const xi = iribarren(0.1, 1, 8)!; assert.ok(Math.abs(xi - 1.0) < 0.01); assert.equal(classify(xi), 'plunging');
});
test('textbook cases: a very steep slope with a long, low swell is surging', () => {
  const xi = iribarren(0.2, 0.5, 12)!; assert.ok(xi > 4 && xi < 4.5); assert.equal(classify(xi), 'surging');
});
test('class boundaries are the deep-water ξ₀ ones (Battjes 1974): ξ₀ < 0.5 spilling, 0.5–3.3 plunging (inclusive), > 3.3 surging; the ξb values 0.4 and 2.0 are NOT used (T-085); bad input is unknown', () => {
  assert.deepEqual([0.499, 0.5, 1, 3.3, 3.301].map(classify), ['spilling', 'plunging', 'plunging', 'plunging', 'surging']); assert.equal(SPILLING_MAX, 0.5); assert.equal(PLUNGING_MAX, 3.3);
  assert.deepEqual([0.45, 2.5].map(classify), ['spilling', 'plunging'], 'the two bands the earlier thresholds misclassified (0.4–0.5 and 2.0–3.3)');
  assert.equal(classify(null), 'unknown'); assert.equal(classify(NaN), 'unknown');
  assert.equal(iribarren(0, 1, 10), null); assert.equal(iribarren(0.02, -1, 10), null); assert.equal(iribarren(0.02, 1, 0), null); assert.equal(iribarren(NaN, 1, 10), null);
});
test('unknown when there is no defensible slope; never a guessed value; only listed spots have one', () => {
  const b = breakerType({id: 'spot-3'}, hour(5, 14)); assert.equal(b.type, 'unknown'); assert.equal(b.xi, null); assert.equal(b.tanBeta, null); assert.match(b.basis, /No defensible seabed slope/); assert.equal(b.label, BREAKER_LABEL);
  assert.deepEqual(nearshoreSlopes.map((s) => s.spotId), ['spot-2']); assert.ok(nearshoreSlopes.every((s) => evidenceSpots.some((e) => e.id === s.spotId) && s.tanBeta > 0 && s.distanceM > 0 && s.basis.length > 20));
  assert.equal(slopeFor('nope'), null);
});
test('Ocean Beach (coarse mean slope) is spilling for typical swell; an injected steep slope gives plunging; a missing swell is unknown with a reason', () => {
  const ob = breakerType({id: 'spot-2'}, hour(5, 14)); assert.equal(ob.type, 'spilling'); assert.ok(ob.xi! > 0.05 && ob.xi! < 0.5); assert.match(ob.basis, /Battjes 1974/);
  const steep = breakerType({id: 'x'}, hour(3.3, 8), {spotId: 'x', tanBeta: 0.1, mopId: 'T', depthM: 10, distanceM: 100, basis: 'test slope.', computedOn: '2026-11-02'}); assert.equal(steep.type, 'plunging');
  const none = breakerType({id: 'spot-2'}, hour(0, 14)); assert.equal(none.type, 'unknown'); assert.match(none.basis, /no usable primary swell/);
  assert.ok(Math.abs(breakerType({id: 'spot-2'}, hour(1 * FT, 10)).h0M! - 1) < 1e-9);
});
test('Board Match input: spilling → soft, plunging → steep, surging and unknown → none', () => {
  assert.deepEqual(['spilling', 'plunging', 'surging', 'unknown'].map((t) => characterFromBreaker(t as any)), ['soft', 'steep', null, null]);
});

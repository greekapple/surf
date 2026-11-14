import test from 'node:test';
import assert from 'node:assert/strict';
import {BAR_BLOCKS, barOf, barWords, gridStep, pct, stepText, weekScale, type BarKind} from '../services/weekBars.ts';
import type {HeadlineSurf} from '../services/headlineSurf.ts';

// forecast-visuals B: the day strip's bars. Each bar is ONE hour's own headline; an offshore height is never a surf bar; the scale is one for the week.
const est = (loFt: number, hiFt: number) => ({kind: 'estimate', loFt, hiFt}) as unknown as HeadlineSurf;
const fmt = (ft: number, _k: BarKind) => String(Math.round(ft)), u = () => 'ft';

test('four hours a day: dawn, morning, noon, afternoon', () => {
  assert.deepEqual(BAR_BLOCKS.map((b) => b.hour), [6, 9, 12, 15]);
});
test('each headline kind becomes its own bar kind; nothing is turned into a surf bar that is not one', () => {
  assert.deepEqual(barOf(est(3, 4)), {kind: 'est', lo: 3, hi: 4});
  assert.deepEqual(barOf(est(0, 0)), {kind: 'flat', lo: 0, hi: 0});
  assert.deepEqual(barOf({kind: 'offshore', ft: 6.2, label: 'offshore · not surf size'} as HeadlineSurf), {kind: 'off', lo: 6.2, hi: 6.2});
  assert.deepEqual(barOf({kind: 'official', loFt: 3, hiFt: 5} as unknown as HeadlineSurf), {kind: 'nws', lo: 3, hi: 5});
  assert.deepEqual(barOf({kind: 'demonstration', ft: 4, label: 'x'} as HeadlineSurf), {kind: 'demo', lo: 4, hi: 4});
  assert.deepEqual(barOf({kind: 'none', label: 'x'} as HeadlineSurf), {kind: 'none', lo: null, hi: null});
  assert.deepEqual(barOf(null), {kind: 'none', lo: null, hi: null});
});
test('one scale for the week: the highest top rounded up to whole gridline steps, never below 3 ft', () => {
  assert.deepEqual(weekScale([barOf(est(22, 27)), barOf(est(5, 7))]), {max: 30, step: 10});
  assert.deepEqual(weekScale([barOf(est(1, 2))]), {max: 3, step: 1});
  assert.deepEqual(weekScale([]), {max: 3, step: 1});
  assert.equal(gridStep(14), 5); assert.equal(pct(15, 30), 50); assert.equal(pct(40, 30), 100); assert.equal(pct(-1, 30), 0);
});
test('the words say what each bar is (estimated, NWS, offshore not surf size, demonstration, nothing)', () => {
  assert.equal(barWords('noon', barOf(est(3, 4)), fmt, u), 'noon 3–4 ft model estimate');
  assert.equal(barWords('noon', barOf(est(3, 4)), fmt, u, 'saved copy'), 'noon 3–4 ft model estimate, saved copy');
  assert.equal(barWords('dawn', barOf({kind: 'offshore', ft: 6.2, label: 'offshore · not surf size'} as HeadlineSurf), fmt, u), 'dawn offshore 6 ft, not surf size');
  assert.equal(barWords('morning', barOf({kind: 'official', loFt: 3, hiFt: 5} as unknown as HeadlineSurf), fmt, u), 'morning NWS surf forecast for the day 3–5 ft');
  assert.equal(barWords('noon', barOf(est(0, 0)), fmt, u), 'noon flat (model estimate)');
  assert.equal(barWords('afternoon', barOf(null), fmt, u), 'afternoon no height');
  // the Hawaiian scale: the formatter gets the kind, so an estimate is halved and offshore is not (the day card's rule)
  const hw = (ft: number, k: BarKind) => String(Math.round(k === 'est' ? ft / 2 : ft));
  assert.equal(barWords('noon', barOf(est(4, 6)), hw, (k) => (k === 'est' ? 'ft ≈ Hawaiian' : 'ft')), 'noon 2–3 ft ≈ Hawaiian model estimate');
  assert.equal(stepText(2.5), '2.5'); assert.equal(stepText(10), '10');
});

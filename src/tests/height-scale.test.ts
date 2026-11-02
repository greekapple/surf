import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_HEIGHT_IN, HEIGHT_MIN_IN, HEIGHT_MAX_IN, inchesFromFtIn, inchesFromCm, cmFromInches, splitFtIn, formatHeight, userHeight, parseHeight, validHeightIn} from '../services/heightMath.ts';
import {faceRange, bandRange, axisTop, axisStep, axisTicks, bodyTicks, yFor, wavePath, timesYourHeight, lerp} from '../services/scaleMath.ts';
import {SCALE_BANDS} from '../services/waveScale.ts';
import {BODY_TICKS} from '../services/bodyWords.ts';

test('conversions: ft/in ↔ inches ↔ cm, with carry and rounding', () => {
  assert.equal(inchesFromFtIn(5, 10), 70); assert.ok(Number.isNaN(inchesFromFtIn(-1, 3))); assert.ok(Number.isNaN(inchesFromFtIn(5, NaN)));
  assert.ok(Math.abs(inchesFromCm(178) - 70.07874) < 1e-4); assert.equal(Math.round(cmFromInches(70)), 178); assert.ok(Number.isNaN(inchesFromCm(NaN)));
  assert.deepEqual(splitFtIn(70), {ft: 5, in: 10}); assert.deepEqual(splitFtIn(71.6), {ft: 6, in: 0}, '71.6 in rounds to 6\'0"'); assert.deepEqual(splitFtIn(59.4), {ft: 4, in: 11});
  assert.equal(formatHeight(70, 'ft'), `5'10"`); assert.equal(formatHeight(70, 'm'), '178 cm'); assert.equal(formatHeight(NaN, 'ft'), '—'); assert.equal(formatHeight(60, 'ft'), `5'0"`);
});
test('valid range 3\'4" to 7\'6"; the saved height is used, else the labelled default; garbage falls back, never draws a nonsense surfer', () => {
  assert.ok(validHeightIn(HEIGHT_MIN_IN) && validHeightIn(HEIGHT_MAX_IN) && !validHeightIn(39.9) && !validHeightIn(90.1) && !validHeightIn(NaN) && !validHeightIn('70' as any));
  assert.deepEqual(userHeight({heightIn: 74}), {inches: 74, feet: 74 / 12, isDefault: false});
  for (const bad of [undefined, null, NaN, 5, 200, '70' as any]) assert.deepEqual(userHeight({heightIn: bad as any}), {inches: DEFAULT_HEIGHT_IN, feet: DEFAULT_HEIGHT_IN / 12, isDefault: true});
  assert.equal(userHeight(null).isDefault, true);
});
test('parsing what people type', () => {
  for (const [t, v] of [[`5'10"`, 70], ['5\'10', 70], ['5 10', 70], ['5ft 10in', 70], ['5-10', 70], ['6\'', 72], ['5.5', 66], ['5’11”', 71]] as [string, number][]) assert.equal(parseHeight(t, 'ft'), v, t);
  assert.equal(parseHeight('178', 'm'), 70.1); assert.equal(parseHeight('178 cm', 'm'), 70.1); assert.equal(parseHeight('190.5', 'm'), 75);
  for (const [t, u] of [['', 'ft'], ['abc', 'ft'], ['9\'10', 'ft'], ['2\'0', 'ft'], ['5\'13', 'ft'], ['50', 'm'], ['300', 'm'], ['5\'10', 'm'], ['178', 'ft']] as [string, 'ft' | 'm'][]) assert.equal(parseHeight(t, u), null, `${t} ${u}`);
});
test('face range: only a presentable estimate is drawn', () => {
  assert.deepEqual(faceRange({kind: 'estimate', loFt: 3, hiFt: 5} as any), [3, 5]);
  for (const h of [null, undefined, {kind: 'offshore', ft: 5, label: 'x'}, {kind: 'none', label: 'x'}, {kind: 'estimate', loFt: 5, hiFt: 3}, {kind: 'estimate', loFt: NaN, hiFt: 3}, {kind: 'estimate', loFt: 0, hiFt: 0}] as any[]) assert.equal(faceRange(h), null);
});
test('band browsing ranges and the axis', () => {
  assert.deepEqual(bandRange(SCALE_BANDS[0]), [1, 2]); assert.deepEqual(bandRange(SCALE_BANDS[3]), [4, 6]); assert.deepEqual(bandRange(SCALE_BANDS[7]), [15, 20]);
  assert.equal(axisTop([3, null, NaN]), 7); assert.ok(Math.abs(axisTop([20]) - 22.4) < 1e-9); assert.equal(axisTop([]), 7);
  assert.equal(axisStep(10, 'ft'), 2); assert.equal(axisStep(15, 'ft'), 4); assert.equal(axisStep(10, 'm'), 1); assert.equal(axisStep(20, 'm'), 2);
  assert.deepEqual(axisTicks(7, 'ft'), [2, 4, 6]); assert.deepEqual(axisTicks(10, 'm'), [1, 2, 3]);
  assert.deepEqual(bodyTicks(5.2).map((t) => t[0]), ['ankle', 'knee', 'thigh', 'waist', 'chest', 'shoulder', 'head']); assert.equal(bodyTicks(30).length, BODY_TICKS.length); assert.deepEqual(bodyTicks(0.5), []);
});
test('drawing maths: y is proportional, the wave starts and ends on the base and reaches the crest', () => {
  assert.equal(yFor(0, 10, 150, 100), 150); assert.equal(yFor(10, 10, 150, 100), 50); assert.equal(yFor(5, 10, 150, 100), 100); assert.equal(yFor(-3, 10, 150, 100), 150);
  const d = wavePath(24, 104, 150, 60); assert.ok(d.startsWith('M24 150') && d.endsWith('Z') && d.includes('112 150')); assert.ok(d.includes(String(60 + 90 * 0.02)));
  assert.deepEqual(timesYourHeight([3, 6], 6), [0.5, 1]); assert.equal(timesYourHeight([3, 6], 0), null);
  assert.equal(lerp(2, 4, 0.5), 3); assert.equal(lerp(2, 4, -1), 2); assert.equal(lerp(2, 4, 9), 4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {WINDY_WAVES_FT, WINDY_WIND_KT, windyWindColor, legendTicks, windyWaveColor, mapColor, legendRamp, rampFor, RANGE, RANGE_WIDE} from '../map/colors.ts';

// T-115 (user decision 2026-11-04): the map uses Windy's colours, sampled from the reference legend strip. These tests pin the sampled stops and the properties the product needs (a visible gradient, legend == field).
const hex = (c: number[]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const FT = 0.3048;
test('the sampled Windy wave stops are returned exactly at their tick values', () => {
  for (const [ft, h] of WINDY_WAVES_FT) assert.equal(hex(windyWaveColor(ft * FT)), h, `${ft} ft`);
  assert.equal(WINDY_WAVES_FT[0][1], '#329eba'); assert.equal(WINDY_WAVES_FT.at(-1)![1], '#c0a39d'); // teal at calm, pale salmon at 30 ft
});
test('values outside Windy\'s range clamp to the end colours; colours between stops are interpolated', () => {
  assert.equal(hex(windyWaveColor(-1)), '#329eba'); assert.equal(hex(windyWaveColor(50)), '#c0a39d');
  const mid = windyWaveColor(((1.6 + 3.3) / 2) * FT); assert.ok(mid[1] < 0x93 && mid[1] > 0x5c, 'between #2e93ad and #2d5c88');
});
test('a 2 to 3 m sea (the usual coastal range) shows a clear gradient, not one flat colour', () => {
  const a = windyWaveColor(2), b = windyWaveColor(3), dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  assert.ok(dist > 40, `distance ${dist.toFixed(0)}`);
  assert.ok(new Set(legendRamp('m', 0, 4, 13)).size >= 10, 'the legend ramp has many distinct colours');
});
test('the legend ramp IS the field\'s function: first and last stops are the colours at the range ends, per unit and view', () => {
  for (const unit of ['m', 's', 'm/s']) for (const wide of [false, true]) {
    const [lo, hi] = (wide ? RANGE_WIDE : RANGE)[unit], r = rampFor(unit, wide);
    assert.equal(r[0], hex(mapColor(lo, unit, lo, hi))); assert.equal(r.at(-1), hex(mapColor(hi, unit, lo, hi)));
  }
  assert.notEqual(rampFor('m', false).at(-1), rampFor('m', true).at(-1), 'the wide view reaches different (larger) seas');
});
test('wind uses Windy\'s wind ramp at the true speed (knots on their legend); period walks the wave ramp teal to red', () => {
  for (const [kt, h] of WINDY_WIND_KT) assert.equal(hex(windyWindColor(kt / 1.943844)), h, `${kt} kt`);
  assert.equal(hex(mapColor(0, 'm/s', 0, 15)), '#6271b8'); assert.equal(hex(mapColor(40, 'm/s', 0, 15)), '#527b92');
  assert.notEqual(hex(mapColor(5, 'm/s', 0, 15)), hex(mapColor(12, 'm/s', 0, 15)), 'blue-teal vs green');
  assert.equal(hex(mapColor(6, 's', 6, 18)), '#329eba'); assert.notEqual(hex(mapColor(18, 's', 6, 18)), '#329eba');
});
test('each layer carries its own legend ticks inside its display range', () => {
  for (const unit of ['m', 's', 'm/s']) for (const wide of [false, true]) { const [lo, hi] = (wide ? RANGE_WIDE : RANGE)[unit], t = legendTicks(unit, wide); assert.ok(t.length >= 4, `${unit} ${wide}`); assert.ok(t.every((v) => v >= lo && v <= hi), `${unit} ${wide} in range`); assert.deepEqual([...t].sort((a, b) => a - b), t); }
});

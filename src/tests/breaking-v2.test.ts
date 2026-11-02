import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateBreakingV2, estimateBreaking, wavenumber, BREAKER_INDEX, BREAKING_V2_METHOD} from '../ocean/breakingEstimate.ts';
import {breakingProfile} from '../ocean/localCalibration.ts';
import {breakingV2Enabled, mopBreaking} from '../services/breakingV2.ts';

const P = breakingProfile('spot-2')!;
const FT = 1 / 0.3048;
const base = {hsFt: 1.5 * FT, periodS: 14, directionDeg: 263.49, depthM: 10, shoreNormalDeg: 263.49};

test('dispersion: deep-water and shallow-water limits', () => {
  assert.ok(Math.abs(wavenumber(10, 500) - (2 * Math.PI / 10) ** 2 / 9.81) / ((2 * Math.PI / 10) ** 2 / 9.81) < 1e-6);
  const kShallow = wavenumber(20, 1), w = 2 * Math.PI / 20; assert.ok(Math.abs(w / kShallow - Math.sqrt(9.81 * 1)) / Math.sqrt(9.81) < 0.02);
});

test('normal incidence: breaks where H ≈ 0.78 h, height grows from the 10 m value, range uses the 0.7–1.4 factors', () => {
  const r = estimateBreakingV2(base, P);
  assert.ok(r.ok); if (!r.ok) return;
  assert.ok(r.centralFt > base.hsFt, 'shoaling raises the height');
  assert.ok(r.breakDepthM > 0.5 && r.breakDepthM < 10);
  assert.ok(Math.abs(r.centralFt / FT / r.breakDepthM - BREAKER_INDEX) < 0.08, 'at the break H ≈ γ h');
  assert.ok(r.angleAtBreakDeg < 1e-9 && r.angleAtDepthDeg < 1e-9);
  assert.equal(r.input.kind, 'breaking-estimate'); assert.equal(r.input.valueFt, null); assert.equal(r.input.rangeMethod, BREAKING_V2_METHOD);
  const [lo, hi] = r.input.rangeFt!; assert.ok(hi - lo >= 2 && lo <= r.centralFt * 0.7 + 1 && hi >= r.centralFt * 1.4);
});

test('oblique waves refract toward the normal and break slightly smaller', () => {
  const a = estimateBreakingV2(base, P), b = estimateBreakingV2({...base, directionDeg: 263.49 + 40}, P);
  assert.ok(a.ok && b.ok); if (!a.ok || !b.ok) return;
  assert.ok(b.centralFt < a.centralFt); assert.ok(b.angleAtBreakDeg < b.angleAtDepthDeg);
});

test('bigger or longer waves break bigger; result is monotonic in height', () => {
  const h = [1, 1.5, 2.5, 4].map((m) => { const r = estimateBreakingV2({...base, hsFt: m * FT}, P); assert.ok(r.ok); return r.ok ? r.centralFt : 0; });
  assert.deepEqual([...h].sort((x, y) => x - y), h);
});

test('refusals mirror v1: missing input, short period, outside window, nearly parallel, no profile', () => {
  const code = (o: any, p: any = P) => { const r = estimateBreakingV2({...base, ...o}, p); return r.ok ? 'ok' : r.code; };
  assert.equal(code({hsFt: null}), 'null-input'); assert.equal(code({depthM: null}), 'null-input'); assert.equal(code({shoreNormalDeg: null}), 'no-orientation');
  assert.equal(code({periodS: 6}), 'short-period'); assert.equal(code({directionDeg: 120}), 'outside-window');
  assert.equal(code({}, null), 'no-profile'); assert.equal(code({hsFt: 0}), 'null-input');
  assert.equal(code({directionDeg: 263.49 + 59.9, shoreNormalDeg: 263.49 - 25}), 'outside-window');
});

test('v1 is untouched and v2 is the same order of magnitude on a typical swell (consistency, not validation)', () => {
  const v1 = estimateBreaking({swellHsFt: 4.9, periodS: 14, directionDeg: 270, combinedHsFt: 5.2}, P, 263.49), v2 = estimateBreakingV2({...base, hsFt: 4.2, directionDeg: 266}, P);
  assert.ok(v1.ok && v2.ok); if (!v1.ok || !v2.ok) return;
  assert.ok(v2.centralFt / v1.centralFt > 0.5 && v2.centralFt / v1.centralFt < 2);
});

test('flag is off by default; only an explicit "on" enables it; storage errors mean off', () => {
  assert.equal(breakingV2Enabled({getItem: () => null}, undefined), false);
  assert.equal(breakingV2Enabled({getItem: () => 'true'}, undefined), false);
  assert.equal(breakingV2Enabled({getItem: () => 'on'}, undefined), true);
  assert.equal(breakingV2Enabled({getItem: () => null}, 'on'), true);
  assert.equal(breakingV2Enabled({getItem: () => { throw new Error('blocked'); }}, undefined), false);
  assert.equal(breakingV2Enabled(null, undefined), false);
});

test('mopBreaking only runs for the reviewed MOP point of that spot', () => {
  const m = (unit: any, value: number) => ({value, unit, source: {} as any});
  const rec = {timestamp: '2026-11-01T12:00:00.000Z', height: m('ft', 4.9), period: m('s', 14), direction: m('deg', 266), qualityFlag: 1, mopId: 'SF023', product: 'forecast' as const};
  const ok = mopBreaking('spot-2', rec); assert.ok(ok.ok);
  const no = mopBreaking('spot-3', rec); assert.ok(!no.ok && no.code === 'no-profile');
  const other = mopBreaking('spot-2', {...rec, mopId: 'SM375'}); assert.ok(!other.ok);
});

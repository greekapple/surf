import test from 'node:test';
import assert from 'node:assert/strict';
import {SCALE_KEYS, rampColorAt, valueToPos, layerColor, colorLut, lutIndex, legendModel, breakpointsNative, scaleOf, type Theme} from '../map/ramps.ts';
import {mapConfig} from '../map/mapConfig.ts';
import {rgbToLab, deltaE, simulateCvd, greyOf, hexToRgb, rgbToHex, type RGB} from '../map/colorMath.ts';

// Stage 3: Swello's own ramps. One fixed scale per layer; perceptually ordered; readable in greyscale and for colour-blind viewers; not confusable with the land grey or with "no data".
const THEMES: Theme[] = ['light', 'dark'];
const stops = (k: (typeof SCALE_KEYS)[number], th: Theme) => scaleOf(k).breakpoints.map((_, i, a) => rampColorAt(k, i / (a.length - 1), th));
const LAND = {light: hexToRgb('#7a7a7d'), dark: hexToRgb('#3b3b3f')};

test('lightness rises at every breakpoint (no reversals), in both themes, so the ramp reads in greyscale', () => {
  for (const k of SCALE_KEYS) for (const th of THEMES) { const st = stops(k, th), L = st.map((c) => rgbToLab(c)[0]), g = st.map(greyOf); for (let i = 1; i < st.length; i++) { assert.ok(L[i] - L[i - 1] >= 4, `${k} ${th} L* step ${i}: ${(L[i] - L[i - 1]).toFixed(1)}`); assert.ok(g[i] - g[i - 1] >= 6, `${k} ${th} grey step ${i}: ${(g[i] - g[i - 1]).toFixed(1)}`); } }
});
test('the calm end is a dark, saturated colour: not pale like ice or "no data", not a grey like the land', () => {
  for (const k of SCALE_KEYS) for (const th of THEMES) { const c = rampColorAt(k, 0, th), lab = rgbToLab(c); assert.ok(lab[0] <= 36, `${k} ${th} calm L* ${lab[0].toFixed(1)}`); assert.ok(Math.hypot(lab[1], lab[2]) >= 20, `${k} ${th} calm chroma`); assert.ok(deltaE(c, LAND[th]) >= 20, `${k} ${th} calm vs land`); }
});
test('adjacent breakpoints are clearly different colours: delta E >= 9 everywhere, >= 12 across the surfable 2 to 10 ft', () => {
  for (const k of SCALE_KEYS) for (const th of THEMES) { const st = stops(k, th), bp = scaleOf(k).breakpoints; for (let i = 1; i < st.length; i++) { const d = deltaE(st[i - 1], st[i]); assert.ok(d >= 9, `${k} ${th} step ${i}: ${d.toFixed(1)}`); if ((k === 'WAVES' || k === 'SWELL') && bp[i - 1] >= 2 && bp[i] <= 10) assert.ok(d >= 12, `${k} ${th} surfable step ${bp[i - 1]}-${bp[i]} ft: ${d.toFixed(1)}`); } }
});
test('colour-blind simulation (deuteranopia, protanopia, tritanopia): adjacent breakpoints stay distinguishable', () => {
  for (const k of SCALE_KEYS) { const st = stops(k, 'light'); for (const [kind, min] of [['deuteranopia', 4.5], ['protanopia', 4.5], ['tritanopia', 4]] as const) for (let i = 1; i < st.length; i++) { const d = deltaE(simulateCvd(st[i - 1], kind), simulateCvd(st[i], kind)); assert.ok(d >= min, `${k} ${kind} step ${i}: ${d.toFixed(1)}`); } }
});
test('no ramp colour is confusable with the land grey of either basemap', () => {
  for (const k of SCALE_KEYS) for (const th of THEMES) for (const c of stops(k, th)) assert.ok(deltaE(c, LAND[th]) >= 12, `${k} ${th} ${rgbToHex(c)}`);
});
test('each layer has its own ramp: the mid colours of the layers differ', () => {
  const mids = SCALE_KEYS.map((k) => rampColorAt(k, 0.5, 'light'));
  for (let i = 0; i < mids.length; i++) for (let j = i + 1; j < mids.length; j++) assert.ok(deltaE(mids[i], mids[j]) >= 20, `${SCALE_KEYS[i]} vs ${SCALE_KEYS[j]}: ${deltaE(mids[i], mids[j]).toFixed(1)}`);
});
test('ONE fixed scale per layer: a value maps to the same position and colour whatever the zoom or range (no wide/coastal switch)', () => {
  assert.equal(valueToPos('WAVES', 3 * 0.3048), 0.3); assert.equal(valueToPos('WAVES', 10 * 0.3048), 0.7); assert.equal(valueToPos('WAVES', 0), 0); assert.equal(valueToPos('WAVES', 99), 1); assert.equal(valueToPos('PERIOD', 14), 5 / 8);
  assert.deepEqual(layerColor('WAVES', 2.4), layerColor('WAVES', 2.4)); assert.equal(Object.keys(mapConfig.scales).length, 4);
  const bp = breakpointsNative('WAVES'); for (let i = 1; i < bp.length; i++) assert.ok(valueToPos('WAVES', bp[i]) > valueToPos('WAVES', bp[i - 1]), 'monotone');
});
test('2 to 10 ft has its own distinct steps: six breakpoints between 2 and 10 ft occupy the middle of the ramp', () => {
  const p2 = valueToPos('WAVES', 2 * 0.3048), p10 = valueToPos('WAVES', 10 * 0.3048); assert.ok(p10 - p2 >= 0.499, `2-10 ft spans ${(p10 - p2).toFixed(2)} of the ramp`);
});
test('the legend is the painted ramp: ticks at the breakpoints, the same colours, in the person\'s units; never rescaled', () => {
  const ft = legendModel('WAVES', {heightUnit: 'ft', windUnit: 'mph'}), m = legendModel('WAVES', {heightUnit: 'm', windUnit: 'kn'});
  assert.deepEqual(ft.ticks.map((t) => t.label), ['0', '1', '2', '3', '4', '6', '8', '10', '15', '20', '30+']); assert.equal(ft.unitLabel, 'ft'); assert.equal(m.unitLabel, 'm'); assert.equal(m.hi, '9.1+');
  assert.equal(ft.gradient[0], rgbToHex(rampColorAt('WAVES', 0))); assert.equal(ft.gradient.at(-1), rgbToHex(rampColorAt('WAVES', 1))); assert.deepEqual(ft.gradient, m.gradient, 'same ramp whatever the unit');
  const kn = legendModel('WIND', {heightUnit: 'ft', windUnit: 'kn'}), mph = legendModel('WIND', {heightUnit: 'ft', windUnit: 'mph'}); assert.equal(kn.unitLabel, 'kt'); assert.equal(mph.unitLabel, 'mph'); assert.equal(kn.ticks[1].label, '3'); assert.equal(mph.ticks[1].label, '3.5');
  assert.deepEqual(legendModel('PERIOD', {heightUnit: 'ft', windUnit: 'mph'}).ticks.map((t) => t.label), ['4', '6', '8', '10', '12', '14', '16', '18', '20+']);
  // the painter's lookup table agrees with the ramp at every breakpoint
  for (const k of SCALE_KEYS) { const lut = colorLut(k), bp = breakpointsNative(k); for (const v of bp) { const q = lutIndex(k, v), c = layerColor(k, v); assert.ok(Math.hypot(lut[q] - c[0], lut[q + 1] - c[1], lut[q + 2] - c[2]) < 6, `${k} ${v}`); } }
});
test('breakpoints follow the brief: waves 0 1 2 3 4 6 8 10 15 20 30+ ft, period 4 to 20+ s, wind emphasises 0 to 25 kt', () => {
  assert.deepEqual([...mapConfig.scales.WAVES.breakpoints], [0, 1, 2, 3, 4, 6, 8, 10, 15, 20, 30]); assert.deepEqual([...mapConfig.scales.SWELL.breakpoints], [0, 1, 2, 3, 4, 6, 8, 10, 15, 20, 30]); assert.deepEqual([...mapConfig.scales.PERIOD.breakpoints], [4, 6, 8, 10, 12, 14, 16, 18, 20]);
  const w = mapConfig.scales.WIND.breakpoints; assert.ok(w.filter((b) => b <= 25).length >= 7, 'at least seven of the eleven wind breakpoints sit at or below 25 kt');
});

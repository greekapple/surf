import test from 'node:test';
import assert from 'node:assert/strict';
import {SCALE_KEYS, rampColorAt, valueToPos, layerColor, colorLut, lutIndex, legendModel, breakpointsNative, scaleOf, type Theme} from '../map/ramps.ts';
import {mapConfig} from '../map/mapConfig.ts';
import {rgbToLab, deltaE, simulateCvd, greyOf, hexToRgb, rgbToHex, type RGB} from '../map/colorMath.ts';

// Stage 3: Swello's own ramps. One fixed scale per layer; perceptually ordered; readable in greyscale and for colour-blind viewers; not confusable with the land grey or with "no data".
const THEMES: Theme[] = ['light', 'dark'];
const stops = (k: (typeof SCALE_KEYS)[number], th: Theme) => scaleOf(k).breakpoints.map((_, i, a) => rampColorAt(k, i / (a.length - 1), th));
/** Wave and swell height use Windy's colours (explicit stops, user decision 2026-11-04); Wind and Period keep Swello's own LCH ramps, which are the ones held to the ordered-lightness rules. */
const OWN_KEYS = SCALE_KEYS.filter((k) => !('stops' in scaleOf(k)));
const LAND = {light: hexToRgb('#7a7a7d'), dark: hexToRgb('#3b3b3f')};
const SEA = {light: hexToRgb('#55606b'), dark: hexToRgb('#1d2733')}; // style.ts palette(theme, heat=true).sea: the sea where the model has no value

test('lightness rises at every breakpoint (no reversals), in both themes, so the ramp reads in greyscale', () => {
  for (const k of OWN_KEYS) for (const th of THEMES) { const st = stops(k, th), L = st.map((c) => rgbToLab(c)[0]), g = st.map(greyOf); for (let i = 1; i < st.length; i++) { assert.ok(L[i] - L[i - 1] >= 4, `${k} ${th} L* step ${i}: ${(L[i] - L[i - 1]).toFixed(1)}`); assert.ok(g[i] - g[i - 1] >= 6, `${k} ${th} grey step ${i}: ${(g[i] - g[i - 1]).toFixed(1)}`); } }
});
test('the calm end is a dark, saturated colour: not pale like ice or "no data", not a grey like the land', () => {
  for (const k of OWN_KEYS) for (const th of THEMES) { const c = rampColorAt(k, 0, th), lab = rgbToLab(c); assert.ok(lab[0] <= 36, `${k} ${th} calm L* ${lab[0].toFixed(1)}`); assert.ok(Math.hypot(lab[1], lab[2]) >= 20, `${k} ${th} calm chroma`); assert.ok(deltaE(c, LAND[th]) >= 20, `${k} ${th} calm vs land`); }
});
test('adjacent breakpoints are clearly different colours: delta E >= 9 everywhere, >= 12 across the surfable 2 to 10 ft', () => {
  for (const k of OWN_KEYS) for (const th of THEMES) { const st = stops(k, th), bp = scaleOf(k).breakpoints; for (let i = 1; i < st.length; i++) { const d = deltaE(st[i - 1], st[i]); assert.ok(d >= 9, `${k} ${th} step ${i}: ${d.toFixed(1)}`); if ((k === 'WAVES' || k === 'SWELL') && bp[i - 1] >= 2 && bp[i] <= 10) assert.ok(d >= 12, `${k} ${th} surfable step ${bp[i - 1]}-${bp[i]} ft: ${d.toFixed(1)}`); } }
});
test('colour-blind simulation (deuteranopia, protanopia, tritanopia): adjacent breakpoints stay distinguishable', () => {
  for (const k of OWN_KEYS) { const st = stops(k, 'light'); for (const [kind, min] of [['deuteranopia', 4.5], ['protanopia', 4.5], ['tritanopia', 4]] as const) for (let i = 1; i < st.length; i++) { const d = deltaE(simulateCvd(st[i - 1], kind), simulateCvd(st[i], kind)); assert.ok(d >= min, `${k} ${kind} step ${i}: ${d.toFixed(1)}`); } }
});
test('no ramp colour is confusable with the land grey of either basemap', () => {
  for (const k of OWN_KEYS) for (const th of THEMES) for (const c of stops(k, th)) assert.ok(deltaE(c, LAND[th]) >= 12, `${k} ${th} ${rgbToHex(c)}`);
});
test('each layer has its own ramp: the mid colours of the layers differ', () => {
  const mids = SCALE_KEYS.map((k) => rampColorAt(k, 0.5, 'light'));
  for (let i = 0; i < mids.length; i++) for (let j = i + 1; j < mids.length; j++) if (!(SCALE_KEYS[i] === 'WAVES' && SCALE_KEYS[j] === 'SWELL')) assert.ok(deltaE(mids[i], mids[j]) >= 20, `${SCALE_KEYS[i]} vs ${SCALE_KEYS[j]}: ${deltaE(mids[i], mids[j]).toFixed(1)}`);
});
test('ONE fixed scale per layer: a value maps to the same position and colour whatever the zoom or range (no wide/coastal switch)', () => {
  assert.equal(valueToPos('WAVES', 5 * 0.3048), 0.375); assert.equal(valueToPos('WAVES', 10 * 0.3048), 0.625); assert.equal(valueToPos('WAVES', 0), 0); assert.equal(valueToPos('WAVES', 99), 1); assert.equal(valueToPos('PERIOD', 14), 5 / 8);
  assert.deepEqual(layerColor('WAVES', 2.4), layerColor('WAVES', 2.4)); assert.equal(Object.keys(mapConfig.scales).length, 4);
  const bp = breakpointsNative('WAVES'); for (let i = 1; i < bp.length; i++) assert.ok(valueToPos('WAVES', bp[i]) > valueToPos('WAVES', bp[i - 1]), 'monotone');
});
test('3 to 13 ft (the surfable sizes) occupy the middle half of the height ramp, with their own steps', () => {
  const p3 = valueToPos('WAVES', 3.3 * 0.3048), p13 = valueToPos('WAVES', 13 * 0.3048); assert.ok(p13 - p3 >= 0.49, `3.3-13 ft spans ${(p13 - p3).toFixed(2)} of the ramp`);
});
test('Swell keeps Windy\'s wave-height colours: one stop per breakpoint, blue to indigo to magenta to red to pale salmon, each step visibly different (delta E >= 8)', () => {
  const sc = scaleOf('SWELL') as unknown as {stops: string[]; breakpoints: number[]}; assert.equal(sc.stops.length, sc.breakpoints.length); const c = sc.stops.map(hexToRgb); for (let i = 1; i < c.length; i++) assert.ok(deltaE(c[i], c[i - 1]) >= 8, `SWELL step ${i}: ${deltaE(c[i], c[i - 1]).toFixed(1)}`); assert.ok(c[0][2] > c[0][0] + 60, 'the calm end is blue'); assert.ok(c[5][0] > c[5][1] + 50 && c[5][2] > c[5][1], 'the middle is magenta'); assert.ok(c.at(-1)![0] > c.at(-1)![2] + 30, 'the top is warm');
  assert.deepEqual(sc.stops, ['#2646a0', '#327196', '#346496', '#4448a0', '#7a46ae', '#a03787', '#a83870', '#c1645c', '#cda096'], 'Swell is unchanged by the Waves palette (map-smooth, 2026-11-06)');
  assert.deepEqual(rampColorAt('SWELL', 0, 'light'), rampColorAt('SWELL', 0, 'dark'), 'the same colours in both themes');
});
test('Waves: matched to the user\'s Surfline screenshots (navy, blue, cyan, green, yellow, orange, red, dark red, purple), one stop per breakpoint, every step clearly different, readable on both basemaps', () => {
  const sc = scaleOf('WAVES') as unknown as {stops: string[]; breakpoints: number[]}; assert.equal(sc.stops.length, sc.breakpoints.length); const c = sc.stops.map(hexToRgb);
  for (let i = 1; i < c.length; i++) { assert.ok(deltaE(c[i], c[i - 1]) >= 15, `WAVES step ${i}: ${deltaE(c[i], c[i - 1]).toFixed(1)}`); for (const [kind, min] of [['deuteranopia', 5], ['protanopia', 5], ['tritanopia', 5]] as const) assert.ok(deltaE(simulateCvd(c[i - 1], kind), simulateCvd(c[i], kind)) >= min, `WAVES ${kind} step ${i}`); }
  const hue = (x: RGB) => { const [, a, b] = rgbToLab(x); return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360; };
  assert.ok(c[0][2] > c[0][0] + 60 && rgbToLab(c[0])[0] < 30, 'the calm end is a dark navy'); // sizes from the key of the user's Surfline screenshots (2026-11-07): cyan ~3, green 5-6, yellow-green 7, yellow 8, orange 10, red 15, dark red 20, magenta/purple 25+
  assert.ok(hue(c[2]) > 200 && hue(c[2]) < 260, '3.3 ft is cyan'); assert.ok(c[3][1] > c[3][0] + 80 && c[3][1] > c[3][2] + 60, '5 ft is green');
  assert.ok(c[4][1] > 180 && c[4][0] > 120 && c[4][2] < 90, '6.6 ft is yellow-green'); const y8 = rampColorAt('WAVES', valueToPos('WAVES', 8 * 0.3048)); assert.ok(y8[0] > 200 && y8[1] > 170 && y8[2] < 80, `8 ft is yellow (${y8})`);
  assert.ok(c[5][0] > 220 && c[5][1] > 120 && c[5][1] < 180 && c[5][2] < 60, '10 ft is orange'); assert.ok(c[6][0] > 200 && c[6][1] < 100, '13 ft is red'); assert.ok(c[7][0] > 140 && c[7][0] < 200 && c[7][1] < 60, '20 ft is dark red');
  assert.ok(c[8][2] > 150 && c[8][0] > 130 && c[8][1] < 80, '30+ ft is magenta-purple');
  for (const th of THEMES) for (const x of c) assert.ok(deltaE(x, LAND[th]) >= 12 && deltaE(x, SEA[th]) >= 12, `${rgbToHex(x)} vs the ${th} land and sea grey`);
  assert.notDeepEqual(sc.stops, (scaleOf('SWELL') as unknown as {stops: string[]}).stops, 'Waves and Swell are told apart at a glance');
  assert.deepEqual(rampColorAt('WAVES', 0, 'light'), rampColorAt('WAVES', 0, 'dark'), 'the same colours in both themes');
});
test('the legend is the painted ramp: ticks at the breakpoints, the same colours, in the person\'s units; never rescaled', () => {
  const ft = legendModel('WAVES', {heightUnit: 'ft', windUnit: 'mph'}), m = legendModel('WAVES', {heightUnit: 'm', windUnit: 'kn'});
  assert.deepEqual(ft.ticks.map((t) => t.label), ['0', '1.6', '3.3', '5', '6.6', '10', '13', '20', '30+']); assert.equal(ft.unitLabel, 'ft'); assert.equal(m.unitLabel, 'm'); assert.equal(m.hi, '9.1+');
  assert.equal(ft.gradient[0], rgbToHex(rampColorAt('WAVES', 0))); assert.equal(ft.gradient.at(-1), rgbToHex(rampColorAt('WAVES', 1))); assert.deepEqual(ft.gradient, m.gradient, 'same ramp whatever the unit');
  const kn = legendModel('WIND', {heightUnit: 'ft', windUnit: 'kn'}), mph = legendModel('WIND', {heightUnit: 'ft', windUnit: 'mph'}); assert.equal(kn.unitLabel, 'kt'); assert.equal(mph.unitLabel, 'mph'); assert.deepEqual(kn.ticks.map((t) => t.label), ['0', '5', '10', '15', '20', '25', '30', '40', '50+']); assert.deepEqual(mph.ticks.map((t) => t.label), ['0', '6', '12', '17', '23', '29', '35', '46', '58+'], 'whole numbers, never 25.3 or 57.5'); assert.deepEqual(legendModel('WIND', {heightUnit: 'ft', windUnit: 'km/h'}).ticks.map((t) => t.label), ['0', '9', '19', '28', '37', '46', '56', '74', '93+']);
  assert.deepEqual(legendModel('PERIOD', {heightUnit: 'ft', windUnit: 'mph'}).ticks.map((t) => t.label), ['4', '6', '8', '10', '12', '14', '16', '18', '20+']);
  // the painter's lookup table agrees with the ramp at every breakpoint
  for (const k of SCALE_KEYS) { const lut = colorLut(k), bp = breakpointsNative(k); for (const v of bp) { const q = lutIndex(k, v), c = layerColor(k, v); assert.ok(Math.hypot(lut[q] - c[0], lut[q + 1] - c[1], lut[q + 2] - c[2]) < 16, `${k} ${v}`); } }
});
test('breakpoints: waves and swell 0 1.6 3.3 5 6.6 10 13 20 30+ ft (Windy\'s legend ticks 1.6 / 3.3 / 5 / 6.6 / 20 / 30), period 4 to 20+ s, wind emphasises 0 to 25 kt', () => {
  assert.deepEqual([...mapConfig.scales.WAVES.breakpoints], [0, 1.6, 3.3, 5, 6.6, 10, 13, 20, 30]); assert.deepEqual([...mapConfig.scales.SWELL.breakpoints], [0, 1.6, 3.3, 5, 6.6, 10, 13, 20, 30]); assert.deepEqual([...mapConfig.scales.PERIOD.breakpoints], [4, 6, 8, 10, 12, 14, 16, 18, 20]);
  const w = mapConfig.scales.WIND.breakpoints; assert.deepEqual([...w], [0, 5, 10, 15, 20, 25, 30, 40, 50]); assert.ok(w.filter((b) => b <= 25).length >= 6, 'six of the nine wind breakpoints sit at or below 25 kt');
});

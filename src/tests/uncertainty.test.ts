import test from 'node:test';
import assert from 'node:assert/strict';
import {intervalFor, CONVENTION_W, BREAKER_INDEX_W, V1_STEP_W, DISAGREE_HALF} from '../services/uncertainty.ts';
import {normalizeSpread, loadModelSpread, spreadAt, clearSpread, modelSpreadURL, SPREAD_MODELS} from '../services/modelSpread.ts';
import {headlineSurf} from '../services/headlineSurf.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';

test('the cited constants are what the documentation says', () => {
  assert.ok(Math.abs(CONVENTION_W - 0.1195) < 0.001); assert.ok(Math.abs(BREAKER_INDEX_W - 0.1621) < 0.001); assert.ok(Math.abs(V1_STEP_W - 0.2000) < 0.001); assert.ok(Math.abs(DISAGREE_HALF - 0.1500) < 0.001);
});
test('inputs agree: a narrow range around the central height (v2 about ±22%, v1 about ±26%), always at least 1 ft wide, never negative', () => {
  const v2 = intervalFor({method: 'mop-v2', centralFt: 8})!, v1 = intervalFor({method: 'v1', centralFt: 8})!;
  assert.equal(v2.components.length, 2); assert.ok(Math.abs(v2.halfWidth - Math.sqrt(CONVENTION_W ** 2 + BREAKER_INDEX_W ** 2)) < 1e-9);
  assert.deepEqual([v2.loFt, v2.hiFt], [6, 10]); assert.ok(v1.hiFt - v1.loFt >= v2.hiFt - v2.loFt - 1); assert.equal(v2.disagree, false);
  assert.ok(v2.hiFt - v2.loFt < 14 * 0.7 / 1.0, 'narrower than the legacy 0.7–1.4 band (8 ft → 6–12)');
  for (const c of [0.2, 0.5, 1, 3]) { const i = intervalFor({method: 'v1', centralFt: c})!; assert.ok(i.loFt >= 0 && i.hiFt - i.loFt >= 1, `c=${c}`); }
  assert.equal(intervalFor({method: 'v1', centralFt: 0}), null); assert.equal(intervalFor({method: 'v1', centralFt: NaN}), null);
});
test('inputs disagree: the range widens with the model spread and the method difference; only the wave-model spread (beyond a factor of 1.35) says "disagree"', () => {
  const methodOnly = intervalFor({method: 'mop-v2', centralFt: 8, mopOverOffshore: 1.8})!; assert.equal(methodOnly.disagree, false, 'v2 vs v1 are two methods, not two sources'); assert.ok(methodOnly.halfWidth > intervalFor({method: 'mop-v2', centralFt: 8})!.halfWidth); assert.doesNotMatch(methodOnly.note, /disagree/);
  const calm = intervalFor({method: 'mop-v2', centralFt: 8, modelSpread: {ratio: 1.05, models: 3}, mopOverOffshore: 1.04})!, split = intervalFor({method: 'mop-v2', centralFt: 8, modelSpread: {ratio: 1.8, models: 3}, mopOverOffshore: 1.5})!;
  assert.equal(calm.disagree, false); assert.equal(split.disagree, true); assert.ok(split.halfWidth > calm.halfWidth); assert.ok(split.hiFt - split.loFt > calm.hiFt - calm.loFt + 3);
  assert.match(split.note, /Wave models disagree/); assert.ok(split.components.some((c) => c.id === 'model-spread') && split.components.some((c) => c.id === 'mop-vs-offshore'));
  assert.equal(intervalFor({method: 'v1', centralFt: 8, modelSpread: {ratio: 1.8, models: 1}})!.components.some((c) => c.id === 'model-spread'), false, 'one model is not a spread');
  assert.equal(intervalFor({method: 'v1', centralFt: 8, mopOverOffshore: 3})!.components.some((c) => c.id === 'mop-vs-offshore'), false, 'v1 has no MOP');
});
test('the range grows monotonically with each component and the combination is a quadrature sum', () => {
  const a = intervalFor({method: 'v1', centralFt: 10})!, b = intervalFor({method: 'v1', centralFt: 10, modelSpread: {ratio: 1.2, models: 2}})!, c = intervalFor({method: 'v1', centralFt: 10, modelSpread: {ratio: 1.6, models: 2}})!;
  assert.ok(a.halfWidth < b.halfWidth && b.halfWidth < c.halfWidth); assert.ok(Math.abs(b.halfWidth - Math.sqrt(CONVENTION_W ** 2 + V1_STEP_W ** 2 + (Math.log(1.2) / 2) ** 2)) < 1e-9);
});

const T = 1792454400, times = Array.from({length: 24}, (_, i) => T + i * 3600);
const multi = (heights: Record<string, number>, period = 14, dir = 270) => ({hourly: {time: times, ...Object.fromEntries(Object.entries(heights).flatMap(([m, hs]) => [[`swell_wave_height_${m}`, times.map(() => hs)], [`swell_wave_period_${m}`, times.map(() => period)], [`swell_wave_direction_${m}`, times.map(() => dir)], [`wave_height_${m}`, times.map(() => hs + 0.1)]]))}});
test('model spread: per-hour ratio of the breaking height across models; models with no data are left out; one model gives no spread', () => {
  const ob = evidenceSpot('spot-2'), s = normalizeSpread(multi({meteofrance_wave: 1.5, gwam: 1.2, ncep_gfswave016: 1.5, ecmwf_wam025: 0}), ob);
  const h = s.byHour.get(new Date(T * 1000).toISOString())!; assert.equal(h.models, 3); assert.ok(!s.modelsUsed.includes('ecmwf_wam025'));
  assert.ok(Math.abs(h.ratio - (1.5 / 1.2) ** 0.8) < 0.02, `breaking height scales about with Hs^0.8 (ratio ${h.ratio})`);
  assert.equal(normalizeSpread(multi({meteofrance_wave: 1.5}), ob).byHour.size, 0); assert.equal(normalizeSpread({hourly: {}}, ob).byHour.size, 0); assert.equal(normalizeSpread(null, ob).byHour.size, 0);
  assert.equal(normalizeSpread(multi({meteofrance_wave: 1.5, gwam: 1.2}), evidenceSpot('cs-rincon')).byHour.size, 0, 'a spot without a profile (Rincon, refused by the wrap rule) has no spread');
});
test('model spread fetch: one request per spot, cached for 10 minutes, failure is silent; the URL asks for the documented models', async () => {
  clearSpread(); const ob = evidenceSpot('spot-2'); let calls = 0; const fetchJson = async () => { calls++; return multi({meteofrance_wave: 1.5, gwam: 1.1}); };
  const a = await loadModelSpread(ob, fetchJson, 1e12), b = await loadModelSpread(ob, fetchJson, 1e12 + 60000); assert.equal(calls, 1); assert.ok(a && a === b);
  assert.ok(spreadAt('spot-2', new Date(T * 1000).toISOString())!.ratio > 1); await loadModelSpread(ob, fetchJson, 1e12 + 11 * 60000); assert.equal(calls, 2);
  clearSpread(); assert.equal(await loadModelSpread(ob, async () => { throw new Error('offline'); }, 1e12), null); assert.equal(spreadAt('spot-2', new Date(T * 1000).toISOString()), null);
  const u = new URL(modelSpreadURL(ob)); assert.equal(u.searchParams.get('models'), SPREAD_MODELS.join(',')); assert.equal(u.hostname, 'marine-api.open-meteo.com');
});

const marine = (hs: number) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => hs + 0.1), swell_wave_height: times.map(() => hs), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}});
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 4)}};
test('headlineSurf: the range is built from the central height; narrower than the legacy band; wider with spread; the shape stays compatible', () => {
  const f = toLegacy(normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.5), weather, new Date(T * 1000).toISOString())[1]);
  const none = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: [], spread: null}) as any, agree = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: [], spread: {ratio: 1.03, models: 3}}) as any, split = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: [], spread: {ratio: 2, models: 3}}) as any;
  for (const h of [none, agree, split]) { assert.equal(h.kind, 'estimate'); assert.ok(h.loFt >= 0 && h.hiFt > h.loFt && typeof h.words === 'string' && h.label && h.method && h.methodLabel); assert.ok(h.centralFt > 0); assert.ok(h.loFt <= h.centralFt && h.hiFt >= h.centralFt); }
  const legacy = f.evidence!.faceEstimate.input!.rangeFt!; assert.ok(none.hiFt - none.loFt < legacy[1] - legacy[0], `${none.loFt}–${none.hiFt} vs legacy ${legacy}`);
  assert.ok(split.hiFt - split.loFt > agree.hiFt - agree.loFt); assert.equal(split.interval.disagree, true); assert.match(split.methodLabel, /wave models disagree/); assert.equal(agree.interval.disagree, false); assert.doesNotMatch(agree.methodLabel, /disagree/);
  assert.ok(Array.isArray(none.interval.components) && none.interval.note.length > 20);
});
test('headlineSurf: a calibrated range is unchanged in kind (n observations, calibration label) and has no interval object', () => {
  const f = toLegacy(normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.5), weather, new Date(T * 1000).toISOString())[1]), base = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: [], spread: null}) as any;
  const ob = (i: number) => ({id: 'o' + i, schema: 1 as const, spotId: 'spot-2', observedAt: new Date(T * 1000).toISOString(), loggedAt: '', rangeFt: [4, 4] as [number, number], faceFt: 4, pair: {centralFt: base.centralFt, loFt: base.loFt, hiFt: base.hiFt, method: base.method, validAt: '', offshoreHsFt: 5, primaryTpS: 14, basis: 'central' as const}});
  const cal = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: Array.from({length: 8}, (_, i) => ob(i)), spread: null}) as any;
  assert.equal(cal.calibration.n, 8); assert.equal(cal.interval, undefined); assert.ok(Math.abs(cal.calibration.ratio - 4 / base.centralFt) < 1e-9);
});

test('T-073 review fixes: the legacy band is labelled when a record has no central height; calibration only mixes pairs on the central basis', async () => {
  const f = toLegacy(normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.5), weather, new Date(T * 1000).toISOString())[1]); delete (f.evidence!.faceEstimate as any).centralFt;
  const h = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: [], spread: null}) as any;
  assert.match(h.methodLabel, /fixed 0\.7–1\.4 band \(older cached data\)/); assert.equal(h.interval.components.length, 0); assert.match(h.interval.note, /Fixed 0\.7–1\.4 band/);
  const {fitFor} = await import('../services/calibrationMath.ts');
  const ob = (i: number, basis?: 'central') => ({id: 'x' + i, schema: 1 as const, spotId: 'spot-2', observedAt: '', loggedAt: '', rangeFt: [4, 4] as [number, number], faceFt: 4, pair: {centralFt: 8, loFt: 6, hiFt: 11, method: 'v1' as const, validAt: '', offshoreHsFt: 5, primaryTpS: 14, ...(basis ? {basis} : {})}});
  assert.equal(fitFor(Array.from({length: 8}, (_, i) => ob(i)), 'spot-2', 'v1').n, 0, 'pairs from the old fixed-band midpoint are not mixed into a fit');
  assert.equal(fitFor(Array.from({length: 8}, (_, i) => ob(i, 'central')), 'spot-2', 'v1').status, 'active');
});

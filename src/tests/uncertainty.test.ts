import test from 'node:test';
import assert from 'node:assert/strict';
import {intervalFor, SKILL_FLOOR_W, LEAD_SKILL, skillW, V1_STEP_W, DISAGREE_HALF} from '../services/uncertainty.ts';
import {normalizeSpread, loadModelSpread, spreadAt, clearSpread, modelSpreadURL, SPREAD_MODELS, MODEL_SKILL, PRUNED_MODELS, PRUNE_HALF_WIDTH, SKILL_AS_OF} from '../services/modelSpread.ts';
import {headlineSurf} from '../services/headlineSurf.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot, evidenceSpots} from '../ocean/spots.ts';
import {breakingProfile} from '../ocean/localCalibration.ts';
import {toLegacy} from '../ocean/bridge.ts';

test('the measured constants are what the documentation says', () => {
  assert.equal(SKILL_FLOOR_W, 0.156); assert.ok(LEAD_SKILL.every((v, i) => i === 0 || v > LEAD_SKILL[i - 1]), 'error grows with lead'); assert.ok(Math.abs(skillW(0) - 0.156) < 1e-9 && Math.abs(skillW(72) - 0.181) < 1e-9 && Math.abs(skillW(36) - 0.1655) < 1e-3 && skillW(500) === 0.425 && skillW(NaN) === 0.156); assert.ok(Math.abs(V1_STEP_W - 0.1705) < 0.001); assert.ok(Math.abs(DISAGREE_HALF - 0.1500) < 0.001);
  for (const m of ['meteofrance_wave', 'ecmwf_wam025', 'ncep_gfswave016']) assert.ok(MODEL_SKILL[m].halfWidth <= PRUNE_HALF_WIDTH, m); assert.ok(PRUNED_MODELS.every((m) => MODEL_SKILL[m].halfWidth > 0.18)); assert.match(SKILL_AS_OF, /^2026-11-\d\d$/);
});
test('models agree: the range is the measured forecast error at that lead (about ±17% now, ±53% at 7 days) around the central height, rounded outward to whole feet (it contains the stated interval), at least 1 ft wide, never negative', () => {
  const a = intervalFor({method: 'mop-v2', centralFt: 8})!, b = intervalFor({method: 'mop-v2', centralFt: 8, modelSpread: {ratio: 1.04, models: 3}})!;
  assert.deepEqual([a.loFt, a.hiFt], [6, 10]); assert.deepEqual([b.loFt, b.hiFt], [6, 10]); for (let c = 1; c <= 12; c += 0.7) { const i = intervalFor({method: 'mop-v2', centralFt: c, leadHours: 30})!; assert.ok(i.loFt <= c * Math.exp(-i.halfWidth) + 1e-6 && i.hiFt >= c * Math.exp(i.halfWidth) - 1e-6, `c=${c} ${i.loFt}–${i.hiFt}`); } assert.equal(a.components.length, 1); assert.equal(a.components[0].id, 'forecast-skill'); assert.equal(b.disagree, false); assert.ok(Math.abs(a.halfWidth - skillW(0)) < 1e-9);
  for (const c of [0.2, 0.5, 1, 3]) { const i = intervalFor({method: 'v1', centralFt: c})!; assert.ok(i.loFt >= 0 && i.hiFt - i.loFt >= 1, `c=${c}`); }
  assert.equal(intervalFor({method: 'v1', centralFt: 0}), null); assert.equal(intervalFor({method: 'v1', centralFt: NaN}), null);
  assert.ok(intervalFor({method: 'mop-v2', centralFt: 5})!.hiFt - intervalFor({method: 'mop-v2', centralFt: 5})!.loFt <= 3, 'a 5 ft surf height reads about 2–3 ft wide when the models agree');
  const now = intervalFor({method: 'mop-v2', centralFt: 10, leadHours: 0})!, d3 = intervalFor({method: 'mop-v2', centralFt: 10, leadHours: 72})!, d7 = intervalFor({method: 'mop-v2', centralFt: 10, leadHours: 168})!;
  assert.ok(now.hiFt - now.loFt < d7.hiFt - d7.loFt && d3.halfWidth > now.halfWidth && d7.halfWidth > d3.halfWidth, 'the range widens with lead time');
});
test('models disagree: the range widens to the disagreement (max, not a sum with the skill floor) and says so beyond a factor of 1.35; one model is not a spread', () => {
  const calm = intervalFor({method: 'mop-v2', centralFt: 8, modelSpread: {ratio: 1.08, models: 3}})!, split = intervalFor({method: 'mop-v2', centralFt: 8, modelSpread: {ratio: 1.8, models: 3}})!;
  assert.equal(calm.disagree, false); assert.equal(split.disagree, true); assert.ok(split.hiFt - split.loFt >= calm.hiFt - calm.loFt + 2); assert.match(split.note, /Wave models disagree/); assert.equal(split.components.length, 1); assert.equal(split.components[0].id, 'model-spread'); assert.ok(Math.abs(split.halfWidth - Math.log(1.8) / 2) < 1e-9); assert.equal(intervalFor({method: 'mop-v2', centralFt: 8, leadHours: 168, modelSpread: {ratio: 1.3, models: 3}})!.components[0].id, 'forecast-skill', 'at 7 days the measured error already exceeds a modest disagreement');
  assert.equal(intervalFor({method: 'mop-v2', centralFt: 8, modelSpread: {ratio: 1.8, models: 1}})!.disagree, false);
  assert.equal(intervalFor({method: 'mop-v2', centralFt: 8, mopOverOffshore: 3})!.halfWidth, skillW(0), 'the v2-vs-v1 method difference no longer widens a v2 range');
});
test('v1 adds the measured offshore-to-nearshore step in quadrature; v2 never does', () => {
  const v2 = intervalFor({method: 'mop-v2', centralFt: 10})!, v1 = intervalFor({method: 'v1', centralFt: 10})!;
  assert.ok(v1.halfWidth > v2.halfWidth); assert.ok(Math.abs(v1.halfWidth - Math.sqrt(skillW(0) ** 2 + V1_STEP_W ** 2)) < 1e-9); assert.ok(v1.components.some((c) => c.id === 'offshore-step') && !v2.components.some((c) => c.id === 'offshore-step'));
});

const T = 1792454400, times = Array.from({length: 24}, (_, i) => T + i * 3600);
const multi = (heights: Record<string, number>, period = 14, dir = 270) => ({hourly: {time: times, ...Object.fromEntries(Object.entries(heights).flatMap(([m, hs]) => [[`swell_wave_height_${m}`, times.map(() => hs)], [`swell_wave_period_${m}`, times.map(() => period)], [`swell_wave_direction_${m}`, times.map(() => dir)], [`wave_height_${m}`, times.map(() => hs + 0.1)]]))}});
test('model spread: bias-corrected, skill-pruned ratio of the breaking height across models; no-data and pruned models are left out; one model gives no spread', () => {
  const ob = evidenceSpot('spot-2'), s = normalizeSpread(multi({meteofrance_wave: 1.5, ncep_gfswave016: 1.0, ecmwf_wam025: 1.5, gwam: 0.2}), ob);
  const h = s.byHour.get(new Date(T * 1000).toISOString())!; assert.equal(h.models, 3); assert.ok(!s.modelsUsed.includes('gwam'), 'gwam is pruned (half-width above the limit)');
  const c = (hs: number, m: string) => hs / MODEL_SKILL[m].bias; assert.ok(Math.abs(h.ratio - (c(1.5, 'meteofrance_wave') / c(1.0, 'ncep_gfswave016')) ** 0.8) < 0.03, `breaking height scales about with the bias-corrected Hs^0.8 (ratio ${h.ratio})`);
  // a model that merely runs low or high by its known bias is NOT a disagreement
  const same = normalizeSpread(multi({meteofrance_wave: 1.5 * 1.015, ncep_gfswave016: 1.5 * 0.835, ecmwf_wam025: 1.5 * 1.045}), ob).byHour.get(new Date(T * 1000).toISOString())!; assert.ok(same.ratio < 1.02, `known biases cancel (ratio ${same.ratio})`);
  assert.equal(normalizeSpread(multi({meteofrance_wave: 1.5}), ob).byHour.size, 0); assert.equal(normalizeSpread({hourly: {}}, ob).byHour.size, 0); assert.equal(normalizeSpread(null, ob).byHour.size, 0);
  assert.equal(normalizeSpread(multi({meteofrance_wave: 1.5, ncep_gfswave016: 1.1}), evidenceSpots.find((x) => !breakingProfile(x.id))!).byHour.size, 0, 'a spot without a profile has no spread');
});
test('model spread fetch: one request per spot, cached for 10 minutes, failure is silent; the URL asks for the documented models', async () => {
  clearSpread(); const ob = evidenceSpot('spot-2'); let calls = 0; const fetchJson = async () => { calls++; return multi({meteofrance_wave: 1.5, ncep_gfswave016: 1.0}); };
  const a = await loadModelSpread(ob, fetchJson, 1e12), b = await loadModelSpread(ob, fetchJson, 1e12 + 60000); assert.equal(calls, 1); assert.ok(a && a === b);
  assert.ok(spreadAt('spot-2', new Date(T * 1000).toISOString(), 1e12 + 60000)!.ratio > 1); await loadModelSpread(ob, fetchJson, 1e12 + 11 * 60000); assert.equal(calls, 2);
  clearSpread(); assert.equal(await loadModelSpread(ob, async () => { throw new Error('offline'); }, 1e12), null); assert.equal(spreadAt('spot-2', new Date(T * 1000).toISOString(), 1e12), null);
  const u = new URL(modelSpreadURL(ob)); assert.equal(u.searchParams.get('models'), SPREAD_MODELS.join(',')); assert.equal(u.hostname, 'marine-api.open-meteo.com');
});

const marine = (hs: number) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => hs + 0.1), swell_wave_height: times.map(() => hs), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}});
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 4)}};
test('headlineSurf: the range is built from the central height; narrower than the legacy band; wider with spread; the shape stays compatible', () => {
  const f = toLegacy(normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.5), weather, new Date(T * 1000).toISOString())[1]);
  const none = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: [], spread: null}) as any, agree = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: [], spread: {ratio: 1.03, models: 3}}) as any, split = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: [], spread: {ratio: 2, models: 3}}) as any;
  for (const h of [none, agree, split]) { assert.equal(h.kind, 'estimate'); assert.ok(h.loFt >= 0 && h.hiFt > h.loFt && typeof h.words === 'string' && h.label && h.method && h.methodLabel); assert.ok(h.centralFt > 0); assert.ok(h.loFt <= h.centralFt && h.hiFt >= h.centralFt); }
  // T-118: the headline range is the surf BAND (typical to sets); the forecast uncertainty interval is kept in `interval` and drives the confidence word.
  const legacy = f.evidence!.faceEstimate.input!.rangeFt!; assert.ok(none.interval.hiFt - none.interval.loFt < legacy[1] - legacy[0], `${none.interval.loFt}–${none.interval.hiFt} vs legacy ${legacy}`);
  assert.ok(split.interval.hiFt - split.interval.loFt > agree.interval.hiFt - agree.interval.loFt); assert.equal(split.confidence, 'low'); assert.equal(split.interval.disagree, true); assert.match(split.methodLabel, /wave models disagree/); assert.equal(agree.interval.disagree, false); assert.doesNotMatch(agree.methodLabel, /disagree/);
  assert.ok(Array.isArray(none.interval.components) && none.interval.note.length > 20);
});
test('headlineSurf: a calibrated range is unchanged in kind (n observations, calibration label) and has no interval object', () => {
  const f = toLegacy(normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.5), weather, new Date(T * 1000).toISOString())[1]), base = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: [], spread: null}) as any;
  const ob = (i: number) => ({id: 'o' + i, schema: 1 as const, spotId: 'spot-2', observedAt: new Date(T * 1000).toISOString(), loggedAt: '', rangeFt: [4, 4] as [number, number], faceFt: 4, pair: {centralFt: base.centralFt, loFt: base.loFt, hiFt: base.hiFt, method: base.method, validAt: '', offshoreHsFt: 5, primaryTpS: 14, basis: 'surf-height' as const, transfer: base.transfer?.factor ?? 1 /* T-131 phase 2: pairs record the factor in their central */}});
  const cal = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: Array.from({length: 8}, (_, i) => ob(i)), spread: null}) as any;
  assert.equal(cal.calibration.n, 8); assert.equal(cal.interval, undefined); assert.ok(Math.abs(cal.calibration.rawRatio - 4 / base.centralFt) < 1e-9); assert.ok(Math.abs(cal.calibration.ratio - Math.min(2, Math.max(0.5, 1 + (4 / base.centralFt - 1) * 0.5))) < 1e-9, 'step 3: shrunk half way toward 1 at 8 reports, held in 0.5-2x');
});

test('T-073 review fixes: the legacy band is labelled when a record has no central height; calibration only mixes pairs on the central basis', async () => {
  const f = toLegacy(normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.5), weather, new Date(T * 1000).toISOString())[1]); delete (f.evidence!.faceEstimate as any).centralFt;
  const h = headlineSurf('spot-2', f, {nowMs: T * 1000, observations: [], spread: null}) as any;
  assert.match(h.methodLabel, /fixed 0\.7–1\.4 band \(older cached data\)/); assert.equal(h.interval.components.length, 0); assert.match(h.interval.note, /Fixed 0\.7–1\.4 band/);
  const {fitFor} = await import('../services/calibrationMath.ts');
  const ob = (i: number, basis?: 'surf-height') => ({id: 'x' + i, schema: 1 as const, spotId: 'spot-2', observedAt: '', loggedAt: '', rangeFt: [4, 4] as [number, number], faceFt: 4, pair: {centralFt: 8, loFt: 6, hiFt: 11, method: 'v1' as const, validAt: '', offshoreHsFt: 5, primaryTpS: 14, ...(basis ? {basis} : {})}});
  assert.equal(fitFor(Array.from({length: 8}, (_, i) => ob(i)), 'spot-2', 'v1').n, 0, 'pairs from the old fixed-band midpoint are not mixed into a fit');
  assert.equal(fitFor(Array.from({length: 8}, (_, i) => ob(i, 'surf-height')), 'spot-2', 'v1').status, 'active');
});

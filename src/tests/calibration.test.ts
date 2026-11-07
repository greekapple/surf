import test from 'node:test';
import assert from 'node:assert/strict';
import {buoyTransferAt} from '../ocean/buoyTransfer.ts';
import {median, quantile, fitFor, applyFit, NEEDED, MIN_SPREAD} from '../services/calibrationMath.ts';
import {logObservation, observationsFor, latestObservation, deleteObservation, calibrationFor, resetObservationCache, subscribeObservations, pairFor, WORD_FACE_FT} from '../services/calibration.ts';
import {headlineSurf} from '../services/headlineSurf.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';

const t = 1792454400, now = t * 1000 + 600000;
const times = Array.from({length: 30}, (_, i) => t - 3600 + i * 3600);
const marine = {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => 1.1), swell_wave_height: times.map(() => 1.0) /* T-131 phase 2: was 1.6/1.5 m; Ocean Beach's buoy-evidenced ×1.48 keeps the surf height near the old fixture size */, swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}};
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 5), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 5)}};
const records = normalizeOpenMeteo(evidenceSpot('spot-2'), marine, weather, new Date(now).toISOString()).map(toLegacy);
const hourIso = new Date(t * 1000).toISOString();
const env = {records, nowMs: now};
const pair = (central: number, method: 'v1' | 'mop-v2' = 'v1') => ({centralFt: central, loFt: central * 0.7, hiFt: central * 1.4, method, validAt: hourIso, offshoreHsFt: 5, primaryTpS: 14, basis: 'surf-height' as const, ...(method === 'v1' ? {transfer: buoyTransferAt('spot-2', 5)?.factor ?? 1} : {})}); // T-131 phase 2: a pair made today records the factor already in its central
const ob = (i: number, observed: number, central: number, spotId = 'spot-2', method: 'v1' | 'mop-v2' = 'v1') => ({id: 'o' + i, schema: 1 as const, spotId, observedAt: hourIso, loggedAt: hourIso, rangeFt: [observed, observed] as [number, number], faceFt: observed, pair: pair(central, method)});

test('median and quartiles', () => {
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(quantile([1, 2, 3, 4, 5], 0.25), 2); assert.equal(quantile([1, 2, 3, 4, 5], 0.75), 4); assert.ok(Number.isNaN(quantile([], 0.5)));
});
test('threshold: 7 paired observations change nothing; the 8th activates the fit', () => {
  const log = Array.from({length: 8}, (_, i) => ob(i, 6, 4));
  assert.equal(fitFor(log.slice(0, 7), 'spot-2', 'v1').status, 'collecting'); assert.equal(fitFor(log.slice(0, 7), 'spot-2', 'v1').n, 7);
  const f = fitFor(log, 'spot-2', 'v1'); assert.equal(f.status, 'active'); assert.equal(f.needed, NEEDED); assert.equal(NEEDED, 8); assert.equal(f.ratio, 1.5);
});
test('the fit is per spot and per method; unpaired and tiny-model observations are not counted', () => {
  const log = [...Array.from({length: 8}, (_, i) => ob(i, 6, 4, 'spot-3')), {...ob(9, 5, 4), pair: undefined}, ob(10, 5, 0.2)];
  assert.equal(fitFor(log, 'spot-2', 'v1').n, 0); assert.equal(fitFor(log, 'spot-3', 'v1').n, 8); assert.equal(fitFor(log, 'spot-3', 'mop-v2').n, 0);
});
test('median is robust to one wild observation', () => {
  const log = [...Array.from({length: 7}, (_, i) => ob(i, 4, 4)), ob(8, 20, 4)];
  assert.equal(fitFor(log, 'spot-2', 'v1').ratio, 1);
});
test('calibrated range is never narrower than ±15% and brackets the central value', () => {
  const tight = {n: 8, needed: 8, status: 'active' as const, ratio: 1.5, iqr: [1.5, 1.5] as [number, number]};
  const r = applyFit(tight, 3, 5)!; // model central 4 -> 6
  assert.ok(r.loFt <= 6 * (1 - MIN_SPREAD) && r.hiFt >= 6 * (1 + MIN_SPREAD)); assert.equal(r.centralFt, 6);
  const wide = applyFit({...tight, iqr: [1, 2.5]}, 3, 5)!; assert.ok(wide.loFt <= 4 && wide.hiFt >= 10);
  assert.equal(applyFit({n: 3, needed: 8, status: 'collecting'}, 3, 5), null);
});
test('headline: uncalibrated output is identical below the threshold; at 8 it is calibrated and labelled', () => {
  const f = records[1], base = headlineSurf('spot-2', f, {nowMs: now, observations: []}) as any;
  const seven = headlineSurf('spot-2', f, {nowMs: now, observations: Array.from({length: 7}, (_, i) => ob(i, 6, 4))}) as any;
  assert.deepEqual(seven, base); assert.equal(base.calibration, undefined);
  const mid = (base.loFt + base.hiFt) / 2, log = Array.from({length: 8}, (_, i) => ob(i, mid * 0.5, mid));
  const cal = headlineSurf('spot-2', f, {nowMs: now, observations: log}) as any;
  assert.equal(cal.kind, 'estimate'); assert.equal(cal.calibration.n, 8); assert.match(cal.calibration.label, /^calibrated with your 8 observations$/); assert.match(cal.methodLabel, /calibrated with your 8 observations/);
  assert.ok(cal.hiFt < base.hiFt); assert.ok(cal.hiFt >= mid * 0.5 * 1.15 - 1e-9); assert.deepEqual(cal.calibration.uncalibratedFt, [base.loFt, base.hiFt]);
});
test('pairing: the model estimate for the same spot-hour (uncalibrated), with offshore Hs and Tp; a different hour or no record pairs nothing', () => {
  const p = pairFor('spot-2', records, t * 1000 + 120000, null, now)!, h = headlineSurf('spot-2', records[1], {nowMs: now, observations: []}) as any;
  assert.equal(p.method, h.method); assert.equal(p.centralFt, h.centralFt); assert.ok(h.centralFt > 0); assert.equal(p.validAt, hourIso); assert.ok(p.offshoreHsFt! > 0); assert.equal(p.primaryTpS, 14);
  assert.equal(pairFor('spot-2', records, (t - 5 * 3600) * 1000, null, now), null); assert.equal(pairFor('spot-2', undefined, t * 1000, null, now), null);
});
test('API: log, list, latest same Pacific day, delete, subscribe, validation errors', () => {
  resetObservationCache([]); let pings = 0; const off = subscribeObservations(() => { pings++; });
  const r = logObservation({spotId: 'spot-2', observedAt: hourIso, word: 'head', quality: 4}, env);
  assert.ok(r.ok); if (!r.ok) return; assert.equal(r.obs.faceFt, WORD_FACE_FT.head); assert.equal(r.obs.quality, 4); assert.equal(r.obs.paired, true); assert.equal(pings, 1);
  assert.equal(observationsFor('spot-2').length, 1); assert.equal(observationsFor('spot-3').length, 0); assert.equal(observationsFor().length, 1);
  assert.equal(latestObservation('spot-2', now)?.id, r.obs.id); assert.equal(latestObservation('spot-2', now + 2 * 86400000), null); assert.equal(latestObservation('spot-3', now), null);
  assert.deepEqual(calibrationFor('spot-2', 'v1'), {state: 'collecting', count: 1, needed: 8, felt: {low: 0, right: 0, high: 0, factor: 1}});
  const unpaired = logObservation({spotId: 'spot-2', observedAt: new Date((t - 8 * 3600) * 1000).toISOString(), word: 'knee'}, env);
  assert.ok(unpaired.ok && !unpaired.obs.paired && unpaired.obs.quality === null); assert.equal(calibrationFor('spot-2', 'v1').count, 1);
  assert.equal(deleteObservation(r.obs.id), true); assert.equal(deleteObservation(r.obs.id), false); assert.equal(observationsFor().length, 1);
  assert.match((logObservation({spotId: 'spot-2', observedAt: new Date(now + 3600000).toISOString(), word: 'head'}, env) as any).error, /future/);
  assert.match((logObservation({spotId: 'spot-2', observedAt: new Date(now - 400 * 86400000).toISOString(), word: 'head'}, env) as any).error, /year/);
  assert.match((logObservation({spotId: 'nope', observedAt: hourIso, word: 'head'}, env) as any).error, /Unknown spot/);
  assert.ok(!(logObservation({spotId: 'spot-2', observedAt: hourIso, word: 'huge' as any}, env) as any).ok);
  off(); resetObservationCache([]);
});
test('eight logged observations activate the calibration through the API and the shared store', () => {
  resetObservationCache([]);
  for (let i = 0; i < 8; i++) assert.ok(logObservation({spotId: 'spot-2', observedAt: hourIso, word: 'waist'}, env).ok);
  const c = calibrationFor('spot-2', 'v1'); assert.equal(c.state, 'active'); assert.equal(c.count, 8);
  const h = headlineSurf('spot-2', records[1], {nowMs: now}) as any; assert.equal(h.calibration?.n, 8);
  resetObservationCache([]);
});

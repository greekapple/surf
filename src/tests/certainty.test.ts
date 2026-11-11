import test from 'node:test';
import assert from 'node:assert/strict';
import {certaintyOf, certainLabel, widen, HORIZON_HOURS, TOO_FAR_W, CERTAINTY_WORD, type Certainty} from '../services/certainty.ts';
import {skillW} from '../services/uncertainty.ts';
import {headlineSurf, type HeadlineSurf} from '../services/headlineSurf.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {defaultProfile} from '../data/demo.ts';

const profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const H = 3600000, now = Date.UTC(2026, 10, 6, 18), at = (leadH: number) => new Date(now + leadH * H).toISOString();
type Est = Extract<HeadlineSurf, {kind: 'estimate'}>;
const est = (o: Partial<Est> = {}): HeadlineSurf => ({kind: 'estimate', loFt: 4, hiFt: 6, confidence: 'high', words: null, wordsNote: '', method: 'mop-v2', methodLabel: '', label: '', centralFt: 4.6,
  band: {loFt: 4, hiFt: 6, centralFt: 4.6, setsFt: 5.8, setsFactor: 1.27, widthFt: 2, confidence: 'high', confidenceWhy: '', interval: {loFt: 3, hiFt: 6, halfWidth: 0.17, disagree: false}}, ...o} as Est);
const RANK: Record<Certainty, number> = {high: 0, medium: 1, low: 2, 'too-far': 3};

test('certainty: the horizon is read from the measured lead table, where the error alone spans a factor of two (our cut-off), about 5.7 days', () => {
  assert.equal(TOO_FAR_W, Math.log(2) / 2);
  assert.ok(skillW(HORIZON_HOURS) >= TOO_FAR_W && skillW(HORIZON_HOURS - 1) < TOO_FAR_W, 'first whole hour past the cut-off');
  assert.ok(HORIZON_HOURS > 5 * 24 && HORIZON_HOURS < 6 * 24, `${HORIZON_HOURS} h`);
});

test('certainty: the three near levels ARE the headline confidence word (one engine, one vocabulary), too far out is lead time alone', () => {
  assert.equal(certaintyOf('spot-2', est({confidence: 'high'}), at(10), now, null)?.level, 'high');
  assert.equal(certaintyOf('spot-2', est({confidence: 'medium'}), at(10), now, null)?.level, 'medium');
  assert.equal(certaintyOf('spot-2', est({confidence: 'low'}), at(10), now, null)?.level, 'low');
  assert.equal(certaintyOf('spot-2', est({confidence: 'high'}), at(HORIZON_HOURS), now, null)?.level, 'too-far');
  assert.equal(certaintyOf('spot-2', est({confidence: 'high'}), at(HORIZON_HOURS - 1), now, null)?.level, 'high');
  // too far out also covers offshore heights and Flat estimates (it is about the lead, not the number)
  assert.equal(certaintyOf('spot-2', {kind: 'offshore', ft: 7, label: 'offshore · not surf size'}, at(150), now, null)?.level, 'too-far');
  assert.equal(certaintyOf('spot-2', est({loFt: 0, hiFt: 0, confidence: undefined, nearshoreOnly: {code: 'no-break', flat: true, reason: ''}}), at(150), now, null)?.level, 'too-far');
});

test('certainty: no level where none is honest (offshore and Flat near term, saved or calibrated numbers, no data, demonstration)', () => {
  assert.equal(certaintyOf('spot-2', {kind: 'offshore', ft: 7, label: 'offshore · not surf size'}, at(10), now, null), null);
  assert.equal(certaintyOf('spot-2', est({loFt: 0, hiFt: 0, confidence: undefined, nearshoreOnly: {code: 'no-break', flat: true, reason: ''}}), at(10), now, null), null);
  assert.equal(certaintyOf('spot-2', est({saved: {retrievedAt: at(-5), reason: 'saved'}}), at(10), now, null), null);
  assert.equal(certaintyOf('spot-2', est({calibration: {n: 4, ratio: 1.1, label: '', uncalibratedFt: [4, 6]}}), at(10), now, null), null);
  assert.equal(certaintyOf('spot-2', {kind: 'none', label: ''}, at(10), now, null), null);
  assert.equal(certaintyOf('spot-2', {kind: 'demonstration', ft: 5, label: ''}, at(10), now, null), null);
});

test('certainty: where the models disagree the range widens to cover them, never narrower than the band', () => {
  const h = est({confidence: 'low', band: {...(est() as Est).band!, confidence: 'low', interval: {loFt: 2, hiFt: 8, halfWidth: 0.3, disagree: true}}}) as Est;
  const cv = certaintyOf('spot-2', h, at(30), now, {ratio: 1.8, models: 3})!;
  assert.equal(cv.level, 'low'); assert.equal(cv.disagree, true); assert.equal(cv.models, 3);
  assert.ok(cv.wide && cv.wide.loFt <= h.loFt && cv.wide.hiFt >= h.hiFt && cv.wide.hiFt - cv.wide.loFt > h.hiFt - h.loFt, JSON.stringify(cv.wide));
  assert.match(cv.why, /3 models differ/); assert.doesNotMatch(cv.why, /  /, 'no double space');
  assert.equal(widen(h, 1), null, 'no spread, no widening');
  // models that agree leave the band as it is
  assert.equal(certaintyOf('spot-2', est(), at(30), now, {ratio: 1.1, models: 3})?.wide, null);
});

test('certainty: what a day surface shows (too far out hides the number, it stays in the detail; where models differ the band stays the number, the widened range is detail only)', () => {
  const far = certaintyOf('spot-2', est(), at(150), now, null), near = certaintyOf('spot-2', est(), at(10), now, null);
  assert.deepEqual(certainLabel('4–6', 'ft', far, profile), {text: 'too far out', note: null, detail: 'the model says 4–6 ft'});
  assert.deepEqual(certainLabel('4–6', 'ft', near, profile), {text: '4–6', note: null, detail: null});
  const h = est({confidence: 'low', band: {...(est() as Est).band!, interval: {loFt: 2, hiFt: 8, halfWidth: 0.3, disagree: true}}});
  const w = certainLabel('4–6', 'ft', certaintyOf('spot-2', h, at(30), now, {ratio: 1.8, models: 3}), profile);
  assert.equal(w.note, 'models differ'); assert.equal(w.text, '4–6', 'the band stays the main number (T-118)');
  assert.match(w.detail!, /^could be \d+–\d+ ft: widened by how far apart the wave models are \(their max\/min ratio, centered on our estimate\); the spread comes from the offshore wave models/);
  const v1 = certainLabel('4–6', 'ft', certaintyOf('spot-2', {...(h as Est), method: 'v1'}, at(30), now, {ratio: 1.8, models: 3}), profile);
  assert.doesNotMatch(v1.detail!, /offshore wave models, not the nearshore/, 'v1 numbers come from the offshore models already');
  // Flat past the horizon: no unit after Flat
  assert.equal(certainLabel('Flat', '', far, profile).detail, 'the model says Flat');
});

test('certainty: never called accuracy; every why names it as our own levels', () => {
  for (const word of Object.values(CERTAINTY_WORD)) assert.doesNotMatch(word, /accura/i);
  assert.deepEqual(Object.values(CERTAINTY_WORD), ['high confidence', 'medium confidence', 'low confidence', 'too far out'], 'one vocabulary: the existing confidence word plus too far out');
  for (const lead of [5, 40, 100, 150]) { const cv = certaintyOf('spot-2', est({confidence: lead > 90 ? 'low' : 'high'}), at(lead), now, null)!; assert.doesNotMatch(cv.why, /accura/i); assert.match(cv.why, /our own/i); }
});

// The real engine: Ocean Beach records for 7 days with steady swell, no model spread loaded. The level can only get less certain with lead time.
const t0 = Math.floor(now / 1000 / 3600) * 3600, times = Array.from({length: 7 * 24}, (_, i) => t0 + i * 3600);
const marine = {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'},
  hourly: {time: times, wave_height: times.map(() => 1.8), swell_wave_height: times.map(() => 1.6), swell_wave_direction: times.map(() => 280), swell_wave_period: times.map(() => 13), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 270), secondary_swell_wave_period: times.map(() => 9)}};
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 5), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 8)}};
const records = normalizeOpenMeteo(evidenceSpot('spot-2'), marine as any, weather as any, new Date(now).toISOString()).map(toLegacy);

test('certainty (real engine): fades with lead time and ends in too far out', () => {
  const levels = records.map((f) => certaintyOf('spot-2', headlineSurf('spot-2', f, {nowMs: now, observations: [], felt: [], spread: null}), f.timestamp, now, null)?.level ?? null);
  const seen = levels.filter((l): l is Certainty => l !== null);
  assert.ok(seen.length > 100, `${seen.length} hours with a level`);
  for (let i = 1; i < seen.length; i++) assert.ok(RANK[seen[i]] >= RANK[seen[i - 1]], `never more certain later: ${seen[i - 1]} then ${seen[i]} at ${i}`);
  assert.equal(seen[seen.length - 1], 'too-far');
  assert.ok(new Set(seen).size >= 3, `at least three levels over the week: ${[...new Set(seen)].join(', ')}`);
});

test('certainty (real engine): disagreeing models make the hour uncertain with a widened range', () => {
  const f = records[30], spread = {ratio: 1.9, models: 3}, h = headlineSurf('spot-2', f, {nowMs: now, observations: [], felt: [], spread});
  assert.equal(h.kind, 'estimate');
  const cv = certaintyOf('spot-2', h, f.timestamp, now, spread)!;
  assert.equal(cv.level, 'low'); assert.ok(cv.disagree); assert.ok(cv.wide, 'widened');
  assert.ok(cv.wide!.loFt <= (h as Est).loFt && cv.wide!.hiFt >= (h as Est).hiFt);
});

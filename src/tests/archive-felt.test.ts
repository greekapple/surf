import test from 'node:test';
import assert from 'node:assert/strict';
const mem = new Map<string, string>();
(globalThis as any).localStorage = {getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }};
const {archiveHours, loadArchive, predictedFor, resetArchiveThrottle, ARCHIVE_KEY, ARCHIVE_DAYS, ARCHIVE_MAX} = await import('../services/forecastArchive.ts');
const {logObservation, calibrationFor, resetObservationCache} = await import('../services/calibration.ts');
const {logFeltRight, feltRightFor} = await import('../services/feltRight.ts');
const {resetFeltCache, getFelt} = await import('../services/observationStore.ts');
const {fitFor, feltFactor, FELT_CAP} = await import('../services/calibrationMath.ts');
const {headlineSurf} = await import('../services/headlineSurf.ts');
const {normalizeOpenMeteo} = await import('../ocean/openMeteo.ts');
const {evidenceSpot} = await import('../ocean/spots.ts');
const {toLegacy} = await import('../ocean/bridge.ts');

const t = 1792454400, now = t * 1000 + 600000, times = Array.from({length: 30}, (_, i) => t - 3600 + i * 3600);
const marine = {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => 1.6), swell_wave_height: times.map(() => 1.5), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}};
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 5), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 5)}};
const records = normalizeOpenMeteo(evidenceSpot('spot-2'), marine, weather, new Date(now - 2 * 3600000).toISOString()).map(toLegacy);
const hourIso = new Date(t * 1000).toISOString();

test('archive: stores predicted hours with run time and lead, one entry per spot-hour and lead bucket, throttled, pruned to two weeks', () => {
  mem.clear(); resetArchiveThrottle();
  const n = archiveHours('spot-2', records, null, now); assert.ok(n > 10);
  const a = loadArchive(); assert.equal(a.length, n); const e = a.find((x) => x.v === hourIso)!;
  assert.equal(e.s, 'spot-2'); assert.equal(e.k, 'estimate'); assert.ok(e.lo! < e.hi!); assert.ok(e.m === 'v1' || e.m === 'mop-v2'); assert.ok(e.off! > 0); assert.equal(e.tp, 14);
  assert.equal(e.run, new Date(now - 2 * 3600000).toISOString()); assert.ok(e.lead >= 0);
  assert.equal(archiveHours('spot-2', records, null, now + 60000), 0, 'throttled within 30 minutes');
  resetArchiveThrottle(); archiveHours('spot-2', records, null, now + 3 * 3600000); assert.ok(loadArchive().length >= a.length);
  // old entries are dropped
  mem.set(ARCHIVE_KEY, JSON.stringify([{...e, v: new Date(now - (ARCHIVE_DAYS + 2) * 86400000).toISOString()}])); resetArchiveThrottle(); archiveHours('spot-2', records, null, now);
  assert.ok(loadArchive().every((x) => Date.parse(x.v) >= now - ARCHIVE_DAYS * 86400000)); assert.ok(ARCHIVE_MAX >= 1000);
});
test('predictedFor returns what was seen BEFORE the given time, not a later run', () => {
  mem.clear(); resetArchiveThrottle(); archiveHours('spot-2', records, null, now);
  assert.ok(predictedFor('spot-2', hourIso, now + 1000)); assert.equal(predictedFor('spot-2', hourIso, now - 1000), null); assert.equal(predictedFor('spot-3', hourIso, now + 1000), null);
});
test('an observation pairs with the ARCHIVED prediction (source archived), not a later re-run', () => {
  mem.clear(); resetArchiveThrottle(); resetObservationCache([]); archiveHours('spot-2', records, null, now - 4 * 3600000); // seen four hours BEFORE the session
  const r = logObservation({spotId: 'spot-2', observedAt: hourIso, word: 'chest'}, {records, nowMs: now + 3600000});
  assert.ok(r.ok);
  const log = JSON.parse(mem.get('swello-session-log')!), pair = log[0].pair; assert.equal(pair.source, 'archived'); assert.ok(pair.leadH >= 0);
  resetObservationCache([]);
});
test('felt right: stores direction paired with the prediction; the latest per spot-hour replaces; today read-back; validation', () => {
  mem.clear(); resetArchiveThrottle(); resetFeltCache([]); archiveHours('spot-2', records, null, now);
  assert.deepEqual(logFeltRight({spotId: 'spot-2', at: hourIso, felt: 'low'}, {records, nowMs: now + 60000}), {ok: true});
  assert.equal(getFelt().length, 1); assert.equal(getFelt()[0].predicted?.source, 'archived'); assert.equal(feltRightFor('spot-2', now)?.felt, 'low');
  logFeltRight({spotId: 'spot-2', at: hourIso, felt: 'right'}, {records, nowMs: now + 120000}); assert.equal(getFelt().length, 1); assert.equal(feltRightFor('spot-2', now)?.felt, 'right');
  assert.equal(feltRightFor('spot-3', now), null); assert.equal(feltRightFor('spot-2', now + 3 * 86400000), null);
  assert.match((logFeltRight({spotId: 'spot-2', at: new Date(now + 9e6).toISOString(), felt: 'low'}, {nowMs: now}) as any).error, /future/);
  assert.match((logFeltRight({spotId: 'nope', at: hourIso, felt: 'low'}, {nowMs: now}) as any).error, /Unknown spot/);
  assert.equal((logFeltRight({spotId: 'spot-2', at: hourIso, felt: 'meh' as any}, {nowMs: now}) as any).ok, false);
  resetFeltCache([]);
});
test('felt right is a weaker, separate signal: it never activates a calibration, only nudges an active one, capped', () => {
  const ob = (i: number) => ({id: 'o' + i, schema: 1 as const, spotId: 'spot-2', observedAt: hourIso, loggedAt: hourIso, rangeFt: [3, 3] as [number, number], faceFt: 3, pair: {centralFt: 6, loFt: 4, hiFt: 8, method: 'v1' as const, validAt: hourIso, offshoreHsFt: 5, primaryTpS: 14, basis: 'central' as const}});
  const few = Array.from({length: 7}, (_, i) => ob(i)), many = Array.from({length: 8}, (_, i) => ob(i)), lots = {low: 50, right: 0, high: 0};
  assert.equal(fitFor(few, 'spot-2', 'v1', lots).status, 'collecting');
  const base = fitFor(many, 'spot-2', 'v1'), up = fitFor(many, 'spot-2', 'v1', {low: 2, right: 5, high: 0}), down = fitFor(many, 'spot-2', 'v1', {low: 0, right: 0, high: 3}), cap = fitFor(many, 'spot-2', 'v1', lots);
  assert.equal(base.ratio, 0.5); assert.ok(Math.abs(up.ratio! - 0.5 * 1.06) < 1e-9); assert.ok(Math.abs(down.ratio! - 0.5 * 0.91) < 1e-9); assert.ok(Math.abs(cap.ratio! - 0.5 * (1 + FELT_CAP)) < 1e-9); assert.equal(feltFactor({low: 1, right: 9, high: 1}), 1);
});
test('headline: felt signals nudge only an active calibration; uncalibrated output stays identical without observations', () => {
  mem.clear(); resetObservationCache([]); resetFeltCache([]);
  const f = records[1], base = headlineSurf('spot-2', f, {nowMs: now}) as any;
  resetFeltCache([{id: 'f', spotId: 'spot-2', hour: hourIso, felt: 'low', loggedAt: hourIso, predicted: {loFt: 4, hiFt: 8, method: base.method, source: 'archived'}}]);
  assert.deepEqual(headlineSurf('spot-2', f, {nowMs: now}), base); assert.equal(calibrationFor('spot-2', base.method).state, 'collecting'); assert.equal((calibrationFor('spot-2', base.method) as any).felt.low, 1);
  resetFeltCache([]);
});

test('codex P2 (a): a later visit does not overwrite the pre-session snapshot; at most 4 snapshots per spot-hour (earliest and latest kept)', () => {
  mem.clear(); resetArchiveThrottle(); const sessionMs = Date.parse(hourIso);
  archiveHours('spot-2', records, null, sessionMs - 4 * 3600000);               // seen before the session
  resetArchiveThrottle(); archiveHours('spot-2', records, null, sessionMs + 3600000); // revisited after it started (same lead bucket before the fix)
  const pre = predictedFor('spot-2', hourIso, sessionMs);
  assert.ok(pre); assert.equal(pre!.seen, new Date(sessionMs - 4 * 3600000).toISOString(), 'the pre-session entry survives');
  assert.equal(predictedFor('spot-2', hourIso, sessionMs + 2 * 3600000)!.seen, new Date(sessionMs + 3600000).toISOString(), 'later visits are kept too');
  for (let i = 2; i < 9; i++) { resetArchiveThrottle(); archiveHours('spot-2', records, null, sessionMs + i * 3600000); }
  const mine = loadArchive().filter((a) => a.v === hourIso); assert.ok(mine.length <= 4); assert.equal(mine[0].seen === new Date(sessionMs - 4 * 3600000).toISOString() || mine.some((m) => m.seen === new Date(sessionMs - 4 * 3600000).toISOString()), true);
});
test('codex P2 (b): an observation logged later with NO current record still pairs from the archive', () => {
  mem.clear(); resetArchiveThrottle(); resetObservationCache([]); archiveHours('spot-2', records, null, Date.parse(hourIso) - 4 * 3600000);
  const r = logObservation({spotId: 'spot-2', observedAt: hourIso, word: 'waist'}, {records: [], nowMs: Date.parse(hourIso) + 3 * 86400000});
  assert.ok(r.ok); if (!r.ok) return; assert.equal(r.obs.paired, true);
  assert.equal(JSON.parse(mem.get('swello-session-log')!)[0].pair.source, 'archived');
  // without an archive and without a record there is nothing to pair with
  mem.clear(); resetObservationCache([]); const r2 = logObservation({spotId: 'spot-2', observedAt: hourIso, word: 'waist'}, {records: [], nowMs: Date.parse(hourIso) + 3 * 86400000}); assert.ok(r2.ok && !r2.obs.paired);
  resetObservationCache([]);
});

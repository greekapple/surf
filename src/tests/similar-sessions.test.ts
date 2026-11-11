import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {distance, closestSession, similarLine, reportWhen, storedInputs, todayInputs, WEIGHTS, MAX_DISTANCE, MIN_SESSIONS, type Inputs} from '../services/similarSessions.ts';
import {forecastInputs} from '../services/sessionInputs.ts';
import {archiveHours, loadArchive, resetArchiveThrottle} from '../services/forecastArchive.ts';
import type {SessionObservation} from '../services/sessionLog.ts';
import {allSpots} from '../data/catalog.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {defaultProfile} from '../data/demo.ts';

const spot = allSpots.find((s) => s.id === 'spot-2')!;
const base: Inputs = {heightFt: 4.5, periodS: 13, dirDeg: 290, windMph: 4, windRel: 'offshore', tide: 'rising', method: 'v1', nearshoreOnly: false};
const sess = (id: string, observedAt: string, over: Partial<NonNullable<SessionObservation['pair']>> = {}, quality?: 1 | 2 | 3 | 4 | 5, spotId = 'spot-2'): SessionObservation => ({id, schema: 1, spotId, observedAt, loggedAt: observedAt, rangeFt: [3, 4], ...(quality ? {quality} : {}),
  pair: {centralFt: 4.5, loFt: 4, hiFt: 5, method: 'v1', nearshoreOnly: false, validAt: observedAt, offshoreHsFt: 5, primaryTpS: 13, dirDeg: 290, windMph: 4, windRel: 'offshore', tide: 'rising', basis: 'surf-height', source: 'archived', ...over}});
const log3 = (o: Partial<NonNullable<SessionObservation['pair']>> = {}) => [sess('a', '2026-10-18T16:00:00Z', o, 4), sess('b', '2026-10-10T16:00:00Z', {centralFt: 9, loFt: 8, hiFt: 10, primaryTpS: 7}, 2), sess('c', '2026-10-02T16:00:00Z', {centralFt: 1, loFt: 1, hiFt: 2, primaryTpS: 6}, 3)];

test('documented distance: weights are fixed and sum to 1; identical inputs are distance 0; each dimension scales as documented', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 1);
  assert.equal(distance(base, base)!.d, 0);
  assert.ok(Math.abs(distance(base, {...base, heightFt: 5.5})!.d - 0.35 * 0.5) < 1e-9, 'height 1 ft = half of the 2 ft scale, weight .35');
  assert.ok(Math.abs(distance(base, {...base, periodS: 15})!.d - 0.25 * 0.5) < 1e-9);
  assert.ok(Math.abs(distance(base, {...base, dirDeg: 350})!.d - 0.15 * (60 / 45 > 1 ? 1 : 60 / 45)) < 1e-9, 'direction caps at 45°; 290→350 is 60° = far');
  assert.ok(Math.abs(distance(base, {...base, dirDeg: 10})!.d - 0.15 * (80 / 45 > 1 ? 1 : 0)) < 1e-9, 'circular: 290→10 is 80°');
  assert.ok(Math.abs(distance(base, {...base, windMph: 9})!.d - 0.15 * 0.25) < 1e-9, 'wind: half the speed difference (5 of 10 mph)'); assert.ok(Math.abs(distance(base, {...base, tide: null, windRel: null})!.d) < 1e-9);
});
test('a stored session that predates a dimension is compared on what it has; height AND period must be on both sides', () => {
  const old: Inputs = {...base, dirDeg: null, windMph: null, windRel: null, tide: null};
  const r = distance(base, old)!; assert.deepEqual(r.dims, ['height', 'period']); assert.equal(r.d, 0);
  assert.equal(distance(base, {...old, periodS: NaN}), null); assert.equal(distance({...base, heightFt: NaN}, base), null);
});
test('fewer than 3 logged sessions at the spot: nothing, even for a perfect match; other spots do not count', () => {
  const two = log3().slice(0, 2); assert.equal(closestSession(two, 'spot-2', base), null);
  const three = [...two, sess('x', '2026-09-01T16:00:00Z', {}, 3, 'spot-0')]; assert.equal(closestSession(three, 'spot-2', base), null);
  assert.equal(MIN_SESSIONS, 3); assert.ok(closestSession(log3(), 'spot-2', base));
});
test('closest session wins; a close match is within MAX_DISTANCE and a poor one says nothing', () => {
  const m = closestSession(log3(), 'spot-2', {...base, heightFt: 4.8})!; assert.equal(m.obs.id, 'a'); assert.ok(m.distance <= MAX_DISTANCE);
  assert.equal(closestSession(log3(), 'spot-2', {heightFt: 20, periodS: 20, dirDeg: 100, windMph: 30, windRel: 'onshore', tide: 'falling'}), null, 'nothing resembles it');
  assert.equal(closestSession(log3(), 'spot-2', null), null);
  const edge = closestSession([sess('a', '2026-10-18T16:00:00Z'), sess('b', '2026-10-10T16:00:00Z', {centralFt: 20}), sess('c', '2026-10-02T16:00:00Z', {centralFt: 20})], 'spot-2', {...base, heightFt: 4.5 + 2 * 0.3, periodS: 13 + 1.5})!; assert.ok(edge === null || edge.distance <= MAX_DISTANCE);
});
test('ties keep the more recent session; sessions with no comparable surf-height pair are ignored', () => {
  const t = closestSession([sess('old', '2026-09-01T16:00:00Z'), sess('new', '2026-10-18T16:00:00Z'), sess('mid', '2026-10-01T16:00:00Z')], 'spot-2', base)!; assert.equal(t.obs.id, 'new');
  const noBasis = [sess('a', '2026-10-18T16:00:00Z', {basis: undefined}), sess('b', '2026-10-10T16:00:00Z', {basis: undefined}), sess('c', '2026-10-02T16:00:00Z', {basis: undefined})]; assert.equal(closestSession(noBasis, 'spot-2', base), null);
  assert.equal(storedInputs({...sess('z', '2026-10-01T00:00:00Z'), pair: undefined}), null);
});
test('the line is built from that session\'s OWN stored values and says it is a comparison of forecasts, not a prediction', () => {
  const m = closestSession(log3(), 'spot-2', base)!, line = similarLine(m, spot, defaultProfile);
  assert.match(line, /^Similar size, period, swell direction, wind and tide to your report on \w{3} Oct 18, \d+ [AP]M \(you rated the waves Good\)\. Forecast then: est\. .*4.*5.* ft surf height \(untuned\), 13 s [NSEW]{1,2}, light offshore, rising tide\. A comparison of forecasts, not a prediction\.$/);
  assert.doesNotMatch(line, /will|going to|expect|best/i);
  const noQ = similarLine({...m, obs: {...m.obs, quality: undefined}}, spot, defaultProfile); assert.doesNotMatch(noQ, /you rated/);
  const old = similarLine({...m, dims: ['height', 'period']}, spot, defaultProfile); assert.match(old, /^Similar size and period to your report on/); assert.doesNotMatch(old, /offshore|tide| [NSEW]{1,2},/, 'a dimension that was not compared is neither named nor shown');
  assert.match(similarLine({...m, dims: ['height', 'period', 'direction', 'wind']}, spot, defaultProfile), /^Similar size, period, swell direction and wind to your report/);
  const real = closestSession(log3({dirDeg: null, windMph: null, windRel: null, tide: null}), 'spot-2', base)!; assert.deepEqual(real.dims, ['height', 'period']); assert.match(similarLine(real, spot, defaultProfile), /^Similar size and period to /);
});
test('the forecast inputs come from the record the app shows, and are null where it has no such value', () => {
  const f = {primary: {direction: 287.4, period: 13, height: 4}, wind: {speed: 4.2, direction: 90}, tide: {trend: 'Rising'}, availability: {wind: true}} as never;
  const x = forecastInputs(spot, f); assert.equal(x.dirDeg, 287); assert.equal(x.windMph, 4.2, 'raw mph (one decimal), so the adjective matches the page'); assert.equal(x.tide, 'rising'); assert.ok(x.windRel);
  assert.deepEqual(forecastInputs(spot, {primary: {}, availability: {wind: false}} as never), {dirDeg: null, windMph: null, windRel: null, tide: null});
});
test('the forecast archive keeps the other inputs for new entries (local storage only), and old entries still load', () => {
  const store = (() => { const m = new Map<string, string>(); return {getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v)}; })();
  const rec = {spotId: 'spot-2', timestamp: '2026-11-03T20:00:00.000Z', face: 4, offshore: 5, primary: {height: 5, period: 13, direction: 290}, wind: {speed: 4, direction: 90}, tide: {trend: 'Rising'}, availability: {wind: true, face: true}} as never;
  resetArchiveThrottle(); archiveHours('spot-2', [rec], null, Date.parse('2026-11-03T18:00:00Z'), store as never);
  const a = loadArchive(store as never); assert.ok(a.length === 1 && a[0].dir === 290 && a[0].ws === 4 && a[0].ti === 'rising', JSON.stringify(a[0]));
});
test('local only, no network: the matching and its view import no fetch, XMLHttpRequest, sendBeacon or analytics', () => {
  for (const f of ['services/similarSessions.ts', 'services/sessionInputs.ts', 'features/forecast/SimilarSession.tsx']) assert.doesNotMatch(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'), /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|api\//, f);
  assert.match(fs.readFileSync(new URL('../features/forecast/ForecastView.tsx', import.meta.url), 'utf8'), /<SimilarSession /);
});

test('hard gates: an opposite wind relation, an opposite tide stage, or a height gap over 30% is NO match, whatever the rest says (an Epic session is never "similar" to an opposite wind and tide)', () => {
  assert.equal(distance(base, {...base, windRel: 'onshore'}), null); assert.equal(distance(base, {...base, tide: 'falling'}), null);
  assert.equal(distance(base, {...base, heightFt: 4.5 * 1.5}), null); assert.ok(distance(base, {...base, heightFt: 4.5 * 1.2}));
  const epic = sess('e', '2026-10-18T16:00:00Z', {windRel: 'onshore', tide: 'falling'}, 5);
  assert.equal(closestSession([epic, sess('b', '2026-10-10T16:00:00Z', {centralFt: 9, loFt: 8, hiFt: 10}), sess('c', '2026-10-02T16:00:00Z', {centralFt: 1, loFt: 1, hiFt: 2})], 'spot-2', base), null);
  assert.ok(distance(base, {...base, windRel: null, tide: null}), 'an unknown relation or stage is not a gate');
});
test('windRel "unknown" and a stale or saved wind/tide are never stored as data', () => {
  const f = {primary: {direction: 290, period: 13}, wind: {speed: 4, direction: 90}, tide: {trend: 'Rising'}, availability: {wind: true}} as never;
  const x = forecastInputs(spot, f); assert.notEqual(x.windRel, 'unknown');
  const T0 = Date.parse('2026-11-02T00:00:00Z') / 1000, times = Array.from({length: 48}, (_, i) => T0 + i * 3600);
  const marine = {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'}, hourly: {time: times, wave_height: times.map(() => 1.1), swell_wave_height: times.map(() => 1), swell_wave_direction: times.map(() => 290), swell_wave_period: times.map(() => 13), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 290), secondary_swell_wave_period: times.map(() => 8)}};
  const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 6)}};
  const rec = normalizeOpenMeteo(evidenceSpot('spot-2'), marine as never, weather as never, '2026-11-02T00:00:00Z').map(toLegacy)[20];
  const fresh = forecastInputs(spot, rec, Date.parse('2026-11-02T01:00:00Z')); assert.equal(fresh.windMph, 4); assert.ok(fresh.windRel && fresh.windRel !== 'unknown');
  const stale = rec;
  const y = forecastInputs(spot, stale, Date.parse('2026-11-05T20:00:00Z')); assert.equal(y.windMph, null); assert.equal(y.windRel, null); assert.equal(y.tide, null);
});
test('saved or stale estimates and flat hours are skipped on both sides', () => {
  const log = (o: object) => [sess('a', '2026-10-18T16:00:00Z', o, 4), sess('b', '2026-10-10T16:00:00Z', o, 2), sess('c', '2026-10-02T16:00:00Z', o, 3)];
  assert.ok(closestSession(log({}), 'spot-2', base));
  assert.equal(closestSession(log({stale: true}), 'spot-2', base), null, 'a session whose stored estimate was a saved or stale copy'); assert.equal(closestSession(log({flat: true}), 'spot-2', base), null);
  assert.equal(storedInputs(sess('s', '2026-10-01T00:00:00Z', {stale: true})), null);
  const src = fs.readFileSync(new URL('../services/similarSessions.ts', import.meta.url), 'utf8'); assert.match(src, /\.saved \|\| h\.nearshoreOnly\?\.flat\) return null/, 'today: a saved copy and a flat hour');
});
test('like with like: a nearshore-only point is compared only with a nearshore-only point; the same method family only; a stored pair from before nearshoreOnly was kept is compared only with a breaking-rule estimate', () => {
  const log = (o: object) => [sess('a', '2026-10-18T16:00:00Z', o, 4), sess('b', '2026-10-10T16:00:00Z', o, 2), sess('c', '2026-10-02T16:00:00Z', o, 3)];
  assert.equal(closestSession(log({nearshoreOnly: true}), 'spot-2', base), null); assert.ok(closestSession(log({nearshoreOnly: true}), 'spot-2', {...base, nearshoreOnly: true}));
  assert.equal(closestSession(log({method: 'mop-v2'}), 'spot-2', base), null, 'mop-v2 vs v1');
  assert.ok(closestSession(log({nearshoreOnly: undefined}), 'spot-2', base)); assert.equal(closestSession(log({nearshoreOnly: undefined}), 'spot-2', {...base, nearshoreOnly: true}), null);
});
test('the line names the compared hour and says "forecast then ... (untuned)"; the link says "See that report"', () => {
  const m = closestSession(log3(), 'spot-2', base)!, line = similarLine(m, spot, defaultProfile, '2026-11-03T14:00:00Z'); assert.match(line, /^Similar size, period, swell direction, wind and tide at Tue 6 AM to your report on /); assert.match(line, /Forecast then: est\. .* surf height \(untuned\)/);
  assert.match(fs.readFileSync(new URL('../features/forecast/SimilarSession.tsx', import.meta.url), 'utf8'), />See that report</); assert.match(fs.readFileSync(new URL('../features/forecast/SimilarSession.tsx', import.meta.url), 'utf8'), /isDark\(spot\.id, forecast\.timestamp\)\) return null/);
});
test('a session entered with no time (timeKnown: false, or a date-only string) shows the date only: no invented "12 AM"; a real session at midnight keeps its hour (never inferred)', () => {
  const Z = 'America/Los_Angeles';
  assert.equal(reportWhen('2026-10-18', Z), 'Sun Oct 18'); 
  assert.equal(reportWhen('2026-10-18T07:00:00.000Z', Z, false), 'Sun Oct 18', 'entered with no time: date only'); assert.equal(reportWhen('2026-10-18T07:00:00.000Z', Z), 'Sun Oct 18, 12 AM', 'a real session at midnight keeps its hour'); assert.match(reportWhen('2026-10-18T14:20:00.000Z', Z), /^Sun Oct 18, 7 AM$/, 'a real time keeps its hour');
  const m = closestSession(log3(), 'spot-2', base)!, line = similarLine({...m, obs: {...m.obs, observedAt: '2026-10-18T07:00:00.000Z', timeKnown: false as const}}, spot, defaultProfile);
  assert.doesNotMatch(line, /12 AM/); assert.match(line, /to your report on \w{3} Oct 18 \(you rated/);
});

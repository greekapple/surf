import test from 'node:test';
import assert from 'node:assert/strict';
import {headlineSurf, headlineText} from '../services/headlineSurf.ts';
import {spotHourOf} from '../services/spotHour.ts';
import {dashCard} from '../services/homeDash.ts';
import {evidenceMatch} from '../ocean/match.ts';
import {faceEstimateView} from '../features/forecast/estimate.ts';
import {request, ProviderError} from '../ocean/request.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile, demoBoards} from '../data/demo.ts';

const T = 1792454400, NOW = T * 1000 + 600000, times = Array.from({length: 24}, (_, i) => T + i * 3600), spot = allSpots.find((s) => s.id === 'spot-2')!;
const marine = (hs: number) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => hs + 0.05), swell_wave_height: times.map(() => hs), swell_wave_direction: times.map(() => 263.49), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}});
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 4)}};
const rec = () => toLegacy(normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.5), weather, new Date(T * 1000).toISOString())[1]);
const m = (v: number, delivery?: string) => ({value: v, unit: 'ft', source: {retrievedAt: '2026-11-02T00:00:00Z', ...(delivery ? {delivery} : {})}});
const mopRec = (hsFt: number, delivery?: string, at = T * 1000 + 3600000) => ({timestamp: new Date(at).toISOString(), height: m(hsFt, delivery), period: m(14), direction: m(263.49), qualityFlag: 1, product: 'forecast' as const, mopId: 'SF023'});
const bundle = (r: any[]) => ({nearshore: [], mop: {SF023: {mopId: 'SF023', records: r, issue: null, retrievedAt: '', url: 'x'}}}) as any;

test('one height per spot-hour: the headline, the spot-hour view, Board Match and the estimate view agree for a v2 spot', () => {
  const f = rec(), b = bundle([mopRec(9)]), h = headlineSurf('spot-2', f, {bundle: b, nowMs: NOW, observations: [], spread: null}) as any;
  assert.equal(h.method, 'mop-v2'); assert.equal(h.centralFt, 9);
  const sh = spotHourOf(spot, f, NOW, defaultProfile, {bundle: b}), ev = faceEstimateView({evidence: f.evidence} as any, defaultProfile, NOW, h) as any;
  assert.equal(sh.surf.headline.kind, 'estimate'); assert.equal((sh.surf.headline as any).centralFt, 9);
  assert.deepEqual([ev.rangeFt[0], ev.rangeFt[1]], [h.loFt, h.hiFt]); assert.equal(ev.midFt, 9);
  const r: any = normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.5), weather, new Date(T * 1000).toISOString())[1];
  Object.assign(r, {windSpeed: {...r.windSpeed, value: 5}, windDirection: {...r.windDirection, value: 90}, tide: {...r.tide, value: 2}, tideTrend: 'Rising', organization: {...r.organization, value: 75}, character: 'Peaky'});
  const spotE = {...evidenceSpot('spot-2'), idealSwell: 270, tidePreferences: ['Rising'], faceRange: [2, 10], difficulty: 'Expert' as const, hazardsComplete: true}, p = {...defaultProfile, skill: 'Expert' as const, comfort: 30, minWave: 4, maxWave: 12, breakType: 'Any' as const, character: 'Any' as const};
  const out = evidenceMatch(spotE as any, r, p, [], {loFt: h.loFt, hiFt: h.hiFt}, NOW);
  assert.notEqual(out.score, null, out.reason); assert.ok(out.reason.includes(`${h.loFt}–${h.hiFt} ft`), out.reason); // Match quotes the headline's range
  assert.ok(evidenceMatch(spotE as any, r, p, [], undefined, NOW).reason.includes('unvalidated estimate'), 'without the headline it falls back to the record\'s own figure');
  const card = dashCard(spot, [f], NOW, defaultProfile, {bundle: b} as any) as any;
  if (card) assert.match(JSON.stringify(card), new RegExp(`${h.loFt}–${h.hiFt}`));
});

test('MOP unavailable (Worker or provider failed): no nearshore number is shown, the fallback is labelled', () => {
  const f = rec(), none = headlineSurf('spot-2', f, {bundle: bundle([]), nowMs: NOW, observations: [], spread: null}) as any;
  assert.notEqual(none.method, 'mop-v2'); assert.ok(none.kind !== 'estimate' || /Offshore swell|offshore/i.test(none.methodLabel), 'v1 is labelled as the offshore-swell estimate');
  assert.doesNotMatch(headlineText(none, defaultProfile).detail, /nearshore model \(MOP/i);
  const stale = headlineSurf('spot-2', f, {bundle: bundle([mopRec(9, undefined, T * 1000 - 6 * 3600000)]), nowMs: NOW, observations: [], spread: null}) as any;
  assert.notEqual(stale.method, 'mop-v2', 'a record six hours from the hour is never used as that hour');
});

test('a value served from the proxy\'s SAVED copy is labelled saved, with its retrieval time, never shown as live', () => {
  const f = rec(), live = headlineSurf('spot-2', f, {bundle: bundle([mopRec(9)]), nowMs: NOW, observations: [], spread: null}) as any;
  const saved = headlineSurf('spot-2', f, {bundle: bundle([mopRec(9, 'saved')]), nowMs: NOW, observations: [], spread: null}) as any;
  assert.equal(live.saved, undefined); assert.ok(saved.saved); assert.match(saved.methodLabel, /SAVED copy retrieved 2026-11-02 00:00 UTC.*not a live forecast/);
  assert.equal(headlineText(saved, defaultProfile).tag, 'saved estimate'); assert.equal(headlineText(live, defaultProfile).tag, 'model estimate');
  const f2: any = rec(); f2.evidence = {...f2.evidence, offshore: {...f2.evidence.offshore, source: {...f2.evidence.offshore.source, delivery: 'saved'}}};
  assert.ok((headlineSurf('spot-2', f2, {nowMs: NOW, observations: [], spread: null}) as any).saved, 'the v1 path (Open-Meteo saved copy) is labelled too');
});

test('an offshore fallback from a saved copy is labelled saved too', () => {
  const f: any = rec(); f.evidence = {...f.evidence, faceEstimate: {input: f.evidence.faceEstimate.input}, offshore: {...f.evidence.offshore, source: {...f.evidence.offshore.source, delivery: 'saved'}}};
  const h = headlineSurf('spot-2', f, {nowMs: NOW, observations: [], spread: null}) as any;
  assert.equal(h.kind, 'offshore'); assert.ok(h.saved); assert.match(headlineText(h, defaultProfile).label, /saved copy/);
});

test('a failing provider yields an error, not a number (no stale cache served as fresh)', async () => {
  const fail: typeof fetch = (async () => new Response('x', {status: 503})) as any;
  await assert.rejects(request('https://example.invalid/t083-' + Math.random(), 'json', 0, fail), (e: any) => e instanceof ProviderError || e instanceof Error);
});

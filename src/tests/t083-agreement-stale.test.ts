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
const m = (v: number, delivery?: string) => ({value: v, unit: 'ft', source: {retrievedAt: new Date(NOW - 60000).toISOString(), ...(delivery ? {delivery} : {})}});
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
  assert.equal(live.saved, undefined); assert.ok(saved.saved); assert.match(saved.methodLabel, /SAVED copy retrieved .*not live/);
  assert.equal(headlineText(saved, defaultProfile).tag, 'saved estimate'); assert.equal(headlineText(live, defaultProfile).tag, 'model estimate');
  const f2: any = rec(); f2.evidence = {...f2.evidence, offshore: {...f2.evidence.offshore, source: {...f2.evidence.offshore.source, delivery: 'saved'}}};
  assert.ok((headlineSurf('spot-2', f2, {nowMs: NOW, observations: [], spread: null}) as any).saved, 'the v1 path (Open-Meteo saved copy) is labelled too');
});

test('an offshore fallback from a saved copy is labelled saved too', () => {
  const f: any = rec(); f.evidence = {...f.evidence, faceEstimate: {input: f.evidence.faceEstimate.input}, offshore: {...f.evidence.offshore, source: {...f.evidence.offshore.source, delivery: 'saved'}}};
  const h = headlineSurf('spot-2', f, {nowMs: NOW, observations: [], spread: null}) as any;
  assert.equal(h.kind, 'offshore'); assert.ok(h.saved); assert.match(headlineText(h, defaultProfile).label, /saved or stale/);
});

test('a failing provider yields an error, not a number (no stale cache served as fresh)', async () => {
  const fail: typeof fetch = (async () => new Response('x', {status: 503})) as any;
  await assert.rejects(request('https://example.invalid/t083-' + Math.random(), 'json', 0, fail), (e: any) => e instanceof ProviderError || e instanceof Error);
});

/* T-084: one freshness rule (saved copy, older than 2 h, dated in the future, undated) for every source behind a spot-hour. */
import {staleness, firstStale, staleText} from '../services/freshness.ts';
import {windOf, tideOf} from '../services/spotHour.ts';
import {loadModelSpread, spreadAt, spreadStale, clearSpread} from '../services/modelSpread.ts';

const fresh = new Date(NOW - 600000).toISOString(), old = new Date(NOW - 3 * 3600000).toISOString(), future = new Date(NOW + 3600000).toISOString();
test('freshness rule: saved, older than 2 h, future and undated are stale; recent is not', () => {
  assert.equal(staleness({retrievedAt: fresh}, NOW), null); assert.equal(staleness({retrievedAt: new Date(NOW - 7200000).toISOString()}, NOW), null);
  assert.equal(staleness({retrievedAt: old}, NOW)!.reason, 'old'); assert.equal(staleness({retrievedAt: future}, NOW)!.reason, 'future');
  assert.equal(staleness({retrievedAt: fresh, delivery: 'saved'}, NOW)!.reason, 'saved'); assert.equal(staleness({retrievedAt: 'x'}, NOW)!.reason, 'unknown');
  assert.equal(firstStale([{retrievedAt: old}, {retrievedAt: fresh, delivery: 'saved'}], NOW)!.reason, 'saved', 'saved is reported before old');
  assert.match(staleText(staleness({retrievedAt: old}, NOW)!), /STALE: retrieved .*older than the refresh interval/);
});
const withSrc = (patch: (e: any) => void) => { const f: any = rec(); f.evidence = {...f.evidence}; patch(f.evidence); return f; };
test('the headline labels an estimate older than 2 h as stale (v1 and v2), never as current', () => {
  const o = (m: any) => ({...m, source: {...m.source, retrievedAt: old}});
  const v1 = headlineSurf('spot-2', withSrc((e) => { e.offshore = o(e.offshore); }), {nowMs: NOW, observations: [], spread: null}) as any;
  assert.equal(v1.saved.reason, 'old'); assert.match(v1.methodLabel, /STALE: retrieved/); assert.equal(headlineText(v1, defaultProfile).tag, 'stale estimate');
  const v2 = headlineSurf('spot-2', rec(), {bundle: bundle([{...mopRec(9), height: {...mopRec(9).height, source: {retrievedAt: old}}}]), nowMs: NOW, observations: [], spread: null}) as any;
  assert.equal(v2.method, 'mop-v2'); assert.equal(v2.saved.reason, 'old'); assert.match(v2.methodLabel, /STALE/);
});
test('MOP forecast file or DAS issue file served saved: the headline says so', () => {
  const b = bundle([mopRec(9)]); b.mop.SF023.issueDelivery = 'saved'; b.mop.SF023.retrievedAt = fresh;
  const a = headlineSurf('spot-2', rec(), {bundle: b, nowMs: NOW, observations: [], spread: null}) as any; assert.equal(a.saved.reason, 'saved'); assert.match(a.methodLabel, /SAVED copy/);
  const c = bundle([mopRec(9)]); c.mop.SF023.delivery = 'saved'; c.mop.SF023.retrievedAt = fresh;
  assert.equal((headlineSurf('spot-2', rec(), {bundle: c, nowMs: NOW, observations: [], spread: null}) as any).saved.reason, 'saved');
});
test('wind and tide: stale or saved sources are labelled where they show', () => {
  const f: any = rec(); f.tide = {height: 2, trend: 'Rising'}; const tm = (retrievedAt: string, delivery?: string) => ({value: 2, unit: 'ft', source: {retrievedAt, ...(delivery ? {delivery} : {})}}); f.evidence = {...f.evidence, tide: tm(fresh)};
  const wFresh = windOf(spot, f, defaultProfile, NOW)!, tFresh = tideOf(f, defaultProfile, NOW);
  assert.doesNotMatch(wFresh.label, /stale|saved/); assert.equal(wFresh.stale, undefined);
  const wOld = windOf(spot, withSrc((e) => { e.windSpeed = {...e.windSpeed, source: {...e.windSpeed.source, retrievedAt: old}}; }), defaultProfile, NOW)!; assert.match(wOld.label, / · stale$/); assert.equal(wOld.stale!.reason, 'old');
  const wSaved = windOf(spot, withSrc((e) => { e.windDirection = {...e.windDirection, source: {...e.windDirection.source, delivery: 'saved'}}; }), defaultProfile, NOW)!; assert.match(wSaved.label, / · saved copy$/);
  const withTide = (m: any) => ({...f, evidence: {...f.evidence, tide: m}}), fT: any = withTide(tm(fresh, 'saved'));
  assert.ok(tFresh, 'fixture has a tide'); const t = tideOf(fT, defaultProfile, NOW)!; assert.equal(t.stale!.reason, 'saved'); assert.match(t.note, /SAVED copy/);
  const fOld: any = withTide(tm(new Date(NOW - 5 * 3600000).toISOString()));
  assert.equal(tideOf(fOld, defaultProfile, NOW)!.stale, undefined, 'a tide prediction retrieved 5 h ago (6 h refresh) is current, not stale');
  const fVeryOld: any = withTide(tm(new Date(NOW - 9 * 3600000).toISOString())); assert.equal(tideOf(fVeryOld, defaultProfile, NOW)!.stale!.reason, 'old');
});
test('model spread: a saved or over-2-h-old spread is not used and the headline says the term is missing', async () => {
  clearSpread(); const ob = evidenceSpot('spot-2'), j = {hourly: {time: times, wave_height_meteofrance_wave: times.map(() => 1.6), swell_wave_height_meteofrance_wave: times.map(() => 1.5), swell_wave_period_meteofrance_wave: times.map(() => 14), swell_wave_direction_meteofrance_wave: times.map(() => 263), wave_height_ecmwf_wam025: times.map(() => 1.6), swell_wave_height_ecmwf_wam025: times.map(() => 2.3), swell_wave_period_ecmwf_wam025: times.map(() => 14), swell_wave_direction_ecmwf_wam025: times.map(() => 263)}};
  await loadModelSpread(ob, async () => j, NOW, () => true);
  assert.ok(spreadStale('spot-2', NOW)); assert.equal(spreadAt('spot-2', new Date(T * 1000 + 3600000).toISOString(), NOW), null, 'a saved spread is not used');
  const h = headlineSurf('spot-2', rec(), {bundle: bundle([mopRec(9)]), nowMs: NOW, observations: []}) as any; assert.match(h.methodLabel, /model-spread term not used \(SAVED copy/);
  clearSpread(); await loadModelSpread(ob, async () => j, NOW - 3 * 3600000); assert.equal(spreadStale('spot-2', NOW)!.reason, 'old'); clearSpread();
});

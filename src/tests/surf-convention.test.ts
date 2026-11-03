import test from 'node:test';
import assert from 'node:assert/strict';
import {headlineSurf, headlineText, guideBasis, ESTIMATE_LABEL} from '../services/headlineSurf.ts';
import {estimateBreaking, NEARSHORE_REF_DEPTH_M} from '../ocean/breakingEstimate.ts';
import {breakingProfile} from '../ocean/localCalibration.ts';
import {fitFor} from '../services/calibrationMath.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';

const T = 1792454400, NOW = T * 1000 + 600000, times = Array.from({length: 24}, (_, i) => T + i * 3600), FT = 1 / 0.3048, G = 9.80665;
const marine = (hs: number, dir = 270, tp = 14) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => hs + 0.05), swell_wave_height: times.map(() => hs), swell_wave_direction: times.map(() => dir), swell_wave_period: times.map(() => tp), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}});
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 4)}};
const rec = (id: string, hs: number, dir = 263.49, tp = 14) => toLegacy(normalizeOpenMeteo(evidenceSpot(id), marine(hs, dir, tp), weather, new Date(T * 1000).toISOString())[1]);
const m = (v: number) => ({value: v, unit: 'ft', source: {retrievedAt: '2026-11-02T00:00:00Z'}});
const mopRec = (hsFt: number, tp = 14, dp = 263.49) => ({timestamp: new Date(T * 1000 + 3600000).toISOString(), height: m(hsFt), period: m(tp), direction: m(dp), qualityFlag: 1, product: 'forecast' as const, mopId: 'SF023'});
const bundle = (r: any[]) => ({nearshore: [], mop: {SF023: {mopId: 'SF023', records: r, issue: null, retrievedAt: '', url: 'x'}}}) as any;

test('v2: the headline central is the MOP Hs at the point (the surf-report convention); the breaking height is kept beside it and is larger; labels say surf height', () => {
  const f = rec('spot-2', 1.5), h = headlineSurf('spot-2', f, {bundle: bundle([mopRec(7.5)]), nowMs: NOW, observations: [], spread: null}) as any;
  assert.equal(h.kind, 'estimate'); assert.equal(h.method, 'mop-v2'); assert.equal(h.centralFt, 7.5); assert.ok(h.breakingFt > 7.5 && h.breakingFt / 7.5 < 1.5, `breaking ${h.breakingFt}`);
  assert.ok(h.loFt <= 7.5 && h.hiFt >= 7.5); assert.match(h.methodLabel, /Surf height \(common convention/); assert.match(h.methodLabel, /breaking height about \d+ ft/); assert.doesNotMatch(h.methodLabel, /at the break/);
  const t = headlineText(h, {heightUnit: 'ft', scale: 'Face height'} as any); assert.match(t.label, /^Est\. .* surf height$/); assert.equal(ESTIMATE_LABEL, 'Est. surf height · model estimate'); assert.equal(h.label, ESTIMATE_LABEL);
});
test('v1 is consistent with it: the offshore swell carried to the 10 m reference depth by linear shoaling (an independent calculation agrees), not the larger breaking height', () => {
  const p = breakingProfile('spot-2')!, hsM = 1.5, tp = 14, ks = (() => { const w = 2 * Math.PI / tp; let lo = 1e-6, hi = 10; for (let i = 0; i < 200; i++) { const x = (lo + hi) / 2; (G * x * Math.tanh(x * NEARSHORE_REF_DEPTH_M) > w * w ? (hi = x) : (lo = x)); } const k = (lo + hi) / 2, c = w / k, n = 0.5 * (1 + 2 * k * NEARSHORE_REF_DEPTH_M / Math.sinh(2 * k * NEARSHORE_REF_DEPTH_M)); return Math.sqrt((G * tp / (4 * Math.PI)) / (c * n)); })();
  const r = estimateBreaking({swellHsFt: hsM * FT, periodS: tp, directionDeg: 263.49, combinedHsFt: hsM * FT, secondaryHsFt: null}, p, 263.49); assert.ok(r.ok); if (!r.ok) return;
  assert.ok(Math.abs(r.nearshoreFt - hsM * FT * ks * 1 * 1) / r.nearshoreFt < 0.01, `nearshore ${r.nearshoreFt} vs independent ${hsM * FT * ks}`); assert.ok(r.centralFt > r.nearshoreFt, 'the breaking height is larger');
  const h = headlineSurf('spot-2', rec('spot-2', 1.5), {nowMs: NOW, observations: [], spread: null}) as any; assert.equal(h.method, 'v1'); assert.ok(Math.abs(h.centralFt - r.nearshoreFt) < 1e-6); assert.ok(Math.abs(h.breakingFt - r.centralFt) < 1e-6); assert.match(h.methodLabel, /Surf height \(common convention.*carried to 10 m/);
});
test('both methods answer the same question: the same swell as MOP Hs at 10 m and as an offshore partition gives about the same surf height', () => {
  const v1 = headlineSurf('spot-2', rec('spot-2', 1.5), {nowMs: NOW, observations: [], spread: null}) as any, ks = v1.centralFt / (1.5 * FT);
  assert.ok(ks > 1.0 && ks < 1.2, `offshore to 10 m shoaling factor ${ks}`); // Ks at 14 s, 10 m depth is about 1.08
  const v2 = headlineSurf('spot-2', rec('spot-2', 1.5), {bundle: bundle([mopRec(v1.centralFt)]), nowMs: NOW, observations: [], spread: null}) as any; assert.equal(v2.centralFt, v1.centralFt);
});
test('calibration pairs on the old breaking-height basis (and the T-073 "central" basis) are not mixed into a convention fit', () => {
  const ob = (i: number, basis?: string) => ({id: 'x' + i, schema: 1 as const, spotId: 'spot-2', observedAt: '', loggedAt: '', rangeFt: [4, 4] as [number, number], faceFt: 4, pair: {centralFt: 8, loFt: 6, hiFt: 11, method: 'v1' as const, validAt: '', offshoreHsFt: 5, primaryTpS: 14, ...(basis ? {basis: basis as any} : {})}});
  assert.equal(fitFor(Array.from({length: 8}, (_, i) => ob(i, 'central')), 'spot-2', 'v1').n, 0); assert.equal(fitFor(Array.from({length: 8}, (_, i) => ob(i)), 'spot-2', 'v1').n, 0);
  assert.equal(fitFor(Array.from({length: 8}, (_, i) => ob(i, 'surf-height')), 'spot-2', 'v1').status, 'active');
});
test('guideBasis: a facing derived from coastline geometry is not listed as a guide fact (Pismo)', () => {
  const g = guideBasis('cs-pismo')!; assert.match(g, /^facing derived from coastline geometry \(CDIP\); swell window from published guides \(Surfnerd, Surf-Forecast\), not reviewed/); assert.doesNotMatch(g, /facing and swell window from published guides/);
  assert.match(guideBasis('spot-3')!, /^facing and swell window from published guides/);
});
test('fallback order: with a nearshore record for the hour that refuses (outside the window, short period) the spot shows offshore; with no usable nearshore record the offshore-swell estimate is used', () => {
  const f = rec('spot-2', 1.5);
  assert.equal(headlineSurf('spot-2', f, {bundle: bundle([mopRec(7.5, 14, 100)]), nowMs: NOW, observations: [], spread: null}).kind, 'offshore');
  assert.equal(headlineSurf('spot-2', f, {bundle: bundle([mopRec(7.5, 5, 263)]), nowMs: NOW, observations: [], spread: null}).kind, 'offshore');
  assert.equal((headlineSurf('spot-2', f, {bundle: bundle([]), nowMs: NOW, observations: [], spread: null}) as any).method, 'v1'); assert.equal((headlineSurf('spot-2', f, {nowMs: NOW, observations: [], spread: null}) as any).method, 'v1');
});

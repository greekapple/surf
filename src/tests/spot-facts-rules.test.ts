import test from 'node:test';
import assert from 'node:assert/strict';
import {enablement, clampWindow, pickMop, breakingProfileFromGuide, profileFromGuide, GENERIC_MIN_PERIOD_S, MOP_NORMAL_TOLERANCE_DEG, type GuideFacts} from '../ocean/spotFactsRules.ts';
import {guideFacts, guideFactsFor} from '../ocean/spotFactsSourced.ts';
import {breakingProfiles, breakingProfile} from '../ocean/localCalibration.ts';
import {evidenceSpots, evidenceSpot} from '../ocean/spots.ts';
import {spotProfiles} from '../ocean/spotProfiles.ts';
import {mopAssignments, mopPoint, assignmentFor} from '../ocean/mop.ts';
import {profileProblems} from '../ocean/spotProfile.ts';

const src = [{url: 'https://example.test/guide', title: 't', site: 'surfnerd', retrievedOn: '2026-11-02'}];
const base: GuideFacts = {spotId: 'x', sources: src, facing: {text: 'W', deg: 270}, swellWindow: {text: 'S to NW', fromDeg: 180, toDeg: 315, basis: 'workable'}, idealSwell: null, windOffshore: null, tide: null, bottom: 'sand', waveType: 'beach', sizeFt: null, exposure: 'not stated', hazards: [], notes: ''};

test('enablement: facing and swell range are required; sheltered never; points, reefs and jetties need an explicit "exposed"', () => {
  assert.equal(enablement(base).estimate, true); assert.equal(enablement(base).shelter, 1);
  assert.match(enablement({...base, facing: null}).reasons.join(), /which way the beach faces/); assert.match(enablement({...base, swellWindow: null}).reasons.join(), /swell directions/);
  assert.match(enablement({...base, exposure: 'sheltered'}).reasons.join(), /sheltered/);
  assert.equal(enablement({...base, exposure: 'somewhat protected'}).estimate, true, 'a beach one source calls somewhat protected still estimates, with the narrower window');
  for (const t of ['point', 'reef', 'jetty'] as const) { assert.equal(enablement({...base, waveType: t}).estimate, false, t); assert.equal(enablement({...base, waveType: t, exposure: 'exposed'}).estimate, true, t); }
});
test('clampWindow: a wide published range is limited to ±60° of the facing; wrap and empty cases', () => {
  assert.deepEqual(clampWindow(180, 360, 270), [210, 330]); assert.deepEqual(clampWindow(270, 337.5, 315), [270, 337.5]);
  assert.deepEqual(clampWindow(270, 90, 270), [270, 330], 'W through E via N, facing W');
  assert.equal(clampWindow(270, 360, 202.5), null, 'nothing left within ±60° of a SSW-facing beach'); assert.deepEqual(clampWindow(0, 359, 90), [30, 150]);
});
test('MOP facing-match rule: Linda Mar (faces NW) takes SM375; Bolinas (faces SE) has no candidate within 25°; the tolerance is documented', () => {
  const lm = guideFactsFor('spot-3')!, bo = guideFactsFor('spot-0')!;
  assert.equal(MOP_NORMAL_TOLERANCE_DEG, 25);
  const pick = pickMop(lm, [{id: 'SM375', shoreNormalDeg: mopPoint('SM375')!.shoreNormalDeg}, {id: 'SM376', shoreNormalDeg: mopPoint('SM376')!.shoreNormalDeg}]); assert.equal(pick!.id, 'SM375'); assert.ok(pick!.offsetDeg < 6);
  assert.equal(pickMop(bo, [{id: 'MA140', shoreNormalDeg: mopPoint('MA140')!.shoreNormalDeg}]), null);
  assert.equal(assignmentFor('spot-3')!.mopId, 'SM375'); assert.equal(assignmentFor('spot-0'), null); assert.match(assignmentFor('spot-3')!.note, /facing-match rule/);
  for (const a of mopAssignments) assert.ok(a.sourceUrl.startsWith('https://'));
});
test('the breaking profile from a guide: generic 8 s minimum, shelter 1, window inside ±60°, shared unvalidated face factors', () => {
  const p = breakingProfileFromGuide(base)!; assert.equal(p.minPeriod, GENERIC_MIN_PERIOD_S); assert.equal(p.shelter, 1); assert.deepEqual(p.window, [210, 315]); assert.deepEqual(p.faceFactors, [0.7, 1.4]); assert.match(p.note, /generic 8 s/);
  assert.equal(breakingProfileFromGuide({...base, exposure: 'sheltered'}), null); assert.equal(breakingProfileFromGuide({...base, facing: null}), null);
});
test('Ocean Beach keeps its reviewed values; guide facing fills orientation only where it was null', () => {
  assert.equal(evidenceSpot('spot-2').orientation, 263.49); assert.deepEqual(breakingProfile('spot-2')!.window, [203, 323]);
  assert.equal(evidenceSpot('spot-3').orientation, 315); assert.equal(evidenceSpot('spot-0').orientation, 135); assert.equal(evidenceSpot('cs-pismo').orientation, null);
});
test('provenance: every guide entry cites https pages with a retrieval date and the same spots the app lists; every derived value says "published guide"', () => {
  assert.deepEqual(guideFacts.map((f) => f.spotId).sort(), evidenceSpots.map((e) => e.id).sort());
  for (const f of guideFacts) { assert.ok(f.sources.length >= 1, f.spotId); for (const s of f.sources) assert.ok(/^https:\/\//.test(s.url) && /^\d{4}-\d\d-\d\d$/.test(s.retrievedOn) && s.title.length > 5, f.spotId); if (f.facing) assert.ok(f.facing.deg >= 0 && f.facing.deg < 360); if (f.swellWindow) assert.ok(f.swellWindow.fromDeg >= 0 && f.swellWindow.toDeg <= 360); }
  for (const p of spotProfiles) assert.deepEqual(profileProblems(p), [], p.spotId);
  const lm = spotProfiles.find((p) => p.spotId === 'spot-3')!; assert.equal(lm.orientation.provenance, 'published guide'); assert.equal(lm.periodResponse.provenance, 'published guide (generic)'); assert.equal(lm.mop.value!.id, 'SM375');
});
test('a sheltered spot gets facts but no estimate; a spot with no published facing or range gets neither; coverage grows from 1 spot to at least 25', () => {
  assert.equal(breakingProfile('spot-1'), null); assert.equal(spotProfiles.find((p) => p.spotId === 'spot-1')!.orientation.value!.beachNormalDeg, 225);
  assert.equal(breakingProfile('cs-pismo'), null); assert.equal(spotProfiles.find((p) => p.spotId === 'cs-pismo')!.orientation.value, null);
  assert.ok(breakingProfiles.length >= 25, `profiles ${breakingProfiles.length}`); assert.ok(breakingProfiles.every((p) => p.window[0] !== p.window[1] && p.minPeriod === 8 && p.shelter === 1));
  assert.ok(profileFromGuide({...base, facing: null, swellWindow: null}).orientation.value === null);
});

import {headlineSurf, guideBasis} from '../services/headlineSurf.ts';
import {explainRating} from '../ratings/explain.ts';
import {rateOcean} from '../ratings/adapters.ts';
import {nowcastFor} from '../services/nearshoreSelect.ts';
import {pickMop as pickMopRecord} from '../services/nearshoreSelect.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {toLegacy} from '../ocean/bridge.ts';

const T = 1792454400, NOW = T * 1000 + 600000, times = Array.from({length: 30}, (_, i) => T - 3600 + i * 3600);
const marine = {latitude: 37.6, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => 1.6), swell_wave_height: times.map(() => 1.5), swell_wave_direction: times.map(() => 315), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}};
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 5), wind_direction_10m: times.map(() => 135), wind_gusts_10m: times.map(() => 5)}};
const rec = (id: string) => normalizeOpenMeteo(evidenceSpot(id), marine, weather, new Date(NOW).toISOString());
const m = (v: number) => ({value: v, unit: 'ft', source: {retrievedAt: '2026-11-02T00:00:00Z'}});
const nr = (iso: string, hs: number, mopId?: string) => ({timestamp: iso, height: m(hs), period: m(14), direction: m(300), qualityFlag: 1, product: 'nowcast' as const, ...(mopId ? {mopId} : {})});

test('T-071b: a spot never shows another point\'s nowcast (Linda Mar SM375 vs the Ocean Beach SF023 nowcast)', () => {
  const iso = new Date(T * 1000).toISOString(), sf023 = [nr(iso, 6.5, 'SF023'), nr(iso, 6.5)];
  assert.equal(nowcastFor('SM375', sf023), undefined); assert.equal(nowcastFor('SF023', sf023)!.length, 2); assert.deepEqual(nowcastFor('SF023', [nr(iso, 5, 'SM375')]), []);
  // the selector with SM375 sees only its forecast, never the SF023 record, even for the current hour
  const fc = [{...nr(iso, 3.1, 'SM375'), product: 'forecast' as const}], pick = pickMopRecord(Date.parse(iso), NOW, nowcastFor('SM375', sf023), fc);
  assert.ok(pick.state === 'ok' && pick.product === 'forecast' && pick.record.height.value === 3.1);
  // headlineSurf for Linda Mar uses the SM375 forecast (v2) even though the bundle carries Ocean Beach's nowcast
  const bundle = {nearshore: sf023, mop: {SM375: {mopId: 'SM375', records: fc, issue: null, retrievedAt: iso, url: 'x'}}} as any;
  const f = toLegacy(rec('spot-3')[1]), h = headlineSurf('spot-3', f, {bundle, nowMs: NOW, observations: []}) as any;
  assert.equal(h.kind, 'estimate'); assert.equal(h.method, 'mop-v2'); assert.equal(h.mop.id, 'SM375'); assert.equal(h.mop.product, 'forecast');
});
test('T-071b: a guide-derived estimate says once where its inputs came from; Ocean Beach (reviewed) does not', () => {
  assert.match(guideBasis('spot-3')!, /facing and swell window from published guides \(Surfnerd, Surf-Forecast\), not reviewed; 8 s generic minimum period/); assert.equal(guideBasis('spot-2'), null);
  const f = toLegacy(rec('spot-0')[1]), h = headlineSurf('spot-0', f, {nowMs: NOW, observations: []}) as any;
  if (h.kind === 'estimate') { assert.match(h.methodLabel, /published guides/); assert.equal((h.methodLabel.match(/published guides/g) ?? []).length, 1); }
  const lm = headlineSurf('spot-3', toLegacy(rec('spot-3')[1]), {bundle: {nearshore: [], mop: {SM375: {mopId: 'SM375', records: [{...nr(new Date(T * 1000).toISOString(), 3, 'SM375'), product: 'forecast' as const}], issue: null, retrievedAt: '', url: 'x'}}} as any, nowMs: NOW, observations: []}) as any;
  assert.match(lm.methodLabel, /SM375 assigned by the facing-match rule/); assert.match(lm.methodLabel, /published guides/);
});
test('T-071b: explainRating counts guide-filled facts as "from published guides, not reviewed" and the wind reason says the shore direction is from a guide', () => {
  const q = rateOcean(evidenceSpot('spot-3'), rec('spot-3')[1], NOW), e = explainRating(q, {spotId: 'spot-3', wind: {mph: 5, relation: 'Offshore'}});
  assert.ok(e.guideFacts.includes('Beach orientation') && e.guideFacts.includes('Swell window')); assert.ok(!e.unknownFacts.includes('Beach orientation'));
  assert.match(e.reliability.reasons.at(-1)!, /not reviewed: \d+ come from published guides/);
  assert.match(e.items.find((i) => /wind/i.test(i.factor))!.reason, /Shore direction comes from a published guide \(approximate, not surveyed\)/);
  const ob = explainRating(rateOcean(evidenceSpot('spot-2'), rec('spot-2')[1], NOW), {spotId: 'spot-2', wind: {mph: 5, relation: 'Offshore'}});
  assert.doesNotMatch(ob.items.find((i) => /wind/i.test(i.factor))!.reason, /published guide/, 'the CDIP orientation is not a guide fact');
});
test('T-071b: exposure parsing separates wind shelter from swell shelter; sizes are rounded to half feet', () => {
  assert.notEqual(guideFactsFor('cs-sand-dollar')!.exposure, 'sheltered'); assert.equal(enablement(guideFactsFor('cs-sand-dollar')!).estimate, true);
  assert.equal(guideFactsFor('cs-asilomar')!.exposure, 'exposed'); assert.equal(guideFactsFor('spot-3')!.exposure, 'somewhat protected'); assert.equal(guideFactsFor('spot-3')!.sizeFt!.max, 12);
  assert.ok(guideFacts.every((f) => !f.sizeFt || (f.sizeFt.min * 2) % 1 === 0 && (f.sizeFt.max * 2) % 1 === 0));
  assert.match(breakingProfile('cs-swamis')!.note, /rests on one guide's "exposed" statement/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {spotHourOf, dayRange} from '../services/spotHour.ts';
import {headlineSurf, headlineText, FLAT_LABEL} from '../services/headlineSurf.ts';
import {glyphFor} from '../services/waveGlyph.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {pacificDate} from '../ocean/time.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';
import {mopAssignments} from '../ocean/mop.ts';

// T-130 review fixes: a Flat headline beside a rating, an all-flat day, no glyph for Flat, and the on-screen caveats.
const FT = 1 / 0.3048, profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const t0 = Date.UTC(2026, 10, 4, 17), NOW = t0 + 600000, times = Array.from({length: 30}, (_, i) => t0 / 1000 - 3600 + i * 3600);
const marine = {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => 1.8), swell_wave_height: times.map(() => 1.7), swell_wave_direction: times.map(() => 330), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}};
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 6)}};
const recs = (id: string) => normalizeOpenMeteo(evidenceSpot(id), marine as never, weather as never, new Date(NOW).toISOString()).map(toLegacy);
const mop = (id: string, hsM: number) => ({nearshore: [], mop: {[id]: {mopId: id, records: times.map((s) => ({timestamp: new Date(s * 1000).toISOString(), height: {value: hsM * FT, unit: 'ft', source: {}}, period: {value: 14, unit: 's', source: {}}, direction: {value: 100, unit: 'deg', source: {}}, qualityFlag: 1, mopId: id, product: 'forecast'})), issue: null, retrievedAt: new Date(NOW).toISOString(), url: 'x'}}}) as never;

test('a Flat headline beside a rating: the rating says it uses offshore swell and the nearshore model shows the swell mostly blocked; the rating is not fed by it', () => {
  const spot = allSpots.find((s) => s.id === 'spot-2')!, f = recs('spot-2')[5];
  const flat = spotHourOf(spot, f, NOW, profile, {bundle: mop('SF023', 0.1)}), none = spotHourOf(spot, f, NOW, profile, {});
  assert.equal(flat.surf.value, FLAT_LABEL); assert.match(flat.rating.explanation, /uses offshore swell; the nearshore model shows the swell mostly blocked here/);
  assert.equal(flat.rating.baseScore, none.rating.baseScore, 'the same rating with or without the nearshore height: nothing feeds it');
});
test('an all-flat day reads Flat, never "Est. 0–0 ft"; glyph: still water for Flat; Flat carries no confidence word', () => {
  const spot = allSpots.find((s) => s.id === 'spot-2')!, records = recs('spot-2'), key = pacificDate(records[8].timestamp);
  const d = dayRange(spot, records, key, NOW, profile, {bundle: mop('SF023', 0.1)});
  assert.equal(d.kind, 'estimate'); assert.equal(d.label, FLAT_LABEL); assert.doesNotMatch(String(d.label), /0–0/);
  const h = headlineSurf('spot-2', records[8], {bundle: mop('SF023', 0.1), nowMs: NOW}) as any;
  assert.deepEqual(glyphFor(h, 69, 14, null), {kind: 'flat', personFt: 69}, 'Flat draws still water beside the person (product), never a wave'); assert.equal(h.confidence, undefined);
});
test('the caveats and provenance of the hand-chosen points are data on the assignment, and reach the method line on screen', () => {
  const by = (id: string) => mopAssignments.find((a) => a.spotId === id)!;
  assert.match(by('spot-5').caveat!, /reef’s focusing is not modelled/); assert.match(by('spot-7').caveat!, /shared with Steamer Lane/); assert.match(by('spot-0').caveat!, /2\.8 km out at the mouth of Bolinas Bay/);
  for (const id of ['spot-5', 'spot-7', 'cs-shelter-cove', 'cs-rincon', 'spot-0']) assert.match(by(id).provenance!, /Chosen by us from CDIP shore normals \(T-130\), not owner-reviewed/, id);
  assert.doesNotMatch(by('cs-shelter-cove').note, /matches the guide’s SW facing/); assert.match(by('cs-shelter-cove').note, /No guide states a facing/);
  const m = mopAssignments.find((a) => a.spotId === 'spot-5')!, r = {timestamp: new Date(t0).toISOString(), height: {value: 6, unit: 'ft', source: {}}, period: {value: 14, unit: 's', source: {}}, direction: {value: 262, unit: 'deg', source: {}}, qualityFlag: 1, mopId: m.mopId, product: 'forecast'};
  const h = headlineSurf('spot-5', {spotId: 'spot-5', timestamp: r.timestamp, day: 0, hour: 10, face: NaN, offshore: 9, availability: {face: false, swell: true, wind: true, tide: true, organization: false}, evidence: {}} as never, {bundle: {nearshore: [], mop: {SM306: {mopId: 'SM306', records: [r], issue: null, retrievedAt: r.timestamp, url: 'x'}}} as never, nowMs: NOW}) as any;
  assert.match(h.methodLabel, /caveat: a 15 m point off the reef/); assert.match(h.methodLabel, /Chosen by us from CDIP shore normals \(T-130\), not owner-reviewed/); assert.match(h.methodLabel, /unvalidated/); assert.match(h.methodLabel, /not a confidence interval/);
});

test('a nearshore-only headline never carries high confidence: low for a hand-chosen or caveated point, at most medium otherwise', () => {
  const fresh = {retrievedAt: new Date(NOW - 60000).toISOString(), delivery: 'direct'}, rec = (id: string, hsM: number) => ({timestamp: new Date(t0).toISOString(), height: {value: hsM * FT, unit: 'ft', source: fresh}, period: {value: 14, unit: 's', source: {}}, direction: {value: 278, unit: 'deg', source: {}}, qualityFlag: 1, mopId: id, product: 'forecast'});
  const hr = (spotId: string) => ({spotId, timestamp: new Date(t0).toISOString(), day: 0, hour: 10, face: NaN, offshore: 8, availability: {face: false, swell: true, wind: true, tide: true, organization: false}, evidence: {}}) as never;
  const bu = (id: string) => ({nearshore: [], mop: {[id]: {mopId: id, records: [rec(id, 1.4)], issue: null, retrievedAt: new Date(t0).toISOString(), url: 'x'}}}) as never;
  for (const [spotId, mopId] of [['spot-0', 'MA137'], ['spot-5', 'SM306'], ['spot-7', 'SC149'], ['cs-shelter-cove', 'HU029'], ['cs-rincon', 'B0001']] as const) {
    const h = headlineSurf(spotId, hr(spotId), {bundle: bu(mopId), nowMs: NOW, observations: [], spread: null}) as any;
    assert.ok(h.nearshoreOnly, spotId); assert.equal(h.confidence, 'low', `${spotId}: hand-chosen point`); assert.match(headlineText(h, profile).confidenceDetail!, /model point, not a breaking estimate; local shelter not modelled/, spotId); assert.doesNotMatch(headlineText(h, profile).confidenceText ?? '', /high/);
  }
  // a rules-based, un-caveated point (Ocean Beach, outside the window): at most medium, never high
  const ob = headlineSurf('spot-2', hr('spot-2'), {bundle: (() => { const r = {...rec('SF023', 1.4), direction: {value: 100, unit: 'deg', source: {}}}; return {nearshore: [], mop: {SF023: {mopId: 'SF023', records: [r], issue: null, retrievedAt: r.timestamp, url: 'x'}}} as never; })(), nowMs: NOW, observations: [], spread: null}) as any;
  assert.ok(ob.nearshoreOnly); assert.notEqual(ob.confidence, 'high'); assert.match(headlineText(ob, profile).confidenceDetail!, /local shelter not modelled/);
});

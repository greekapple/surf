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

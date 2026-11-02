import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {profileProblems, lowestStatus, emptyProfile, PROFILE_FIELDS, unknown, type SpotProfile} from '../ocean/spotProfile.ts';
import {spotProfiles, spotProfile} from '../ocean/spotProfiles.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {mopAssignments} from '../ocean/mop.ts';
import {renderSpotReview} from '../services/spotReview.ts';

test('registry covers the three core spots and satisfies every rule', () => {
  assert.deepEqual(spotProfiles.map((p) => p.spotId).sort(), ['spot-0', 'spot-2', 'spot-3']);
  for (const p of spotProfiles) { assert.ok(evidenceSpots.some((e) => e.id === p.spotId)); assert.deepEqual(profileProblems(p), [], p.spotId); }
});

test('only sourced facts are values; drafts and assumptions stay in proposals (null until reviewed)', () => {
  const ob = spotProfile('spot-2')!;
  assert.equal(ob.swellWindow.value, null); assert.ok(ob.swellWindow.proposal); assert.equal(ob.swellWindow.proposal!.sources.length, 0, 'an assumption carries no invented source');
  assert.equal(ob.periodResponse.value, null); assert.equal(ob.bottom.value, null); assert.ok(ob.bottom.proposal!.sources.length >= 2);
  for (const f of ['sizeBand', 'tideWindow', 'windTolerance'] as const) { assert.equal(ob[f].value, null); assert.equal(ob[f].status, 'unknown'); }
  for (const p of spotProfiles) for (const f of PROFILE_FIELDS) { const s = p[f]; if (s.value !== null) assert.ok(['sourced', 'owner-reviewed'].includes(s.status)); assert.notEqual(s.status, 'validated'); assert.notEqual(s.status, 'measured'); }
  assert.equal(spotProfile('spot-3')!.mop.value, null); assert.equal(spotProfile('spot-0')!.mop.value, null);
});

test('the Ocean Beach MOP value matches the reviewed assignment and the CDIP metadata', () => {
  const m = spotProfile('spot-2')!.mop.value!, a = mopAssignments.find((x) => x.spotId === 'spot-2')!;
  assert.equal(m.id, a.mopId); assert.equal(m.depthM, 10); assert.equal(m.shoreNormalDeg, 263.49);
  assert.deepEqual(mopAssignments.map((x) => x.spotId), spotProfiles.filter((p) => p.mop.value).map((p) => p.spotId));
});

test('rules reject a value without a source, a stale proposal, unreviewed "reviewed", and early calibration', () => {
  const p = emptyProfile('spot-x');
  assert.deepEqual(profileProblems(p), []);
  const bad = (mut: (q: SpotProfile) => void) => { const q = structuredClone(p); mut(q); return profileProblems(q); };
  assert.ok(bad((q) => { q.orientation = {value: {beachNormalDeg: 90}, status: 'sourced', sources: []}; }).some((m) => /needs at least one source/.test(m)));
  assert.ok(bad((q) => { q.orientation = {value: {beachNormalDeg: 90}, status: 'unknown', sources: []}; }).some((m) => /status above unknown/.test(m)));
  assert.ok(bad((q) => { q.orientation = {value: null, status: 'sourced', sources: []}; }).some((m) => /null value must have status unknown/.test(m)));
  assert.ok(bad((q) => { q.orientation = {value: {beachNormalDeg: 90}, status: 'owner-reviewed', sources: [{url: 'https://x.test/a', title: 't', retrievedOn: '2026-11-02'}]}; }).some((m) => /reviewedBy/.test(m)));
  assert.ok(bad((q) => { q.orientation = {value: {beachNormalDeg: 90}, status: 'sourced', sources: [{url: 'http://x.test/a', title: 't', retrievedOn: '2026-11-02'}]}; }).some((m) => /https url/.test(m)));
  assert.ok(bad((q) => { q.orientation = {value: {beachNormalDeg: 90}, status: 'sourced', sources: [{url: 'https://x.test/a', title: 't', retrievedOn: '2026-11-02'}], proposal: {value: {beachNormalDeg: 90}, sources: [], note: ''}}; }).some((m) => /proposal equals/.test(m)));
  assert.ok(bad((q) => { q.calibration = {status: 'reviewed', coefficients: null, sampleCount: 0, validationRef: null}; }).some((m) => /calibrat/.test(m)));
  assert.ok(bad((q) => { q.bottom = {value: {type: 'reef', stability: 'fixed'}, status: 'validated', sources: [{url: 'https://x.test/a', title: 't', retrievedOn: '2026-11-02'}]}; }).some((m) => /validation record/.test(m)));
});

test('lowest status decides what a factor may rely on; any unknown means no score', () => {
  const ob = spotProfile('spot-2')!;
  assert.equal(lowestStatus(ob, ['mop', 'orientation']), 'sourced');
  assert.equal(lowestStatus(ob, ['mop', 'swellWindow']), 'unknown');
  assert.equal(lowestStatus(emptyProfile('z'), PROFILE_FIELDS), 'unknown');
  assert.equal(unknown().value, null);
});

test('the committed review sheet is exactly what the registry generates, and invents no source', () => {
  const file = fs.readFileSync(new URL('../../docs/forecast/SPOT-FACTS-REVIEW.md', import.meta.url), 'utf8');
  assert.equal(file, renderSpotReview(), 'regenerate with docs/forecast/data/build-spot-review.ts');
  assert.ok(!/surf-forecast|surfnerd|magicseaweed|surfline|mondo\.surf|7x7|theoutbound/i.test(file), 'no commercial surf-report source');
  assert.match(file, /SM375/); assert.match(file, /Pillar Point Harbor/); assert.match(file, /☐ approve/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import type {HeadlineSurf} from '../services/headlineSurf.ts';
import {isFlat, FLAT_ESTIMATE_TEXT, flatWhy, nowcastNearby, NOWCAST_NEARBY_TEXT} from '../services/flatSurf.ts';
import {estimateLabel, heroEstimateText} from '../services/headlineLabel.ts';
import {glyphFor, glyphAt} from '../services/waveGlyph.ts';

// T-130: a Flat hour is an estimate with loFt = hiFt = 0 and nearshoreOnly.flat (engineering's headlineSurf). Every surface asks isFlat first.
const p = {heightUnit: 'ft', heightScale: 'face'} as any;
const est = (extra: Record<string, unknown> = {}): HeadlineSurf => ({kind: 'estimate', loFt: 0, hiFt: 0, words: null, wordsNote: '', method: 'mop-v2', methodLabel: 'MOP nearshore (CDIP), 15 m modelled point X: under 0.5 ft, so Flat', label: 'Est. surf height · model estimate', centralFt: 0.3, ...extra} as any);
const flatBlocked = est({nearshoreOnly: {code: 'outside-window', flat: true, reason: 'outside the swell window'}});
const flatNoProfile = est({nearshoreOnly: {code: 'no-profile', flat: true, reason: ''}});
const small = est({loFt: 0, hiFt: 1, centralFt: 0.6, nearshoreOnly: {code: 'outside-window', flat: false, reason: ''}});

test('isFlat only for a flat nearshore estimate', () => {
  assert.equal(isFlat(flatBlocked), true);
  assert.equal(isFlat(small), false, 'a small 0–1 ft nearshore range is a number, not Flat');
  assert.equal(isFlat({kind: 'offshore', ft: 0, label: 'offshore · not surf size'}), false);
  assert.equal(isFlat(null), false);
  assert.equal(flatWhy(flatBlocked), 'swell mostly blocked here');
  assert.equal(flatWhy(flatNoProfile), 'under half a foot nearshore');
});

test('Flat reads "Flat (model estimate)" on every estimate label, never "Est. Flat" or "Flat est."', () => {
  const e = estimateLabel(flatBlocked, p)!;
  assert.equal(`${e.value} ${e.suffix}`, FLAT_ESTIMATE_TEXT);
  assert.equal(heroEstimateText(flatBlocked, p), FLAT_ESTIMATE_TEXT);
  assert.doesNotMatch(`${e.value} ${e.suffix} ${heroEstimateText(flatBlocked, p)}`, /0–0|Est\. Flat|Flat est\./);
  const s = estimateLabel(small, p)!;
  assert.equal(s.suffix, 'est.', 'a numeric nearshore range keeps its usual suffix');
});

test('a Flat hour draws still water beside the person, never a wave from the sub-half-foot model height', () => {
  assert.deepEqual(glyphFor(flatBlocked, 5.8, 12, null), {kind: 'flat', personFt: 5.8});
  assert.deepEqual(glyphAt('estimate', 0.3, 5.8, 12, null, true), {kind: 'flat', personFt: 5.8});
  assert.equal(glyphAt('estimate', 0.3, 5.8, 12, null, false)?.kind, 'surf', 'without the flag the old behaviour stands');
});

test('the nowcast hour says "nowcast nearby (CDIP model)", never "measured"', () => {
  assert.equal(NOWCAST_NEARBY_TEXT, 'nowcast nearby (CDIP model)');
  assert.doesNotMatch(NOWCAST_NEARBY_TEXT, /measured/i);
  assert.deepEqual(nowcastNearby(est({nowcastNearby: {source: 'CDIP nowcast'}})), {source: 'CDIP nowcast'});
  assert.equal(nowcastNearby(small), null);
});

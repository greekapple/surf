import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateLabel, heroEstimateText} from '../services/headlineLabel.ts';
import {defaultProfile} from '../data/demo.ts';
import type {HeadlineSurf} from '../services/headlineSurf.ts';

// T-110 (Codex P2s): compact surfaces never show a model range as a bare number, keep the Hawaiian qualifier, and keep saved/stale labels.
const est = (extra: object = {}): HeadlineSurf => ({kind: 'estimate', loFt: 8, hiFt: 12, words: null, wordsNote: '', method: 'mop-v2', methodLabel: 'Model estimate from the MOP nowcast', label: 'Est.', ...extra} as any);
const ft = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const}, haw = {...ft, scale: 'Hawaiian' as const};

test('Compare label: an estimate says "est.", with the method for tooltip and screen readers', () => {
  const e = estimateLabel(est(), ft)!;
  assert.match(e.value, /^8–12 ft$/); assert.equal(e.suffix, 'est.'); assert.equal(e.tag, 'model estimate'); assert.match(e.detail, /MOP nowcast/); assert.equal(e.fresh, true);
  assert.equal(estimateLabel({kind: 'offshore', ft: 7, label: 'offshore · not surf size'} as any, ft), null, 'offshore rows keep their own offshore tag');
});
test('Compare label: the Hawaiian scale qualifier is kept', () => {
  const e = estimateLabel(est(), haw)!;
  assert.match(e.value, /Hawaiian/); assert.match(e.value, /^4–6 ft/);
});
test('Compare and hero: saved and stale estimates are labelled, never shown as current', () => {
  const saved = est({saved: {retrievedAt: '2026-11-03T10:00:00Z', reason: 'saved'}}), stale = est({saved: {retrievedAt: '2026-11-03T10:00:00Z', reason: 'old'}});
  assert.equal(estimateLabel(saved, ft)!.suffix, 'saved est.'); assert.equal(estimateLabel(stale, ft)!.suffix, 'stale est.');
  assert.equal(heroEstimateText(est(), ft), 'Est. 8–12 ft');
  assert.equal(heroEstimateText(saved, ft), 'Est. 8–12 ft (saved estimate)'); assert.equal(heroEstimateText(stale, ft), 'Est. 8–12 ft (stale estimate)');
  assert.match(heroEstimateText(est(), haw)!, /Hawaiian/);
  assert.equal(heroEstimateText({kind: 'offshore', ft: 7, label: 'offshore · not surf size'} as any, ft), null);
});

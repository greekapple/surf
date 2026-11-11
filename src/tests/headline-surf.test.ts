import test from 'node:test';
import assert from 'node:assert/strict';
import {headlineSurf, headlineText} from '../services/headlineSurf.ts';
import {bodyWord, bodyWords, BODY_WORD_SOURCES} from '../services/bodyWords.ts';

const FT = 1 / 0.3048;
const m = (unit: any, value: number | null) => ({value, unit, source: {} as any});
const rec = (iso: string, hsM: number, tp: number, dp: number) => ({timestamp: iso, height: m('ft', hsM * FT), period: m('s', tp), direction: m('deg', dp), qualityFlag: 1, mopId: 'SF023', product: 'forecast' as const});
const T = '2026-11-02T18:00:00.000Z', NOW = Date.parse('2026-11-02T12:00:00Z');
const v1input = {kind: 'breaking-estimate', valueFt: null, rangeFt: [3, 5] as [number, number], rangeMethod: 'Komar-Gaughan … unvalidated v1'};
const hour = (o: any = {}) => ({spotId: 'spot-2', timestamp: T, day: 0, hour: 18, face: NaN, offshore: 5.2, availability: {face: false, swell: true, wind: true, tide: true, organization: false}, evidence: {faceEstimate: {input: v1input, centralFt: 4, breakingFt: 5}}, ...o}) as any;
const bundle = (records: any[]) => ({nearshore: [], mop: {SF023: {mopId: 'SF023', records, issue: null, retrievedAt: T, url: 'x'}}}) as any;
const profile = {heightUnit: 'ft', scale: 'Face'} as any;

test('body words: anchors, in-between words, edges and nulls', () => {
  assert.deepEqual([1, 2, 2.5, 3, 4, 4.5, 5, 6, 11, 12, 20].map(bodyWord), ['ankle', 'knee', 'thigh', 'waist', 'chest', 'shoulder', 'head', 'overhead', 'overhead', 'double overhead', 'double overhead']);
  assert.equal(bodyWord(0), 'ankle'); assert.equal(bodyWord(1.4), 'ankle'); assert.equal(bodyWord(1.6), 'knee'); assert.equal(bodyWord(3.4), 'waist'); assert.equal(bodyWord(3.6), 'chest'); assert.equal(bodyWord(5.49), 'head'); assert.equal(bodyWord(5.5), 'overhead'); assert.equal(bodyWord(11.99), 'overhead');
  assert.equal(bodyWord(null), null); assert.equal(bodyWord(undefined), null); assert.equal(bodyWord(NaN), null); assert.equal(bodyWord(-1), null); assert.equal(bodyWord(Infinity), null);
});
test('body words for ranges: "waist to chest", single word, nulls and reversed ranges', () => {
  assert.equal(bodyWords(3, 4), 'waist to chest'); assert.equal(bodyWords(3, 3.4), 'waist high'); assert.equal(bodyWords(6, 9), 'overhead'); assert.equal(bodyWords(12, 16), 'double overhead'); assert.equal(bodyWords(8, 14), 'overhead to double overhead');
  assert.equal(bodyWords(null, 4), null); assert.equal(bodyWords(4, 3), null); assert.equal(bodyWords(NaN, NaN), null);
  assert.ok(BODY_WORD_SOURCES.every((s) => s.url.startsWith('https://')) && BODY_WORD_SOURCES.length === 2);
});

test('v2 is the default where a reviewed MOP point has data for the hour', () => {
  const h = headlineSurf('spot-2', hour(), {bundle: bundle([rec(T, 1.4, 14, 266)]), nowMs: NOW});
  assert.equal(h.kind, 'estimate'); if (h.kind !== 'estimate') return;
  assert.equal(h.method, 'mop-v2'); assert.ok(h.hiFt - h.loFt >= 1 && h.loFt >= 0); assert.equal(h.mop?.id, 'SF023'); assert.equal(h.mop?.product, 'forecast');
  assert.ok(h.words && h.wordsNote.includes('Approximate')); assert.match(h.label, /Est\./); assert.match(h.methodLabel, /unvalidated/);
});
test('falls to v1 only when the nearshore model has no usable record for the hour; if it HAS the hour and refuses (short period, outside the window) the spot shows MOP\'s own nearshore height, never a contradicting v1 and never the offshore number (T-077, replaced by T-130)', () => {
  const far = headlineSurf('spot-2', hour(), {bundle: bundle([rec('2026-11-09T00:00:00.000Z', 1.4, 14, 266)]), nowMs: NOW});
  assert.ok(far.kind === 'estimate' && far.method === 'v1' && far.centralFt === 4 && far.loFt <= 4 && far.hiFt >= 4 && far.words !== null);
  for (const [tp, dp, code] of [[6, 266, 'short-period'], [14, 100, 'outside-window']] as const) {
    const h = headlineSurf('spot-2', hour(), {bundle: bundle([rec(T, 1.4, tp, dp)]), nowMs: NOW}) as any;
    assert.equal(h.kind, 'estimate', `${code}: the nearshore model has the hour, so the spot shows its own height (T-130)`); assert.equal(h.method, 'mop-v2'); assert.equal(h.nearshoreOnly.code, code); assert.equal(h.nearshoreOnly.flat, false);
    assert.ok(Math.abs(h.centralFt - 1.4 * FT) < 0.01, 'the central height is MOP\'s Hs at the point'); assert.match(h.methodLabel, /^MOP nearshore \(CDIP\), 10 m modeled point SF023/); assert.match(h.methodLabel, /outside our rule's swell window/); assert.match(h.methodLabel, /local shelter between the point and the break is not modeled/); assert.match(h.methodLabel, /unvalidated/); assert.doesNotMatch(h.methodLabel, /already includes the blocking/);
  }
  assert.ok((headlineSurf('spot-2', hour(), {bundle: null, nowMs: NOW}) as any).method === 'v1');
  assert.ok((headlineSurf('spot-2', hour(), {nowMs: NOW}) as any).method === 'v1');
  const lm = headlineSurf('spot-0', hour({spotId: 'spot-0'}), {bundle: bundle([rec(T, 1.4, 14, 266)]), nowMs: NOW});
  assert.ok(lm.kind === 'estimate' && lm.method === 'v1', 'a spot with no assigned MOP point never uses v2');
});
test('v1 estimates that are too narrow, unversioned or missing fall to offshore with its label; never an unlabelled number', () => {
  const narrow = headlineSurf('spot-3', hour({evidence: {faceEstimate: {input: {...v1input, rangeFt: [3, 3.5]}}}}), {nowMs: NOW});
  assert.deepEqual(narrow, {kind: 'offshore', ft: 5.2, label: 'offshore · not surf size'});
  assert.equal(headlineSurf('spot-3', hour({evidence: {faceEstimate: {input: {...v1input, rangeMethod: 'unversioned'}}}}), {nowMs: NOW}).kind, 'offshore');
  assert.equal(headlineSurf('spot-3', hour({evidence: {faceEstimate: {refusal: 'short period'}}}), {nowMs: NOW}).kind, 'offshore');
  assert.equal(headlineSurf('spot-3', hour({evidence: {}}), {nowMs: NOW}).kind, 'offshore');
});
test('demonstration data is labelled as such; nothing usable gives "none"', () => {
  const d = headlineSurf('spot-3', hour({evidence: undefined, face: 4.4, availability: {face: true, swell: true, wind: true, tide: true, organization: false}}), {nowMs: NOW});
  assert.deepEqual(d, {kind: 'demonstration', ft: 4.4, label: 'demonstration face · not a forecast'});
  assert.equal(headlineSurf('spot-3', hour({evidence: undefined, offshore: NaN}), {nowMs: NOW}).kind, 'none');
  assert.equal(headlineSurf('spot-3', hour({evidence: undefined, offshore: -2}), {nowMs: NOW}).kind, 'none');
  assert.equal(headlineSurf('spot-3', hour({timestamp: 'bad'}), {nowMs: NOW}).kind, 'estimate');
  assert.equal(headlineSurf('spot-3', undefined as any, {nowMs: NOW}).kind, 'none');
});
test('the selector is read-only: the hour and bundle are not changed, and it exports nothing the rating can consume', () => {
  const h = hour(), b = bundle([rec(T, 1.4, 14, 266)]), before = JSON.stringify([h, b]);
  headlineSurf('spot-2', h, {bundle: b, nowMs: NOW}); assert.equal(JSON.stringify([h, b]), before);
});
test('display strings use the user units and always name the quantity', () => {
  const est = headlineSurf('spot-3', hour(), {nowMs: NOW}), ft = headlineText(est, profile), mt = headlineText(est, {heightUnit: 'm', scale: 'Face'} as any);
  assert.match(ft.label, /^Est\. .*ft surf height$/); assert.equal(ft.tag, 'model estimate'); assert.match(mt.label, /m surf height$/);
  const off = headlineText(headlineSurf('spot-3', hour({evidence: {}}), {nowMs: NOW}), profile); assert.match(off.label, /offshore · not surf size$/); assert.equal(off.words, null);
  assert.equal(headlineText({kind: 'none', label: 'No wave height for this hour'}, profile).value, '—');
});

// T-130: nearshore-only, Flat, measured nearby, and the four spots with a MOP point but no breaking profile
test('T-130: a blocked hour whose MOP height is under the flat threshold reads Flat, with the method named', () => {
  const h = headlineSurf('spot-2', hour(), {bundle: bundle([rec(T, 0.1, 14, 100)]), nowMs: NOW}) as any; // 0.33 ft at the point, swell outside the window
  assert.equal(h.kind, 'estimate'); assert.equal(h.nearshoreOnly.flat, true); assert.equal(h.loFt, 0); assert.equal(h.hiFt, 0); assert.match(h.methodLabel, /under 0\.5 ft, so Flat/);
  const t = headlineText(h, profile); assert.equal(t.value, 'Flat'); assert.match(t.label, /^Flat/); assert.equal(t.words, null); assert.match(t.detail, /MOP nearshore \(CDIP\)/);
});
test('T-130: a small blocked height is a small range (0-1 ft), never the offshore number', () => {
  const h = headlineSurf('spot-2', hour({offshore: 6}), {bundle: bundle([rec(T, 0.3, 14, 100)]), nowMs: NOW}) as any; // 0.98 ft at the point
  assert.equal(h.kind, 'estimate'); assert.equal(h.nearshoreOnly.flat, false); assert.ok(h.hiFt <= 2, `range ${h.loFt}-${h.hiFt}`); assert.ok(h.loFt <= 1);
  assert.doesNotMatch(headlineText(h, profile).value, /6/);
});
test('T-130: the four spots with a reviewed MOP point and NO breaking profile show MOP\'s nearshore height as the surf estimate', () => {
  const pts: [string, string][] = [['spot-5', 'SM306'], ['spot-7', 'SC149'], ['cs-shelter-cove', 'HU029'], ['cs-rincon', 'B0001']];
  for (const [spotId, mopId] of pts) {
    const r = {...rec(T, 1.2, 14, 262), mopId}, b = {nearshore: [], mop: {[mopId]: {mopId, records: [r], issue: null, retrievedAt: T, url: 'x'}}} as any;
    const h = headlineSurf(spotId, hour({spotId, offshore: 9, evidence: {}}), {bundle: b, nowMs: NOW}) as any;
    assert.equal(h.kind, 'estimate', spotId); assert.equal(h.nearshoreOnly.code, 'no-profile', spotId); assert.equal(h.method, 'mop-v2'); assert.match(h.methodLabel, new RegExp(`modeled point ${mopId}`)); assert.match(h.methodLabel, /no breaking profile/); assert.match(h.methodLabel, /not a breaking estimate/);
    assert.ok(Math.abs(h.centralFt - 1.2 * FT) < 0.01, spotId);
  }
});
test('T-130: "measured nearby" only when a CDIP nowcast covers the hour (never for a forecast hour)', () => {
  const nowcast = {...rec(T, 1.4, 14, 266), product: 'nowcast' as const};
  const near = headlineSurf('spot-2', hour(), {bundle: {nearshore: [nowcast], mop: {}} as any, nowMs: Date.parse(T) + 3600000}) as any;
  assert.equal(near.kind, 'estimate'); assert.equal(near.mop.product, 'nowcast'); assert.match(near.nowcastNearby.source, /nowcast.*measured buoy waves.*not a measurement at the spot/);
  const fc = headlineSurf('spot-2', hour(), {bundle: bundle([rec(T, 1.4, 14, 266)]), nowMs: NOW}) as any;
  assert.equal(fc.mop.product, 'forecast'); assert.equal(fc.nowcastNearby, undefined);
});

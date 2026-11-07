import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BUOY_TRANSFERS, HELD_TRANSFERS, buoyTransferFor, buoyTransferAt, breakingFactor, buoyTransferText, buoyTransferTag} from '../ocean/buoyTransfer.ts';
import {faceEstimate} from '../ocean/openMeteo.ts';
import {estimateBreaking} from '../ocean/breakingEstimate.ts';
import {breakingProfile} from '../ocean/localCalibration.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {mopAssignments} from '../ocean/mop.ts';
import {headlineSurf, headlineText, transferTag} from '../services/headlineSurf.ts';
import {pairsFor, fitFor, v1CentralOnCurrentScale} from '../services/calibrationMath.ts';
import {defaultProfile} from '../data/demo.ts';

const evidence = JSON.parse(fs.readFileSync(new URL('../../docs/forecast/data/accuracy-vs-buoys.json', import.meta.url), 'utf8'));
const day = (iso: string) => iso.slice(0, 10);

test('every applied factor is a "supported" v1 trial in the generated evidence (minus the held ones), with its dates and size bins', () => {
  const supported = evidence.trials.filter((t: any) => t.verdict === 'supported' && /^v1 vs \(d\)/.test(t.what));
  assert.deepEqual([...BUOY_TRANSFERS.map((t) => t.spotId), ...HELD_TRANSFERS.map((t) => t.spotId)].sort(), supported.map((t: any) => t.spot).sort());
  for (const t of BUOY_TRANSFERS) {
    const e = supported.find((x: any) => x.spot === t.spotId);
    assert.ok(Math.abs(e.factor - t.factor) < 0.0015, `${t.spotId} factor`);
    assert.match(e.what, new RegExp(`anchor ${t.buoyId}$`));
    assert.equal(e.heldOutBefore.n, t.heldOut.n); assert.equal(e.heldOutBefore.maeFt, t.heldOut.maeBeforeFt); assert.equal(e.heldOutAfter.maeFt, t.heldOut.maeAfterFt);
    assert.equal(day(e.firstHour), t.fit.from); assert.equal(day(e.cutAt), t.fit.to); assert.equal(day(e.cutAt), t.heldOut.from); assert.equal(day(e.lastHour), t.heldOut.to);
    assert.equal(e.recentBefore.n, t.later.n); assert.equal(e.recentAfter.maeFt, t.later.maeAfterFt);
    assert.deepEqual(t.bins, e.bins.filter((b: any) => b.holds).map((b: any) => [b.fromFt, b.toFt]), `${t.spotId} bins`);
    const a = mopAssignments.find((x) => x.spotId === t.spotId)!; assert.equal(a.mopId, t.mopId);
    if (/facing-match rule/.test(a.note)) assert.equal(t.mopStatus, 'assigned by the facing-match rule, not reviewed');
  }
  assert.equal(buoyTransferFor('spot-3'), null, 'Linda Mar is held: its MOP point is not known to represent the beach');
  assert.equal(buoyTransferFor('cs-imperial'), null, 'archive-only evidence is not applied');
});

test('the factor applies only in the offshore-Hs bins where it held', () => {
  assert.ok(buoyTransferAt('spot-2', 6)); assert.ok(buoyTransferAt('spot-2', 2)); assert.equal(buoyTransferAt('spot-2', 13), null, 'Ocean Beach 12 ft and up: no held-out hours, no factor');
  assert.equal(buoyTransferAt('spot-4', 3), null, 'Montara under 4 ft: the factor did not hold'); assert.ok(buoyTransferAt('spot-4', 9));
  assert.equal(buoyTransferAt('cs-topanga', 5), null); assert.ok(buoyTransferAt('cs-topanga', 2));
  assert.equal(buoyTransferAt('spot-2', null), null);
});

const src = {provider: 't', kind: 'forecast', validAt: '2026-11-06T00:00:00Z', retrievedAt: '2026-11-06T00:00:00Z', issuedAt: null, updatedAt: null, url: '', nativeUnit: 'm', location: '', delivery: 'direct'} as any;
const m = (value: number, unit: string) => ({value, unit, source: src}) as any;
const swell = (hs: number, tp: number, dp: number) => ({height: m(hs, 'ft'), period: m(tp, 's'), direction: m(dp, 'deg')}) as any;

test('v1 at a corrected spot: surf height × factor, breaking height × factor^0.8, uncorrected values kept; outside the bins and at other spots untouched', () => {
  const ob = evidenceSpot('spot-2'), p = breakingProfile('spot-2')!;
  const raw = estimateBreaking({swellHsFt: 8, periodS: 14, directionDeg: 275, combinedHsFt: 9, secondaryHsFt: null}, p, ob.orientation);
  assert.ok(raw.ok);
  const fe = faceEstimate(ob, m(9, 'ft'), swell(8, 14, 275), null);
  assert.ok(fe.transfer && raw.ok);
  assert.ok(Math.abs(fe.centralFt! - raw.nearshoreFt * 1.482) < 1e-9);
  assert.ok(Math.abs(fe.breakingFt! - raw.centralFt * breakingFactor(1.482)) < 1e-9);
  assert.equal(fe.transfer!.uncorrectedFt, raw.nearshoreFt); assert.equal(fe.transfer!.uncorrectedBreakingFt, raw.centralFt);
  assert.equal(faceEstimate(ob, m(14, 'ft'), swell(13, 14, 275), null).transfer, undefined, 'big offshore swell: outside the bins, uncorrected');
  assert.equal(faceEstimate(evidenceSpot('cs-moonstone'), m(9, 'ft'), swell(8, 14, 285), null).transfer, undefined);
  assert.equal(faceEstimate(evidenceSpot('spot-3'), m(9, 'ft'), swell(8, 14, 300), null).transfer, undefined, 'Linda Mar held');
});

test('the correction is visible: a short tag, a method line naming the MOP point, its review status and the held-out dates, and the uncorrected height in the detail', () => {
  const t = buoyTransferFor('spot-2')!, text = buoyTransferText(t);
  assert.equal(buoyTransferTag(t), 'buoy-corrected ×1.48');
  assert.match(text, /^buoy-corrected ×1\.48 \(our correction\): fitted 1 Nov 2025–26 Jan 2026 on measured waves at the CDIP 142 San Francisco Bar buoy/);
  assert.match(text, /against that buoy height carried to MOP point SF023, on held-out hours 26 Jan–28 Apr 2026, the typical error fell from 2\.6 to 0\.8 ft; applied only with offshore waves under 12 ft$/);
  assert.doesNotMatch(text, /last 30 days|6 months/);
  assert.match(buoyTransferText(buoyTransferFor('spot-4')!), /MOP point SM340 \(assigned by the facing-match rule, not reviewed\)/);
  assert.match(buoyTransferText(buoyTransferFor('spot-4')!), /only with offshore waves of 4–12 ft/);
  const ob = evidenceSpot('spot-2'), fe = faceEstimate(ob, m(9, 'ft'), swell(8, 14, 275), null);
  const hour = {spotId: 'spot-2', timestamp: '2026-11-06T00:00:00.000Z', day: 0, hour: 0, face: NaN, offshore: 9, availability: {face: false, swell: true, wind: true, tide: true, organization: false}, evidence: {faceEstimate: fe, offshore: {source: src}, primary: {height: {source: src}}}} as any;
  const h = headlineSurf('spot-2', hour, {bundle: null, nowMs: Date.parse('2026-11-06T00:30:00Z'), observations: [], felt: [], spread: null}) as any;
  assert.equal(h.kind, 'estimate'); assert.equal(h.method, 'v1');
  assert.ok(Math.abs(h.centralFt - fe.centralFt!) < 1e-9);
  assert.match(h.methodLabel, /buoy-corrected ×1\.48 \(our correction\)/);
  assert.equal(transferTag(h), 'buoy-corrected ×1.48'); assert.equal(h.transfer.uncorrectedFt, fe.transfer!.uncorrectedFt);
  const tx = headlineText(h, {...defaultProfile, heightUnit: 'ft'} as any);
  assert.match(tx.detail, /; before our correction: /);
});

test('personal calibration does not compound with the factor: old and new Ocean Beach pairs land on one scale', () => {
  const raw = 4; // the uncorrected v1 central for that hour; offshore 6 ft is inside the factor's bins
  const old = {centralFt: raw, offshoreHsFt: 6}; // recorded before T-131 phase 2: no transfer field
  const fresh = {centralFt: raw * 1.482, offshoreHsFt: 6, transfer: 1.482};
  assert.ok(Math.abs(v1CentralOnCurrentScale('spot-2', old)! - raw * 1.482) < 1e-9);
  assert.ok(Math.abs(v1CentralOnCurrentScale('spot-2', fresh)! - raw * 1.482) < 1e-9);
  assert.equal(v1CentralOnCurrentScale('spot-2', {centralFt: raw, offshoreHsFt: null}), null, 'unknown offshore height at a corrected spot: left out');
  assert.equal(v1CentralOnCurrentScale('cs-moonstone', {centralFt: raw, offshoreHsFt: null}), raw);
  // eight sessions where the surfer saw exactly the corrected height, logged half before and half after the change: the fit ratio is 1, so the headline is not raised again
  const obs = (i: number, pair: any) => ({id: 'o' + i, schema: 1 as const, spotId: 'spot-2', observedAt: '2026-11-01T16:00:00Z', loggedAt: '2026-11-01T18:00:00Z', rangeFt: [raw * 1.482, raw * 1.482] as [number, number], faceFt: raw * 1.482,
    pair: {loFt: 0, hiFt: 0, method: 'v1' as const, validAt: '2026-11-01T16:00:00Z', primaryTpS: 14, basis: 'surf-height' as const, ...pair}});
  const log = [...Array(8)].map((_, i) => obs(i, i % 2 ? old : fresh));
  assert.equal(pairsFor(log, 'spot-2', 'v1').length, 8);
  const fit = fitFor(log, 'spot-2', 'v1'); assert.equal(fit.status, 'active'); assert.ok(Math.abs(fit.ratio! - 1) < 1e-9, `ratio ${fit.ratio}`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {explainRating, effectOf} from '../ratings/explain.ts';
import {rateOcean} from '../ratings/adapters.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';

const now = Date.parse('2026-10-20T06:00:00Z');
const rec = (id: string, mph: number, dir: number) => ({...normalizeOpenMeteo(evidenceSpot(id),
  {hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_period: 's', swell_wave_direction: '°'}, hourly: {time: [now / 1000], wave_height: [2], swell_wave_height: [1.7], swell_wave_period: [13], swell_wave_direction: [270]}},
  {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: [now / 1000], wind_speed_10m: [mph], wind_direction_10m: [dir], wind_gusts_10m: [mph]}}, new Date(now).toISOString())[0], spotId: id});

test('effect bands: ≥70 +, ≥40 ~, below −, missing ?', () => {
  assert.deepEqual([100, 70, 69.9, 40, 39.9, 0, null, NaN].map((x) => effectOf(x as any)), ['+', '+', '~', '~', '-', '-', '?', '?']);
});
test('onshore wind explains itself: "~", the threshold and its source', () => {
  const q = rateOcean(evidenceSpot('spot-2'), rec('spot-2', 4.9, 270), now), e = explainRating(q, {spotId: 'spot-2', wind: {mph: 4.9, relation: 'Onshore'}});
  const w = e.items.find((i) => /wind/i.test(i.factor))!;
  assert.equal(w.effect, '~'); assert.match(w.reason, /Onshore 4\.9 mph/); assert.match(w.reason, /3 mph/); assert.match(w.reason, /Beaufort/); assert.ok(w.inScore);
});
test('offshore wind is a plus; light onshore is described as a small penalty; unknown relation is "?" and unscored', () => {
  const off = explainRating(rateOcean(evidenceSpot('spot-2'), rec('spot-2', 4.9, 90), now), {spotId: 'spot-2', wind: {mph: 4.9, relation: 'offshore'}}).items.find((i) => /wind/i.test(i.factor))!;
  assert.equal(off.effect, '+'); assert.match(off.reason, /Offshore 4\.9 mph/);
  const light = explainRating(rateOcean(evidenceSpot('spot-2'), rec('spot-2', 2, 270), now), {spotId: 'spot-2', wind: {mph: 2, relation: 'onshore'}}).items.find((i) => /wind/i.test(i.factor))!;
  assert.match(light.reason, /Light onshore 2 mph/);
  const unk = explainRating(rateOcean(evidenceSpot('spot-3'), rec('spot-3', 4.9, 270), now), {spotId: 'spot-3', wind: {mph: 4.9, relation: 'Unknown'}}).items.find((i) => /wind/i.test(i.factor))!;
  assert.equal(unk.effect, '?'); assert.equal(unk.inScore, false);
});
test('nearshore swell and tide are context only: never in the score, never claim more than they know', () => {
  const q = rateOcean(evidenceSpot('spot-2'), rec('spot-2', 4.9, 270), now);
  const e = explainRating(q, {spotId: 'spot-2', wind: {mph: 4.9, relation: 'onshore'}, mop: {id: 'SF023', hsFt: 4.5, tpS: 11.8, dpDeg: 266, shoreNormalDeg: 263.49, product: 'forecast'}, tide: {trend: 'falling', heightLabel: '0.9 ft'}});
  const m = e.items.find((i) => /Nearshore/.test(i.factor))!, t = e.items.find((i) => /Tide/.test(i.factor))!;
  assert.equal(m.inScore, false); assert.equal(m.weight, 0); assert.equal(m.effect, '+'); assert.match(m.reason, /Shown, not scored/);
  assert.equal(t.inScore, false); assert.equal(t.effect, '?'); assert.match(t.reason, /no reviewed tide window/);
  const base = rateOcean(evidenceSpot('spot-2'), rec('spot-2', 4.9, 270), now);
  assert.equal(base.score, q.score, 'explaining does not change the rating');
  assert.equal(explainRating(q, {spotId: 'spot-2', mop: {id: 'X', hsFt: 3, tpS: 10, dpDeg: 20, shoreNormalDeg: 263, product: 'nowcast'}}).items.find((i) => /Nearshore/.test(i.factor))!.effect, '-');
  assert.equal(explainRating(q, {spotId: 'spot-2', mop: {id: 'X', hsFt: null, tpS: 10, dpDeg: 20, shoreNormalDeg: 263, product: 'nowcast'}}).items.some((i) => /Nearshore/.test(i.factor)), false, 'a missing MOP value is not shown as a result');
});
test('unreviewed spot facts are listed and lower the stated reliability reasons; a spot with more reviewed facts lists fewer', () => {
  const q = rateOcean(evidenceSpot('spot-3'), rec('spot-3', 4.9, 270), now), e = explainRating(q, {spotId: 'spot-3'});
  assert.ok(e.unknownFacts.includes('Swell window') && e.unknownFacts.includes('Tide window') && e.unknownFacts.includes('Wind tolerance'));
  assert.match(e.reliability.reasons.at(-1)!, /spot facts are not reviewed/); assert.equal(e.reliability.category, q.reliability.category);
  const ob = explainRating(rateOcean(evidenceSpot('spot-2'), rec('spot-2', 4.9, 270), now), {spotId: 'spot-2'});
  assert.ok(ob.unknownFacts.length < e.unknownFacts.length);
  assert.ok(explainRating(q, {spotId: 'spot-unknown'}).unknownFacts.length >= 9);
});

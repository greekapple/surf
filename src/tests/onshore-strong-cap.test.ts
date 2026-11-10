import test from 'node:test';
import assert from 'node:assert/strict';
import {windCeilings, ONSHORE_BAD_MPH, ONSHORE_STRONG_CEILING, setOnshoreCapEnabled} from '../ratings/windRules.ts';
import {ONSHORE_BAD_MPH as CALL_SKIP_MPH} from '../services/call.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {rateOcean} from '../ratings/adapters.ts';
import {explainRating} from '../ratings/explain.ts';
import {categoryForScore} from '../ratings/engine.ts';
/** features/forecast/model.ts bandOf (not importable under node: extensionless imports): WEAK and POOR are the "poor" band, NOT BAD and SURFABLE "fair". */
const bandOf = (c: string) => (['WEAK', 'POOR'].includes(c) ? 'poor' : ['NOT BAD', 'SURFABLE'].includes(c) ? 'fair' : 'other');

// 4B (round 4): onshore wind over the Call's Skip line (12 mph) caps the rating at 39, the top of "poor".
const now = Date.parse('2026-10-20T06:00:00Z');
/** Ocean Beach (shore normal ~263°): wind from 270° is onshore, from 90° offshore, from 0° cross-shore. A strong, long-period swell so the uncapped score is well above 39. */
const rec = (mph: number, dir: number) => normalizeOpenMeteo(evidenceSpot('spot-2'),
  {hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_period: 's', swell_wave_direction: '°'}, hourly: {time: [now / 1000], wave_height: [2.2], swell_wave_height: [2], swell_wave_period: [16], swell_wave_direction: [270]}},
  {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: [now / 1000], wind_speed_10m: [mph], wind_direction_10m: [dir], wind_gusts_10m: [mph]}}, new Date(now).toISOString())[0];
const rate = (mph: number, dir: number) => rateOcean(evidenceSpot('spot-2'), rec(mph, dir), now);

test('one threshold: the rating cap uses the Call\'s Skip line, and 39 is the top of the poor band', () => {
  assert.equal(ONSHORE_BAD_MPH, 12); assert.equal(CALL_SKIP_MPH, ONSHORE_BAD_MPH);
  assert.equal(ONSHORE_STRONG_CEILING, 39); assert.equal(bandOf(categoryForScore(39)), 'poor'); assert.equal(bandOf(categoryForScore(40)), 'fair');
});
test('windCeilings: onshore above 12 mph only, case-insensitive', () => {
  assert.equal(windCeilings('onshore', 12).length, 0, 'at the line: no cap');
  const c = windCeilings('Onshore', 12.1); assert.equal(c.length, 1); assert.equal(c[0].id, 'onshore-strong'); assert.equal(c[0].limit, 39);
  for (const rel of ['offshore', 'unknown']) assert.ok(!windCeilings(rel, 25).some((x) => x.id === 'onshore-strong'));
  assert.ok(!windCeilings('cross-shore', 25).some((x) => x.id === 'onshore-strong'));
});
test('Ocean Beach: 12 mph onshore keeps its score; 12.5 mph onshore is capped at 39 and says why; offshore at 12.5 mph is not capped', () => {
  setOnshoreCapEnabled(false); const off = rate(12.5, 270).score!; setOnshoreCapEnabled(true);
  assert.ok(off > 39, `uncapped score ${off} must be above 39 for this test to mean anything`);
  const at = rate(12, 270); assert.ok(!(at.ceilings ?? []).some((c) => c.id === 'onshore-strong'));
  const over = rate(12.5, 270); assert.equal(over.score, 39); assert.equal(bandOf(over.category), 'poor');
  assert.ok(over.ceilings!.some((c) => c.id === 'onshore-strong')); assert.ok(over.constraints.some((x) => /over 12 mph/.test(x)));
  const e = explainRating(over, {spotId: 'spot-2', wind: {mph: 12.5, relation: 'Onshore'}});
  assert.match(e.items.find((i) => /wind/i.test(i.factor))!.reason, /over 12 mph, so the rating is capped at poor/);
  assert.ok(e.items.some((i) => i.factor === 'Rating ceiling' && i.score === 39 && /top of poor/.test(i.reason)));
  assert.ok(!(rate(12.5, 90).ceilings ?? []).some((c) => c.id === 'onshore-strong'));
});
test('the cap never raises a score', () => {
  for (const mph of [13, 18, 25, 40]) { setOnshoreCapEnabled(false); const a = rate(mph, 270).score!; setOnshoreCapEnabled(true); const b = rate(mph, 270).score!; assert.ok(b <= a && b <= 39, `${mph} mph: ${a} -> ${b}`); }
});

// Review fixes (4B data-honesty round 1)
const later = now - 5 * 86400000;   // rate the same hour from 5 days before: the long lead makes the wide-range ceiling (SOLID, 69) apply too
test('only the binding ceiling is recorded: a 39 hour does not also claim "stops at SOLID"; the explanation ends with the binding one', () => {
  const q = rateOcean(evidenceSpot('spot-2'), rec(12.5, 270), later);
  assert.equal(q.score, 39); assert.deepEqual(q.ceilings!.map((c) => c.id), ['onshore-strong']);
  assert.ok(!q.constraints.some((c) => /too uncertain/.test(c)), q.constraints.join(' | '));   // the wide-range ceiling did not bind (the alignment cap's "SOLID (74)" is the engine's own method note, unchanged) assert.match(q.explanation, /top of poor/);
  const off = rateOcean(evidenceSpot('spot-2'), rec(5, 90), later);
  assert.ok(off.ceilings!.some((c) => c.id === 'wide-range'), 'the wide-range ceiling still applies when it binds'); assert.ok(off.score! <= 69);
});
test('strong onshore wind is never shown as a fair or good wind (display effect "-"); light onshore keeps its effect', () => {
  const e = explainRating(rate(12.5, 270), {spotId: 'spot-2', wind: {mph: 12.5, relation: 'onshore'}}), w = e.items.find((i) => /wind/i.test(i.factor))!;
  assert.equal(w.effect, '-'); assert.match(w.reason, /over 12(\.0)? mph, so the rating is capped at poor \(see Rating ceiling\)/); assert.doesNotMatch(w.reason, /Skip line/);
  const at12 = explainRating(rate(12, 270), {spotId: 'spot-2', wind: {mph: 12, relation: 'onshore'}}).items.find((i) => /wind/i.test(i.factor))!;
  assert.notEqual(at12.effect, '-'); assert.match(at12.reason, /held below "good"/);
});
test('a rating the cap does not hold (a demonstration rating, no wind ceilings) keeps the old wording', () => {
  const capped = rate(12.5, 270), demo = {...capped, score: 60, category: 'NOT BAD' as const, label: 'NOT BAD', ceilings: []};
  const w = explainRating(demo, {spotId: 'spot-2', wind: {mph: 12.5, relation: 'onshore'}}).items.find((i) => /wind/i.test(i.factor))!;
  assert.doesNotMatch(w.reason, /capped at poor/); assert.match(w.reason, /held below "good"/);
});
test('wind is shown in the person\'s unit when a formatter is given; the ceiling reason never reads "12.0 is over 12"', () => {
  const kn = explainRating(rate(12.5, 270), {spotId: 'spot-2', wind: {mph: 12.5, relation: 'onshore'}, fmtWind: (m) => `${(m * 0.868976).toFixed(1)} kn`}).items.find((i) => /wind/i.test(i.factor))!;
  assert.match(kn.reason, /Onshore 10\.9 kn: over 10\.4 kn/);
  assert.match(windCeilings('onshore', 12.04)[0].reason, /^Onshore 12\.1 mph is over 12 mph/); assert.match(windCeilings('onshore', 12.04)[0].reason, /Beaufort force 3/);
});

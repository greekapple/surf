import test from 'node:test';
import assert from 'node:assert/strict';
import {WIDTH_TABLE, widthRowFor, snapBand, setsFactor, confidenceFor, surfBandFor, BASE_SETS_FACTOR, CONFIDENCE_HIGH_W, CONFIDENCE_MEDIUM_W} from '../services/surfBand.ts';
import {headlineSurf, headlineText, surfBand, surfBandOf} from '../services/headlineSurf.ts';
import {spotHour} from '../services/spotHour.ts';
import {dashCard} from '../services/homeDash.ts';
import {spotStrip} from '../services/spotStrip.ts';
import {dayRange} from '../services/spotHour.ts';
import {weekCell} from '../services/weekCell.ts';
import {estimateLabel} from '../services/headlineLabel.ts';
import {LEAD_SKILL} from '../services/uncertainty.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {pacificDate} from '../ocean/time.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';

// T-118: the headline range is the surf BAND (typical wave to the sets, Surfline widths); the uncertainty is the confidence word and the interval kept in `interval`.
test('widths follow the table for every typical height and every sets factor; lo <= typical <= hi; whole feet', () => {
  for (const k of [1.18, BASE_SETS_FACTOR, 1.36]) for (let t = 0; t <= 40; t += 0.05) {
    const b = snapBand(t, t * k), row = widthRowFor(t);
    assert.ok(Number.isInteger(b.loFt) && Number.isInteger(b.hiFt) && b.loFt >= 0, `${t} ${k}`);
    assert.ok(b.hiFt - b.loFt >= row.min && b.hiFt - b.loFt <= row.max, `${t} ft at k=${k}: ${b.loFt}–${b.hiFt} outside ${row.min}–${row.max}`);
    assert.ok(b.loFt <= t + 1e-9 && b.hiFt >= t, `${t}: ${b.loFt}–${b.hiFt} contains the typical wave`);
  }
  assert.deepEqual(WIDTH_TABLE.map((r) => [r.min, r.max]), [[1, 1], [1, 2], [2, 3], [3, 3], [5, 5]]);
});
test('the table in practice: <2 ft is 1 ft wide, 2–6 is 1–2, 6–10 is 2–3, 10–15 is 3, 15+ is 5', () => {
  const w = (t: number) => { const b = snapBand(t, t * BASE_SETS_FACTOR); return [b.loFt, b.hiFt]; };
  assert.deepEqual(w(1.4), [1, 2]); assert.deepEqual(w(3.2), [3, 4]); assert.deepEqual(w(4.8), [4, 6]); assert.deepEqual(w(8), [8, 10]); assert.deepEqual(w(12.4), [12, 15]); assert.deepEqual(w(17), [17, 22]);
});
test('sets factor: Rayleigh 1.27 at the base, a little differentiated by beach (point/reef, breaker type), clamped', () => {
  assert.equal(setsFactor('Beach', null), 1.27);
  assert.ok(setsFactor('Point', {type: 'plunging', confidence: 'checked'}) > setsFactor('Beach', {type: 'spilling'}));
  assert.ok(Math.abs(setsFactor('Point', {type: 'plunging', confidence: 'checked'}) - 1.36) < 1e-9); assert.ok(Math.abs(setsFactor('Beach', {type: 'spilling'}) - 1.23) < 1e-9);
  assert.ok(setsFactor('Reef', {type: 'plunging', confidence: 'checked'}) <= 1.36 && setsFactor('Beach', {type: 'spilling'}) >= 1.18);
  assert.ok(setsFactor('Beach', {type: 'plunging', confidence: 'mean-slope'}) > setsFactor('Beach', {type: 'plunging', confidence: 'mean-slope'}) - 0.01 && setsFactor('Beach', {type: 'plunging', confidence: 'mean-slope'}) < setsFactor('Beach', {type: 'plunging', confidence: 'checked'}));
});
test('the confidence word follows the old interval: its half-width and the model disagreement', () => {
  assert.equal(confidenceFor(LEAD_SKILL[0], false).word, 'high'); assert.equal(confidenceFor(LEAD_SKILL[3], false).word, 'high'); assert.equal(confidenceFor(LEAD_SKILL[4], false).word, 'medium'); assert.equal(confidenceFor(LEAD_SKILL[5], false).word, 'low'); assert.equal(confidenceFor(LEAD_SKILL[6], false).word, 'low'); assert.equal(confidenceFor(LEAD_SKILL[7], false).word, 'low');
  assert.equal(confidenceFor(0.1, true).word, 'low', 'models disagree'); assert.equal(confidenceFor(null, false).word, 'low'); assert.equal(confidenceFor(CONFIDENCE_HIGH_W, false).word, 'high'); assert.equal(confidenceFor(CONFIDENCE_MEDIUM_W + 0.001, false).word, 'low');
  assert.match(confidenceFor(0.243, false).why, /±28%/);
  const b = surfBandFor({centralFt: 6.5, halfWidth: 0.243, disagree: false, interval: {loFt: 5, hiFt: 9}}); assert.equal(b.confidence, 'medium'); assert.deepEqual([b.interval!.loFt, b.interval!.hiFt], [5, 9]);
});

// An Ocean Beach (spot-2) record, 1.5 m swell, through the whole headline: lead time and the model spread move the confidence word, never the band's width.
const T = 1792454400, nowMs = T * 1000 + 600000, times = Array.from({length: 120}, (_, i) => T - 3600 + i * 3600);
const marine = (h: number) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'},
  hourly: {time: times, wave_height: times.map(() => h * 1.1), swell_wave_height: times.map(() => h), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 270), secondary_swell_wave_period: times.map(() => 10)}});
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 5), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 8)}};
const records = normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.5) as any, weather as any, new Date(nowMs).toISOString()).map(toLegacy);
const spot = allSpots.find((s) => s.id === 'spot-2')!, profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
test('headlineSurf: the range is the band (typical to sets), the interval is kept, the confidence word follows lead time and model spread', () => {
  const f0 = records[1], f4 = records[1 + 96];
  const now = headlineSurf('spot-2', f0, {nowMs, observations: [], spread: null}) as any, far = headlineSurf('spot-2', f4, {nowMs, observations: [], spread: null}) as any, split = headlineSurf('spot-2', f0, {nowMs, observations: [], spread: {ratio: 2, models: 3}}) as any;
  for (const h of [now, far, split]) { assert.equal(h.kind, 'estimate'); assert.ok(h.loFt <= h.centralFt && h.hiFt >= h.centralFt); assert.ok(Number.isInteger(h.loFt) && Number.isInteger(h.hiFt)); const row = widthRowFor(h.centralFt); assert.ok(h.hiFt - h.loFt >= row.min && h.hiFt - h.loFt <= row.max); assert.ok(h.interval.loFt <= h.loFt || h.interval.hiFt >= h.hiFt, 'the uncertainty interval is kept whole'); }
  assert.equal(now.method, 'v1'); assert.equal(now.confidence, 'medium', 'v1 adds the measured offshore step, so even day 0 is medium (a reviewed MOP point can reach high)'); assert.ok(['medium', 'low'].includes(far.confidence)); assert.equal(split.confidence, 'low');
  assert.equal(now.hiFt - now.loFt, far.hiFt - far.loFt, 'lead time and spread change the word, not the band');
  assert.match(now.methodLabel, /typical wave to the sets/); assert.match(now.methodLabel, /not a confidence interval/);
  assert.equal(headlineText(now, profile).confidenceText, 'medium confidence');
  const sb = surfBand('spot-2', f0, {nowMs, observations: [], spread: null})!; assert.deepEqual([sb.loFt, sb.hiFt, sb.confidence], [now.loFt, now.hiFt, now.confidence]); assert.ok(sb.setsFt! > sb.centralFt && sb.interval);
});
test('every surface reads the same band: spot hour, Home card, strip, day range and week cell, Compare/Find Spots label', () => {
  const f = records[1], at = Date.parse(f.timestamp), h = headlineSurf('spot-2', f, {nowMs, observations: [], spread: null}) as any;
  const hr = spotHour(spot, records, at, profile)!, card = dashCard(spot, records, at, profile, {}, nowMs), strip = spotStrip([spot], records, ['spot-2'], at, profile)[0] as any;
  const same = (x: any, name: string) => { assert.equal(x.kind, 'estimate', name); assert.deepEqual([x.loFt, x.hiFt, x.confidence], [h.loFt, h.hiFt, h.confidence], name); };
  same(hr.surf.headline, 'spotHour'); same(card.surf.headline, 'dashCard'); if (strip?.surf?.headline) same(strip.surf.headline, 'spotStrip');
  const dr = dayRange(spot, records, pacificDate(f.timestamp), nowMs, profile), ty = dr.typical!; same(ty.hour.surf.headline, 'dayRange typical hour'); assert.equal(ty.loFt, ty.hour.surf.headline.loFt);
  const wc = weekCell(dr, 'ft'); assert.equal(wc.label, `${ty.loFt}–${ty.hiFt}`);
  const el = estimateLabel(h, profile)!; assert.equal(el.value, `${h.loFt}–${h.hiFt} ft`); assert.equal(el.confidenceText, `${h.confidence} confidence`);
});

test('honesty: no confidence word beside a saved, stale or calibrated number; the tooltip says the word is our judgement and not validated; a record with no band does not claim one', () => {
  const f = records[1], fresh = headlineSurf('spot-2', f, {nowMs, observations: [], spread: null}) as any;
  assert.ok(headlineText(fresh, profile).confidenceText); assert.match(headlineText(fresh, profile).confidenceDetail!, /our own judgement.*not validated/);
  const stale = {...fresh, saved: {retrievedAt: '2026-11-03T10:00:00Z', reason: 'old'}}; assert.equal(headlineText(stale, profile).confidenceText, ''); assert.equal(surfBandOf(stale)!.confidence, null); assert.equal(estimateLabel(stale, profile)!.confidenceText, '');
  const cal = {...fresh, calibration: {n: 8, ratio: 1, label: 'x', uncalibratedFt: [1, 2]}, band: undefined}; assert.equal(headlineText(cal, profile).confidenceText, '');
  const nobandDetail = headlineText({...fresh, band: undefined}, profile).confidenceDetail!; assert.doesNotMatch(nobandDetail, /typical wave to the sets/);
  assert.match(fresh.methodLabel, /our own judgement/); assert.match(fresh.methodLabel, /about half of the observed heights fell inside the band/);
});

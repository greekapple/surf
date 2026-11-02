import test from 'node:test';
import assert from 'node:assert/strict';
import {dashCard, bestNearby, bestWindowToday, windowLabel, ratingBars} from '../services/homeDash.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';

const profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const t = 1792454400, now = t * 1000 + 600000; // 10 min into the first record's hour
const times = Array.from({length: 30}, (_, i) => t - 3600 + i * 3600);
const marine = (dir: number, hs = 1.5, combined = 1.6) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => combined), swell_wave_height: times.map(() => hs), swell_wave_direction: times.map(() => dir), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => null), secondary_swell_wave_direction: times.map(() => null), secondary_swell_wave_period: times.map(() => null), sea_surface_temperature: times.map(() => 14)}});
const weather = (kph = 5, dir = 90) => ({hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => kph), wind_direction_10m: times.map(() => dir), wind_gusts_10m: times.map(() => kph + 3)}});
const recs = (id: string, dir = 270) => normalizeOpenMeteo(evidenceSpot(id), marine(dir), weather(), new Date(now).toISOString()).map(toLegacy);
const spot = (id: string) => allSpots.find((s) => s.id === id)!;

test('ratingBars: 0 unrated, 1–5 by fifths, clamped', () => {
  assert.deepEqual([null, undefined, NaN, 0, -5, 1, 20, 21, 55, 100, 140].map((x) => ratingBars(x as any)), [0, 0, 0, 0, 0, 1, 1, 2, 3, 5, 5]);
});
test('windowLabel spells am/pm once when both ends share it', () => {
  assert.equal(windowLabel(Date.parse('2026-11-02T15:00:00Z'), Date.parse('2026-11-02T18:00:00Z')), '7–10 AM');
  assert.equal(windowLabel(Date.parse('2026-11-02T18:00:00Z'), Date.parse('2026-11-02T22:00:00Z')), '10 AM–2 PM');
});
test('a card with data: labelled estimate with words, rating, wind relation, tide, never a bare number', () => {
  const c = dashCard(spot('spot-2'), recs('spot-2'), now, profile);
  assert.equal(c.name, 'Ocean Beach'); assert.equal(c.demo, false); assert.ok(c.validTime);
  assert.equal(c.surf.headline.kind, 'estimate'); assert.match(c.surf.label, /^Est\. \d+–\d+ ft at the break$/); assert.equal(c.surf.tag, 'model estimate'); assert.ok(c.surf.words);
  assert.match(c.surf.offshoreLabel!, /offshore · not surf size$/);
  assert.ok(c.rating.bars >= 0 && c.rating.bars <= 5); assert.ok(c.wind && /offshore|onshore|cross/.test(c.wind.relation));
});
test('no record, or only a past hour, says so', () => {
  const none = dashCard(spot('spot-2'), [], now, profile);
  assert.equal(none.surf.label, 'No forecast data'); assert.equal(none.rating.score, null); assert.equal(none.rating.bars, 0); assert.equal(none.window, null); assert.equal(none.wind, null);
  const past = dashCard(spot('spot-2'), recs('spot-2').filter((f) => Date.parse(f.timestamp) < t * 1000), now, profile);
  assert.equal(past.validTime, null);
});
test('a spot where the estimate is refused shows the offshore height with its label', () => {
  const c = dashCard(spot('spot-3'), recs('spot-3'), now, profile);
  assert.ok(['estimate', 'offshore'].includes(c.surf.headline.kind)); assert.ok(c.surf.label.length > 0);
  const south = dashCard(spot('spot-2'), recs('spot-2', 180), now, profile);
  assert.equal(south.surf.headline.kind, 'offshore'); assert.match(south.surf.label, /offshore · not surf size$/); assert.equal(south.surf.words, null);
});
test('best window today only uses remaining hours of today and returns null when nothing qualifies', () => {
  const w = bestWindowToday(spot('spot-2'), recs('spot-2'), now);
  if (w) { assert.match(w.label, /\d/); assert.ok(Date.parse(w.end) > now); }
  const s = bestWindowToday(spot('spot-2'), recs('spot-2', 180), now); assert.ok(s === null || Date.parse(s.end) > now, 'windows follow the existing rating, not the surf estimate');
  assert.equal(bestWindowToday(spot('spot-2'), [], now), null);
  const night = normalizeOpenMeteo(evidenceSpot('spot-2'), marine(270), weather(), new Date(now).toISOString()).map(toLegacy);
  const w2 = bestWindowToday(spot('spot-2'), night, now); if (w2) { const h = (iso: string) => Number(new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23'}).format(new Date(iso))); assert.ok(h(w2.start) >= 6 && h(w2.start) <= 18, 'a window starts in daylight: ' + w2.label); }
});
test('best nearby: rated spots only, excluded ones skipped, sorted by rating, within the radius', () => {
  const all = ['spot-2', 'spot-3', 'spot-0'].flatMap((id) => recs(id));
  const n = bestNearby(allSpots, all, now, profile, 'spot-2', {exclude: ['spot-2']});
  assert.ok(n.every((x) => x.card.id !== 'spot-2' && x.card.rating.score !== null && !x.card.demo && x.km <= 100));
  for (let i = 1; i < n.length; i++) assert.ok((n[i - 1].card.rating.score as number) >= (n[i].card.rating.score as number));
  assert.deepEqual(bestNearby(allSpots, all, now, profile, 'nope'), []);
  assert.deepEqual(bestNearby(allSpots, [], now, profile, 'spot-2'), []);
  assert.deepEqual(bestNearby(allSpots, all, now, profile, 'spot-2', {radiusKm: 0.1, exclude: ['spot-2']}), []);
});

import {ribbon12, rankHour, bestNearbyAt, RANK_LABEL} from '../services/homeDash.ts';
test('ribbon: 12 consecutive exact hours from the current hour, gaps stay null, never interpolated', () => {
  const r = ribbon12(spot('spot-2'), recs('spot-2'), now);
  assert.equal(r.length, 12); assert.equal(r[0].iso, new Date(t * 1000).toISOString()); assert.equal(Date.parse(r[11].iso) - Date.parse(r[0].iso), 11 * 3600000);
  assert.ok(r.every((h) => h.score === null || (h.bars >= 1 && h.bars <= 5 && h.category)));
  const gap = recs('spot-2').filter((f) => Date.parse(f.timestamp) !== (t + 3 * 3600) * 1000);
  const g = ribbon12(spot('spot-2'), gap, now); assert.equal(g[3].score, null); assert.equal(g[3].category, null); assert.ok(g[2].score !== null);
  assert.ok(ribbon12(spot('spot-2'), [], now).every((h) => h.score === null));
});
test('rankHour: now and +3 h need those exact hours; tomorrow AM is a 6–11 PT hour of the next Pacific day', () => {
  const rs = recs('spot-2');
  assert.equal(rankHour(spot('spot-2'), rs, now, 'now'), t * 1000); assert.equal(rankHour(spot('spot-2'), rs, now, '3h'), (t + 3 * 3600) * 1000);
  assert.equal(rankHour(spot('spot-2'), [], now, 'now'), null);
  const tm = rankHour(spot('spot-2'), rs, now, 'tomorrow-am');
  if (tm !== null) { const h = Number(new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23'}).format(new Date(tm))); assert.ok(h >= 6 && h <= 11); assert.ok(tm > now); }
  assert.deepEqual(Object.keys(RANK_LABEL), ['now', '3h', 'tomorrow-am']);
});
test('bestNearbyAt judges each spot at the chosen hour and says which hour that was', () => {
  const all = ['spot-2', 'spot-3', 'spot-0'].flatMap((id) => recs(id));
  const a = bestNearbyAt(allSpots, all, now, profile, 'spot-2', '3h', {exclude: ['spot-2']});
  assert.ok(a.every((x) => x.at === new Date((t + 3 * 3600) * 1000).toISOString() && x.card.id !== 'spot-2'));
  assert.deepEqual(bestNearbyAt(allSpots, [], now, profile, 'spot-2', 'now'), []); assert.deepEqual(bestNearbyAt(allSpots, all, now, profile, 'nope', 'now'), []);
});

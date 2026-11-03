import test from 'node:test';
import assert from 'node:assert/strict';
import {dayRange} from '../services/spotHour.ts';
import {weekCell} from '../services/weekCell.ts';
import {bestNearbyAt} from '../services/homeDash.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {pacificDate} from '../ocean/time.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';

// T-107. Ocean Beach (spot-2) fixture: hourly swell that swings from 0.4 m to 4 m through the day, retrieved 10 minutes after the first hour.
const profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const t = 1792454400, now = t * 1000 + 600000;
const times = Array.from({length: 30}, (_, i) => t - 3600 + i * 3600);
const base = (swell: (i: number) => number) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'},
  hourly: {time: times, wave_height: times.map((_, i) => swell(i) * 1.1), swell_wave_height: times.map((_, i) => swell(i)), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 270), secondary_swell_wave_period: times.map(() => 10)}});
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 5), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 8)}};
const recs = (swell: (i: number) => number) => normalizeOpenMeteo(evidenceSpot('spot-2'), base(swell) as any, weather as any, new Date(now).toISOString()).map(toLegacy);
const spot = allSpots.find((s) => s.id === 'spot-2')!, key = pacificDate(new Date(t * 1000).toISOString());

test('T-107 week cell: the day\'s typical (midday) range, never the envelope; the daylight spread is in the tooltip text', () => {
  const records = recs((i) => 0.4 + (i % 9) * 0.45), dr = dayRange(spot, records, key, now, profile);
  assert.equal(dr.kind, 'estimate'); assert.ok(dr.typical);
  const wc = weekCell(dr, 'ft'), ty = dr.typical!;
  assert.ok(dr.hiFt! - dr.loFt! > ty.hiFt - ty.loFt, 'fixture: the day envelope really is wider than the midday estimate');
  assert.equal(wc.kind, 'estimate'); assert.equal(wc.loFt, ty.loFt); assert.equal(wc.hiFt, ty.hiFt);
  assert.ok(wc.hiFt! - wc.loFt! <= ty.hiFt - ty.loFt, 'no cell wider than its midday estimate');
  assert.equal(wc.label, `${ty.loFt}–${ty.hiFt}`.replace(/(\d+\.\d+)/g, (m) => String(Math.round(Number(m)))));
  assert.ok(wc.centralFt! >= wc.loFt! && wc.centralFt! <= wc.hiFt!, 'the glyph value lies inside the cell range');
  assert.match(wc.spread!, /^ranges \d+–\d+ ft over daylight$/); assert.equal(wc.spreadLoFt, dr.loFt); assert.equal(wc.spreadHiFt, dr.hiFt); assert.match(wc.midday!, /^midday \d{1,2}[ap]$/);
});
test('T-107 week cell: offshore-only and no-data states are kept', () => {
  const off = {kind: 'offshore' as const, loFt: 2, hiFt: 9, hours: 8, label: '2–9 ft offshore', basis: '', typical: {atIso: 'x', how: 'midday' as const, hourLabel: '11 AM', short: 'midday 11a', loFt: 5, hiFt: 5, centralFt: 5, hour: {} as any, aria: ''}};
  const o = weekCell(off, 'ft'); assert.equal(o.kind, 'offshore'); assert.equal(o.label, '5'); assert.match(o.spread!, /^offshore heights range 2–9 ft over daylight$/); assert.equal(o.stale, null);
  const none = weekCell({kind: 'none', loFt: null, hiFt: null, hours: 0, label: null, basis: '', typical: null}, 'ft'); assert.equal(none.label, '—'); assert.equal(none.centralFt, null); assert.equal(none.spread, null);
});
test('T-107 week cell: a saved or stale midday source is marked (data-honesty P1)', () => {
  const mk = (reason: 'saved' | 'old') => ({kind: 'estimate' as const, loFt: 4, hiFt: 22, hours: 10, label: '', basis: '', typical: {atIso: 'x', how: 'midday' as const, hourLabel: '12 PM', short: 'midday 12p', loFt: 4, hiFt: 6, centralFt: 5,
    hour: {surf: {headline: {kind: 'estimate', loFt: 4, hiFt: 6, saved: {retrievedAt: 'x', reason}}}} as any, aria: ''}});
  assert.equal(weekCell(mk('saved'), 'ft').stale, 'saved'); assert.equal(weekCell(mk('old'), 'ft').stale, 'stale');
});
test('T-107 nearby rows: fresh data is not labelled stale (the freshness clock is the real now, not the ranked hour)', () => {
  const records = recs(() => 1.5);
  for (const when of ['now', 'tomorrow-am'] as const) {
    const rows = bestNearbyAt([spot], records, now, profile, 'spot-2', when, {limit: 5});
    assert.ok(rows.length >= 1, `${when}: a row`);
    for (const r of rows) { assert.equal(r.card.surf.headline.kind, 'estimate'); assert.equal(r.card.surf.tag, 'model estimate', `${when}: the tag follows the T-084 rule against the real clock`); assert.equal((r.card.surf.headline as any).saved, undefined); }
  }
});

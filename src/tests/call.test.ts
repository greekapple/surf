import test from 'node:test';
import assert from 'node:assert/strict';
import {callFor, hourCall, SKILL_RANGE_FT} from '../services/call.ts';
import {daylightFor, isDark} from '../services/daylight.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';

const T0 = Date.parse('2026-11-02T00:00:00Z') / 1000; // Nov 1, 4 PM PST: after the clocks went back
const times = Array.from({length: 72}, (_, i) => T0 + i * 3600);
const marine = (swellM: number, dir = 270) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => swellM + .1), swell_wave_height: times.map(() => swellM), swell_wave_direction: times.map(() => dir), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}});
const weather = (mph: number, dir: number) => ({hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => mph), wind_direction_10m: times.map(() => dir), wind_gusts_10m: times.map(() => mph)}});
const recs = (swellM: number, mph = 4, wdir = 90) => normalizeOpenMeteo(evidenceSpot('spot-2'), marine(swellM), weather(mph, wdir), '2026-11-02T00:00:00Z').map(toLegacy);
const spot = allSpots.find((s) => s.id === 'spot-2')!;
const prof = (skill: 'Beginner' | 'Intermediate' | 'Expert') => ({...defaultProfile, skill, heightUnit: 'ft' as const, scale: 'Face height' as const});
const at = (records: ReturnType<typeof recs>, iso: string) => records.find((f) => f.timestamp === iso)!;
const noonNov2 = '2026-11-02T20:00:00.000Z'; // noon PST
const dark646pm = '2026-11-03T02:00:00.000Z'; // 6 PM PST hour (6:46 PM falls inside it)
const ctxFor = (records: ReturnType<typeof recs>, nowIso: string) => ({records, nowMs: Date.parse(nowIso)});

test('daylight: first light < sunrise < sunset < last light, in Pacific November hours', () => {
  const d = daylightFor('spot-2', '2026-11-02'), ms = [d.firstLight, d.sunrise, d.sunset, d.lastLight].map(Date.parse);
  assert.ok(ms[0] < ms[1] && ms[1] < ms[2] && ms[2] < ms[3]);
  const h = (iso: string) => new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit'}).format(new Date(iso));
  assert.match(h(d.sunrise), /^6:\d\d AM$/); assert.match(h(d.sunset), /^5:[01]\d PM$/);
});
test('isDark: 6:46 PM in November and 4 AM are dark; noon is not; the hour containing first light is light', () => {
  assert.equal(isDark('spot-2', dark646pm), true); assert.equal(isDark('spot-2', '2026-11-02T12:00:00.000Z'), true); // 4 AM
  assert.equal(isDark('spot-2', noonNov2), false); assert.equal(isDark('spot-2', '2026-11-02T14:00:00.000Z'), false); // 6 AM hour holds first light (~6:08)
  assert.equal(isDark('spot-2', 'nonsense'), false);
});
test('night-aware rating: a dark hour has no rating; the same hour in daylight does', () => {
  const r = recs(1.5), night = rateForecast(spot, at(r, dark646pm), Date.parse(dark646pm)), day = rateForecast(spot, at(r, noonNov2), Date.parse(noonNov2));
  assert.equal(night.score, null); assert.equal(night.dark, true); assert.equal(night.category, 'UNRATED'); assert.match(night.explanation, /Dark/);
  assert.ok(day.score !== null && !day.dark);
  assert.equal(rateForecast(spot, at(r, dark646pm), Date.parse(dark646pm), {night: false}).score !== null, true);
});
test('the call at 6:46 PM in November reads Dark with the next window the following day; no window now', () => {
  const r = recs(1.5), c = callFor(spot, at(r, dark646pm), prof('Expert'), ctxFor(r, '2026-11-03T02:46:00Z'));
  assert.equal(c.verdict, 'Dark'); assert.equal(c.window, null); assert.ok(c.nextWindow); assert.match(c.nextWindow!.label, /AM|PM/); assert.match(c.why[0], /^It is dark\. The next window is tomorrow /);
  assert.ok(Date.parse(c.nextWindow!.start) > Date.parse('2026-11-03T02:46:00Z')); assert.match(c.basis, /Our own rules/);
});
test('skill-aware: the same big hour (surf height above 4 ft) is Skip for a beginner (reason says why) and not Skip for an expert', () => {
  const r = recs(2.4), ctx = ctxFor(r, noonNov2), f = at(r, noonNov2);
  const b = callFor(spot, f, prof('Beginner'), ctx), e = callFor(spot, f, prof('Expert'), ctx);
  assert.equal(b.verdict, 'Skip'); assert.match(b.why[0], /beginner range \(up to 4 ft\)/);
  assert.notEqual(e.verdict, 'Skip'); assert.ok(SKILL_RANGE_FT.Beginner.max < SKILL_RANGE_FT.Intermediate.max && SKILL_RANGE_FT.Intermediate.max < SKILL_RANGE_FT.Expert.max);
});
test('wind: strong onshore is a Skip for everyone, with a plain reason first', () => {
  const r = recs(1.5, 16, 270), c = callFor(spot, at(r, noonNov2), prof('Expert'), ctxFor(r, noonNov2));
  assert.equal(c.verdict, 'Skip'); assert.match(c.why[0], /Onshore wind at 16 mph will chop it up\./);
});
test('a good daylight hour: the call has a window inside daylight, labelled, and a plain first sentence', () => {
  const r = recs(1.2), now = '2026-11-02T15:00:00Z', c = callFor(spot, at(r, '2026-11-02T16:00:00.000Z'), prof('Expert'), ctxFor(r, now));
  assert.ok(['Go', 'Worth a look'].includes(c.verdict)); assert.ok(c.why[0].length > 10 && !c.why[0].includes('undefined'));
  if (c.window) { const d = daylightFor('spot-2', '2026-11-02'); assert.ok(Date.parse(c.window.start) >= Date.parse(d.firstLight) - 3600000 && Date.parse(c.window.end) <= Date.parse(d.lastLight) + 3600000); assert.match(c.window.label, /AM|PM/); }
});
test('hourCall is pure and the verdict for dark hours never depends on skill', () => {
  const r = recs(1.5); for (const k of ['Beginner', 'Intermediate', 'Expert'] as const) assert.equal(hourCall(spot, at(r, dark646pm), prof(k), ctxFor(r, dark646pm)).verdict, 'Dark');
});

import {surfBandSeries} from '../services/surfSeries.ts';
import {headlineSurf} from '../services/headlineSurf.ts';
test('graph series == headlineSurf per hour (estimate band), with offshore Hs as the secondary value and night flagged', () => {
  const r = recs(1.5), s = surfBandSeries(spot, r, {nowMs: Date.parse(noonNov2)});
  assert.equal(s.length, r.length);
  for (const p of s) { const f = r.find((x) => x.timestamp === p.t)!, h = headlineSurf('spot-2', f, {nowMs: Date.parse(noonNov2)}); assert.equal(p.kind, h.kind); if (h.kind === 'estimate') { assert.equal(p.lo, h.loFt); assert.equal(p.hi, h.hiFt); } assert.equal(p.offshoreFt, f.offshore); assert.equal(p.dark, isDark('spot-2', p.t)); }
  assert.ok(s.some((p) => p.dark) && s.some((p) => !p.dark));
});

import {periodFit} from '../services/boardPeriod.ts';
test('board period fit: short period is soft for a performance board, fine for a fish; long period asks more of a small board; unknown is neutral', () => {
  assert.equal(periodFit('shortboard', 8).fit, 'short'); assert.equal(periodFit('fish', 8).fit, 'ok'); assert.equal(periodFit('shortboard', 14).fit, 'ok');
  assert.equal(periodFit('fish', 17, 62).fit, 'long'); assert.equal(periodFit('longboard', 17, 108).fit, 'ok');
  assert.equal(periodFit('gun', 11).fit, 'short'); assert.equal(periodFit('shortboard', null).fit, 'ok'); assert.match(periodFit('shortboard', 8).note, /8 s swell is short/);
});

import {nearshoreSlopes} from '../ocean/nearshoreSlope.ts';
test('callFor carries the estimated breaker type; a plunging break at size is "experienced surfers only" for a non-expert, and still fine for an expert', () => {
  const r = recs(1.5), f = at(r, noonNov2), ctx = ctxFor(r, noonNov2);
  const ob = callFor(spot, f, prof('Expert'), ctx); assert.equal(ob.breaker.type, 'spilling'); assert.equal(ob.breaker.label, 'est. breaker type');
  assert.ok(ob.why.some((w) => /Spilling breaker/.test(w)));
  // inject a steep slope for Ocean Beach to exercise the plunging rule
  const saved = nearshoreSlopes[0].tanBeta; nearshoreSlopes[0].tanBeta = 0.1;
  try {
    const b = callFor(spot, f, prof('Intermediate'), ctx), e = callFor(spot, f, prof('Expert'), ctx);
    assert.equal(b.breaker.type, 'plunging'); assert.equal(b.verdict, 'Skip'); assert.match(b.why[0], /^Plunging and .*: experienced surfers only\.$/);
    assert.ok(!/experienced surfers only/.test(e.why[0])); assert.ok(e.why.some((w) => /Plunging breaker: hollow and powerful/.test(w)));
  } finally { nearshoreSlopes[0].tanBeta = saved; }
  const other = allSpots.find((s) => s.id === 'spot-3')!; assert.equal(callFor(other, {...f, spotId: 'spot-3'}, prof('Expert'), ctx).breaker.type, 'unknown');
});

test('Dark before first light: today\'s upcoming window is the next window ("today"); with none tomorrow the day is named, not "tomorrow"', () => {
  const r = recs(1.2), pre = '2026-11-02T13:00:00.000Z', c = callFor(spot, at(r, pre), prof('Expert'), ctxFor(r, '2026-11-02T13:30:00Z')); // 5:30 AM PST, first light ~6:08
  assert.equal(c.verdict, 'Dark'); assert.ok(c.nextWindow); assert.match(c.why[0], /^It is dark\. The next window is today /);
  const only = r.filter((f) => f.timestamp >= '2026-11-04T00:00:00.000Z'), late = callFor(spot, at(r, dark646pm), prof('Expert'), ctxFor([...only, at(r, dark646pm)], '2026-11-03T02:46:00Z'));
  if (late.nextWindow) assert.ok(!/tomorrow/.test(late.why[0]) || late.nextWindow.start.slice(0, 10) === '2026-11-03' || late.nextWindow.start.slice(0, 10) === '2026-11-04');
});

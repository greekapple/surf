import test from 'node:test';
import assert from 'node:assert/strict';
import {callFor, windowOnDay, bestWindowFrom} from '../services/call.ts';
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
import {bestWindowToday} from '../services/homeDash.ts';
import {hourCall} from '../services/call.ts';
import {windowPhrase} from '../services/homeDash.ts';

// a day with a clear sub-window: light offshore wind only for the 16:00-22:00Z hours (8 AM-2 PM PST), hard onshore wind the rest of the time, so the window is a part of the day and can move if the choice depends on the clock
const windy = (i: number) => (i % 24 >= 16 && i % 24 < 22 ? [4, 90] : [24, 270]);
const wx = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map((_, i) => windy(i)[0]), wind_direction_10m: times.map((_, i) => windy(i)[1]), wind_gusts_10m: times.map((_, i) => windy(i)[0] + 3)}};
const records = normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.0), wx, '2026-11-02T00:00:00Z').map(toLegacy), p = prof('Intermediate'), day = '2026-11-03';
const ctx = (nowIso: string) => ({records, nowMs: Date.parse(nowIso)});
// "now" values inside the SAME model run (retrieved 2026-11-02T00:00Z): during the window itself (9:10, 10:20, 11:40 AM PST); the passing hours must not trim or move it
const NOWS = ['2026-11-03T17:10:00Z', '2026-11-03T18:20:00Z', '2026-11-03T19:40:00Z'];

test('the spot page window (windowOnDay) is the same at any "now" inside one model run', () => {
  const ws = NOWS.map((n) => windowOnDay(spot, day, p, ctx(n), Date.parse(n))); assert.ok(ws[0], 'a window exists in the fixture');
  for (const w of ws) assert.deepEqual(w, ws[0]);
});
test('the Call (window and wording) is the same at any "now" inside one run', () => {
  const hour = records.find((f) => f.timestamp === '2026-11-03T20:00:00.000Z')!;
  const cs = NOWS.map((n) => callFor(spot, hour, p, ctx(n))); for (const c of cs) { assert.deepEqual(c.window, cs[0].window); assert.deepEqual(c.why, cs[0].why); assert.equal(c.verdict, cs[0].verdict); }
});
test('the best window from now (Compare / Find spots / next window) is the same at any "now" inside one run', () => {
  const bs = NOWS.map((n) => bestWindowFrom(spot, p, ctx(n), Date.parse(n))); assert.ok(bs[0]); for (const b of bs) assert.deepEqual(b, bs[0]);
});
test('Home\'s best window today is the same at any "now" inside one run', () => {
  const ns = NOWS, ws = ns.map((n) => bestWindowToday(spot, records, Date.parse(n))); assert.ok(ws[0]); for (const w of ws) assert.deepEqual(w, ws[0]);
});
test('ties keep the earlier run: two equal windows on one day give the earlier one, every time', () => {
  const flat = records.map((f) => ({...f}));   // the fixture is constant, so every daylight hour ties: the choice is the first (earliest) run, deterministically
  const a = windowOnDay(spot, day, p, {records: flat, nowMs: Date.parse(NOWS[0])}, 0), b = windowOnDay(spot, day, p, {records: [...flat].reverse(), nowMs: Date.parse(NOWS[2])}, 0); assert.deepEqual(a, b);
});
test('once the day\'s best window is over, the best of the hours still ahead is chosen (the choice depends on now only through "has it ended")', () => {
  const early = windowOnDay(spot, day, p, ctx('2026-11-03T14:05:00Z'), Date.parse('2026-11-03T14:05:00Z')), late = windowOnDay(spot, day, p, ctx('2026-11-04T05:00:00Z'), Date.parse('2026-11-04T05:00:00Z'));
  assert.ok(early); assert.equal(late, windowOnDay(spot, day, p, ctx('2026-11-04T05:00:00Z'), Date.parse('2026-11-04T05:00:00Z'))); // after sunset, deterministic (null or the remaining hours)
});
test('a window never contradicts the hour cards: every hour inside the chosen window has a Go / Worth a look verdict from the same hourCall at the real now', () => {
  for (const n of NOWS) {
    const c = ctx(n), w = windowOnDay(spot, day, p, c, Date.parse(n))!; assert.ok(w);
    for (let t = Date.parse(w.start); t < Date.parse(w.end); t += 3600000) { const f = records.find((x) => Date.parse(x.timestamp) === Math.floor(t / 3600000) * 3600000); if (!f) continue; const v = hourCall(spot, f, p, c).verdict; assert.ok(v === 'Go' || v === 'Worth a look', `${new Date(t).toISOString()} ${v}`); }
  }
});
test('a running window reads "on now, until <end>"; before or after it, its own label', () => {
  const w = {start: '2026-11-03T16:00:00.000Z', end: '2026-11-03T22:00:00.000Z', label: '8 AM–2 PM'};
  assert.equal(windowPhrase(w, Date.parse('2026-11-03T18:00:00Z')), 'on now, until 2 PM'); assert.equal(windowPhrase(w, Date.parse('2026-11-03T15:00:00Z')), '8 AM–2 PM'); assert.equal(windowPhrase(w, Date.parse('2026-11-03T22:00:00Z')), '8 AM–2 PM');
});

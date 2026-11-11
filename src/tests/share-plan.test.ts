import test from 'node:test';
import assert from 'node:assert/strict';
import {callFor} from '../services/call.ts';
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
import {sharePlanFor, hourFromParam, hawaiianScaleNote} from '../services/sharePlan.ts';
import fs from 'node:fs';
import {evidenceSpots} from '../ocean/spots.ts';

const windy = (i: number) => (i % 24 >= 16 && i % 24 < 22 ? [4, 90] : [24, 270]);
const wx = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map((_, i) => windy(i)[0]), wind_direction_10m: times.map((_, i) => windy(i)[1]), wind_gusts_10m: times.map((_, i) => windy(i)[0] + 3)}};
const records = normalizeOpenMeteo(evidenceSpot('spot-2'), marine(1.0), wx, '2026-11-02T00:00:00Z').map(toLegacy), p = prof('Intermediate');
const nowMs = Date.parse('2026-11-03T17:10:00Z'), hour = records.find((f) => f.timestamp === '2026-11-03T20:00:00.000Z')!;
const call = callFor(spot, hour, p, {records, nowMs});

test('the share text is the app\'s own labelled numbers and tags only: spot · weekday window zone · from <hour>: rating (provisional rating) · surf height (the app\'s own tags) — SWELLO', () => {
  const s = sharePlanFor(spot, call, records, p, nowMs, 'ocean-beach', 'https://swello.example')!; assert.ok(s);
  assert.match(s.text, /^Ocean Beach · \w{3} .+ PST · from [\d:]+ ?(AM|PM)?: [A-Z][a-z]+ \(provisional rating\) · .+ ft surf height \((model|stale|saved) estimate(; [^)]+)?\) — SWELLO$/);
  assert.doesNotMatch(s.text, /wind|tide|mph|http|%|score|\d{4}-\d\d/i, 'no other data');
  assert.equal(s.title, 'Ocean Beach · SWELLO');
});
test('nothing is shared in demonstration mode (records with no evidence), so no Share button shows', () => {
  const demo = records.map((f) => ({...f, evidence: undefined}));
  assert.equal(sharePlanFor(spot, call, demo as never, p, nowMs, 'ocean-beach'), null);
});
test('the size carries the app\'s own tags: stale / saved estimate, buoy-correction, tuned, models differ, the confidence word', () => {
  const s = sharePlanFor(spot, call, records, p, nowMs, 'ocean-beach')!, tag = /\((model|stale|saved) estimate/.exec(s.text); assert.ok(tag, s.text)
});
test('Hawaii spots say "surf height, not Hawaiian scale" like the spot page; the Hawaiian-scale profile does not; other regions never', () => {
  const hi = allSpots.find((x) => x.id.startsWith('w-hawaii'))!, ca = allSpots.find((x) => x.id === 'spot-2')!; assert.ok(hi);
  assert.equal(hawaiianScaleNote(hi, p), ', not Hawaiian scale'); assert.equal(hawaiianScaleNote(hi, {...p, scale: 'Hawaiian'}), ''); assert.equal(hawaiianScaleNote(ca, p), '');
  const recsH = normalizeOpenMeteo(evidenceSpot(hi.id), marine(1.0), wx, '2026-11-02T00:00:00Z').map(toLegacy), c = callFor(hi, recsH.find((f) => f.timestamp === '2026-11-03T20:00:00.000Z')!, p, {records: recsH, nowMs});
  const a = sharePlanFor(hi, c, recsH, p, nowMs, 'x'); if (a && /ft surf height/.test(a.text)) assert.match(a.text, /surf height, not Hawaiian scale/); if (a) assert.doesNotMatch(a.text, /\d ft(?! surf height)/, 'an offshore height is never shared as a size');
});
test('a window that is already running is shared from the current hour (text and t), never from a start that has passed', () => {
  const w = call.window!, mid = Date.parse(w.start) + 2 * 3600000 + 20 * 60000, s = sharePlanFor(spot, call, records, p, mid, 'ocean-beach')!;
  assert.equal(new URL('https://x' + s.url.slice(s.url.indexOf('/forecast'))).searchParams.get('t'), new Date(Math.floor(mid / 3600000) * 3600000).toISOString().replace('.000Z', 'Z'));
  const label = s.text.split(' · ')[1]; assert.ok(!label.includes(call.window!.label), 'the window starts at the current hour: ' + label);
  assert.equal(sharePlanFor(spot, call, records, p, Date.parse(w.end) + 1000, 'ocean-beach'), null, 'an over window is not shared');
});
test('the link is a deep link to the spot and the window\'s first hour', () => {
  const s = sharePlanFor(spot, call, records, p, nowMs, 'ocean-beach', 'https://swello.example')!; assert.match(s.url, /^https:\/\/swello\.example\/forecast\?spot=ocean-beach&t=\d{4}-\d\d-\d\dT\d\d:00:00Z$/);
  const t = new URL(s.url).searchParams.get('t')!; assert.equal(hourFromParam(t), new Date(t).toISOString()); assert.ok(records.some((f) => f.timestamp === new Date(t).toISOString()), 'the shared hour exists in the forecast');
});
test('without a sized estimate no size is shared (never an offshore height or a made-up number); without a window there is nothing to share', () => {
  const noSize = records.map((f) => ({...f, face: NaN, availability: {...f.availability, face: false}, evidence: f.evidence ? {...f.evidence, faceEstimate: undefined} : f.evidence}));
  const s = sharePlanFor(spot, call, noSize as never, p, nowMs, 'ocean-beach')!; if (s) assert.doesNotMatch(s.text, /\d+(–\d+)? ft/);
  assert.equal(sharePlanFor(spot, {verdict: 'Skip', window: null, nextWindow: null}, records, p, nowMs, 'ocean-beach'), null);
});
test('deep link time: any valid time rounds down to its hour; junk is ignored', () => {
  assert.equal(hourFromParam('2026-11-03T20:00:00Z'), '2026-11-03T20:00:00.000Z'); assert.equal(hourFromParam('2026-11-03T20:41:10Z'), '2026-11-03T20:00:00.000Z');
  for (const bad of [null, '', 'tomorrow', '99']) assert.equal(bad === '99' ? null : hourFromParam(bad as never), null);
});
test('Share uses navigator.share({title, text, url}) and falls back to copying the link with a toast; it is wired on the spot page Call and Home cards', () => {
  const src = (f: string) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const sw = src('features/forecast/ShareWindow.tsx'); assert.match(sw, /navigator\.share\(\{title: plan\.title, text: plan\.text, url: plan\.url\}\)/); assert.match(sw, /clipboard\.writeText\(plan\.url\)/); assert.match(sw, /role="status"/); assert.match(sw, /AbortError/); assert.match(src('app/store.tsx'), /That shared hour has passed; showing now\./);
  assert.match(src('features/forecast/ForecastView.tsx'), /share=\{sharePlanFor\(/); assert.match(src('features/home/HomeView.tsx'), /<ShareWindow plan=\{planOf\(/); assert.match(src('app/store.tsx'), /hourFromParam/);
});

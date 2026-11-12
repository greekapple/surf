import {withSign} from '../utils/signed.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {callFor, WINDOW_DAYS} from '../services/call.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {normalizeTides, attachTides} from '../ocean/noaa.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';
import {shareCardFor, bestEachDay, bandOfCategory, DAY_EMOJI, shareTextWithLink, dayRowText, shortReason} from '../services/shareCard.ts';
import {spotHourOf, dayRange} from '../services/spotHour.ts';
import {dayCertainty} from '../services/certainty.ts';
import {windowHour} from '../services/call.ts';
import {heightValue, wind as windText, compass} from '../utils/units.ts';

// an Open-Meteo week from Nov 2 UTC (10 days where a test asks), light easterly mornings, windy W afternoons; a tide series attached like the pipeline does
const T0 = Date.parse('2026-11-02T00:00:00Z') / 1000, HOURS = 24 * 7;
const times = (n = HOURS) => Array.from({length: n}, (_, i) => T0 + i * 3600);
const marine = (swellM: number, n = HOURS) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times(n), wave_height: times(n).map(() => swellM + .1), swell_wave_height: times(n).map(() => swellM), swell_wave_direction: times(n).map(() => 270), swell_wave_period: times(n).map(() => 14), secondary_swell_wave_height: times(n).map(() => 0), secondary_swell_wave_direction: times(n).map(() => 0), secondary_swell_wave_period: times(n).map(() => 0), sea_surface_temperature: times(n).map(() => 14)}});
const windy = (i: number) => (i % 24 >= 16 && i % 24 < 22 ? [4, 90] : [24, 270]);
/** `noWindDays`: Pacific-day indexes from Nov 2 with no wind at all, so those hours are UNRATED (the rating needs wind). */
const pday = (i: number) => Math.floor((i - 8) / 24);
const weather = (n = HOURS, noWindDays: number[] = []) => ({hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times(n),
  wind_speed_10m: times(n).map((_, i) => (noWindDays.includes(pday(i)) ? null : windy(i)[0])), wind_direction_10m: times(n).map((_, i) => (noWindDays.includes(pday(i)) ? null : windy(i)[1])), wind_gusts_10m: times(n).map((_, i) => windy(i)[0] + 3)}});
const tides = normalizeTides({predictions: times(24 * 10).map((t, i) => ({t: new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' '), v: String(Math.round((2 + 2 * Math.sin(i / 2)) * 100) / 100)}))}, '2026-11-02T00:00:00Z', 'https://example.test');
const build = (id: string, opts: {n?: number; noWindDays?: number[]; tide?: boolean; retrieved?: string} = {}) => {
  const ev = normalizeOpenMeteo(evidenceSpot(id), marine(1.0, opts.n), weather(opts.n, opts.noWindDays), opts.retrieved ?? '2026-11-02T00:00:00Z');
  return (opts.tide === false ? ev : attachTides(ev, tides)).map(toLegacy);
};
const spot = allSpots.find((s) => s.id === 'spot-2')!, hawaii = allSpots.find((x) => x.id.startsWith('w-hawaii'))!;
const p = {...defaultProfile, skill: 'Intermediate' as const, heightUnit: 'ft' as const, windUnit: 'mph' as const, scale: 'Face height' as const};
const nowMs = Date.parse('2026-11-03T17:10:00Z');
const SQUARES = /[🟩🟨⬛⬜]/u;
const tOf = (url: string) => new URL('https://x' + url.slice(url.indexOf('/forecast'))).searchParams.get('t');
const cardOf = (s = spot, records = build(s.id), prof = p, at = nowMs, fallbackNow = false) => {
  const hour = records.find((f) => f.timestamp === '2026-11-03T20:00:00.000Z')!, call = callFor(s, hour, prof, {records, nowMs: at});
  return shareCardFor(s, call, records, prof, at, 'ocean-beach', 'https://swello.example', null, {fallbackNow});
};

test('the condensed text: SWELLO · spot; the window, the rating at its first hour and when it was shared; surf + swell; wind + tide with its source; the day row; the link is separate', () => {
  const c = cardOf()!; assert.ok(c); const L = c.text.split('\n');
  assert.equal(L[0], 'SWELLO · Ocean Beach');
  assert.match(L[1], /^\w{3} [\d:]+( AM| PM)?–[\d:]+ (AM|PM) PST · at \d+ (AM|PM): [A-Z][a-z]+( [a-z]+)? \(provisional\) · shared \d+:\d\d (AM|PM)$/);
  assert.match(L[2], /^🌊 \d+–\d+ ft surf \((model|stale|saved) est\.[^)]*\) · 14 s W swell$/);
  assert.match(L[3], /^💨 \d+\.\d mph [NESW]{1,2}( \((stale|saved)\))?, (offshore|onshore|cross-shore) · tide −?\d+\.\d ft (rising|falling)( \((stale|saved)\))? \((NOAA pred\.|interp\. from NOAA hi\/lo), [^)]+\)$/);
  assert.match(L[4], /^Best rating each day \(provisional\), \w{3}–\w{3}: [🟩🟨⬛⬜]+( · ⬜+ too far out)?$/u);
  assert.equal(L.length, 5); assert.doesNotMatch(c.text, /http|score|%|\d{4}-\d\d|confidence/);
  assert.equal(shareTextWithLink(c), `${c.text}\n${c.url}`); assert.match(c.url, /^https:\/\/swello\.example\/forecast\?spot=ocean-beach&t=\d{4}-\d\d-\d\dT\d\d:00:00Z$/);
});
test('every number in the text is the spot page\'s displayed value for that hour (Surf, Swell, Wind and Tide cards: the same formulas as features/forecast/helpers.ts ht / windVal)', () => {
  const records = build(spot.id), c = cardOf(spot, records)!, f = windowHour(records, spot.id, {start: tOf(c.url)!})!, hr = spotHourOf(spot, f, nowMs, p);
  const page = {surf: hr.surf.value, period: `${Math.round(f.primary!.period)} s`, dir: compass(f.primary!.direction), wind: `${windText(f.wind.speed, p).split(' ')[0]} ${p.windUnit} ${compass(f.wind.direction)}`, tide: `${withSign(f.tide.height, heightValue(Math.abs(f.tide.height), p, false).toFixed(1))} ${p.heightUnit}`};
  for (const v of Object.values(page)) assert.ok(c.text.includes(v), `${v} in ${c.text}`);
  const numbers = c.text.split('\n').slice(1, 4).join(' ').replace(/at \d+ (AM|PM)/, '').replace(/shared \d+:\d\d (AM|PM)/, '').replace(/^\w{3} [^·]+·/, '').match(/−?\d+(\.\d+)?/g) ?? [];
  const shown = Object.values(page).join(' ').match(/−?\d+(\.\d+)?/g)!;
  for (const n of numbers) assert.ok(shown.includes(n) || /×/.test(c.text) && c.text.includes(`×${n}`), `${n} is a spot-page value (${shown.join(', ')})`);
  // the page shows these with the same expressions (guards the copies above)
  const sp = fs.readFileSync(new URL('../features/forecast/SpotPage.tsx', import.meta.url), 'utf8'), hp = fs.readFileSync(new URL('../features/forecast/helpers.ts', import.meta.url), 'utf8');
  assert.match(sp, /\{windVal\(f\.wind\.speed, p\)\}<small>\{p\.windUnit\}<\/small>/); assert.match(sp, /\{htSigned\(f\.tide\.height, p\)\}/); assert.match(hp, /htSigned = \(ft: number, p: UserProfile, digits = 1\) => withSign\(ft, ht\(Math\.abs\(ft\), p, digits\)\)/); assert.match(sp, /\{Math\.round\(s\.period\)\}<small>s/);
  assert.match(hp, /heightValue\(ft, p, false\)\.toFixed\(digits\)/); assert.match(hp, /windText\(mph, p\)\.split\(' '\)\[0\]/);
});
test('a field the app has no value for is left out: no wind, no tide', () => {
  const noWind = build(spot.id).map((f) => ({...f, wind: {...f.wind, speed: NaN}, availability: {...f.availability, wind: false}}));
  const c1 = shareCardFor(spot, {verdict: 'Go', window: null, nextWindow: null, why: []}, noWind as never, p, nowMs, 'x', '', null, {fallbackNow: true})!; assert.ok(c1);
  assert.doesNotMatch(c1.text, /💨|mph/); assert.equal(c1.wind, null);
  const c2 = cardOf(spot, build(spot.id, {tide: false}))!; assert.doesNotMatch(c2.text, /tide/); assert.equal(c2.tide, null);
});
test('S6: an offshore-only spot says it has no surf estimate, and no offshore number is shared', () => {
  const noSize = build(spot.id).map((f) => ({...f, face: NaN, availability: {...f.availability, face: false}, evidence: f.evidence ? {...f.evidence, faceEstimate: undefined, face: {...f.evidence.face, value: null}} : f.evidence}));
  const hr = spotHourOf(spot, noSize.find((f) => f.timestamp === '2026-11-03T17:00:00.000Z')! as never, nowMs, p); assert.equal(hr.surf.headline.kind, 'offshore', 'the fixture is offshore-only');
  const c = shareCardFor(spot, {verdict: 'Skip', window: null, nextWindow: null, why: []}, noSize as never, p, nowMs, 'x', '', null, {fallbackNow: true})!;
  assert.match(c.text, /^🌊 no surf estimate here \(offshore model only\)/m); assert.doesNotMatch(c.text.replace(/tide −?\d+\.\d ft/, ''), /\d(\.\d)? ft/);
});
test('units follow the profile: m and km/h', () => {
  const pm = {...p, heightUnit: 'm' as const, windUnit: 'km/h' as const}, c = cardOf(spot, build(spot.id), pm)!;
  assert.match(c.text, /\d(\.\d)?–\d(\.\d)? m surf/); assert.match(c.text, /\d+\.\d km\/h/); assert.match(c.text, /tide −?\d+\.\d m/); assert.doesNotMatch(c.text, / ft\b|mph/);
});
test('Hawaii: "not Hawaiian scale" beside the surf height; a Hawaiian-scale profile does not get it', () => {
  const r = build(hawaii.id), c = cardOf(hawaii, r, p, nowMs, true)!; assert.ok(c);
  if (c.surf && /ft surf/.test(c.surf.main)) assert.match(c.surf.main, /surf, not Hawaiian scale$/);
  const ch = cardOf(hawaii, r, {...p, scale: 'Hawaiian'}, nowMs, true)!; assert.doesNotMatch(ch.text, /not Hawaiian scale/);
  assert.doesNotMatch(c.text.replace(/tide −?\d+\.\d ft/, ''), /\d ft(?! surf)/, 'no offshore height as a size');
});
test('demonstration mode shares nothing', () => {
  const demo = build(spot.id).map((f) => ({...f, evidence: undefined}));
  assert.equal(cardOf(spot, demo as never), null); assert.equal(cardOf(spot, demo as never, p, nowMs, true), null);
});
test('the day row: one square per local day (7 at most, fewer when the forecast is shorter, never padded); colours from the app\'s rating bands; ⬜ for a day with no rating', () => {
  const full = bestEachDay(spot, build(spot.id), nowMs, 7, p); assert.ok(full.length <= 7 && full.length >= 5, String(full.length));
  assert.equal(new Set(full.map((d) => d.dateKey)).size, full.length);
  const short = bestEachDay(spot, build(spot.id, {n: 72}), nowMs, 7, p); assert.ok(short.length < full.length && short.length >= 2, String(short.length));
  const c = cardOf(spot, build(spot.id, {n: 72}))!; assert.equal([...c.text.split('\n').at(-1)!.split(': ')[1]].filter((x) => SQUARES.test(x)).length, short.length, 'squares = days');
  const gap = bestEachDay(spot, build(spot.id, {noWindDays: [4]}), nowMs, 7, p), d4 = gap.find((d) => d.dateKey === '2026-11-06')!;
  assert.equal(d4.band, 'none'); assert.equal(d4.category, null);
  const cg = cardOf(spot, build(spot.id, {noWindDays: [4]}))!; assert.ok(cg.text.split('\n').at(-1)!.includes('⬜'));
  assert.deepEqual(['EPIC', 'FIRING', 'GOOD', 'SOLID', 'NOT BAD', 'SURFABLE', 'WEAK', 'POOR', 'FLAT', 'UNRATED'].map(bandOfCategory), ['good', 'good', 'good', 'good', 'fair', 'fair', 'poor', 'poor', 'poor', 'none']);
  const model = fs.readFileSync(new URL('../features/forecast/model.ts', import.meta.url), 'utf8');
  assert.match(model, /\['EPIC', 'FIRING', 'GOOD', 'SOLID'\]\.includes\(category\)\) return 'good'/); assert.match(model, /\['NOT BAD', 'SURFABLE'\]\.includes\(category\)\) return 'fair'/);
});
test('S2: poor is ⬛ (the app draws poor as neutral grey, not red); ⬜ stays "no rating"', () => {
  assert.deepEqual(DAY_EMOJI, {good: '🟩', fair: '🟨', poor: '⬛', none: '⬜'});
  const d = (band: 'good' | 'fair' | 'poor' | 'none') => ({dateKey: 'k', dow: 'Mon', band, category: null, tooFar: false});
  assert.equal(dayRowText([d('good'), d('poor'), d('none')]), '🟩⬛⬜'); assert.doesNotMatch(cardOf()!.text, /🟥/);
});
test('S3: the day row says it is the best RATING each day and provisional', () => {
  assert.match(cardOf()!.text.split('\n').at(-1)!, /^Best rating each day \(provisional\), /);
});
test('B2: days past the certainty horizon (the week grid\'s dayCertainty rule) are not coloured: ⬜ after a separator, "too far out"', () => {
  const r = build(spot.id, {n: 24 * 10}), days = bestEachDay(spot, r, nowMs, 7, p); assert.equal(days.length, 7);
  for (const d of days) assert.equal(d.tooFar, dayCertainty(spot.id, dayRange(spot, r, d.dateKey, nowMs, p), nowMs)?.level === 'too-far', d.dateKey);
  const far = days.filter((d) => d.tooFar).length; assert.ok(far >= 1, 'the 10-day fixture reaches past the horizon');
  assert.ok(days.slice(0, days.length - far).every((d) => !d.tooFar), 'too-far days are the last ones');
  const row = cardOf(spot, r)!.text.split('\n').at(-1)!;
  assert.ok(row.endsWith(` · ${'⬜'.repeat(far)} too far out`), row);
  assert.equal([...row.split(': ')[1].split(' · ')[0]].length, 7 - far, 'coloured squares only for days inside the horizon');
});
test('a stale or saved estimate still says so in the short tag; the confidence word is not shared', () => {
  assert.match(cardOf()!.text, /\((model|stale|saved) est\./);
  const fresh = cardOf(spot, build(spot.id, {retrieved: '2026-11-03T17:00:00Z'}))!; assert.equal(fresh.surf!.tags[0], 'model est.'); assert.doesNotMatch(fresh.text, /confidence/);
  // the fixture was retrieved Nov 2: a day later the estimate is stale and the card keeps the word
  assert.equal(cardOf()!.surf!.tags[0], 'stale est.');
});
test('B1: no window: nothing from the Go window\'s Share; the header\'s Share gives the current hour with the call\'s own horizon and reason (never "in this forecast")', () => {
  const r = build(spot.id), none = {verdict: 'Skip' as const, window: null, nextWindow: null, why: ['The estimated 10–13 ft is above the intermediate range (up to 8 ft). Wind is fine.']};
  assert.equal(shareCardFor(spot, none, r, p, nowMs, 'x'), null);
  const c = shareCardFor(spot, none, r, p, nowMs, 'x', '', null, {fallbackNow: true})!; assert.ok(c.noWindow);
  const L = c.text.split('\n'); assert.match(L[1], /^Now, \w{3} \d+ (AM|PM) PST · /);
  assert.equal(L[2], `No window next ${WINDOW_DAYS} days: 10–13 ft is above the intermediate range (up to 8 ft)`);
  assert.doesNotMatch(c.text, /in this forecast/); assert.equal(tOf(c.url), '2026-11-03T17:00:00Z');
  assert.equal(shortReason('Wind 1.5 mph. More.'), 'Wind 1.5 mph');
  // the PNG and the aria read the same field
  const src = (f: string) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  assert.match(src('ui/shareImage.ts'), /c\.noWindowText/); assert.match(src('features/forecast/ShareWindow.tsx'), /card\.noWindowText/); assert.doesNotMatch(src('features/forecast/ShareWindow.tsx') + src('ui/shareImage.ts'), /in this forecast/);
});
test('N1: after dark with no window, the card shares the next daylight day\'s best hour (Call.nextDay), not the dark hour', () => {
  const at = '2026-11-04T19:00:00.000Z', dark = {verdict: 'Dark' as const, window: null, nextWindow: null, why: ['Tomorrow: Skip.'], nextDay: {when: 'tomorrow', at, verdict: 'Skip' as const, reason: 'The estimated 5–7 ft is above your range.'}};
  const c = shareCardFor(spot, dark, build(spot.id), p, Date.parse('2026-11-04T05:00:00Z'), 'x', '', null, {fallbackNow: true})!;
  assert.match(c.when, /\(tomorrow's best hour\)$/); assert.equal(tOf(c.url), '2026-11-04T19:00:00Z');
  assert.equal(c.noWindowText, `No window next ${WINDOW_DAYS} days: 5–7 ft is above your range`);
});

test('the tide source follows the spot page Tide card: an interpolated station says so, never "NOAA pred."', async () => {
  const {tideStationFor, SF_STATION, hourlyTideStationIds} = await import('../ocean/tideStations.ts');
  const {evidenceSpots} = await import('../ocean/spots.ts');
  const c = cardOf()!, e = evidenceSpots.find((x: {id: string}) => x.id === spot.id)!;
  const st = tideStationFor({id: spot.id, latitude: e.latitude, longitude: e.longitude});
  assert.ok(st && c.tide, 'Ocean Beach has a tide station and a shared tide');
  const hourly = st.station.id === SF_STATION || hourlyTideStationIds.includes(st.station.id);
  assert.equal(c.tide.source.startsWith(hourly ? 'NOAA pred.' : 'interp. from NOAA hi/lo'), true);
  assert.ok(c.text.includes(`(${c.tide.source})`));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tideStationFor, SF_STATION} from '../ocean/tideStations.ts';
import {evidenceSpots} from '../ocean/spots.ts';

const src = (f: string) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const station = (id: string) => tideStationFor(evidenceSpots.find((s) => s.id === id)! as never);

test('A2: ONE tide source per spot: the own station\'s hourly series where it is harmonic, a cosine curve between its own highs and lows where it is subordinate; SF is drawn only where it IS the own station and says so', () => {
  assert.equal(station('spot-1')!.station.id, SF_STATION, 'Stinson: San Francisco');
  for (const [id, own] of [['spot-5', '9414131'], ['spot-3', '9414131'], ['spot-2', '9414275']] as const) assert.equal(station(id)!.station.id, own, `${id}: its own station, not San Francisco`);
  const s = src('features/forecast/SpotPage.tsx');
  assert.match(s, /ownIsSf = !!ownTide && ownTide\.station\.id === SF_STATION/); assert.match(s, /\{tideOk && ownTide \? <>/); assert.match(s, /NOAA CO-OPS prediction at San Francisco \(\$\{SF_STATION\}\), a regional reference/); assert.match(s, /tideCurveWords\(/);
  assert.doesNotMatch(s, /NOAA station prediction, not at the beach/, 'the nameless label is gone');
  const pl = src('ocean/pipeline.ts'); assert.match(pl, /spotTideSeries\(stationTidesOut/); assert.doesNotMatch(pl, /nearSanFrancisco\(e\.latitude/, 'no SF attachment by proximity to the Bay; the own station decides');
  const fv = src('features/forecast/ForecastView.tsx'); assert.match(fv, /extremaForOwnStation\(view\.ocean\.bundle/);
});
test('A2: the interpolated curve passes through NOAA\'s own highs and lows, is a cosine between them, and says it is interpolated; hourly series win where they exist', () => {
  const m = (v: number, t: string) => ({value: v, unit: 'ft' as const, source: {provider: 'NOAA CO-OPS 9410230', kind: 'forecast' as const, validAt: t, retrievedAt: t, issuedAt: null, updatedAt: null, url: 'u', nativeUnit: 'ft MLLW', location: 'x', delivery: 'direct' as const, notes: ''}});
  const ex = [['2026-11-11T00:00:00.000Z', 1, 'Low'], ['2026-11-11T06:00:00.000Z', 5, 'High'], ['2026-11-11T12:00:00.000Z', 1, 'Low'], ['2026-11-11T18:00:00.000Z', 5, 'High'], ['2026-11-12T00:00:00.000Z', 1, 'Low']].map(([t, v, ty]) => ({timestamp: t as string, height: m(v as number, t as string), type: ty as 'High' | 'Low'}));
  const st = {id: '9410230', name: 'La Jolla', distanceKm: 3};
  const h = interpolatedHeights(ex, st); assert.equal(h.get('2026-11-11T00:00:00.000Z')!.value, 1); assert.ok(Math.abs(h.get('2026-11-11T06:00:00.000Z')!.value! - 5) < 1e-9); assert.ok(Math.abs(h.get('2026-11-11T03:00:00.000Z')!.value! - 3) < 1e-9, 'midway is the mean');
  assert.match(h.get('2026-11-11T03:00:00.000Z')!.source.notes, /Curve interpolated between NOAA's predicted highs and lows at La Jolla \(9410230\), 3 km/);
  const ser = spotTideSeries({stationId: '9410230', hourly: [], extrema: ex}, st)!; assert.equal(ser.kind, 'interpolated'); assert.match(tideCurveWords(ser), /^Curve interpolated between NOAA's predicted highs and lows at La Jolla \(9410230\), 3 km from this spot/);
  const hourly = [...h].map(([timestamp, height]) => ({timestamp, height})); const ser2 = spotTideSeries({stationId: '9410230', hourly, extrema: ex}, st)!; assert.equal(ser2.kind, 'hourly'); assert.match(tideCurveWords(ser2), /^NOAA CO-OPS hourly prediction at La Jolla/);
  assert.equal(spotTideSeries(undefined, st), null); assert.equal(spotTideSeries({stationId: 'x', hourly: [], extrema: ex.slice(0, 1)}, st), null, 'one extreme is not a curve');
});

// ---- A4: the rating word, the Why and the day star agree
import {callFor, GO_MIN_SCORE} from '../services/call.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';
const T0 = Date.parse('2026-11-02T00:00:00Z') / 1000, times = Array.from({length: 72}, (_, i) => T0 + i * 3600);
const marineBig = {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'}, hourly: {time: times, wave_height: times.map(() => 3.1), swell_wave_height: times.map(() => 3), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 270), secondary_swell_wave_period: times.map(() => 8)}};
const weatherCalm = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 3), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 4)}};
test('A4: a Solid hour that is Skip for size/skill never says "only middling": the Why states the rating and where the call comes from', () => {
  const spot = allSpots.find((s) => s.id === 'spot-2')!, recs = normalizeOpenMeteo(evidenceSpot('spot-2'), marineBig as never, weatherCalm as never, '2026-11-02T00:00:00Z').map(toLegacy);
  const hour = recs.find((f) => f.timestamp === '2026-11-02T20:00:00.000Z')!, prof = {...defaultProfile, skill: 'Beginner' as const};
  const c = callFor(spot, hour, prof, {records: recs, nowMs: Date.parse('2026-11-02T19:00:00Z')});
  assert.equal(c.verdict, 'Skip'); const text = c.why.join(' | ');
  assert.doesNotMatch(text, /only middling/, text); assert.match(text, /above the beginner range|too big|above/i);
  assert.match(text, /The conditions themselves rate solid; the call comes from the size rule above, not from the rating\./, 'the Why names the deciding rule (size), not a list');
  assert.equal(GO_MIN_SCORE, 65);
});
test('A4: the best-day star is given only to a day the call also names a window for, inside the call\'s window horizon and the certainty horizon, and is recomputed on the hour', () => {
  const v = src('features/forecast/ForecastView.tsx'); assert.match(v, /windowOnDay\(spot, dateIn\(timeZoneOf\(spot\), series\[d\.start\]\.timestamp\), p, \{records: series\.map\(\(h\) => h\.forecast\), bundle: view\.ocean\.bundle, nowMs\}\)\) return;/);
  assert.match(v, /CALL_WINDOW_DAYS \* 86400000/); assert.match(v, />= HORIZON_HOURS\) return;/); assert.match(v, /const nowHour = Math\.floor\(now \/ 3600000\)/); assert.match(v, /\[days, series, spot, p, view\.ocean\.bundle, nowHour\]/);
  assert.match(src('features/forecast/SpotPage.tsx'), /among the next few days that have a Go or Worth-a-look window for your skill range/);
  assert.doesNotMatch(src('services/call.ts'), /: 'The rating is only middling for this hour\.';/, 'the unconditional "only middling" fallback is gone'); assert.doesNotMatch(src('services/call.ts'), /WORTH_MIN_SCORE \? `The rating is \$\{cat\} for this hour\.` : `The rating is/, 'the dead identical ternary branch is gone');
  // "though within" notes are reasons: a Worth-a-look because the size is above the range you prefer leads with it
  const spot = allSpots.find((s) => s.id === 'spot-2')!, recs = normalizeOpenMeteo(evidenceSpot('spot-2'), marineBig as never, weatherCalm as never, '2026-11-02T00:00:00Z').map(toLegacy);
  const hour = recs.find((f) => f.timestamp === '2026-11-02T20:00:00.000Z')!, c = callFor(spot, hour, {...defaultProfile, skill: 'Intermediate' as const, minWave: 1, maxWave: 2}, {records: recs, nowMs: Date.parse('2026-11-02T19:00:00Z')});
  if (/though within/.test(c.why.join(' '))) assert.match(c.why[0], /though within/, 'a "though within" size note is the lead reason');
});

// ---- A20: the buoy checks
import {chooseBuoy, scoringBuoys, KNOWN_SILENT, SCORING_RULE, silentBuoyNear, silentBuoyNearerThan, silentBuoyWords, nearerBuoyNotUsed, windowOf} from '../ocean/scoringBuoys.ts';
import {offshoreLine, comparedText} from '../services/howRightAll.ts';
const pos = (id: string) => { const e = evidenceSpot(id); return {lat: e.latitude, lon: e.longitude}; };
test('A20: a silent nearby buoy is described as silent (Hookipa: Pauwela 51205 has not reported since Oct 13), never "no wave buoy within 100 km"', () => {
  assert.deepEqual(KNOWN_SILENT.map((b) => b.id), ['51205']);
  const hookipa = allSpots.find((s) => /hookipa/i.test(s.name))!; const at = pos(hookipa.id), silent = silentBuoyNear(at.lat, at.lon)!; assert.equal(silent.id, '51205'); assert.ok(silent.km < 15, `Pauwela is a few km away: ${silent.km}`);
  const choice = chooseBuoy(at, windowOf(hookipa.id)); assert.equal(choice.ok, false); if (!choice.ok) assert.match(choice.reason, /^the nearest wave buoy, Pauwela, Maui \(51205, \d+ km\), had sent no data since Oct 13, 2026 when checked Nov 10$/, choice.reason);
  const line = offshoreLine({status: 'no-buoy', spotId: hookipa.id, reason: `no wave buoy within ${SCORING_RULE.maxKm} km`, nearest: null}); assert.match(line.text, /^No offshore check: the nearest wave buoy, Pauwela, Maui \(51205, \d+ km\), had sent no data since Oct 13, 2026 when checked Nov 10\.$/);
  assert.equal(silentBuoyNear(37.76, -122.51), null, 'a spot far from it is not told about it'); assert.match(silentBuoyWords(silent), /had sent no data since Oct 13, 2026 when checked Nov 10$/);
  assert.equal(silentBuoyNear(at.lat, at.lon, 1), null, 'the range is a parameter, the default is the scoring rule');
  assert.ok(!/within 100 km/.test(fs.readFileSync(new URL('../services/howRightAll.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), 'no hard-coded 100 km in the line builder');
  // a silent buoy NEARER than the one used is named too
  const nearer = silentBuoyNearerThan(at.lat, at.lon, 50); assert.equal(nearer?.id, '51205'); assert.equal(silentBuoyNearerThan(at.lat, at.lon, 1), null);
  assert.match(comparedText({id: '51201', name: 'Waimea Bay', km: 60} as never, hookipa.id), /; the wave buoy, Pauwela, Maui \(51205, \d+ km\), had sent no data since Oct 13, 2026 when checked Nov 10$/);
});
test('A20: the silent-buoy list is a DATED check: the row is re-checked (or removed) within 30 days', () => {
  for (const b of KNOWN_SILENT) { const age = (Date.now() - Date.parse(b.checked + 'T00:00:00Z')) / 86400000; assert.ok(age <= 30, `${b.id} was last checked ${b.checked} (${Math.round(age)} days ago): look at its NDBC page again and update \`checked\` (or remove the row if it reports)`); }
});
test('A20: the check names the buoy it uses and says why a nearer open buoy is not used (Cowell\'s: 46042 is used, the nearer Monterey Canyon Outer is outside the swell window; Mavericks: 46012, not the nearer San Francisco Bar)', () => {
  for (const [id, used, nearer] of [['spot-7', '46042', '46236'], ['spot-5', '46012', '46237']] as const) {
    const at = pos(id), w = windowOf(id), choice = chooseBuoy(at, w); assert.ok(choice.ok, id); assert.equal((choice as any).pick.buoy.id, used, id);
    const n = nearerBuoyNotUsed(at, used, w); assert.equal(n?.id, nearer, id); assert.match(n!.why, /outside this spot's swell window/); assert.ok(n!.km < (choice as any).pick.km, id);
    const text = comparedText({id: used, name: 'X', km: (choice as any).pick.km, bearing: 0, window: [0, 0], split: true, gridKm: null} as never, id); assert.match(text, new RegExp(`; the nearer buoy .* \\(${nearer}, \\d+ km\\) is not used because it lies outside this spot's swell window$`), text);
  }
  const at = pos('spot-2'), w = windowOf('spot-2'), c = chooseBuoy(at, w); assert.ok(c.ok); assert.equal(nearerBuoyNotUsed(at, (c as any).pick.buoy.id, w), null, 'the nearest open buoy needs no note');
});

// ---- B7: a spot outside NorCal loads its own data first
import {loadOcean} from '../ocean/pipeline.ts';
test('B7: the load follows the SCOPE order (the selected spot first), not the catalogue order, so Hookipa\'s own requests are not queued behind NorCal', async () => {
  const urls: string[] = []; const real = globalThis.fetch;
  globalThis.fetch = (async (u: unknown) => { urls.push(String(u)); return new Response(JSON.stringify({hourly: {time: []}}), {status: 200, headers: {'content-type': 'application/json'}}); }) as never;
  try {
    const hookipa = evidenceSpots.find((s) => s.id === 'w-hawaii-hookipa')!, ob = evidenceSpots.find((s) => s.id === 'spot-2')!, bolinas = evidenceSpots.find((s) => s.id === 'spot-0')!;
    await loadOcean(undefined, new Set([hookipa.id, ob.id, bolinas.id])).catch(() => {});
    const marine = urls.filter((u) => /marine-api\.open-meteo\.com|\/api\/provider\?key=marine-/.test(u)); assert.ok(marine.length >= 3, `marine requests seen: ${marine.length}`);
    assert.match(marine[0], /marine-w-hawaii-hookipa|latitude=2[01]\./, 'the first marine request is the selected spot\'s: ' + marine[0]);
  } finally { globalThis.fetch = real; }
  const hook = src('hooks/useForecast.ts'); assert.match(hook, /useState\(initialSpot\)/); assert.match(hook, /spotIdForSlug\(new URLSearchParams\(location\.search\)\.get\('spot'\)\)/);
  assert.match(src('ocean/pipeline.ts'), /\[\.\.\.scope\]\.map\(id=>byId\.get\(id\)\)/);
});
test('B7: the selected spot is loaded alone first and MERGED into the bundle on screen; the rest of the scope loads behind it', () => {
  const h = src('hooks/useOceanData.ts'); assert.match(h, /const primary=scope&&scope\.length>1\?scope\[0\]:null;/); assert.match(h, /loadOcean\(onStatus,new Set\(\[primary\]\)\)/); assert.match(h, /return loadOcean\(onStatus,scope\?new Set\(scope\):null\)/, 'the full scope still loads');
  assert.match(h, /setBundle\(old=>mergeSpotBundle\(old,first,primary\)\)/, 'merged, never replaced'); assert.match(h, /nextFailed/, 'the failed-spot tracking of the full load is kept'); assert.match(h, /isSpotFailed/);
});

// ---- A1 (round 2): /api/cam-meta keeps a first sighting per ETag; B7 merge
import {interpolatedHeights, spotTideSeries, tideCurveWords} from '../ocean/stationTide.ts';
import {createCamMeta} from '../../services/cam-meta.mjs';
import {mergeSpotBundle} from '../ocean/mergeBundle.ts';
test('A1: /api/cam-meta returns when this Worker FIRST saw the current content (ETag): a rewrite of the same frame keeps its first sighting, new content restarts it', async () => {
  let t = Date.parse('2026-11-10T20:00:00Z'), etag = '"aaa"', lm = 'Tue, 10 Nov 2026 20:00:00 GMT';
  const f = (async () => new Response(null, {status: 200, headers: {etag, 'last-modified': lm}})) as unknown as typeof fetch, svc = createCamMeta({fetcher: f, now: () => t});
  const get = async () => (await (await svc.respond(new URL('http://x/api/cam-meta?id=usgs-dream-inn-c2'))).json()) as any;
  const a = await get(); assert.equal(a.firstSeenAt, '2026-11-10T20:00:00.000Z');
  t += 400000; lm = 'Tue, 10 Nov 2026 20:06:00 GMT'; const b = await get(); assert.equal(b.lastModified, '2026-11-10T20:06:00.000Z'); assert.equal(b.firstSeenAt, '2026-11-10T20:00:00.000Z', 'same content, rewritten: the first sighting stays');
  t += 400000; etag = '"bbb"'; lm = 'Tue, 10 Nov 2026 20:13:00 GMT'; const c = await get(); assert.equal(c.firstSeenAt, new Date(t).toISOString(), 'new content: a new first sighting');
});
test('B7: the single-spot bundle is MERGED into the bundle on screen: other spots\' records and loadedSpotIds stay, nothing is lost', () => {
  const rec = (spotId: string, v: number) => ({spotId, timestamp: '2026-11-10T20:00:00Z', offshore: {value: v}}) as never;
  const old = {records: [rec('a', 1), rec('b', 2)], loadedSpotIds: ['a', 'b'], statuses: [], stationTides: {x: 1}} as never, first = {records: [rec('c', 3)], loadedSpotIds: ['c'], statuses: [], stationTides: {y: 2}} as never;
  const m = mergeSpotBundle(old, first, 'c') as any; assert.deepEqual(m.records.map((r: any) => r.spotId).sort(), ['a', 'b', 'c']); assert.deepEqual([...m.loadedSpotIds].sort(), ['a', 'b', 'c']); assert.deepEqual(Object.keys(m.stationTides).sort(), ['x', 'y']);
  const again = mergeSpotBundle(m, {records: [rec('c', 9)], loadedSpotIds: ['c'], statuses: []} as never, 'c') as any; assert.equal(again.records.filter((r: any) => r.spotId === 'c').length, 1); assert.equal(again.records.find((r: any) => r.spotId === 'c').offshore.value, 9);
  assert.equal(mergeSpotBundle(null, first, 'c'), first, 'with no bundle yet the single-spot bundle is the bundle');
});

// ---- best-sessions: the unknown time is recorded at entry
import {checkObservation} from '../services/sessionLog.ts';
test('best-sessions: a date-only entry is stored with timeKnown:false at entry; a timed one never is', () => {
  const base = {spotId: 'spot-2', lo: 2, hi: 3, unit: 'ft' as const, quality: 4}, now = Date.parse('2026-11-10T20:00:00Z');
  const a = checkObservation({...base, observedAt: '2026-11-08'}, now); assert.ok(a.ok && a.value.timeKnown === false);
  const b = checkObservation({...base, observedAt: '2026-11-08T07:00:00.000Z', timeKnown: false}, now); assert.ok(b.ok && b.value.timeKnown === false);
  const c = checkObservation({...base, observedAt: '2026-11-08T08:00:00.000Z'}, now); assert.ok(c.ok && !('timeKnown' in c.value));
});

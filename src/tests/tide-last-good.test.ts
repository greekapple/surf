import test from 'node:test';
import assert from 'node:assert/strict';
import {saveTide, lastGoodTide, usableTide} from '../ocean/tideLastGood.ts';
import {normalizeTides} from '../ocean/noaa.ts';
import {loadOcean} from '../ocean/pipeline.ts';
import fs from 'node:fs';
const require_ = (f: string) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
import {tideStationFor} from '../ocean/tideStations.ts';
import {evidenceSpot} from '../ocean/spots.ts';

// prod-nan: a failed tide fetch falls back to the last good prediction, labelled saved, not "no tide"
const pad = (n: number) => String(n).padStart(2, '0');
const gmt = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const hourMs = Math.floor(Date.now() / 3600000) * 3600000;
const rows = (from: number, n: number) => Array.from({length: n}, (_, i) => ({t: gmt(from + i * 3600000), v: (2 + Math.sin(i / 2)).toFixed(3)}));
const memory = () => { const m = new Map<string, string>(); return {getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m}; };

test('tideLastGood: saves a good prediction, returns it while it covers now, refuses it once it does not, and never throws', () => {
  const s = memory(), at = '2026-11-14T02:00:00.000Z', good = {predictions: rows(hourMs - 3600000, 48)};
  assert.equal(lastGoodTide('tides', hourMs, s), null, 'nothing saved yet');
  saveTide('tides', good, at, s); const got = lastGoodTide('tides', hourMs, s); assert.equal(got?.at, at); assert.equal(got?.payload.predictions.length, 48);
  assert.equal(lastGoodTide('tides', hourMs + 100 * 3600000, s), null, 'a copy that no longer covers the present is not used');
  assert.equal(lastGoodTide('tides-9414131', hourMs, s), null, 'another station has its own copy');
  saveTide('tides-x', {predictions: [{t: gmt(hourMs), v: 'NaN'}, ...rows(hourMs, 30).map((r) => ({...r, v: ''}))]}, at, s); assert.equal(lastGoodTide('tides-x', hourMs, s), null, 'rows without a number are not saved');
  saveTide('tides-short', {predictions: rows(hourMs, 5)}, at, s); assert.equal(lastGoodTide('tides-short', hourMs, s), null, 'a stub of a few rows is not a prediction');
  for (let i = 0; i < 40; i++) saveTide('st' + i, good, new Date(Date.parse(at) + i * 60000).toISOString(), s);
  assert.ok(Object.keys(JSON.parse(s.m.get('swello-tide-last-good-v1')!)).length <= 24, 'bounded'); assert.ok(lastGoodTide('st39', hourMs, s), 'the newest are kept');
  const broken = {getItem: () => { throw new Error('no storage'); }, setItem: () => { throw new Error('full'); }};
  assert.doesNotThrow(() => saveTide('tides', good, at, broken)); assert.equal(lastGoodTide('tides', hourMs, broken), null); assert.equal(usableTide(null, hourMs), false);
});
test('normalizeTides labels a saved copy: delivery saved, with the retrieval time in the note; direct stays direct', () => {
  const p = {predictions: rows(hourMs, 24)}, url = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=9414290';
  const live = [...normalizeTides(p, '2026-11-14T02:00:00.000Z', url).values()][0], saved = [...normalizeTides(p, '2026-11-14T02:00:00.000Z', url, 'saved').values()][0];
  assert.equal(live.source.delivery, 'direct'); assert.doesNotMatch(live.source.notes ?? '', /Saved copy/);
  assert.equal(saved.source.delivery, 'saved'); assert.match(saved.source.notes ?? '', /Saved copy: the live NOAA fetch failed.*retrieved 2026-11-14T02:00:00\.000Z/);
});
test('loadOcean: with the NOAA tide fetch down, Ocean Beach\'s tide comes from the saved copy, labelled saved (not missing); with no saved copy it is missing as before', async () => {
  const store = memory(); const realLS = (globalThis as any).localStorage, realFetch = globalThis.fetch;
  (globalThis as any).localStorage = store;
  const at = '2026-11-14T01:30:00.000Z'; const own = tideStationFor(evidenceSpot('spot-2'))!.station.id, keys = own === '9414290' ? ['tides', 'tide-extrema'] : ['tides', 'tide-extrema', 'tides-' + own, 'tide-extrema-' + own];
  for (const k of keys) saveTide(k, {predictions: rows(hourMs - 3600000, 72).map((r, i) => (k.includes('extrema') ? {...r, type: i % 2 ? 'H' : 'L'} : r))}, at, store, /^tide(s|-extrema)$/.test(k) ? '9414290' : own);
  const times = Array.from({length: 30}, (_, i) => Math.floor((hourMs - 3 * 3600000) / 1000) + i * 3600);
  const marine = (lat: number) => ({latitude: lat, longitude: -122.6, hourly: {time: times, wave_height: times.map(() => 1.5), swell_wave_height: times.map(() => 1.4), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 13), secondary_swell_wave_height: times.map(() => null), secondary_swell_wave_direction: times.map(() => null), secondary_swell_wave_period: times.map(() => null), sea_surface_temperature: times.map(() => 14)}, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'}});
  const weather = {latitude: 37.76, longitude: -122.51, hourly: {time: times, wind_speed_10m: times.map(() => 8), wind_direction_10m: times.map(() => 300), wind_gusts_10m: times.map(() => 12)}, hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}};
  globalThis.fetch = (async (u: unknown) => { const url = String(u);
    if (/tidesandcurrents\.noaa\.gov/.test(url)) throw new TypeError('network down');
    if (/marine-api\.open-meteo\.com/.test(url)) return new Response(JSON.stringify(marine(37.75)), {status: 200, headers: {'content-type': 'application/json'}});
    if (/api\.open-meteo\.com/.test(url)) return new Response(JSON.stringify(weather), {status: 200, headers: {'content-type': 'application/json'}});
    return new Response('{}', {status: 404}); }) as never;
  try {
    const withCopy = await loadOcean(undefined, new Set(['spot-2', 'spot-0', 'spot-3']));
    const hour = withCopy.records.find((r) => r.spotId === 'spot-2' && Date.parse(r.timestamp) >= hourMs && r.tide.value !== null);
    assert.ok(hour, 'Ocean Beach has a tide value for the present hour from the saved copy'); assert.equal(hour!.tide.source.delivery, 'saved'); assert.equal(hour!.tide.source.retrievedAt, at, 'labelled with the time the saved copy was retrieved'); assert.match(`${hour!.tide.source.notes ?? ''} ${hour!.tide.source.location ?? ''}`, /9414275|9414290|Ocean Beach|San Francisco/);
    assert.ok(withCopy.records.some((r) => r.spotId === 'spot-2' && r.tideTrend !== 'Unknown'), 'the trend follows');
    store.m.clear();
    const without = await loadOcean(undefined, new Set(['spot-2', 'spot-0', 'spot-3', 'spot-1']).add('spot-4'));
    assert.ok(without.records.filter((r) => r.spotId === 'spot-2').every((r) => r.tide.value === null), 'no saved copy: the tide stays missing (not invented)');
  } finally { globalThis.fetch = realFetch; (globalThis as any).localStorage = realLS; }
});

// prod-nan: the Worker's tide window starts at yesterday 00:00 UTC (as the browser's own request does), so a Pacific local day is covered from its first hour
import {ingestionTargets, serviceSpots} from '../../services/forecast-service.mjs';
test('ingestion: tide predictions begin yesterday (UTC), so a Pacific spot\'s whole local day has a tide at any hour of the evening', () => {
  for (const iso of ['2026-11-14T00:36:00Z', '2026-11-14T02:40:00Z', '2026-11-14T12:00:00Z', '2026-11-30T23:59:00Z']) {
    const now = Date.parse(iso), ts = ingestionTargets(now, serviceSpots).filter((t: any) => /^tide(s|-extrema)(-|$)/.test(t.key) && !t.field);
    assert.ok(ts.length >= 4, 'tide targets exist');
    const day = new Date(now); const yesterday = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - 1)); const want = yesterday.toISOString().slice(0, 10).replaceAll('-', '');
    for (const t of ts) { const q = new URL(t.url).searchParams; assert.equal(q.get('begin_date'), want, `${t.key}: begins yesterday (${want})`); assert.equal(q.get('range'), '192'); }
    // PST local midnight of the current Pacific day (UTC-8) is on or after the window start
    const pstMidnightMs = Date.parse(new Date(now - 8 * 3600000).toISOString().slice(0, 10) + 'T08:00:00Z'), windowStart = yesterday.getTime();
    assert.ok(pstMidnightMs >= windowStart, `${iso}: the Pacific day starts inside the window`);
  }
  // the browser's own request starts on the same date
  const b = new URL(ingestionTargets(Date.parse('2026-11-14T02:40:00Z'), serviceSpots).find((t: any) => t.key === 'tides')!.url).searchParams.get('begin_date');
  assert.equal(b, '20261113');
});

test('tideLastGood: a copy is for ITS station: another station\'s feed, or a copy saved without one, is never used when a station is asked for', () => {
  const s = memory(), at = '2026-11-14T02:00:00.000Z', good = {predictions: rows(hourMs - 3600000, 48)};
  saveTide('tides-9414131', good, at, s, '9414131'); assert.ok(lastGoodTide('tides-9414131', hourMs, s, '9414131'));
  assert.equal(lastGoodTide('tides-9414131', hourMs, s, '9414275'), null, 'same key, different station: refused');
  saveTide('tides-old', good, at, s); assert.equal(lastGoodTide('tides-old', hourMs, s, '9414290'), null, 'a copy with no recorded station is refused when a station is asked for');
  assert.ok(lastGoodTide('tides-old', hourMs, s), 'and still readable when no station is asked for (the unit API)');
  assert.match(require_('src/ocean/pipeline.ts'), /saveTide\(id,payload,.*stationOf\(url\)\)/); assert.match(require_('src/ocean/pipeline.ts'), /lastGoodTide\(id,Date\.now\(\),undefined,stationOf\(url\)\)/);
});

// tide-label: a saved (or stale) tide is labelled on every surface that shows a tide, not only the Now value, the hourly table, the chart readout and the share card
import {tideStaleOf, savedTurnText, savedTurnWord, staleWord, staleText} from '../services/freshness.ts';
import {tideOf} from '../services/spotHour.ts';
const hourWith = (delivery: string, retrievedAt: string) => ({forecast: {evidence: {tide: {source: {delivery, retrievedAt, provider: 'NOAA CO-OPS 9414275', kind: 'forecast'}}}}});
test('tide-label helpers: tideStaleOf finds a saved tide among hours; savedTurnText/Word mark a saved turn; a live one is unmarked', () => {
  const now = Date.parse('2026-11-14T03:00:00Z'), live = hourWith('direct', '2026-11-14T02:30:00.000Z'), saved = hourWith('saved', '2026-11-14T01:00:00.000Z');
  assert.equal(tideStaleOf([live, live], now), null); const s = tideStaleOf([live, saved], now); assert.equal(s?.reason, 'saved'); assert.equal(staleWord(s), 'saved'); assert.match(staleText(s!), /SAVED copy retrieved 2026-11-14 01:00 UTC/);
  assert.equal(tideStaleOf([hourWith('direct', '2026-11-13T05:00:00.000Z')], now)?.reason, 'old', 'a tide older than 7 h is stale');
  assert.equal(savedTurnText({delivery: 'direct', retrievedAt: 'x'}), ''); assert.match(savedTurnText({delivery: 'saved', retrievedAt: '2026-11-14T01:00:00.000Z'}), /^ · saved copy, retrieved 2026-11-14 01:00 UTC$/);
  assert.equal(savedTurnWord({delivery: 'saved'}), 'saved'); assert.equal(savedTurnWord(undefined), '');
  const f: any = {tide: {height: 1.2, trend: 'Falling'}, evidence: {tide: {source: {delivery: 'saved', retrievedAt: '2026-11-14T01:00:00.000Z'}}}};
  const v = tideOf(f, {heightUnit: 'ft'} as any, now); assert.match(v!.heightLabel!, /saved copy/); assert.equal(v!.stale?.reason, 'saved');
});
test('tide-label: every surface that shows a tide marks a saved copy (one check per surface)', () => {
  const r = require_;
  // 1 Today ribbon row and its title/aria; ForecastView passes the day's tide freshness
  const rb = r('src/features/forecast/TodayRibbon.tsx'); assert.match(rb, /NOAA\{tideStale \? ` · \$\{staleWord\(tideStale\)\}` : ''\}/); assert.match(rb, /title=\{tideStale \? `\$\{tideLabel\}\. \$\{staleText\(tideStale\)\}`/); assert.match(rb, /saved copy/);
  assert.match(r('src/features/forecast/ForecastView.tsx'), /tideStale=\{tideStaleOf\(dayHours, now\)\}/); assert.match(r('src/features/forecast/ForecastView.tsx'), /<TideDay [^>]*now=\{now\}/);
  // 2 tide charts (Tide tab and day chart) and the small curve caption
  const ch = r('src/features/forecast/charts.tsx'); assert.match(ch, /Tide for the selected day\$\{tideStale \? \(tideStale\.reason === 'saved' \? ' \(saved copy\)'/); assert.match(ch, /<StaleTag s=\{tideStale\} \/> \{staleText\(tideStale\)\}/);
  assert.match(ch, /tideStaleTl = tab === 'tide' && hasTide \? tideStaleOf\(vis, now\)/); assert.match(ch, /Tide chart \(\$\{tideStaleTl\.reason === 'saved' \? 'saved copy'/); assert.match(ch, /<StaleTag s=\{tideStaleTl\} \/> \{staleText\(tideStaleTl\)\}/);
  const sp = r('src/features/forecast/SpotPage.tsx'); assert.match(sp, /const ts = tideStaleOf\(dayHours, now\); return ts \? ` · \$\{staleText\(ts\)\}` : ''/);
  // 3 the highs and lows are their own feed: the Now next-turn line and the station card
  assert.match(sp, /\{htSigned\(nextTurn\.height\.value!, p\)\} \{u\}\{savedTurnText\(nextTurn\.height\.source\)\}/); assert.match(sp, /not at the beach\{savedTurnText\(next\[0\]\.height\.source\)\}/);
  // 4 Home: the card's tide words and the Welcome next-tide cell
  assert.match(r('src/features/home/HomeView.tsx'), /\$\{c\.tide\.stale \? ` · \$\{staleWord\(c\.tide\.stale\)\}` : ''\}/); assert.match(r('src/services/homeDash.ts'), /\.\.\.\(hr\.tide\.stale \? \{stale: hr\.tide\.stale\} : \{\}\)/);
  const wl = r('src/features/home/Welcome.tsx'); assert.match(wl, /saved: e\.height\.source\?\.delivery === 'saved'/); assert.match(wl, /\{nextTide\.saved \? ' \(saved data\)' : ''\}/);
  // 5 the map's point panel: one source line when the highs and lows are saved
  const pp = r('src/features/explore/PointPanel.tsx'); assert.match(pp, /savedTurn = turns\.find\(\(e\) => e\.height\.source\?\.delivery === 'saved'\)/); assert.match(pp, /Tide highs and lows\{savedTurnText\(savedTurn\.height\.source\)\}/);
  // 6 the rating's words use the one tide accessor (saved/stale mark included)
  assert.match(sp, /const tv = tideOf\(f, p, nowMs\)/); assert.match(sp, /heightLabel: tv\?\.heightLabel \?\? /);
});

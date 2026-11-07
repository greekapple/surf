import test from 'node:test';
import assert from 'node:assert/strict';
import {HOW_RIGHT_RULE, checkBuoy, anchoredSeries, captureShown, shownSeries, scoreSpot, windowScore, howRightLine, leanText, runHowRight, type BuoyData, type ShownCapture} from '../services/howRight.ts';
import {OBSERVING_BUOYS, type HourSeries} from '../services/accuracy.ts';
import {howRightSpots} from '../services/howRightSpots.ts';
import {createForecastService} from '../../services/forecast-service.mjs';
import {HOW_RIGHT_BUDGET, HOW_RIGHT_KEYS} from '../../services/how-right.mjs';
import {isHowRightTick, CRON} from '../../worker/cloudflare.mjs';

const H = 3600000, D = 86400000, M = 0.3048, NOW = Date.UTC(2026, 10, 7, 0, 30);
const HDR = 'time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],waveHs[unit="meter"],waveTp[unit="second"],waveDp[unit="degreeT"],waveFlagPrimary';
const csv = (name: string, rows: [number, number][]) => [HDR, ...rows.map(([t, ft]) => `${new Date(t).toISOString().replace('.000Z', 'Z')},${name},37.7,-122.6,${(ft * M).toFixed(4)},14,270,1`)].join('\n');
/** A smooth, varying wave height in feet for hour t (so errors are not constant). */
const wave = (t: number) => 4 + 2 * Math.sin(t / (17 * H));
const hours = (from: number, to: number, step = H) => { const a: number[] = []; for (let t = Math.ceil(from / step) * step; t <= to; t += step) a.push(t); return a; };
const series = (ts: number[], f: (t: number) => number): HourSeries => new Map(ts.map((t) => [t, {hs: f(t)}]));
const sfBar = OBSERVING_BUOYS.find((b) => b.id === '142')!;
const OB = {id: 'spot-2', lat: 37.759, lon: -122.51, mopId: 'SF023'};

test('a buoy qualifies only with 200 measured hours and CDIP\'s model right at it (bias ≤ 0.5 ft, MAE ≤ 1 ft on the first 2/3)', () => {
  const ts = hours(NOW - 30 * D, NOW);
  assert.equal(checkBuoy(sfBar, series(ts, wave), series(ts, wave)).right, true);
  assert.equal(checkBuoy(sfBar, series(ts.slice(0, 150), wave), series(ts, wave)).right, false, 'too few measured hours');
  const off = checkBuoy(sfBar, series(ts, wave), series(ts, (t) => wave(t) + 0.8));
  assert.equal(off.right, false); assert.match(off.why, /missed it by 0\.8 ft/);
  // the check uses the FIRST 2/3 only: a model that goes wrong in the last third still qualifies (held-out hours never pick the anchor)
  const late = checkBuoy(sfBar, series(ts, wave), series(ts, (t) => (t > NOW - 8 * D ? wave(t) + 3 : wave(t))));
  assert.equal(late.right, true);
  assert.equal(checkBuoy(sfBar, undefined, undefined).right, false);
});

test('the measurement is carried to the point by MOP\'s own hourly ratio, same hour only, and never over a near-zero buoy-site value', () => {
  const t = NOW - 5 * H, obs: HourSeries = new Map([[t, {hs: 4}], [t + H, {hs: 4}], [t + 2 * H, {hs: 4}]]);
  const a = anchoredSeries(obs, new Map([[t, {hs: 6}], [t + H, {hs: 6}], [t + 2 * H, {hs: 6}]]), new Map([[t, {hs: 5}], [t + 2 * H, {hs: 0.1}]]));
  assert.deepEqual([...a.keys()], [t]); assert.ok(Math.abs(a.get(t)!.hs - 4.8) < 1e-9);
});

test('what we showed: captured from the cached forecast (the next 48 h), and each hour takes the latest retrieval made at least 12 h before it', () => {
  const r = NOW - 2 * H, ts = hours(NOW - 24 * H, NOW + 72 * H, 3 * H);
  const cap = captureShown([{mopId: 'SF023', value: {payload: csv('SF023', ts.map((t) => [t, 5])), retrievedAt: new Date(r).toISOString()}}, {mopId: 'SM375', value: null}, {mopId: 'X', value: {payload: 'not csv', retrievedAt: 'x'}}], NOW);
  assert.deepEqual(Object.keys(cap.points), ['SF023']);
  const kept = Object.keys(cap.points.SF023.hs).map(Date.parse);
  assert.ok(kept.every((t) => t >= NOW && t <= NOW + 48 * H)); assert.equal(kept.length, 16);
  const target = NOW + 30 * H, older: ShownCapture = {schema: 1, capturedAt: '', points: {SF023: {retrievedAt: new Date(target - 40 * H).toISOString(), hs: {[new Date(target).toISOString()]: 3}}}};
  const newer: ShownCapture = {schema: 1, capturedAt: '', points: {SF023: {retrievedAt: new Date(target - 14 * H).toISOString(), hs: {[new Date(target).toISOString()]: 4}}}};
  const tooLate: ShownCapture = {schema: 1, capturedAt: '', points: {SF023: {retrievedAt: new Date(target - 6 * H).toISOString(), hs: {[new Date(target).toISOString()]: 9}}}};
  const s = shownSeries([older, tooLate, newer], 'SF023');
  assert.equal(s.get(target)!.hs, 4); assert.equal(s.get(target)!.leadH, 14);
  assert.equal(shownSeries([tooLate], 'SF023').size, 0, 'a value retrieved under 12 h before the hour is not "what we showed the day before"');
});

test('a window needs 24 paired hours; bias is ours − measured; "typically within" is the median absolute difference', () => {
  const p = Array.from({length: 23}, (_, i) => ({t: NOW - i * H, obs: 4, model: 4.5}));
  assert.equal(windowScore(p, NOW - D * 7, NOW, 7), null);
  const w = windowScore([...p, {t: NOW - 30 * H, obs: 4, model: 1}], NOW - D * 7, NOW, 7)!;
  assert.equal(w.n, 24); assert.equal(w.typicalFt, 0.5); assert.ok(w.biasFt < 0.5 && w.biasFt > 0.3); assert.ok(w.maeFt > 0.5);
  assert.equal(leanText(0.24), 'ran 0.2 ft high'); assert.equal(leanText(-0.3), 'ran 0.3 ft low'); assert.equal(leanText(0.04), 'no lean high or low');
});

function buoyData(over: number, ts: number[], right = true): BuoyData {
  const obs = series(ts, wave), site = series(ts, (t) => wave(t) * (right ? 1 : 1.4));
  return {buoy: sfBar, obs, site, check: checkBuoy(sfBar, obs, site)};
}

test('Ocean Beach: NO number until we have kept 3 days of our own forecasts; then our day-before forecast, scored only after the buoy check\'s cut', () => {
  const ts = hours(NOW - 30 * D, NOW), b = buoyData(1, ts), point = series(ts, (t) => wave(t) * 1.2);
  const waiting = scoreSpot(OB, [b], point, new Map(), NOW);
  assert.equal(waiting.status, 'collecting'); if (waiting.status !== 'collecting') return;
  assert.equal(waiting.buoy.id, '142'); assert.equal(waiting.have, 0); assert.equal(waiting.need, 24);
  assert.ok(!('d7' in waiting) && !('days' in waiting), 'no score is even served while collecting');
  const wl = howRightLine(waiting, '2026-11-07T00:30:00Z');
  assert.equal(wl.hasNumber, false); assert.equal(wl.text, "How right we've been: starts once we've kept 3 days of our own forecasts (kept since Nov 6)."); assert.doesNotMatch(wl.text, /ft/);
  assert.match(howRightLine(waiting, null).text, /start keeping them tonight/);
  // 2 days of 3-hourly shown values: still collecting (16 < 24)
  const two = new Map(hours(NOW - 2 * D, NOW, 3 * H).map((t) => [t, {hs: wave(t) * 1.2 + 0.5, leadH: 20}]));
  assert.equal(scoreSpot(OB, [b], point, two, NOW).status, 'collecting');
  // 3 days of 3-hourly shown values running 0.5 ft high
  const shown = new Map(hours(NOW - 3 * D, NOW, 3 * H).map((t) => [t, {hs: wave(t) * 1.2 + 0.5, leadH: 20}]));
  const s = scoreSpot(OB, [b], point, shown, NOW);
  assert.equal(s.status, 'ok'); if (s.status !== 'ok') return;
  assert.equal(s.leadH, 20); assert.equal(s.d7!.n, 24); assert.equal(s.d7!.biasFt, 0.5); assert.equal(s.d7!.typicalFt, 0.5);
  const line = howRightLine(s, null);
  assert.equal(line.text, 'Our forecast from the day before vs the San Francisco Bar buoy: typically within 0.5 ft, ran 0.5 ft high.'); assert.equal(line.source, 'Buoy height carried to our point SF023 by CDIP\'s model.'); assert.equal(line.hasNumber, true);
  assert.ok(s.days.length >= 3 && s.days.every((d) => d.oursFt > d.measuredFt));
  // shown hours from BEFORE the check's cut (the hours that picked the buoy) are never scored
  const old = new Map([...shown, ...hours(NOW - 29 * D, NOW - 25 * D, 3 * H).map((t) => [t, {hs: 99, leadH: 20}] as [number, {hs: number; leadH: number}])]);
  const s2 = scoreSpot(OB, [b], point, old, NOW);
  assert.equal(s2.status, 'ok'); if (s2.status !== 'ok') return;
  assert.equal(s2.d30!.n, 24, 'the 99 ft pre-cut hours are excluded'); assert.ok(Date.parse(s2.scoredFrom!) >= Date.parse(b.check.cutAt!));
});

test('a failed fetch gets its own reason, never a number', () => {
  const ts = hours(NOW - 30 * D, NOW);
  assert.match(checkBuoy(sfBar, undefined, undefined, HOW_RIGHT_RULE, {obs: true}).why, /could not be fetched today/);
  assert.match(checkBuoy(sfBar, series(ts, wave), undefined, HOW_RIGHT_RULE, {site: true}).why, /could not be fetched today/);
  const r = scoreSpot(OB, [buoyData(1, ts)], null, new Map(), NOW);
  assert.equal(r.status, 'no-buoy'); assert.match(howRightLine(r, null).source!, /could not be fetched today/);
});

test('no qualifying buoy means no number, said plainly with the reason', () => {
  const ts = hours(NOW - 30 * D, NOW), point = series(ts, wave);
  const notRight = scoreSpot(OB, [buoyData(1, ts, false)], point, new Map(), NOW);
  assert.equal(notRight.status, 'no-buoy');
  const l = howRightLine(notRight, null);
  assert.equal(l.hasNumber, false); assert.doesNotMatch(l.text, /\d/); assert.match(l.text, /no buoy can check this spot/); assert.match(l.source!, /San Francisco Bar/); assert.match(l.source!, /missed it/);
  const far = scoreSpot({id: 'cs-salmon-creek', lat: 38.354, lon: -123.068, mopId: 'SN080'}, [buoyData(1, ts)], point, new Map(), NOW);
  assert.equal(far.status, 'no-buoy'); assert.match(howRightLine(far, null).source!, /km away \(our limit is 40 km\)/); assert.match(howRightLine(far, null).source!, /^Nearest is /);
  assert.equal(scoreSpot({id: 'x', lat: 41.7, lon: -124.2, mopId: 'DN194'}, [buoyData(1, ts)], point, new Map(), NOW).status, 'no-buoy');
  assert.equal(scoreSpot({...OB, mopId: null}, [buoyData(1, ts)], point, new Map(), NOW).status, 'no-buoy');
});

/** A fake upstream: SF Bar measures `wave`, CDIP's model at the bar matches it, SF023 sees 1.2×; every other buoy and point is missing. */
function fakeFetch(calls: string[]) {
  return async (u: string) => {
    calls.push(u);
    const url = new URL(u), from = Date.parse(url.searchParams.get('time_start') ?? ''), to = Date.parse(url.searchParams.get('time_end') ?? '');
    const rows = (k: number) => hours(from, to).map((t) => [t, wave(t) * k] as [number, number]);
    if (/realtime\/142p1_rt/.test(u)) return new Response(csv('SAN FRANCISCO BAR, CA BUOY - 142p1', rows(1)));
    if (/BP142_nowcast/.test(u)) return new Response(csv('BP142', rows(1)));
    if (/SF023_nowcast/.test(u)) return new Response(csv('SF023', rows(1.2)));
    return new Response('', {status: 404});
  };
}
function bucket() {
  const objects = new Map<string, string>();
  return {objects, BUCKET: {get: async (k: string) => (objects.has(k) ? {json: async () => JSON.parse(objects.get(k)!)} : null), put: async (k: string, v: string) => { objects.set(k, v); }}};
}

test('runHowRight fetches only CDIP/NDBC (never Open-Meteo), stays inside its budget, and scores every catalogued spot', async () => {
  const calls: string[] = [], f = fakeFetch(calls);
  const card = await runHowRight({get: async (u) => { const r = await f(u); return r.ok ? r.text() : null; }, nowMs: NOW, spots: howRightSpots(), captures: []});
  assert.equal(Object.keys(card.spots).length, howRightSpots().length);
  assert.ok(calls.every((u) => /thredds\.cdip\.ucsd\.edu|ndbc\.noaa\.gov/.test(u)), 'no Open-Meteo call'); assert.ok(calls.length < 80, `${calls.length} fetches`);
  assert.equal(card.spots['spot-2'].status, 'collecting', 'no captures yet: no number'); assert.equal(card.spots['spot-6'].status, 'no-buoy', 'Steamer Lane: no buoy qualifies in this fake month');
  assert.equal(card.rule.anchorKm, HOW_RIGHT_RULE.anchorKm);
});

test('service: /api/how-right is pending until the daily job runs; the job captures what we show, stores the card, and the page then reads it', async () => {
  const calls: string[] = [], b = bucket();
  const fwd = hours(NOW - 24 * H, NOW + 96 * H, 3 * H);
  b.objects.set('forecast/v8/latest/nearshore-SF023-forecast.json', JSON.stringify({payload: csv('SF023', fwd.map((t) => [t, 5])), retrievedAt: new Date(NOW - H).toISOString()}));
  const svc = createForecastService({fetcher: fakeFetch(calls) as typeof fetch, now: () => NOW}) as any, env = {BUCKET: b.BUCKET};
  const pending = await (await svc(new Request('https://x/api/how-right'), env)).json();
  assert.equal(pending.pending, true); assert.equal(calls.length, 0, 'a page view never fetches upstream');
  const rep = await svc.howRight(env);
  assert.equal(rep.ok, true); assert.ok(rep.budget.used <= HOW_RIGHT_BUDGET && rep.budget.used < 200, `used ${rep.budget.used}`);
  const cap = JSON.parse(b.objects.get(HOW_RIGHT_KEYS.shown('2026-11-07'))!);
  assert.deepEqual(Object.keys(cap.points), ['SF023']); assert.ok(Object.keys(cap.points.SF023.hs).length >= 15);
  const card = await (await svc(new Request('https://x/api/how-right'), env)).json();
  assert.equal(card.schema, 1); assert.equal(card.spots['spot-2'].status, 'collecting'); assert.equal(card.shownSince, '2026-11-07T00:30:00.000Z'); assert.equal(card.stored, true);
  const before = calls.length; await svc(new Request('https://x/api/how-right'), env); assert.equal(calls.length, before, 'reading the card costs no upstream call');
});

test('service without a persistent bucket (the Vite preview) computes on demand once and remembers it', async () => {
  const calls: string[] = [], b = bucket(), svc = createForecastService({fetcher: fakeFetch(calls) as typeof fetch, now: () => NOW}) as any, env = {LOCAL_PREVIEW: true, BUCKET: b.BUCKET};
  const a = await (await svc(new Request('https://x/api/how-right'), env)).json(), n = calls.length;
  assert.equal(a.spots['spot-2'].status, 'collecting'); assert.equal(a.stored, false); assert.equal(b.objects.size, 0, 'nothing stored in the preview');
  await svc(new Request('https://x/api/how-right'), env); assert.equal(calls.length, n);
});

test('the daily job takes exactly one 5-minute cron tick a day (00:30 UTC)', () => {
  const day = Date.UTC(2026, 10, 7), ticks = Array.from({length: 288}, (_, i) => day + i * CRON.everyMs).filter(isHowRightTick);
  assert.equal(ticks.length, 1); assert.equal(new Date(ticks[0]).toISOString(), '2026-11-07T00:30:00.000Z');
});

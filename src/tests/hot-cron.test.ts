import test from 'node:test';
import assert from 'node:assert/strict';
import {createForecastService, ingestionTargets, spotOfKey, HOT_PREFIX, HOT_STARTED, HOT_MAX} from '../../services/forecast-service.mjs';
import {CRON} from '../../worker/cloudflare.mjs';
import {cloneSpots, hotBudget} from '../../docs/forecast/data/open-meteo-budget.ts';

const MIN = 60000, T0 = Date.UTC(2026, 11, 9, 12);
/** An in-memory R2 with list(prefix, cursor) and the `uploaded` time of each object. */
function fakeBucket(store: Map<string, string>, up: Map<string, number>, clock: () => number, onOp?: () => void) {
  return {get: async (k: string) => { onOp?.(); return store.has(k) ? {json: async () => JSON.parse(store.get(k)!)} : null; }, head: async (k: string) => { onOp?.(); return store.has(k) ? {} : null; },
    put: async (k: string, v: string) => { onOp?.(); store.set(k, v); up.set(k, clock()); },
    list: async ({prefix, cursor}: {prefix: string; cursor?: string}) => { onOp?.(); const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort(), from = cursor ? +cursor : 0, page = all.slice(from, from + 1000); return {objects: page.map((key) => ({key, uploaded: new Date(up.get(key) ?? 0)})), truncated: from + 1000 < all.length, cursor: String(from + 1000)}; }};
}
function rig(n: number, hot: number, hours = 6) {
  const spots = cloneSpots(n), targets = (ingestionTargets as any)(T0, spots) as {key: string; ttl: number; url: string; field?: unknown; csv?: boolean; das?: boolean; text?: boolean}[], byUrl = new Map(targets.map((t) => [t.url, t]));
  const store = new Map<string, string>(), up = new Map<string, number>(); let ops = 0, fetches = 0, clock = T0;
  store.set(HOT_STARTED, '1'); (spots.slice(0, hot) as any[]).forEach((s, i) => { store.set(HOT_PREFIX + s.id, '1'); up.set(HOT_PREFIX + s.id, T0 - i * 1000); });   // earlier index = requested more recently
  const BUCKET = fakeBucket(store, up, () => clock, () => { ops++; });
  const fetcher = async (url: string) => { fetches++; const t = byUrl.get(String(url)); if (!t || t.field) return new Response('{}', {status: 200});
    const body = t.csv ? 'time,station,x\n' : t.das ? 'NC_GLOBAL {}' : t.text ? '#YY MM DD' : JSON.stringify({hourly: {time: [new Date(clock).toISOString().slice(0, 13) + ':00']}, table: {rows: [[1]]}, features: []});
    return new Response(body, {status: 200, headers: {'content-type': 'text/plain'}}); };
  return {spots, targets, store, run: async () => {
    let peak = 0, omCalls = 0, last: any = null;
    for (let r = 0; r < hours * 12; r++) { clock = T0 + r * CRON.everyMs; ops = 0; fetches = 0;
      const svc = createForecastService({fetcher: fetcher as unknown as typeof fetch, sleep: async () => {}, now: () => clock, spots});
      last = await svc.refresh({BUCKET}, {perRun: CRON.perRun, tick: Math.floor(clock / CRON.everyMs), ahead: CRON.aheadMs, budget: CRON.budget, minAgeMs: CRON.minAgeMs, hotHours: CRON.hotHours});
      if (r >= 12) peak = Math.max(peak, ops + fetches); }
    void omCalls; return {peak, last, clock}; }};
}
test('spotOfKey names the spot of a per-spot Open-Meteo key and nothing else', () => {
  assert.equal(spotOfKey('marine-spot-2'), 'spot-2'); assert.equal(spotOfKey('weather-x-7'), 'x-7'); assert.equal(spotOfKey('spread-a'), 'a');
  assert.equal(spotOfKey('tides'), null); assert.equal(spotOfKey('ndbc-46012'), null); assert.equal(spotOfKey('nearshore-MOP123'), null);
});
// 429 = every app spot (146 + 283 US East): all of them hot is the worst case; the cron counts the newest 180 only, so it costs the same as 180 hot
for (const [n, h] of [[254, 100], [500, 150], [1000, 150], [429, 429]] as const) {
  test(`hot-only cron at ${n} spots, ${h} hot: only hot spots' Open-Meteo targets are fetched, every hot target stays inside its TTL (+20 min), each run under 1,000 subrequests`, async () => {
    const t = rig(n, h), {peak, last, clock} = await t.run();
    if (process.env.SHOW) console.log(`${n} spots, ${h} hot: peak ${peak} subrequests/run; ${JSON.stringify(last.hot)}; ${JSON.stringify(hotBudget(n, h))}`);
    assert.ok(peak <= 1000, `peak ${peak}`); const hh = Math.min(h, HOT_MAX); assert.equal(last.hot.spots, hh); assert.equal(last.hot.skippedCold, 3 * (n - hh));
    const hotIds = new Set(t.spots.slice(0, Math.min(h, HOT_MAX)).map((s: any) => s.id)), om = t.targets.filter((x) => /open-meteo\.com/.test(x.url));
    for (const x of om) { const id = spotOfKey(x.key)!, v = JSON.parse(t.store.get('forecast/v8/latest/' + x.key + '.json') ?? 'null');
      if (!hotIds.has(id)) { assert.equal(v, null, 'a cold spot is not refreshed by the cron: ' + x.key); continue; }
      assert.ok(v && clock - Date.parse(v.retrievedAt) <= x.ttl + 20 * MIN + 5 * MIN, `${x.key} age ${v ? Math.round((clock - Date.parse(v.retrievedAt)) / MIN) : 'none'} min`); }
  });
}
test('a request touches only a KNOWN spot: one object per spot, junk ids and malformed keys write nothing, repeat requests inside the hour write nothing', async () => {
  const spots = cloneSpots(10), store = new Map<string, string>(), up = new Map<string, number>(), puts: string[] = []; let clock = T0;
  const B = fakeBucket(store, up, () => clock), BUCKET = {...B, put: async (k: string, v: string) => { puts.push(k); return B.put(k, v); }};
  const tg = (ingestionTargets as any)(T0, spots) as {key: string}[], pending: Promise<unknown>[] = [], ctx = {waitUntil: (p: Promise<unknown>) => { pending.push(p); }};
  const svc = createForecastService({fetcher: (async () => Response.json({hourly: {time: ['2026-12-09T12:00']}})) as unknown as typeof fetch, sleep: async () => {}, now: () => clock, spots});
  const key = tg.find((t) => t.key.startsWith('marine-'))!.key, id = spotOfKey(key)!, call = async (u: string) => { const r = await svc(new Request('https://x' + u), {BUCKET}, ctx); await Promise.all(pending); return r; };
  assert.equal((await call('/api/provider?key=' + key)).status, 200); assert.ok(store.has(HOT_PREFIX + id) && store.has(HOT_STARTED));
  await call('/api/provider?key=marine-junk-id'); await call('/api/providers?keys=weather-nope,spread-' + id + ',tides'); assert.deepEqual(puts.filter((k) => k.startsWith(HOT_PREFIX)).sort(), [HOT_PREFIX + id], 'only the known spot was recorded');
  const n = puts.length; await call('/api/provider?key=' + key); assert.equal(puts.length, n, 'no rewrite inside the hour'); clock += 61 * MIN; await call('/api/provider?key=' + key); assert.ok(puts.length > n, 'rewritten after an hour');
});
test('cron: a fresh deploy (no hot record yet) refreshes everything; hot = requested in the last 24 h, newest HOT_MAX only', async () => {
  const spots = cloneSpots(40), store = new Map<string, string>(), up = new Map<string, number>(); let clock = T0;
  const BUCKET = fakeBucket(store, up, () => clock), fetcher = (async () => Response.json({hourly: {time: [new Date(T0).toISOString().slice(0, 13) + ':00']}, table: {rows: [[1]]}, features: []})) as unknown as typeof fetch;
  const run = () => createForecastService({fetcher, sleep: async () => {}, now: () => clock, spots}).refresh({BUCKET}, {perRun: 0, tick: 1, ahead: CRON.aheadMs, budget: 4000, minAgeMs: CRON.minAgeMs, hotHours: 24});
  const fresh = await run(); assert.equal(fresh.hot, undefined, 'no hot record yet: every target is refreshed');
  store.set(HOT_STARTED, '1'); const none = await run(); assert.equal(none.hot.spots, 0, 'started but nothing requested in 24 h: nothing hot');
  for (const s of spots.slice(0, 5) as any[]) { store.set(HOT_PREFIX + s.id, '1'); up.set(HOT_PREFIX + s.id, clock - 2 * 3600000); } store.set(HOT_PREFIX + (spots[6] as any).id, '1'); up.set(HOT_PREFIX + (spots[6] as any).id, clock - 30 * 3600000);
  assert.equal((await run()).hot.spots, 5, 'five hot, the one older than 24 h is cold'); assert.equal(HOT_MAX, 180);
});

test('shared targets (tide stations, nearshore points, shore stations, context buoys) follow the spots: refreshed by the cron only while a visitor asked for them; the fixed core stays on', async () => {
  const spots = cloneSpots(20), store = new Map<string, string>(), up = new Map<string, number>(); let clock = T0;
  const BUCKET = fakeBucket(store, up, () => clock), fetcher = (async () => Response.json({hourly: {time: [new Date(T0).toISOString().slice(0, 13) + ':00']}, table: {rows: [[1]]}, features: []})) as unknown as typeof fetch;
  const all = (ingestionTargets as any)(T0, spots) as {key: string}[], shared = all.map((t) => t.key).filter((k) => /^(tide-extrema|tides|shore-ndbc|shore-asos|ndbc|cdip)-|^nearshore-/.test(k)), core = ['tides', 'tide-extrema', 'buoy', 'level'].filter((k) => all.some((t) => t.key === k));
  assert.ok(shared.length > 10 && core.length >= 2, `shared ${shared.length}, core ${core.join()}`);
  store.set(HOT_STARTED, '1'); const warm = shared.find((k) => k.startsWith('tides-')) ?? shared[0], group = warm.replace(/^nearshore-(.+)-(forecast|das)$/, 'nearshore-$1'); store.set(HOT_PREFIX + '~' + group, '1'); up.set(HOT_PREFIX + '~' + group, T0 - 3600000);
  const r = await createForecastService({fetcher, sleep: async () => {}, now: () => clock, spots}).refresh({BUCKET}, {perRun: 0, tick: 1, ahead: CRON.aheadMs, budget: 4000, minAgeMs: CRON.minAgeMs, hotHours: 24});
  const keys = r.results.map((x: {key: string}) => x.key);
  for (const k of core) assert.ok(keys.includes(k), 'core stays on: ' + k);
  assert.ok(keys.includes(warm), 'the requested shared target is refreshed: ' + warm); assert.ok(shared.filter((k) => !keys.includes(k)).length >= shared.length - 3, `cold shared targets are skipped: ${shared.filter((k) => keys.includes(k)).length} of ${shared.length} ran`);
});
test('a request for a shared key records its group once; an unknown shared key writes nothing', async () => {
  const spots = cloneSpots(10), store = new Map<string, string>(), up = new Map<string, number>(), B = fakeBucket(store, up, () => T0), puts: string[] = [], BUCKET = {...B, put: async (k: string, v: string) => { puts.push(k); return B.put(k, v); }}, pending: Promise<unknown>[] = [];
  const svc = createForecastService({fetcher: (async () => Response.json({hourly: {time: ['2026-12-09T12:00']}})) as unknown as typeof fetch, sleep: async () => {}, now: () => T0, spots}), ctx = {waitUntil: (p: Promise<unknown>) => { pending.push(p); }};
  const key = ((ingestionTargets as any)(T0, spots) as {key: string}[]).map((t) => t.key).find((k) => k.startsWith('tides-'))!;
  await svc(new Request('https://x/api/provider?key=' + key), {BUCKET}, ctx); await svc(new Request('https://x/api/provider?key=tides-9999999'), {BUCKET}, ctx); await Promise.all(pending);
  assert.deepEqual(puts.filter((k) => k.startsWith(HOT_PREFIX)), [HOT_PREFIX + '~' + key]);
});

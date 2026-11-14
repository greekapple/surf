import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderBatcher, BATCH_MAX, BATCH_PARALLEL, isBatchable} from '../ocean/providerBatch.ts';
import {createForecastService, ingestionTargets, BATCH_MAX as SERVER_MAX, BATCH_UPSTREAM_PARALLEL as BATCH_UPSTREAM} from '../../services/forecast-service.mjs';

const T0 = Date.UTC(2026, 10, 9, 12), wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const body = (key: string) => ({payload: {key, hourly: {time: [T0 / 1000]}}, retrievedAt: new Date(T0).toISOString(), sourceURL: 'https://x.test/' + key, cache: 'fresh'});
const keysOf = (u: string) => decodeURIComponent(new URL('http://x' + u).searchParams.get('keys') ?? '').split(',');

test('batcher: requests in one tick go out as ONE batch request, each caller gets its own key body; the client and server caps agree', async () => {
  assert.equal(BATCH_MAX, SERVER_MAX);
  const calls: string[] = [], f = (async (u: string) => { calls.push(u); return Response.json({results: Object.fromEntries(keysOf(u).map((k) => [k, {status: 200, body: body(k)}]))}); }) as unknown as typeof fetch;
  const b = createProviderBatcher(f, 2), keys = ['marine-spot-2', 'weather-spot-2', 'spread-spot-2', 'ndbc-46012'];
  const rs = await Promise.all(keys.map((k) => b('/api/provider?key=' + k)));
  assert.equal(calls.length, 1); assert.match(calls[0], /^\/api\/providers\?keys=/); assert.deepEqual(keysOf(calls[0]).sort(), [...keys].sort());
  for (let i = 0; i < keys.length; i++) { assert.ok(rs[i].ok); assert.equal((await rs[i].json()).payload.key, keys[i]); }
});
test('batcher: more than the cap is split into chunks; a repeated key is asked once and both callers answered', async () => {
  const calls: string[] = [], f = (async (u: string) => { calls.push(u); return Response.json({results: Object.fromEntries(keysOf(u).map((k) => [k, {status: 200, body: body(k)}]))}); }) as unknown as typeof fetch;
  const b = createProviderBatcher(f, 2), keys = Array.from({length: BATCH_MAX * 2 + 5}, (_, i) => 'marine-k' + i);
  const rs = await Promise.all([...keys, 'marine-k0'].map((k) => b('/api/provider?key=' + k)));
  assert.equal(calls.length, 3, 'ceil(29 / 12) batch requests'); assert.ok(calls.every((c) => keysOf(c).length <= BATCH_MAX));
  assert.equal(new Set(calls.flatMap(keysOf)).size, keys.length); assert.equal((await rs[rs.length - 1].json()).payload.key, 'marine-k0');
});
test('batcher: a failed batch, a missing endpoint and a per-key error all fall back to the single-key request (the old behaviour)', async () => {
  const singles: string[] = [];
  const mk = (batch: (u: string) => Promise<Response>) => createProviderBatcher((async (u: string) => (u.startsWith('/api/providers') ? batch(u) : (singles.push(u), Response.json(body('single'))))) as unknown as typeof fetch, 2);
  singles.length = 0; let rs = await Promise.all(['a', 'b'].map((k) => mk(async () => new Response('x', {status: 404}))('/api/provider?key=' + k))); assert.equal(singles.length, 2); assert.ok(rs.every((r) => r.ok));
  singles.length = 0; const bb = mk(async () => { throw new Error('network'); }); rs = await Promise.all(['a', 'b'].map((k) => bb('/api/provider?key=' + k))); assert.equal(singles.length, 2);
  singles.length = 0; const be = mk(async (u) => Response.json({results: {a: {status: 200, body: body('a')}, b: {status: 502, error: 'cooling'}}})); rs = await Promise.all(['a', 'b'].map((k) => be('/api/provider?key=' + k)));
  assert.deepEqual(singles, ['/api/provider?key=b'], 'only the key that failed is asked again, singly'); assert.equal((await rs[0].json()).payload.key, 'a');
  assert.equal(isBatchable('/api/provider?key=marine-spot-2'), true); assert.equal(isBatchable('/api/grid?field=Thgt'), false); assert.equal(isBatchable('https://x.test/'), false);
  const passthrough: string[] = [], bp = createProviderBatcher((async (u: string) => { passthrough.push(u); return new Response('{}'); }) as unknown as typeof fetch, 2); await bp('/api/health'); assert.deepEqual(passthrough, ['/api/health'], 'a non-provider route is passed straight through');
});

// the production path: the Worker handler behind the batcher, same bodies as the single endpoint
const upstream = (key: string) => (async (u: any) => { const s = String(u); if (/ndbc/.test(s)) return new Response('#YY MM DD hh mm\n'); return Response.json({hourly: {time: [T0 / 1000], wave_height: [1.5], wind_speed_10m: [5]}, k: key}); }) as unknown as typeof fetch;
test('Worker: /api/providers answers the same bodies as /api/provider (marine, weather, spread, buoy), rejects unknown keys and over-cap requests', async () => {
  const svc = createForecastService({fetcher: upstream('x'), now: () => T0, sleep: async () => {}}), get = async (p: string) => svc(new Request('https://surf.test' + p), {});
  const keys = ['marine-spot-2', 'weather-spot-2', 'spread-spot-2', 'marine-cs-crescent-city', 'ndbc-46012'];
  const single = await Promise.all(keys.map(async (k) => (await get('/api/provider?key=' + k)).json())), res = await get('/api/providers?keys=' + keys.join(',')); assert.equal(res.status, 200);
  const out = (await res.json()).results;
  for (let i = 0; i < keys.length; i++) { assert.equal(out[keys[i]].status, 200); const a = single[i], bb = out[keys[i]].body; assert.deepEqual(bb.payload, a.payload); assert.equal(bb.retrievedAt, a.retrievedAt); assert.equal(bb.sourceURL, a.sourceURL); assert.equal(bb.model, a.model); }
  const bad = (await (await get('/api/providers?keys=marine-spot-2,nope')).json()).results; assert.equal(bad['nope'].status, 400); assert.equal(bad['marine-spot-2'].status, 200);
  assert.equal((await get('/api/providers')).status, 400); assert.equal((await get('/api/providers?keys=' + Array.from({length: SERVER_MAX + 1}, (_, i) => 'k' + i).join(','))).status, 400);
  assert.equal((await get('/api/providers?keys=' + keys.join(','))).headers.get('cache-control'), 'no-store');
});
test('Worker: one failing provider does not fail the batch, and the batcher asks that key again singly', async () => {
  const up = (async (u: any) => { if (/marine/.test(String(u)) && /latitude=37\.75&/.test(String(u))) return new Response('no', {status: 500}); return Response.json({hourly: {time: [T0 / 1000], wave_height: [1], wind_speed_10m: [4]}}); }) as unknown as typeof fetch;
  const svc = createForecastService({fetcher: up, now: () => T0, sleep: async () => {}}); const seen: string[] = [];
  const b = createProviderBatcher((async (u: string) => { seen.push(u); return svc(new Request('https://surf.test' + u), {}); }) as unknown as typeof fetch, 2);
  const [bad, good] = await Promise.all([b('/api/provider?key=marine-spot-2'), b('/api/provider?key=weather-spot-2')]);
  assert.ok(seen[0].startsWith('/api/providers?keys=')); assert.equal(good.ok, true); assert.equal(bad.ok, false, 'the single endpoint reports the same upstream failure the old path saw'); assert.ok(seen.includes('/api/provider?key=marine-spot-2'));
});
test('browser to Worker: 6 spots x 3 provider values = 18 single requests before, ceil(18 / 12) = 2 batch requests now', async () => {
  const svc = createForecastService({fetcher: upstream('x'), now: () => T0, sleep: async () => {}}), ids = (ingestionTargets(T0) as {key: string}[]).map((t) => t.key).filter((k) => /^(marine|weather|spread)-/.test(k)).slice(0, 18);
  let requests = 0; const b = createProviderBatcher((async (u: string) => { requests++; return svc(new Request('https://surf.test' + u), {}); }) as unknown as typeof fetch, 2);
  const rs = await Promise.all(ids.map((k) => b('/api/provider?key=' + k))); await wait(5);
  assert.ok(rs.every((r) => r.ok)); assert.equal(ids.length, 18); assert.equal(requests, Math.ceil(18 / BATCH_MAX));
});
test('a cold batch is bounded: at most 3 keys of a batch are fetched upstream at once, and at most 2 batch requests are in flight', async () => {
  let live = 0, peak = 0; const up = (async () => { live++; peak = Math.max(peak, live); await wait(8); live--; return Response.json({hourly: {time: [T0 / 1000], wave_height: [1], wind_speed_10m: [4]}}); }) as unknown as typeof fetch;
  const svc = createForecastService({fetcher: up, now: () => T0, sleep: async () => {}}), keys = (ingestionTargets(T0) as {key: string}[]).map((t) => t.key).filter((k) => /^marine-/.test(k)).slice(0, BATCH_MAX);
  const r = await svc(new Request('https://surf.test/api/providers?keys=' + keys.join(',')), {}); assert.equal(r.status, 200); assert.ok(peak <= BATCH_UPSTREAM, `upstream concurrency ${peak}`); assert.ok(peak >= 2, 'but it is still parallel');
  let inflight = 0, peakB = 0; const b = createProviderBatcher((async (u: string) => { inflight++; peakB = Math.max(peakB, inflight); await wait(6); inflight--; return Response.json({results: Object.fromEntries(keysOf(u).map((k) => [k, {status: 200, body: body(k)}]))}); }) as unknown as typeof fetch, 2);
  await Promise.all(Array.from({length: BATCH_MAX * 5}, (_, i) => b('/api/provider?key=marine-p' + i))); assert.ok(peakB <= BATCH_PARALLEL && peakB >= 2, `batch requests in flight ${peakB}`);
});
// cold-tail (docs/specs/2026-11-14-cold-tail.md): three stuck CDIP MOP keys held the whole batch until the browser's 20 s abort
test('Worker: stuck keys answer at the per-key deadline (504, or the saved copy marked stale) and do not hold the other keys', async () => {
  const stuck = /SF015|SF053|SM402/;
  const up = (async (u: any) => { const s = String(u); if (stuck.test(s)) return new Promise(() => {}); if (/ndbc/.test(s)) return new Response('#YY MM DD hh mm\n'); return Response.json({hourly: {time: [T0 / 1000], wave_height: [1.5], wind_speed_10m: [5]}}); }) as unknown as typeof fetch;
  const svc = createForecastService({fetcher: up, now: () => T0, sleep: async () => {}, keyDeadlineMs: 40});
  const keys = ['nearshore-SF015-forecast', 'nearshore-SF053-forecast', 'nearshore-SM402-forecast', 'marine-spot-2', 'weather-spot-2', 'ndbc-46012'];
  const t = Date.now(), out = (await (await svc(new Request('https://surf.test/api/providers?keys=' + keys.join(',')), {})).json()).results, took = Date.now() - t;
  assert.ok(took < 1000, `answered in ${took} ms`);
  for (const k of keys.slice(0, 3)) { assert.equal(out[k].status, 504); assert.equal(out[k].category, 'timeout'); }
  for (const k of keys.slice(3)) assert.equal(out[k].status, 200, k);
});
test('Worker: a refresh that never settles (its request was cancelled) is not joined forever; past the age limit a fresh refresh starts', async () => {
  let clock = T0, calls = 0;
  const up = (async () => { calls++; if (calls === 1) return new Promise(() => {}); return Response.json({hourly: {time: [T0 / 1000], wave_height: [1.5], wind_speed_10m: [5]}}); }) as unknown as typeof fetch;
  const svc = createForecastService({fetcher: up, now: () => clock, sleep: async () => {}, timeoutMs: 1000});
  const first = svc(new Request('https://surf.test/api/provider?key=marine-spot-2'), {}); void first; await wait(5);
  assert.equal(calls, 1);
  clock += 1000 * 2 + 2001;
  const res = await svc(new Request('https://surf.test/api/provider?key=marine-spot-2'), {});
  assert.equal(res.status, 200); assert.equal(calls, 2);
});

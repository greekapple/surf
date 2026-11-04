import test from 'node:test';
import assert from 'node:assert/strict';
import {createForecastService, ingestionTargets} from '../../services/forecast-service.mjs';

// T-129: the cron path refreshes one rotating slice per run (Workers free plan: 50 subrequests per invocation).
function service() { const calls: string[] = []; const fetcher = async (url: string) => { calls.push(String(url)); return new Response('x', {status: 503}); }; const svc = createForecastService({fetcher: fetcher as unknown as typeof fetch, sleep: async () => {}, now: () => Date.UTC(2026, 10, 4, 12)}); return {svc, calls}; }

test('a cron slice touches at most perRun targets and the slices together cover every target exactly once', async () => {
  const all = ingestionTargets(Date.UTC(2026, 10, 4, 12)).map((t: {key: string}) => t.key), perRun = 24, count = Math.ceil(all.length / perRun), seen: string[] = [];
  for (let tick = 0; tick < count; tick++) { const {svc} = service(); const r = await svc.refresh({}, {perRun, tick, ahead: 2400000}); assert.ok(r.results.length <= perRun, `slice ${tick}: ${r.results.length}`); assert.equal(r.slice.of, count); assert.equal(r.slice.index, tick); seen.push(...r.results.map((x: {key: string}) => x.key)); }
  assert.equal(new Set(seen).size, all.length); assert.equal(seen.length, all.length);
});

test('the tick wraps around (slice = tick mod count) and a full refresh with no options still runs every target', async () => {
  const {svc} = service(), count = Math.ceil(ingestionTargets(Date.UTC(2026, 10, 4, 12)).length / 24);
  const a = await svc.refresh({}, {perRun: 24, tick: 3}), {svc: s2} = service(), b = await s2.refresh({}, {perRun: 24, tick: 3 + count});
  assert.deepEqual(a.results.map((x: {key: string}) => x.key), b.results.map((x: {key: string}) => x.key));
  const {svc: s3} = service(), full = await s3.refresh({}); assert.equal(full.slice, undefined); assert.equal(full.results.length, ingestionTargets(Date.UTC(2026, 10, 4, 12)).length);
});

test('refresh-ahead: a stored value that would expire within `ahead` is fetched again, a younger one is not', async () => {
  const t = ingestionTargets(Date.UTC(2026, 10, 4, 12)).find((x: {field?: unknown; ttl: number}) => !x.field)!;
  const store = new Map<string, string>(), BUCKET = {get: async (k: string) => (store.has(k) ? {json: async () => JSON.parse(store.get(k)!)} : null), put: async (k: string, v: string) => { store.set(k, v); }};
  const retrieved = new Date(Date.UTC(2026, 10, 4, 12) - (t.ttl - 20 * 60000)).toISOString(); // 20 minutes of life left
  store.set('forecast/v8/latest/' + t.key + '.json', JSON.stringify({retrievedAt: retrieved, payload: {}}));
  let n = 0; const fetcher = async () => { n++; return new Response('x', {status: 503}); };
  const mk = () => createForecastService({fetcher: fetcher as unknown as typeof fetch, sleep: async () => {}, now: () => Date.UTC(2026, 10, 4, 12)});
  const svc = mk(); const fresh = await svc.refresh({BUCKET}, {perRun: 1000, tick: 0, ahead: 0}); const f1 = fresh.results.find((x: {key: string}) => x.key === t.key);
  assert.equal(f1.state, 'available'); assert.equal(n >= 1, true); // this target is served from the bucket without being fetched (others are fetched and fail)
  const calls0 = n; const svc2 = mk(); const ahead = await svc2.refresh({BUCKET}, {perRun: 1000, tick: 0, ahead: 30 * 60000}); const f2 = ahead.results.find((x: {key: string}) => x.key === t.key);
  assert.ok(n > calls0); assert.notEqual(f2.state, 'available', 'with ahead 30 min the 20-minutes-left value is fetched again (the stub answers 503 so it is retained as stale)');
});

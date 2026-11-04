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

// T-129b (Codex P1s)
import {dueAfter} from '../../services/forecast-service.mjs';
const MIN = 60000, CRON_OPTS = {ahead: 40 * MIN, minAgeMs: (t: {url: string}) => (/open-meteo\.com|thredds\.cdip\.ucsd\.edu/.test(t.url) ? 60 * MIN : 0)};

test('P1-1: a target retrieved just now is NOT due on the next 5-minute run, for every TTL class; and it is due before its TTL ends', () => {
  const targets = ingestionTargets(Date.UTC(2026, 10, 4, 12)) as {ttl: number; url: string; key: string}[], ttls = [...new Set(targets.map((t) => t.ttl))];
  assert.ok(ttls.length >= 5, 'the TTL classes: ' + ttls.map((x) => x / MIN).join(', '));
  for (const t of targets) { const due = dueAfter(t, CRON_OPTS); assert.ok(due > 5 * MIN, `${t.key}: due after ${due / MIN} min must exceed the 5-minute cron step`); assert.ok(due <= Math.max(t.ttl, 60 * MIN), `${t.key}: due ${due / MIN} min vs ttl ${t.ttl / MIN} min`); }
  for (const ttl of ttls) { const t = {ttl, url: 'https://example.org/x', key: 'k'}; assert.ok(dueAfter(t, {ahead: 40 * MIN}) >= 0.7 * ttl - 1 && dueAfter(t, {ahead: 40 * MIN}) < ttl, `ttl ${ttl / MIN}`); }
  assert.equal(dueAfter({ttl: 30 * MIN, url: ''}, {}), 30 * MIN, 'a visitor request (no opts) uses the plain TTL');
});

test('P1-1: the per-day upstream calls stay inside the free tiers (Open-Meteo, as the cron refreshes them)', () => {
  const targets = ingestionTargets(Date.UTC(2026, 10, 4, 12)) as {ttl: number; url: string}[], perDay: Record<string, number> = {};
  for (const t of targets) { const interval = Math.ceil(dueAfter(t, CRON_OPTS) / (5 * MIN)) * 5 * MIN, host = new URL(t.url).hostname; perDay[host] = (perDay[host] ?? 0) + 86400000 / interval; }
  const om = (perDay['marine-api.open-meteo.com'] ?? 0) + (perDay['api.open-meteo.com'] ?? 0);
  assert.ok(om < 4000, `Open-Meteo ${Math.round(om)} calls/day (free tier 10,000)`); assert.ok((perDay['thredds.cdip.ucsd.edu'] ?? 0) < 2500);
});

test('P1-2: a budgeted cold fill never exceeds the subrequest budget (fetches plus R2 operations) in one run', async () => {
  let fetches = 0, ops = 0; const store = new Map<string, string>();
  const BUCKET = {get: async (k: string) => { ops++; return store.has(k) ? {json: async () => JSON.parse(store.get(k)!)} : null; }, put: async (k: string, v: string) => { ops++; store.set(k, v); }};
  const fetcher = async () => { fetches++; return new Response('x', {status: 503}); };
  const svc = createForecastService({fetcher: fetcher as unknown as typeof fetch, sleep: async () => {}, now: () => Date.UTC(2026, 10, 4, 12)});
  const r = await svc.refresh({BUCKET}, {...CRON_OPTS, budget: 800});
  assert.ok(fetches + ops <= 1000, `one run used ${fetches + ops} subrequests (fetches ${fetches}, R2 ops ${ops}), limit 1000`);
  assert.ok(r.budget.deferred > 0, 'a cold fill is deferred to later runs'); assert.equal(r.results.length + r.budget.deferred, ingestionTargets(Date.UTC(2026, 10, 4, 12)).length);
});

// T-129c (Codex P1): every cron run may start in a NEW isolate with no memory; the tail of the targets must not starve.
test('P1-3: successive runs with NEW service instances on the same bucket complete a cold fill, stay under the budget each run, and a warm run is nearly free', async () => {
  const NOWMS = Date.UTC(2026, 10, 4, 12), targets = ingestionTargets(NOWMS) as {key: string; url: string; field?: unknown; csv?: boolean; das?: boolean; text?: boolean}[], byUrl = new Map(targets.map((t) => [t.url, t]));
  const store = new Map<string, string>(); let ops = 0, fetches = 0;
  const BUCKET = {get: async (k: string) => { ops++; return store.has(k) ? {json: async () => JSON.parse(store.get(k)!)} : null; }, put: async (k: string, v: string) => { ops++; store.set(k, v); }};
  const fetcher = async (url: string) => { fetches++; const t = byUrl.get(String(url));
    if (!t || t.field) return new Response('{}', {status: 200});
    const body = t.csv ? 'time,station,x\n' : t.das ? 'NC_GLOBAL {}' : t.text ? '#YY MM DD' : JSON.stringify({hourly: {time: ['2026-11-04T12:00']}, table: {rows: [[1]]}});
    return new Response(body, {status: 200, headers: {'content-type': t.csv || t.das || t.text ? 'text/plain' : 'application/json'}}); };
  const wanted = targets.filter((t) => !t.field).map((t) => 'forecast/v8/latest/' + t.key + '.json'), perRun: number[] = [];
  let full = -1;
  for (let run = 0; run < 12; run++) {
    const svc = createForecastService({fetcher: fetcher as unknown as typeof fetch, sleep: async () => {}, now: () => NOWMS}); ops = 0; fetches = 0;
    const r = await svc.refresh({BUCKET}, {...CRON_OPTS, budget: 800, tick: run}); perRun.push(ops + fetches);
    assert.ok(ops + fetches <= 1000, `run ${run}: ${ops + fetches} subrequests`);
    if (full < 0 && wanted.every((k) => store.has(k))) { full = run; assert.ok(r.budget.start !== undefined); }
  }
  if (process.env.SHOW) console.log('cold fill complete after run', full + 1, '; subrequests per run', perRun.join(','));
  assert.ok(full >= 0 && full <= 6, `the cold fill completed in ${full + 1} runs (${perRun.join(', ')} subrequests per run)`);
  assert.ok(perRun[11] < 40, `a warm run costs ${perRun[11]} subrequests (the index object, no per-target reads)`);
});

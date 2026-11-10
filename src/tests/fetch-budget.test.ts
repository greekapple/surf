import test from 'node:test';
import assert from 'node:assert/strict';
import {createForecastService, ingestionTargets, dueAfter} from '../../services/forecast-service.mjs';
import {CRON} from '../../worker/cloudflare.mjs';
import {budget, cloneSpots} from '../../docs/forecast/data/open-meteo-budget.ts';
import {MARINE_MAX_AGE_MS, MAX_AGE_MS} from '../services/freshness.ts';

const MIN = 60000, T0 = Date.UTC(2026, 11, 9, 12);

test('Open-Meteo budget (WEIGHTED by Open-Meteo\'s own call formula): marine 3 h, weather 1 h, spread 3 h with 3 models = 41.6 calls per spot per day; 150 spots fit, ~240 is the ceiling', () => {
  const ts = ingestionTargets(T0) as {key: string; ttl: number}[], ttl = (p: string) => ts.find((t) => t.key.startsWith(p))!.ttl;
  assert.equal(ttl('marine-'), 3 * 60 * MIN); assert.equal(ttl('weather-'), 60 * MIN); assert.equal(ttl('spread-'), 3 * 60 * MIN);
  const b45 = budget(45), b64 = budget(64), b95 = budget(95);
  for (const b of [b45, b64, b95]) assert.ok(Math.abs(b.perSpotCron - 41.6) < 0.01, `${b.spots}: ${b.perSpotCron} per spot (8 marine x 1.0 + 24 weather x 1.0 + 8 spread x 1.2)`);
  assert.ok(b64.cronPerDay < 5000, `64 spots: ${b64.cronPerDay}`); assert.ok(b95.cronPerDay < 5000, `95 spots: ${b95.cronPerDay}`); assert.ok(b95.visitorPerDay < 10000);
  assert.ok(budget(150).cronPerDay < 6300, 'about 150 spots fit comfortably under the 10,000 free calls'); assert.ok(budget(240).cronPerDay < 10000 && budget(250).cronPerDay > 10000, 'the flat ceiling is ~240 spots; beyond it needs tiers or a paid plan');
  if (process.env.SHOW) console.log([b45, b64, b95].map((b) => `${b.spots} spots: ${Math.round(b.cronPerDay)}/day cron, ${Math.round(b.visitorPerDay)}/day TTL-only, ${b.targets} targets`).join('\n'));
});

test('freshness: the weather cadence (1 h + a 5-minute tick) stays inside the 2 h rule; marine (3 h) inside its own 4 h limit; spread (3 h) inside its 4 h limit', () => {
  const ts = ingestionTargets(T0) as {key: string; ttl: number; url: string}[], TICK = CRON.everyMs;
  const worst = (p: string) => { const t = ts.find((x) => x.key.startsWith(p))!; return Math.max(t.ttl, Math.ceil(dueAfter(t, {ahead: CRON.aheadMs, minAgeMs: CRON.minAgeMs}) / TICK) * TICK) + 2 * TICK; };
  assert.ok(worst('weather-') <= MAX_AGE_MS - 30 * MIN, `weather worst age ${worst('weather-') / MIN} min`);
  assert.ok(worst('spread-') <= MARINE_MAX_AGE_MS - 30 * MIN, `spread worst age ${worst('spread-') / MIN} min`);
  assert.ok(worst('marine-') <= MARINE_MAX_AGE_MS - 30 * MIN, `marine worst age ${worst('marine-') / MIN} min`);
});

// The cron at 64 and 95 spots, warm and in steady state: every target is re-fetched inside its TTL (plus the cron step) and no run exceeds the subrequest budget.
// FLAT cadence = every spot refreshed on every cycle: the history of how far the Worker could go before the hot/cold tiers. It is NOT the production path any more: production refreshes only the spots someone asked for in the last 24 h (capped at HOT_MAX = 180) and the production sizing at 492 spots lives in hot-cron.test.ts.
// The flat ceiling moved down when Hawaii added 18 hilo tide stations to the always-on targets: 180 still holds, 200 now starves marine (asserted below as a known limit, not hidden). It already fails at the full catalogue (384+), which is why production does not use it.
const FLAT_STARVES_AT = 200;
for (const n of [64, 95, 146, 180, FLAT_STARVES_AT]) {
  test(`cron at ${n} spots: every Open-Meteo target stays inside its TTL (+25 min: the 5-minute tick plus budget deferral at 146+ spots; the freshness limits are 4 h marine and 2 h weather) and each run stays under 1,000 subrequests (flat cadence, history)`, async () => {
    const spots = cloneSpots(n), targets = (ingestionTargets as any)(T0, spots) as {key: string; ttl: number; url: string; field?: unknown; csv?: boolean; das?: boolean; text?: boolean}[], byUrl = new Map(targets.map((t) => [t.url, t]));
    const store = new Map<string, string>(); let ops = 0, fetches = 0, clock = T0;
    const BUCKET = {get: async (k: string) => { ops++; return store.has(k) ? {json: async () => JSON.parse(store.get(k)!)} : null; }, put: async (k: string, v: string) => { ops++; store.set(k, v); }};
    const fetcher = async (url: string) => { fetches++; const t = byUrl.get(String(url)); if (!t || t.field) return new Response('{}', {status: 200});
      const body = t.csv ? 'time,station,x\n' : t.das ? 'NC_GLOBAL {}' : t.text ? '#YY MM DD' : JSON.stringify({hourly: {time: [new Date(clock).toISOString().slice(0, 13) + ':00']}, table: {rows: [[1]]}, features: []});
      return new Response(body, {status: 200, headers: {'content-type': 'text/plain'}}); };
    const om = targets.filter((t) => /open-meteo\.com/.test(t.url)), maxAge: Record<string, number> = {}; let peak = 0, om_calls = 0;
    for (let run = 0; run < 12 * 9; run++) {   // nine hours of 5-minute ticks
      clock = T0 + run * CRON.everyMs; ops = 0; fetches = 0;
      const svc = createForecastService({fetcher: fetcher as unknown as typeof fetch, sleep: async () => {}, now: () => clock, spots});
      await svc.refresh({BUCKET}, {perRun: CRON.perRun, tick: Math.floor(clock / CRON.everyMs), ahead: CRON.aheadMs, budget: CRON.budget, minAgeMs: CRON.minAgeMs});
      if (run >= 12) { peak = Math.max(peak, ops + fetches); for (const t of om) { const v = JSON.parse(store.get('forecast/v8/latest/' + t.key + '.json') ?? 'null'); const age = v ? clock - Date.parse(v.retrievedAt) : Infinity; const k = t.key.split('-')[0]; maxAge[k] = Math.max(maxAge[k] ?? 0, age); } }
    }
    if (process.env.SHOW) console.log(`${n} spots: peak ${peak} subrequests in one run; max age (min) ${Object.entries(maxAge).map(([k, v]) => k + ' ' + Math.round(v / MIN)).join(', ')}`);
    assert.ok(peak <= 1000, `peak ${peak} subrequests`);
    if (n === FLAT_STARVES_AT) { assert.equal(maxAge.marine, Infinity, 'flat cadence at 200 spots no longer reaches every marine target in 9 h: known limit, production uses hot/cold'); return; }
    for (const [k, age] of Object.entries(maxAge)) { const ttl = om.find((t) => t.key.startsWith(k + '-'))!.ttl; assert.ok(age <= ttl + 25 * MIN, `${k}: oldest value ${Math.round(age / MIN)} min vs TTL ${ttl / MIN} min`); }
    void om_calls;
  });
}

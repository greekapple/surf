// Open-Meteo calls per day, computed from the service's own targets and TTLs (spot-expansion spec 2026-11-08; free tier 10,000/day).
// Two readings per target: `visitor` = one fetch per TTL (a cold cache that visitors keep refilling), `cron` = what the Cloudflare cron actually does
// (dueAfter with its refresh-ahead and the one-hour politeness floor, rounded up to the 5-minute tick).
// The model clones the 45 service spots to the requested count (the marine/weather/spread targets are per spot; MOP, tide and other targets do not use Open-Meteo).
// WEIGHTED: Open-Meteo counts a call as max(1, variables x models / 10 [x days / 14 beyond two weeks]) per location (the formula in the calculator on https://open-meteo.com/en/pricing, read 2026-11-09),
// so a multi-model request costs more than 1 and NINE-locations-in-one-request costs nine: multi-location requests save HTTP requests, not quota.
// Usage: node docs/forecast/data/open-meteo-budget.ts [spots ...]   e.g. 45 64 95 150 250 500
import {ingestionTargets, dueAfter, serviceSpots} from '../../../services/forecast-service.mjs';
import {CRON} from '../../../worker/cloudflare.mjs';

const OM = /open-meteo\.com/, DAY = 86400000, TICK = CRON.everyMs;
export const cronOpts = {ahead: CRON.aheadMs, minAgeMs: CRON.minAgeMs};
export function cloneSpots(n: number) { return Array.from({length: n}, (_, i) => (i < serviceSpots.length ? serviceSpots[i] : {...serviceSpots[i % serviceSpots.length], id: `x-${i}`})); }
/** Open-Meteo's own call weight of one request URL (pricing-page calculator): variables x models / 10, scaled by days / 14 past two weeks, at least 1, times the number of locations. */
export function callWeight(url: string): number {
  const u = new URL(url), list = (k: string) => (u.searchParams.get(k) ?? '').split(',').filter(Boolean), locs = Math.max(1, list('latitude').length);
  const vars = list('hourly').length + list('daily').length + list('current').length, models = Math.max(1, list('models').length), days = Number(u.searchParams.get('forecast_days') ?? 7) + Number(u.searchParams.get('past_days') ?? 0);
  const n = (vars * models) / 10; return Math.max(1, Math.max(n, (days / 14) * n)) * locs;
}
export interface Budget {spots: number; targets: number; perKind: Record<string, {perDay: number; visitorPerDay: number}>; cronPerDay: number; visitorPerDay: number; perSpotCron: number}
export function budget(n: number, now = Date.UTC(2026, 10, 9, 12)): Budget {
  const ts = (ingestionTargets as any)(now, cloneSpots(n)) as {key: string; ttl: number; url: string}[], perKind: Budget['perKind'] = {};
  let cron = 0, visitor = 0;
  for (const t of ts) {
    if (!OM.test(t.url)) continue;
    const w = callWeight(t.url), kind = t.key.split('-')[0], c = (w * DAY) / (Math.ceil((dueAfter as any)(t, cronOpts) / TICK) * TICK), v = (w * DAY) / t.ttl;
    (perKind[kind] ??= {perDay: 0, visitorPerDay: 0}).perDay += c; perKind[kind].visitorPerDay += v; cron += c; visitor += v;
  }
  return {spots: n, targets: ts.length, perKind, cronPerDay: cron, visitorPerDay: visitor, perSpotCron: cron / n};
}
/** Hot/cold (subset loading, implemented): the cron refreshes only the `hot` spots (requested in the last 24 h); a cold spot is fetched when someone opens it, at most once per TTL. `cron` = hot x per-spot cron calls (steady state, every hot spot at its cron cadence); `worstOnDemand` = every cold spot ALSO opened every TTL (the visitor ceiling, i.e. when all N are requested the cron has nothing left to save: that spot is then hot). */
export function hotBudget(n: number, hot: number) { const b = budget(n), perSpotVisitor = b.visitorPerDay / n; return {spots: n, hot, cron: Math.round(hot * b.perSpotCron), worstOnDemand: Math.round((n - hot) * perSpotVisitor), flat: Math.round(b.cronPerDay)}; }
if (process.argv[1]?.endsWith('open-meteo-budget.ts')) {
  const ns = process.argv.slice(2).map(Number).filter(Boolean); if (!ns.length) ns.push(45, 64, 95);
  console.log('WEIGHTED Open-Meteo calls per day (10,000 free)\nspots  targets  calls/day (cron)  calls/day (TTL only)  per spot (cron)   marine + weather + spread (cron)');
  for (const n of ns) { const b = budget(n); console.log(`${String(n).padEnd(6)} ${String(b.targets).padEnd(8)} ${String(Math.round(b.cronPerDay)).padEnd(16)} ${String(Math.round(b.visitorPerDay)).padEnd(21)} ${b.perSpotCron.toFixed(1).padEnd(17)} ${['marine', 'weather', 'spread'].map((k) => Math.round(b.perKind[k]?.perDay ?? 0)).join(' + ')}`); }
  // Policies beyond what one flat cadence allows (arithmetic on the per-spot costs above; not implemented): hot spots keep the flat cadence, cold spots refresh marine every 6 h and weather every 3 h with no spread (12 calls a day), unopened spots 0.
  console.log('\nhot/cold as implemented (cron = hot spots only):'); for (const [N, H] of [[254, 100], [254, 150], [500, 100], [500, 150], [1000, 100], [1000, 150]]) { const h = hotBudget(N, H); console.log(`  N=${N} hot=${H}: cron ${h.cron}/day (flat would be ${h.flat}); cold spots add 0 unless opened (every cold spot opened every TTL: +${h.worstOnDemand})`); }
  const per = budget(45).perSpotCron, cold = (4 * 1) + (8 * 1);
  console.log(`\npolicy sketch: flat ${per.toFixed(1)} calls/spot/day; hot/cold = H x ${per.toFixed(1)} + (N - H) x ${cold}:`);
  for (const [N, H] of [[150, 150], [250, 100], [500, 100], [500, 150], [1000, 150]]) console.log(`  N=${N} H=${H}: ${Math.round(H * per + (N - H) * cold)}/day${N === H ? ' (all hot)' : ''}`);
}

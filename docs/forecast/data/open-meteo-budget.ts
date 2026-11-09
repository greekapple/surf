// Open-Meteo calls per day, computed from the service's own targets and TTLs (spot-expansion spec 2026-11-08; free tier 10,000/day).
// Two readings per target: `visitor` = one fetch per TTL (a cold cache that visitors keep refilling), `cron` = what the Cloudflare cron actually does
// (dueAfter with its refresh-ahead and the one-hour politeness floor, rounded up to the 5-minute tick).
// The model clones the 45 service spots to the requested count (the marine/weather/spread targets are per spot; MOP, tide and other targets do not use Open-Meteo).
// Usage: node docs/forecast/data/open-meteo-budget.ts [spots ...]   e.g. 45 64 95
import {ingestionTargets, dueAfter, serviceSpots} from '../../../services/forecast-service.mjs';
import {CRON} from '../../../worker/cloudflare.mjs';

const OM = /open-meteo\.com/, DAY = 86400000, TICK = CRON.everyMs;
export const cronOpts = {ahead: CRON.aheadMs, minAgeMs: CRON.minAgeMs};
export function cloneSpots(n: number) { return Array.from({length: n}, (_, i) => (i < serviceSpots.length ? serviceSpots[i] : {...serviceSpots[i % serviceSpots.length], id: `x-${i}`})); }
export interface Budget {spots: number; targets: number; perKind: Record<string, {perDay: number; visitorPerDay: number}>; cronPerDay: number; visitorPerDay: number; perSpotCron: number}
export function budget(n: number, now = Date.UTC(2026, 10, 9, 12)): Budget {
  const ts = (ingestionTargets as any)(now, cloneSpots(n)) as {key: string; ttl: number; url: string}[], perKind: Budget['perKind'] = {};
  let cron = 0, visitor = 0;
  for (const t of ts) {
    if (!OM.test(t.url)) continue;
    const kind = t.key.split('-')[0], c = DAY / (Math.ceil((dueAfter as any)(t, cronOpts) / TICK) * TICK), v = DAY / t.ttl;
    (perKind[kind] ??= {perDay: 0, visitorPerDay: 0}).perDay += c; perKind[kind].visitorPerDay += v; cron += c; visitor += v;
  }
  return {spots: n, targets: ts.length, perKind, cronPerDay: cron, visitorPerDay: visitor, perSpotCron: cron / n};
}
if (process.argv[1]?.endsWith('open-meteo-budget.ts')) {
  const ns = process.argv.slice(2).map(Number).filter(Boolean); if (!ns.length) ns.push(45, 64, 95);
  console.log('spots  targets  calls/day (cron)  calls/day (TTL only)  per spot (cron)   marine + weather + spread (cron)');
  for (const n of ns) { const b = budget(n); console.log(`${String(n).padEnd(6)} ${String(b.targets).padEnd(8)} ${String(Math.round(b.cronPerDay)).padEnd(16)} ${String(Math.round(b.visitorPerDay)).padEnd(21)} ${b.perSpotCron.toFixed(1).padEnd(17)} ${['marine', 'weather', 'spread'].map((k) => Math.round(b.perKind[k]?.perDay ?? 0)).join(' + ')}`); }
}

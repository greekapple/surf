// Open-Meteo quota of the daily "how right we've been" capture (round 4C), WEIGHTED the way Open-Meteo counts (callWeight: variables x models / 10, at least 1, per location),
// next to the hot/cold refresh it shares the 10,000 calls a day with. Usage: node docs/forecast/data/how-right-all-budget.ts [hot spots] (default 150)
import {callWeight, hotBudget} from './open-meteo-budget.ts';
import {spotPicks, marineBatchURL, windBatchURL} from '../../../services/how-right-all.mjs';
import {HOT_MAX} from '../../../services/forecast-service.mjs';

export interface CaptureBudget {spots: number; hot: number; cold: number; buoys: number; coldMarine: number; coldWind: number; buoyMarine: number; captureCalls: number; refreshCalls: number; total: number; headroom: number; requests: number}
export function captureBudget(hot = 150, spots = 492): CaptureBudget {
  const picks = spotPicks(), buoys = new Set(picks.filter((p: any) => p.choice.ok).map((p: any) => p.choice.pick.buoy.id)).size, hh = Math.min(hot, HOT_MAX), cold = spots - hh;
  const pts = (n: number) => Array.from({length: n}, () => ({lat: 21.6, lon: -158.1})), per = (url: (p: any[]) => string) => callWeight(url(pts(10))) / 10;   // weight of one location in a 10-location request
  const coldMarine = Math.round(cold * per(marineBatchURL)), coldWind = Math.round(cold * per(windBatchURL)), buoyMarine = Math.round(buoys * per(marineBatchURL));
  const captureCalls = coldMarine + coldWind + buoyMarine, refreshCalls = hotBudget(spots, hh).cron;
  return {spots, hot: hh, cold, buoys, coldMarine, coldWind, buoyMarine, captureCalls, refreshCalls, total: refreshCalls + captureCalls, headroom: 10000 - refreshCalls - captureCalls, requests: 2 * Math.ceil(cold / 10) + Math.ceil(buoys / 10)};
}
if (process.argv[1]?.endsWith('how-right-all-budget.ts')) {
  for (const h of (process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [0, 100, 150, 180])) { const b = captureBudget(h); console.log(`hot ${String(b.hot).padEnd(3)}: refresh ${b.refreshCalls} + capture ${b.captureCalls} (cold marine ${b.coldMarine} + cold wind ${b.coldWind} + ${b.buoys} buoy points ${b.buoyMarine}; ${b.requests} HTTP requests) = ${b.total} of 10,000; ${b.headroom} left for visitors' on-demand cold spots`); }
}

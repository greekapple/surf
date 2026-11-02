// T-041 consistency check (NOT validation): breaking estimate v2 (from CDIP MOP SF023 at 10 m) vs v1 (from NDBC 46026 swell) on the same archived hours.
// Run: node --experimental-strip-types docs/forecast/data/compare-v1-v2.ts
import fs from 'node:fs';
import {estimateBreakingV2} from '../../../src/ocean/breakingEstimate.ts';
import {breakingProfile} from '../../../src/ocean/localCalibration.ts';
const dir = new URL('./', import.meta.url).pathname, FT = 1 / 0.3048, P = breakingProfile('spot-2')!;
const mop = new Map<number, {hs: number; tp: number; dp: number}>();
for (const l of fs.readFileSync(dir + 'cdip-mop-sf023-nowcast.csv', 'utf8').trim().split('\n').slice(1)) { const c = l.split(','); if (c[7]?.trim() !== '1') continue; const hs = +c[4], tp = +c[5], dp = +c[6]; if ([hs, tp, dp].every(Number.isFinite)) mop.set(Date.parse(c[0]), {hs: hs * FT, tp, dp}); }
let n = 0, both = 0, v1Only = 0, v2Only = 0, neither = 0, overlap = 0, inside = 0; const ratio: number[] = [], diff: number[] = [], refusals: Record<string, number> = {};
for (const l of fs.readFileSync(dir + 't008-pairs.csv', 'utf8').trim().split('\n').slice(1)) {
  const c = l.split(','), t = Date.parse(c[0]), m = mop.get(t); if (!m) continue; n++;
  const v1ok = c[6] === 'ok', r = estimateBreakingV2({hsFt: m.hs, periodS: m.tp, directionDeg: m.dp, depthM: 10, shoreNormalDeg: 263.49}, P);
  if (!r.ok) refusals[r.code] = (refusals[r.code] ?? 0) + 1;
  if (v1ok && r.ok) { both++; const v1 = +c[7]; ratio.push(r.centralFt / v1); diff.push(r.centralFt - v1); const [lo2, hi2] = r.input.rangeFt!, lo1 = +c[8], hi1 = +c[9]; if (lo2 <= hi1 && hi2 >= lo1) overlap++; if (v1 >= lo2 && v1 <= hi2) inside++; }
  else if (v1ok) v1Only++; else if (r.ok) v2Only++; else neither++;
}
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)];
console.log(`hours paired ${n}; both estimate ${both}; v1 only ${v1Only}; v2 only ${v2Only}; neither ${neither}; v2 refusals ${JSON.stringify(refusals)}`);
console.log(`v2/v1 central ratio: median ${med(ratio).toFixed(2)}, 10th ${q(ratio, .1).toFixed(2)}, 90th ${q(ratio, .9).toFixed(2)}; difference v2−v1 median ${med(diff).toFixed(2)} ft, mean ${(diff.reduce((a, b) => a + b, 0) / diff.length).toFixed(2)} ft`);
console.log(`ranges overlap on ${(100 * overlap / both).toFixed(0)}% of shared hours; v1 central inside v2 range on ${(100 * inside / both).toFixed(0)}%`);

// T-073: range widths before and after, 45 spots x next 72 h, from live free-tier sources (Open-Meteo marine + weather, multi-model spread, CDIP MOP forecast for assigned points).
// "Before" = the legacy fixed band (central x 0.7..1.4, whole feet, min 2 ft); "after" = services/uncertainty.ts, without and with the model spread. Context only: nothing here is validated against observations.
// Run: node --experimental-strip-types docs/forecast/data/range-widths.ts
import {normalizeOpenMeteo, marineURL, weatherURL} from '../../../src/ocean/openMeteo.ts';
import {normalizeNearshore} from '../../../src/ocean/nearshore.ts';
import {mopURL, assignedMopIds, assignmentFor} from '../../../src/ocean/mop.ts';
import {evidenceSpots} from '../../../src/ocean/spots.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {headlineSurf} from '../../../src/services/headlineSurf.ts';
import {dayRange} from '../../../src/services/spotHour.ts';
import {pacificDate} from '../../../src/ocean/time.ts';
import {isDark} from '../../../src/services/daylight.ts';
import {normalizeSpread, modelSpreadURL, setSpreadSeries, clearSpread} from '../../../src/services/modelSpread.ts';
import {allSpots} from '../../../src/data/catalog.ts';
import {defaultProfile} from '../../../src/data/demo.ts';
const get = async (u: string, text = false) => { const r = await fetch(u, {signal: AbortSignal.timeout(60000)}); if (!r.ok) throw new Error(`${r.status}`); return text ? r.text() : r.json(); };
const now = Date.now(), retrieved = new Date(now).toISOString(), profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const mop: Record<string, any> = {}; for (const id of assignedMopIds()) mop[id] = {mopId: id, records: normalizeNearshore(await get(mopURL(id, 'forecast', now), true), retrieved, 'mop', 'forecast').map((r: any) => ({...r, mopId: id})), issue: null, retrievedAt: retrieved, url: 'x'};
const bundle = {nearshore: [], mop} as any;
const rows: {id: string; m: string; before: number; after0: number; after1: number; rel0: number; rel1: number; disagree: boolean; spreadModels: number}[] = [];
const week: Record<string, any> = {}; let spreadMs = 0, spreadCalls = 0, spreadBytes = 0;
for (const s of evidenceSpots) {
  let recs: any[]; try { const [m, w] = [await get(marineURL(s)), await get(weatherURL(s))]; recs = normalizeOpenMeteo(s, m, w, retrieved).map(toLegacy); } catch { continue; }
  const t0 = Date.now(); let spread = normalizeSpread(null, s);
  try { const j = await get(modelSpreadURL(s)); spreadMs += Date.now() - t0; spreadCalls++; spreadBytes += JSON.stringify(j).length; spread = normalizeSpread(j, s); } catch { /* none */ }
  clearSpread(); setSpreadSeries(spread);
  for (const f of recs) {
    const t = Date.parse(f.timestamp); if (t < now - 3600000 || t >= now + 72 * 3600000 || isDark(s.id, f.timestamp)) continue;
    const base = f.evidence?.faceEstimate?.input; if (!base?.rangeFt) continue;
    const a = headlineSurf(s.id, f, {bundle, nowMs: now, observations: [], spread: null}) as any, b = headlineSurf(s.id, f, {bundle, nowMs: now, observations: []}) as any;
    if (a.kind !== 'estimate' || b.kind !== 'estimate') continue;
    // "before": the legacy band around the same central (the v2 central where the MOP point was used)
    const c = a.centralFt as number, lo = Math.max(0, Math.floor(c * 0.7)), hi = Math.ceil(c * 1.4), before = Math.max(hi - lo, 2);
    rows.push({id: s.id, m: a.method, before, after0: a.hiFt - a.loFt, after1: b.hiFt - b.loFt, rel0: (a.hiFt - a.loFt) / ((a.hiFt + a.loFt) / 2), rel1: (b.hiFt - b.loFt) / ((b.hiFt + b.loFt) / 2), disagree: !!b.interval?.disagree, spreadModels: spread.byHour.get(new Date(t).toISOString())?.models ?? 0});
  }
  if (s.id === 'spot-2') { const sp = allSpots.find((x) => x.id === 'spot-2')!; const days = [...new Set(recs.map((r) => pacificDate(r.timestamp)))].slice(0, 8);
    for (const d of days) { const dr = dayRange(sp, recs, d, now, profile, {bundle}); week[d] = dr.typical ? `${dr.typical.loFt}–${dr.typical.hiFt}` : '–'; } }
}
const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; }, mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const f1 = (n: number) => n.toFixed(1), pct = (n: number) => (100 * n).toFixed(0) + '%';
const spots = new Set(rows.map((r) => r.id)); const v2 = rows.filter((r) => r.m === 'mop-v2'), v1 = rows.filter((r) => r.m === 'v1');
console.log(`Spot-hours with an estimate (daylight, next 72 h): ${rows.length} across ${spots.size} spots (v2 ${v2.length}, v1 ${v1.length}).\n`);
console.log('| | before (fixed 0.7–1.4) | after, no model spread | after, with model spread |\n|---|---|---|---|');
console.log(`| median width, ft | ${f1(med(rows.map((r) => r.before)))} | ${f1(med(rows.map((r) => r.after0)))} | ${f1(med(rows.map((r) => r.after1)))} |`);
console.log(`| mean width, ft | ${f1(mean(rows.map((r) => r.before)))} | ${f1(mean(rows.map((r) => r.after0)))} | ${f1(mean(rows.map((r) => r.after1)))} |`);
console.log(`| v2 spot-hours: median width, ft | ${f1(med(v2.map((r) => r.before)))} | ${f1(med(v2.map((r) => r.after0)))} | ${f1(med(v2.map((r) => r.after1)))} |`);
console.log(`| v1 spot-hours: median width, ft | ${f1(med(v1.map((r) => r.before)))} | ${f1(med(v1.map((r) => r.after0)))} | ${f1(med(v1.map((r) => r.after1)))} |`);
console.log(`| width ÷ midpoint (median) | ${pct(med(rows.map((r) => r.before / 1)) / med(rows.map((r) => r.before)) * 0 + 0)} | ${pct(med(rows.map((r) => r.rel0)))} | ${pct(med(rows.map((r) => r.rel1)))} |`);
console.log(`\nWith the spread: ${pct(rows.filter((r) => r.spreadModels >= 2).length / rows.length)} of spot-hours had at least 2 usable models; ${pct(rows.filter((r) => r.disagree).length / rows.length)} are flagged "sources disagree"; narrower than before in ${pct(rows.filter((r) => r.after1 < r.before).length / rows.length)}, equal in ${pct(rows.filter((r) => r.after1 === r.before).length / rows.length)}, wider in ${pct(rows.filter((r) => r.after1 > r.before).length / rows.length)}.`);
console.log(`Extra requests: ${spreadCalls} (one per spot), mean ${(spreadMs / Math.max(1, spreadCalls)).toFixed(0)} ms each, mean ${(spreadBytes / Math.max(1, spreadCalls) / 1024).toFixed(1)} KB.`);
console.log('\nOcean Beach day cards (median daylight hour), after, with model spread:', JSON.stringify(week));

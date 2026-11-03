// T-066: traces the Ocean Beach week day by day: our source data (Open-Meteo marine offshore + primary swell, CDIP MOP SF023 forecast) through to the day-card numbers.
// Live fetch, free public sources, non-commercial. Run: node --experimental-strip-types docs/forecast/data/trace-week.ts
import {normalizeOpenMeteo, marineURL, weatherURL} from '../../../src/ocean/openMeteo.ts';
import {normalizeNearshore} from '../../../src/ocean/nearshore.ts';
import {mopURL} from '../../../src/ocean/mop.ts';
import {evidenceSpot} from '../../../src/ocean/spots.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {pacificDate} from '../../../src/ocean/time.ts';
import {headlineSurf} from '../../../src/services/headlineSurf.ts';
import {dayRange} from '../../../src/services/spotHour.ts';
import {isDark} from '../../../src/services/daylight.ts';
import {allSpots} from '../../../src/data/catalog.ts';
import {defaultProfile} from '../../../src/data/demo.ts';
const get = async (u: string, text = false) => { const r = await fetch(u, {signal: AbortSignal.timeout(60000)}); if (!r.ok) throw new Error(`${r.status} ${u}`); return text ? r.text() : r.json(); };
const now = Date.now(), s = evidenceSpot('spot-2'), spot = allSpots.find((x) => x.id === 'spot-2')!, retrieved = new Date(now).toISOString();
const [marine, wx] = [await get(marineURL(s)), await get(weatherURL(s))];
const csv = await get(mopURL('SF023', 'forecast', now), true), mop = normalizeNearshore(csv, retrieved, 'mop', 'forecast').map((r) => ({...r, mopId: 'SF023'}));
const raw = normalizeOpenMeteo(s, marine, wx, retrieved), records = raw.map(toLegacy), bundle = {nearshore: [], mop: {SF023: {mopId: 'SF023', records: mop, issue: null, retrievedAt: retrieved, url: 'x'}}} as any;
const profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const med = (a: number[]) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; };
const f1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : '–');
const days = [...new Set(records.map((r) => pacificDate(r.timestamp)))].slice(0, 8);
console.log(`Ocean Beach, retrieved ${retrieved}. Daylight hours only; ft. MOP rows: ${mop.length} (${mop[0]?.timestamp} … ${mop.at(-1)?.timestamp}).\n`);
console.log('| Day (PT) | offshore Hs (OM) | primary swell Hs / Tp / Dp | MOP SF023 Hs / Tp / Dp | day card typical (median daylight hour) | headline range at 10 AM | day card (same) | day envelope | median v2 central, daylight | MOP Hs median ÷ Wed |\n|---|---|---|---|---|---|---|---|---|---|');
const centrals: number[] = [], mopMeds: number[] = [];
for (const d of days) {
  const hrs = records.filter((r) => pacificDate(r.timestamp) === d && !isDark('spot-2', r.timestamp)); if (hrs.length < 6) continue;
  const mo = mop.filter((m) => pacificDate(m.timestamp) === d && !isDark('spot-2', m.timestamp));
  const at10 = hrs.find((r) => new Date(r.timestamp).toISOString().slice(11, 13) === '18') ?? hrs[Math.floor(hrs.length / 2)]; // 10 AM PST = 18Z
  const h = headlineSurf('spot-2', at10, {bundle, nowMs: now, observations: []}), dr = dayRange(spot, records, d, now, profile, {bundle});
  const cen = med(hrs.map((r) => { const e = headlineSurf('spot-2', r, {bundle, nowMs: now, observations: []}); return e.kind === 'estimate' ? (e.loFt + e.hiFt) / 2 : NaN; })); centrals.push(cen);
  const mid = med(mo.map((m) => m.height.value as number)); mopMeds.push(mid); const tp = med(mo.map((m) => m.period.value as number)); const dp = med(mo.map((m) => m.direction.value as number));
  console.log(`| ${d} | ${f1(med(hrs.map((r) => r.offshore)))} | ${f1(med(hrs.map((r) => r.primary.height)))} / ${f1(med(hrs.map((r) => r.primary.period)))} s / ${Math.round(med(hrs.map((r) => r.primary.direction)))}° | ${mo.length ? `${f1(mid)} / ${f1(tp)} s / ${Math.round(dp)}°` : 'no MOP rows'} | ${dr.typical ? `${dr.typical.loFt}–${dr.typical.hiFt} (${dr.typical.short})` : '–'} | ${h.kind === 'estimate' ? `${h.loFt}–${h.hiFt} (${h.method})` : h.kind} | ${dr.typical ? `${dr.typical.loFt}–${dr.typical.hiFt}` : '–'} | ${dr.kind === 'estimate' ? `${dr.loFt}–${dr.hiFt}` : dr.kind} | ${f1(cen)} | ${f1(mid / (mopMeds[1] || mid))} |`);
}

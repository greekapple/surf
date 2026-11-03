// T-055 rating distribution: every evidence spot x the next 72 hours, rated with the code as it stands, on a cached live snapshot so before/after use the SAME hours.
// Says nothing about accuracy (no rideability observation exists); it shows how the ratings spread. Open-Meteo free tier, non-commercial.
// Run: node --experimental-strip-types docs/forecast/data/rating-distribution.ts <snapshot.json> [label]
//   snapshot.json is created on first use (live fetch) and reused afterwards.
import fs from 'node:fs';
import {normalizeOpenMeteo, marineURL, weatherURL} from '../../../src/ocean/openMeteo.ts';
import {evidenceSpots} from '../../../src/ocean/spots.ts';
import {rateOcean} from '../../../src/ratings/adapters.ts';
import {ratingBands} from '../../../src/ratings/engine.ts';
import {isDark} from '../../../src/services/daylight.ts';
const file = process.argv[2], label = process.argv[3] ?? 'current', DAYLIGHT = process.argv[4] === 'daylight'; // T-064: daylight hours only (first light to last light)
if (!file) throw new Error('usage: rating-distribution.ts <snapshot.json> [label]');
const get = async (u: string) => { const r = await fetch(u, {signal: AbortSignal.timeout(60000)}); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
if (!fs.existsSync(file)) {
  const retrieved = new Date().toISOString(), snap: {retrieved: string; spots: Record<string, unknown[]>} = {retrieved, spots: {}};
  for (const s of evidenceSpots) {
    try { const [m, w] = [await get(marineURL(s)), await get(weatherURL(s))]; snap.spots[s.id] = normalizeOpenMeteo(s, m, w, retrieved); } catch (e) { console.error('skip', s.id, String(e).slice(0, 80)); }
    await new Promise((r) => setTimeout(r, 400));
  }
  fs.writeFileSync(file, JSON.stringify(snap));
}
const snap = JSON.parse(fs.readFileSync(file, 'utf8')), start = Math.floor(Date.parse(snap.retrieved) / 3600000) * 3600000, end = start + 72 * 3600000;
const names = [...ratingBands.map((b) => b.label), 'UNRATED'], counts: Record<string, number> = Object.fromEntries(names.map((n) => [n, 0]));
const perSpot: Record<string, Record<string, number>> = {}; let total = 0;
for (const s of evidenceSpots) for (const r of (snap.spots[s.id] ?? []) as ReturnType<typeof normalizeOpenMeteo>) {
  const t = Date.parse(r.timestamp); if (t < start || t >= end) continue; if (DAYLIGHT && isDark(s.id, r.timestamp)) continue;
  const c = String(rateOcean(s, r, Date.parse(snap.retrieved)).category); counts[c] = (counts[c] ?? 0) + 1; total++; (perSpot[s.id] ??= {})[c] = ((perSpot[s.id] ??= {})[c] ?? 0) + 1;
}
const pct = (n: number) => (100 * n / Math.max(1, total)).toFixed(1) + '%';
const top2 = counts.EPIC + counts.FIRING, top3 = top2 + counts.GOOD, top4 = top3 + counts.SOLID;
console.log(`## Rating distribution (${label})\n\nSnapshot retrieved ${snap.retrieved}; ${Object.keys(snap.spots).length} spots x 72 h = ${total} spot-hours${DAYLIGHT ? ' (daylight hours only)' : ''}.\n\n| Category | Spot-hours | Share |\n|---|---|---|`);
for (const n of names) console.log(`| ${n} | ${counts[n]} | ${pct(counts[n])} |`);
console.log(`\n- Top two (EPIC + FIRING): **${pct(top2)}**\n- GOOD or better: **${pct(top3)}**\n- SOLID or better: **${pct(top4)}**`);
const ob = perSpot['spot-2'] ?? {}; console.log(`- Ocean Beach (only spot with a surveyed orientation): ${names.filter((n) => ob[n]).map((n) => `${n} ${ob[n]}`).join(', ')}`);

console.log(`- Largest single category: **${Math.max(...names.map((n) => counts[n]))} spot-hours = ${pct(Math.max(...names.map((n) => counts[n])))}** (${names.find((n) => counts[n] === Math.max(...names.map((m) => counts[m])))})`);

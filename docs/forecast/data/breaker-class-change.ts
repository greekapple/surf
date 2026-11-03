// T-085: how many spot-hours change breaker class when the Iribarren classes move from the (mis-applied) ξb thresholds 0.4/2.0 to the deep-water ξ₀ thresholds 0.5/3.3.
// 45 spots x next 72 h, live Open-Meteo marine (primary swell). Only spots with a defensible slope (src/ocean/nearshoreSlope.ts) are classified. Run: node --experimental-strip-types docs/forecast/data/breaker-class-change.ts
import {normalizeOpenMeteo, marineURL, weatherURL} from '../../../src/ocean/openMeteo.ts';
import {evidenceSpots} from '../../../src/ocean/spots.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {iribarren, classify} from '../../../src/services/breaker.ts';
import {slopeFor} from '../../../src/ocean/nearshoreSlope.ts';
const get = async (u: string) => { const r = await fetch(u, {signal: AbortSignal.timeout(60000)}); if (!r.ok) throw new Error(`${r.status}`); return r.json(); };
const old = (xi: number) => (xi < 0.4 ? 'spilling' : xi <= 2.0 ? 'plunging' : 'surging');
const now = Date.now(), retrieved = new Date(now).toISOString(); let withSlope = 0, hours = 0, changed = 0; const tr: Record<string, number> = {}, perClass: Record<string, number> = {};
for (const s of evidenceSpots) {
  const sl = slopeFor(s.id); if (!sl) continue; withSlope++;
  let recs: any[]; try { recs = normalizeOpenMeteo(s, await get(marineURL(s)), await get(weatherURL(s)), retrieved).map(toLegacy); } catch { continue; }
  for (const f of recs) {
    const t = Date.parse(f.timestamp); if (t < now - 3600000 || t >= now + 72 * 3600000) continue;
    const xi = iribarren(sl.tanBeta, f.primary.height * 0.3048, f.primary.period); if (xi === null) continue;
    hours++; const a = old(xi), b = classify(xi); perClass[b] = (perClass[b] ?? 0) + 1; if (a !== b) { changed++; tr[`${a} -> ${b}`] = (tr[`${a} -> ${b}`] ?? 0) + 1; }
  }
}
console.log(JSON.stringify({before:'only Ocean Beach had a slope; every other spot-hour was unknown',spotsInDataset: evidenceSpots.length, spotsWithDefensibleSlope: withSlope, spotHoursClassified: hours, changed, transitions: tr, classesAfter: perClass}, null, 1));

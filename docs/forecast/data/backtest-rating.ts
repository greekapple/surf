// T-049 backtest: the rating before and after the onshore-wind rule, on the same archived hours (Open-Meteo historical, free tier, non-commercial).
// It reports how often and why the two differ. It says NOTHING about accuracy: no observation of rideability is involved.
// Run: node --experimental-strip-types docs/forecast/data/backtest-rating.ts [spot-id ...]   (default spot-2 spot-3 spot-0)
import {normalizeOpenMeteo, marineFields} from '../../../src/ocean/openMeteo.ts';
import {evidenceSpot} from '../../../src/ocean/spots.ts';
import {rateOcean} from '../../../src/ratings/adapters.ts';
import {setOnshoreCapEnabled} from '../../../src/ratings/windRules.ts';
const START = '2026-09-16', END = '2026-10-31';
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['spot-2', 'spot-3', 'spot-0'];
const get = async (u: string) => { const r = await fetch(u, {signal: AbortSignal.timeout(60000)}); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
const out: string[] = [`# Rating backtest: before vs after the onshore rule (T-049)`, '', `Hours ${START} to ${END}, Open-Meteo historical marine and weather for each spot's query points. "Before" = wind factor without the onshore ceiling; "after" = with it (onshore above 3 mph held to 59). Nothing else differs. **This compares two versions of the same rating; it is not an accuracy test.**`, ''];
for (const id of ids) {
  const s = evidenceSpot(id);
  const marine = await get(`https://marine-api.open-meteo.com/v1/marine?${new URLSearchParams({latitude: String(s.marineLatitude), longitude: String(s.marineLongitude), hourly: marineFields.join(','), timezone: 'GMT', timeformat: 'unixtime', start_date: START, end_date: END})}`);
  const wx = await get(`https://archive-api.open-meteo.com/v1/archive?${new URLSearchParams({latitude: String(s.latitude), longitude: String(s.longitude), hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m', wind_speed_unit: 'mph', timezone: 'GMT', timeformat: 'unixtime', start_date: START, end_date: END})}`);
  const recs = normalizeOpenMeteo(s, marine, wx, new Date().toISOString());
  let rated = 0, differ = 0, catChange = 0, onshoreHours = 0, onshoreLight = 0, tickFlips = 0, unrated = 0; const diffs: number[] = []; const trans: Record<string, number> = {}; const byBand: Record<string, number> = {};
  for (const r of recs) {
    const t = Date.parse(r.timestamp);
    setOnshoreCapEnabled(false); const a = rateOcean(s, r, t);
    setOnshoreCapEnabled(true); const b = rateOcean(s, r, t);
    if (a.score === null || b.score === null) { unrated++; continue; }
    rated++;
    const wa = a.factors.find((f) => /wind/i.test(f.name))?.score ?? null, wb = b.factors.find((f) => /wind/i.test(f.name))?.score ?? null;
    if (wa !== null && wb !== null && wa >= 70 && wb < 70) tickFlips++;
    if (a.score !== b.score) { differ++; diffs.push(b.score - a.score); }
    if (a.category !== b.category) { catChange++; const k = `${a.category} → ${b.category}`; trans[k] = (trans[k] ?? 0) + 1; }
    if (wa !== wb) { const sp = r.windSpeed.value ?? 0; const band = sp <= 3 ? '≤3' : sp <= 7 ? '3–7' : sp <= 12 ? '7–12' : '>12'; byBand[band] = (byBand[band] ?? 0) + 1; }
  }
  setOnshoreCapEnabled(true);
  const mean = diffs.length ? diffs.reduce((x, y) => x + y, 0) / diffs.length : 0;
  out.push(`## ${s.name} (${id})`, '', `- Hours rated: ${rated} (${unrated} unrated: missing inputs).`, `- Overall score differs on **${differ}** hours (${(100 * differ / Math.max(1, rated)).toFixed(1)}%); mean change ${mean.toFixed(1)} points, largest ${diffs.length ? Math.min(...diffs) : 0}.`, `- Category changes on **${catChange}** hours (${(100 * catChange / Math.max(1, rated)).toFixed(1)}%): ${Object.entries(trans).map(([k, v]) => `${k} ×${v}`).join(', ') || 'none'}.`, `- Wind tick ✓ → ~ on ${tickFlips} hours.`, `- Why: the wind factor changes only for onshore wind above 3 mph; hours whose wind factor changed, by wind speed: ${Object.entries(byBand).map(([k, v]) => `${k} mph ×${v}`).join(', ') || 'none'}. ${id === 'spot-2' ? '' : 'Spots without a reviewed orientation have no onshore/offshore relation, so the rule cannot apply to them (the unknown stays unknown).'}`, '');
}
out.push('Honest limits: both versions are provisional offshore-potential ratings. No rideability observation is available to say which is closer to reality; the session log will provide that over time.');
console.log(out.join('\n'));

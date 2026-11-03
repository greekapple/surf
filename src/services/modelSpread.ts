import type {SpotEvidence} from '../ocean/types.ts';
import {estimateBreaking} from '../ocean/breakingEstimate.ts';
import {breakingProfile} from '../ocean/localCalibration.ts';

/** Wave-model spread for one spot (T-073): Open-Meteo Marine can return several wave models for the same point in ONE request (`models=a,b,c`), which is what Windy's model compare shows.
 *  For every hour and every model with data we run the same offshore-to-break estimate (v1) on that model's primary swell and take the ratio of the largest to the smallest estimated height (the breaking height, whose ratio is close to that of the surf height).
 *  That ratio is the "model spread" component of the range (services/uncertainty.ts). Models with no data at the spot (land-masked grid cells) are left out; fewer than 2 usable models means no spread, never a guess.
 *  Cost: one extra request per viewed spot (about 16 KB, about 1 s for 4 models x 7 days), cached for 10 minutes; the main forecast load is unchanged. */
/** Per-model skill against buoys over the 14 days to 2026-11-03 (docs/forecast/data/model-skill.ts; Open-Meteo analysis hours at a marine point near each buoy vs the buoy's total Hs, NDBC 46026 and 46214; 46012 is
 *  listed in the doc but not used: every model is +30 to +40% there, which points at the grid cell, not the model). `bias` = median model ÷ buoy, averaged over the two open-ocean buoys; `halfWidth` = ln(p90/p10)/2 of that ratio.
 *  Models are bias-corrected (Hs ÷ bias) before they are compared, so the spread shows real disagreement, not known bias. The bias and half-width were measured on TOTAL Hs but are applied to the swell partition the app uses (an assumption: the
 *  partition's own bias was not measured). A model whose half-width exceeds PRUNE_HALF_WIDTH at either buoy is left out; 0.2 is a round figure above the retained models' open-ocean half-widths (at most 0.17) and below gwam's 0.223, not derived and not tuned to a width target.
 *  Static, dated, and ANALYSIS hours only (a lower bound on forecast error); regenerate with the script. */
export const SKILL_AS_OF = '2026-11-03';
export const MODEL_SKILL: Record<string, {bias: number; halfWidth: number}> = {
  meteofrance_wave: {bias: 1.015, halfWidth: 0.127}, ecmwf_wam025: {bias: 1.045, halfWidth: 0.134}, ncep_gfswave016: {bias: 0.835, halfWidth: 0.142}, gwam: {bias: 0.88, halfWidth: 0.187},
};
export const PRUNE_HALF_WIDTH = 0.2;
export const PRUNED_MODELS = ['gwam']; // half-width 0.223 at NDBC 46026 (> PRUNE_HALF_WIDTH)
export const SPREAD_MODELS = ['meteofrance_wave', 'ncep_gfswave016', 'gwam', 'ecmwf_wam025'] as const;
export const SPREAD_TTL_MS = 10 * 60000;
export const modelSpreadURL = (s: Pick<SpotEvidence, 'marineLatitude' | 'marineLongitude'>) => `https://marine-api.open-meteo.com/v1/marine?${new URLSearchParams({latitude: String(s.marineLatitude), longitude: String(s.marineLongitude),
  hourly: ['wave_height', 'swell_wave_height', 'swell_wave_period', 'swell_wave_direction'].join(','), models: SPREAD_MODELS.join(','), forecast_days: '7', timezone: 'GMT', timeformat: 'unixtime'})}`;

export interface HourSpread {ratio: number; models: number; centralsFt: Record<string, number>}
export interface SpreadSeries {spotId: string; fetchedAt: string; byHour: Map<string, HourSpread>; modelsUsed: string[]}
const FT = 1 / 0.3048, num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Pure: Open-Meteo multi-model JSON → per-hour spread for a spot that has a breaking profile and an orientation (otherwise empty). */
export function normalizeSpread(json: any, spot: Pick<SpotEvidence, 'id' | 'orientation'>, fetchedAt = new Date().toISOString()): SpreadSeries {
  const out: SpreadSeries = {spotId: spot.id, fetchedAt, byHour: new Map(), modelsUsed: []}, h = json?.hourly, profile = breakingProfile(spot.id);
  if (!h || !Array.isArray(h.time) || !profile || spot.orientation === null) return out;
  const usable = SPREAD_MODELS.filter((m) => MODEL_SKILL[m] && !PRUNED_MODELS.includes(m) && Array.isArray(h[`swell_wave_height_${m}`]) && h[`swell_wave_height_${m}`].some((v: unknown) => num(v) && v > 0) && h[`swell_wave_period_${m}`]?.some((v: unknown) => num(v) && v > 0));
  out.modelsUsed = [...usable];
  h.time.forEach((t: number, i: number) => {
    const centrals: Record<string, number> = {};
    for (const m of usable) {
      const hs = h[`swell_wave_height_${m}`][i], tp = h[`swell_wave_period_${m}`][i], dp = h[`swell_wave_direction_${m}`]?.[i], comb = h[`wave_height_${m}`]?.[i];
      if (![hs, tp, dp].every(num) || hs <= 0) continue;
      const r = estimateBreaking({swellHsFt: (hs * FT) / MODEL_SKILL[m].bias, periodS: tp, directionDeg: dp, combinedHsFt: num(comb) ? (comb * FT) / MODEL_SKILL[m].bias : null, secondaryHsFt: null}, profile, spot.orientation);
      if (r.ok) centrals[m] = r.centralFt;
    }
    const v = Object.values(centrals);
    if (v.length >= 2) out.byHour.set(new Date(t * 1000).toISOString(), {ratio: Math.max(...v) / Math.min(...v), models: v.length, centralsFt: centrals});
  });
  return out;
}

const store = new Map<string, SpreadSeries>();
const subs = new Set<() => void>();
export const getSpreadSeries = (spotId: string) => store.get(spotId) ?? null;
/** The spread for one spot-hour, or null (no data, a spot without a profile, or fewer than two models). */
export const spreadAt = (spotId: string, iso: string): HourSpread | null => store.get(spotId)?.byHour.get(new Date(Date.parse(iso)).toISOString()) ?? null;
export function setSpreadSeries(s: SpreadSeries) { store.set(s.spotId, s); subs.forEach((f) => { try { f(); } catch { /* one subscriber must not break the others */ } }); }
export const subscribeSpread = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export const clearSpread = () => { store.clear(); subs.forEach((f) => f()); };
/** Fetches (unless fresh) and stores the spread for a spot. Never throws: a failure just leaves the range without a spread term. `fetchJson` is injectable for tests. */
export async function loadModelSpread(spot: SpotEvidence, fetchJson: (url: string) => Promise<unknown>, nowMs = Date.now()): Promise<SpreadSeries | null> {
  const have = store.get(spot.id); if (have && nowMs - Date.parse(have.fetchedAt) < SPREAD_TTL_MS) return have;
  try { const s = normalizeSpread(await fetchJson(modelSpreadURL(spot)), spot, new Date(nowMs).toISOString()); setSpreadSeries(s); return s; } catch { return null; }
}

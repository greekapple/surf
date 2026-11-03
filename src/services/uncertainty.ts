/** Honest ranges (T-073, rebuilt in T-078). The headline is the SURF HEIGHT by the common convention (about the nearshore significant wave height, T-077). Its range is the forecast uncertainty of that height, built only from measured
 *  or observed quantities, around the central height: range = central × exp(−w) … central × exp(+w), whole feet rounded OUTWARD so the displayed range contains the stated interval (at least 1 ft wide).
 *  It is a "likely range of the forecast height", NOT a validated confidence interval and NOT the wave-to-wave variation inside a set (the biggest waves of a set are higher; for Rayleigh seas H1/10 ≈ 1.27 H1/3, Longuet-Higgins 1952).
 *  Calibration from the surfer's own observations (T-059) replaces this range once active.
 *  max(), not a sum, was chosen because both terms describe the same forecast error; a quadrature sum was not tested.
 *
 *  w = √(wForecast² + wStep²), with
  - wForecast = max(skillW(lead), d). skillW is the MEASURED forecast error of the wave models (meteofrance_wave, ecmwf_wam025, ncep_gfswave016, pooled) against buoys by lead time: Open-Meteo Marine "previous day N" forecasts vs the total Hs of NDBC 46026 and 46214,
 *    14 days to 2026-11-03, 660 hours per model and lead, ratio p10 to p90 half-width ln(p90/p10)/2 after dividing each model by its own median ratio: 0.16 at lead 0 days, rising to 0.43 at 7 days (table LEAD_SKILL; docs/forecast/data/model-skill-lead.ts).
 *    Deep-water buoys, one fortnight, not the surf zone: a measured floor, not a guarantee. d = ln(max/min)/2 over the bias-corrected, skill-pruned wave models for that hour: real disagreement,
 *    which grows with lead time. max(), not a sum: the disagreement and the skill figure describe the same forecast error, so adding them would count it twice. d above DISAGREE_HALF (a factor of 1.35 between models) is flagged "disagree".
 *  - wStep = 0.173 = ln(1.40/0.99)/2, v1 only (offshore swell carried to 10 m): the measured scatter of MOP SF023 Hs ÷ the v1 height over 782 hours (docs/forecast/data/t008-pairs.csv). Ocean Beach only; a width, centred on v1, not covering its known 14% low bias.
 *
 *  Removed in T-078, with reasons: the surf-height convention term (an assumed H1/3 to H1/10 range with no source, now outside the quantity the user chose); the breaker-index term (it described where waves break, no longer the centre);
 *  and the v2-vs-v1 "method difference" (two methods on different partitions, not uncertainty about v2). */
/** Half-width of the forecast error by lead day (0..7): the "pooled" table printed by docs/forecast/data/model-skill-lead.ts (three models, each model's median bias removed, 2026-11-03). All three models are used, not a subset picked after seeing which did best. */
export const LEAD_SKILL: readonly number[] = [0.156, 0.161, 0.170, 0.181, 0.243, 0.320, 0.360, 0.425];
export const SKILL_FLOOR_W = LEAD_SKILL[0];
/** Skill half-width at a lead time in hours (linear between days, held at day 7 beyond). */
export const skillW = (leadHours: number | undefined) => { const d = Math.max(0, Math.min(7, (Number.isFinite(leadHours) ? (leadHours as number) : 0) / 24)), i = Math.floor(d), f = d - i; return i >= 7 ? LEAD_SKILL[7] : LEAD_SKILL[i] * (1 - f) + LEAD_SKILL[i + 1] * f; };
export const V1_STEP_W = Math.log(1.40 / 0.99) / 2;
export const DISAGREE_HALF = Math.log(1.35) / 2;
export const LEGACY_BAND: [number, number] = [0.7, 1.4];

export interface UncertaintyComponent {id: 'forecast-skill' | 'model-spread' | 'offshore-step'; label: string; halfWidth: number}
export interface UncertaintyInput {method: 'mop-v2' | 'v1'; centralFt: number; /** max/min of the bias-corrected wave-model heights for this hour (≥ 1), with how many models. */ modelSpread?: {ratio: number; models: number} | null; /** hours from now to the hour (the forecast lead); default 0 */ leadHours?: number; /** ignored since T-078 (kept so older callers compile) */ mopOverOffshore?: number | null}
export interface Interval {loFt: number; hiFt: number; centralFt: number; halfWidth: number; components: UncertaintyComponent[]; disagree: boolean; note: string}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function intervalFor(i: UncertaintyInput): Interval | null {
  if (!finite(i.centralFt) || i.centralFt <= 0) return null;
  const d = i.modelSpread && finite(i.modelSpread.ratio) && i.modelSpread.ratio >= 1 && i.modelSpread.models >= 2 ? Math.log(i.modelSpread.ratio) / 2 : null;
  const sk = skillW(i.leadHours), c: UncertaintyComponent[] = d !== null && d > sk ? [{id: 'model-spread', label: `${i.modelSpread!.models} wave models disagree`, halfWidth: d}] : [{id: 'forecast-skill', label: `wave-model forecast error vs deep-water buoys (14 days) at ${Math.round((i.leadHours ?? 0) / 24)} days${d !== null ? ` (${i.modelSpread!.models} models agree)` : ''}`, halfWidth: sk}];
  if (i.method === 'v1') c.push({id: 'offshore-step', label: 'offshore-to-nearshore step (measured at Ocean Beach only)', halfWidth: V1_STEP_W});
  const w = Math.sqrt(c.reduce((s, x) => s + x.halfWidth * x.halfWidth, 0));
  let lo = Math.max(0, Math.floor(i.centralFt * Math.exp(-w) + 1e-9)), hi = Math.ceil(i.centralFt * Math.exp(w) - 1e-9);
  if (hi - lo < 1) hi = lo + 1;
  const disagree = d !== null && d > DISAGREE_HALF;
  return {loFt: lo, hiFt: hi, centralFt: i.centralFt, halfWidth: w, components: c, disagree, note: `${c.map((x) => `${x.label} −${Math.round((1 - Math.exp(-x.halfWidth)) * 100)}%/+${Math.round((Math.exp(x.halfWidth) - 1) * 100)}%`).join('; ')}; forecast uncertainty of the model height, rounded outward to whole feet; not a validated confidence interval, and bigger waves in a set can exceed the top of the range.${disagree ? ' Wave models disagree.' : ''}`};
}

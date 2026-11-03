/** Honest ranges (T-073). The breaking-wave estimate used to be the central height times a fixed, lead-set band of 0.7 to 1.4. This builds the range from components that each have a stated basis,
 *  combined in quadrature in log space around the central height: range = central × exp(−w) … central × exp(+w), w = √(Σ wᵢ²), then rounded outward to whole feet (at least 1 ft wide).
 *  It is a "likely range", NOT a validated confidence interval: no component has been checked against observed face heights. Calibration from the surfer's own observations (T-059) replaces this range once active.
 *
 *  Components (half-widths in ln units; ln(x) ≈ x−1 for small x):
 *  - CONVENTION 0.119 = ln(1.27)/2. ASSUMED convention range (no source found for it): a surf height is quoted somewhere between the significant wave height H1/3 and the larger H1/10. Only the ratio is cited: for
 *    Rayleigh-distributed wave heights H1/10 ≈ 1.27 H1/3 (Longuet-Higgins 1952, "On the statistical distribution of the heights of sea waves", J. Marine Res. 11, 245–266). Applies to every estimate. It may overlap with
 *    the variability inside the other terms, so it can make the range wider than needed (the safe direction).
 *  - BREAKER INDEX 0.162 = ln(0.83/0.60)/2, v2 only. v2 stops the shoaling wave where H = γ·h; Battjes & Stive (1985, J. Geophys. Res. 90, 9159–9167) re-analysed laboratory and field data and found γ between 0.60 and 0.83
 *    for plane, bar-trough and bar profiles (mean 0.73; reported in Coastal Wiki "Breaker index" and Roelvink-type reviews). The WIDTH is borrowed from that published spread; it is centred on v2's own γ = 0.78 (not on the paper's 0.73), so the range is symmetric in log space and does not reproduce the paper's 0.60–0.83 band exactly.
 *    Breaker type (spilling vs plunging) does NOT narrow it further: the sources found give one pooled range, not separate ones, so we do not invent split ratios.
 *  - OFFSHORE-TO-NEARSHORE STEP 0.200 = ln(0.97/0.65)/2, v1 only. v1 carries the offshore swell to the break with a closed formula (Komar & Gaughan 1973). Our own comparison of that formula with CDIP MOP SF023 over 1,068 hours
 *    (docs/forecast/T-008-validation.md) gave a p10 to p90 spread of MOP Hs ÷ Hb of 0.65 to 0.97. This is a WIDTH only: that band sits below 1 (Hb runs high against MOP Hs at 10 m, partly the intended depth step), the range here is centred on Hb and does not cover that known high bias, and the comparison says nothing about face height. Measured at Ocean Beach only and against a model (MOP), not observed breakers.
 *  - MODEL SPREAD √: how much the wave models available for the spot-hour disagree on the breaking height (ln(max/min)/2 over ≥ 2 models; src/services/modelSpread.ts).

 *  - METHOD DIFFERENCE (v2 spots): |ln(v2 central / v1 central)|/2 where both exist. v2 (nearshore model) and v1 (offshore formula) are two different methods on the same swell and differ systematically, so this widens the range but is NOT called
 *    "sources disagree". Only the model spread is: a spread of more than a factor of 1.35 between wave models (DISAGREE_HALF) is flagged "sources disagree". */
export const CONVENTION_W = Math.log(1.27) / 2;
export const BREAKER_INDEX_W = Math.log(0.83 / 0.60) / 2;
export const V1_STEP_W = Math.log(0.97 / 0.65) / 2;
export const DISAGREE_HALF = Math.log(1.35) / 2;
export const LEGACY_BAND: [number, number] = [0.7, 1.4];

export interface UncertaintyComponent {id: 'convention' | 'breaker-index' | 'offshore-step' | 'model-spread' | 'mop-vs-offshore'; label: string; halfWidth: number}
export interface UncertaintyInput {method: 'mop-v2' | 'v1'; centralFt: number; /** max/min of the breaking height across wave models for this hour (≥ 1), with how many models. */ modelSpread?: {ratio: number; models: number} | null; /** v2 central ÷ v1 central for this hour, where both exist. */ mopOverOffshore?: number | null}
export interface Interval {loFt: number; hiFt: number; centralFt: number; halfWidth: number; components: UncertaintyComponent[]; disagree: boolean; note: string}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function intervalFor(i: UncertaintyInput): Interval | null {
  if (!finite(i.centralFt) || i.centralFt <= 0) return null;
  const c: UncertaintyComponent[] = [{id: 'convention', label: 'surf-height convention (H1/3 to H1/10)', halfWidth: CONVENTION_W}];
  c.push(i.method === 'mop-v2' ? {id: 'breaker-index', label: 'breaker index spread (Battjes & Stive 1985)', halfWidth: BREAKER_INDEX_W} : {id: 'offshore-step', label: 'offshore-to-nearshore step (our Ocean Beach comparison)', halfWidth: V1_STEP_W});
  const ms = i.modelSpread && finite(i.modelSpread.ratio) && i.modelSpread.ratio >= 1 && i.modelSpread.models >= 2 ? Math.log(i.modelSpread.ratio) / 2 : null;
  if (ms !== null) c.push({id: 'model-spread', label: `${i.modelSpread!.models} wave models`, halfWidth: ms});
  const mo = i.method === 'mop-v2' && finite(i.mopOverOffshore) && i.mopOverOffshore > 0 ? Math.abs(Math.log(i.mopOverOffshore)) / 2 : null;
  if (mo !== null) c.push({id: 'mop-vs-offshore', label: 'method difference, nearshore model vs offshore swell', halfWidth: mo});
  const w = Math.sqrt(c.reduce((s, x) => s + x.halfWidth * x.halfWidth, 0));
  let lo = Math.max(0, Math.floor(i.centralFt * Math.exp(-w) + 1e-9)), hi = Math.ceil(i.centralFt * Math.exp(w) - 1e-9);
  if (hi - lo < 1) hi = lo + 1;
  const disagree = ms !== null && ms > DISAGREE_HALF;
  return {loFt: lo, hiFt: hi, centralFt: i.centralFt, halfWidth: w, components: c, disagree, note: `${c.map((x) => `${x.label} −${Math.round((1 - Math.exp(-x.halfWidth)) * 100)}%/+${Math.round((Math.exp(x.halfWidth) - 1) * 100)}%`).join('; ')}; combined in quadrature, not a validated confidence interval.${disagree ? ' Wave models disagree.' : ''}`};
}

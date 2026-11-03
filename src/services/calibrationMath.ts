import type {SessionObservation} from './sessionLog.ts';
/** Per-spot calibration of the breaking estimate from the surfer's own observations (T-059). Pure.
 *  ratio = observed face height / the model's central height (midpoint of the uncalibrated range) for the SAME spot-hour, fitted per spot and per method (v2 and v1 are different estimators).
 *  The fit is the MEDIAN of the ratios (robust to a bad day) and the spread is their interquartile range. Nothing changes below NEEDED paired observations.
 *  NEEDED = 8: quartiles need at least a couple of points in each tail to mean anything (below 8 the 25th and 75th percentiles each rest on one or two observations), and eight
 *  sessions is about two good weeks of surfing; it is a product choice, not a statistical guarantee, and the UI says "n of 8". */
export const NEEDED = 8;
export const MIN_SPREAD = 0.15;   // the calibrated range is never narrower than ±15% of its central value
export const MIN_MODEL_FT = 0.5;  // a model central below this makes the ratio meaningless; that pair is not used
export type Method = 'mop-v2' | 'v1';
export interface FeltCounts {low: number; right: number; high: number}
/** "Felt right?" is a WEAKER, direction-only signal: it can nudge an ACTIVE calibration (never activate one) by 3% per net vote, at most ±15%. Our own choice. `low` = the forecast was too low (raise it). */
export const FELT_STEP = 0.03, FELT_CAP = 0.15;
export const feltFactor = (f: FeltCounts) => 1 + Math.max(-FELT_CAP, Math.min(FELT_CAP, FELT_STEP * (f.low - f.high)));
export interface CalibrationFit {n: number; needed: number; status: 'collecting' | 'active'; ratio?: number; iqr?: [number, number]; felt?: FeltCounts & {factor: number}}

export const median = (a: number[]): number => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** Linear-interpolated quantile (type 7). */
export function quantile(a: number[], q: number): number { const s = [...a].sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
export const observedFt = (o: SessionObservation): number => (typeof o.faceFt === 'number' ? o.faceFt : (o.rangeFt[0] + o.rangeFt[1]) / 2);
/** The paired observations usable for one spot and method. */
export function pairsFor(log: SessionObservation[], spotId: string, method: Method) {
  return log.filter((o) => o.spotId === spotId && o.pair && o.pair.basis === 'surf-height' && o.pair.method === method && o.pair.centralFt >= MIN_MODEL_FT).map((o) => ({ratio: observedFt(o) / o.pair!.centralFt, obs: o}));
}
export function fitFor(log: SessionObservation[], spotId: string, method: Method, felt: FeltCounts = {low: 0, right: 0, high: 0}): CalibrationFit {
  const r = pairsFor(log, spotId, method).map((x) => x.ratio), n = r.length, fc = feltFactor(felt);
  if (n < NEEDED) return {n, needed: NEEDED, status: 'collecting', felt: {...felt, factor: 1}};
  return {n, needed: NEEDED, status: 'active', ratio: median(r) * fc, iqr: [quantile(r, 0.25) * fc, quantile(r, 0.75) * fc], felt: {...felt, factor: fc}};
}
/** The calibrated range for one hour: central = ratio × model central; low/high from the observed IQR of the ratio, floored at ±15% of the calibrated central, rounded outward to whole feet. */
export function applyFit(fit: CalibrationFit, modelLoFt: number, modelHiFt: number): {loFt: number; hiFt: number; centralFt: number} | null {
  if (fit.status !== 'active' || fit.ratio === undefined || !fit.iqr) return null;
  const mid = (modelLoFt + modelHiFt) / 2, central = fit.ratio * mid;
  if (!(central > 0)) return null;
  const lo = Math.min(mid * fit.iqr[0], central * (1 - MIN_SPREAD)), hi = Math.max(mid * fit.iqr[1], central * (1 + MIN_SPREAD));
  return {loFt: Math.max(0, Math.floor(lo + 1e-9)), hiFt: Math.ceil(hi - 1e-9), centralFt: central};
}

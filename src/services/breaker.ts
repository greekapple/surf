import type {Forecast, SurfSpot} from '../models/index.ts';
import {slopeFor} from '../ocean/nearshoreSlope.ts';

/** Estimated breaker type (T-064 addendum): spilling, plunging or surging from the surf-similarity (Iribarren) parameter
 *  ξ = tanβ / √(H₀ / L₀), with deep-water wavelength L₀ = g·T² / 2π.
 *  Classes for the DEEP-WATER parameter ξ₀ (Battjes, J.A., 1974, "Surf similarity", Proc. 14th Coastal Engineering Conference, ASCE, 466–480; thresholds as tabulated on Wikipedia "Iribarren number", checked 2026-11-02):
 *  spilling ξ₀ < 0.5, plunging 0.5 ≤ ξ₀ ≤ 3.3, surging ξ₀ > 3.3. (The thresholds 0.4 and 2.0 are for ξb, which uses the height AT breaking; T-085 fixed the earlier mix-up of ξ₀ with ξb thresholds.)
 *  Inputs: tanβ from src/ocean/nearshoreSlope.ts (only where defensible; otherwise 'unknown', never guessed); H₀ and T = the hour's primary swell height and period (the offshore swell partition,
 *  the deep-water quantities the parameter is defined for). It is an ESTIMATE: the slope is a coarse mean, and real breakers also depend on wind, bar shape and tide. */
export type BreakerType = 'spilling' | 'plunging' | 'surging' | 'unknown';
export const BREAKER_LABEL = 'est. breaker type';
export const SPILLING_MAX = 0.5, PLUNGING_MAX = 3.3, G = 9.80665;
export interface BreakerEstimate {/** 'checked' only for a hand-reviewed slope (T-087); a generated depth/distance mean slope is 'mean-slope' and must not alone downgrade a verdict */confidence?: 'checked' | 'mean-slope'; type: BreakerType; xi: number | null; tanBeta: number | null; h0M: number | null; periodS: number | null; label: typeof BREAKER_LABEL; basis: string}

export const deepWavelengthM = (periodS: number) => (G * periodS * periodS) / (2 * Math.PI);
/** The surf-similarity parameter; null when an input is not a positive finite number. */
export function iribarren(tanBeta: number, h0M: number, periodS: number): number | null {
  if (![tanBeta, h0M, periodS].every((n) => Number.isFinite(n) && n > 0)) return null;
  return tanBeta / Math.sqrt(h0M / deepWavelengthM(periodS));
}
export const classify = (xi: number | null): BreakerType => (xi === null || !Number.isFinite(xi) ? 'unknown' : xi < SPILLING_MAX ? 'spilling' : xi <= PLUNGING_MAX ? 'plunging' : 'surging');
const FT_PER_M = 1 / 0.3048;
const unknown = (basis: string, o: Partial<BreakerEstimate> = {}): BreakerEstimate => ({type: 'unknown', xi: null, tanBeta: null, h0M: null, periodS: null, label: BREAKER_LABEL, basis, ...o});

/** The estimated breaker type for one spot-hour. `unknown` with the reason when the spot has no defensible slope or the hour has no usable swell. */
export function breakerType(spot: Pick<SurfSpot, 'id'>, hour: Pick<Forecast, 'primary'>, slope = slopeFor(spot.id)): BreakerEstimate {
  if (!slope) return unknown('No defensible seabed slope for this spot, so the breaker type is not estimated.');
  const h0 = hour.primary?.height / FT_PER_M, t = hour.primary?.period;
  const xi = iribarren(slope.tanBeta, h0, t);
  if (xi === null) return unknown('This hour has no usable primary swell height and period.', {tanBeta: slope.tanBeta});
  const type = classify(xi);
  return {confidence: slope.confidence ?? 'mean-slope', type, xi, tanBeta: slope.tanBeta, h0M: h0, periodS: t, label: BREAKER_LABEL, basis: `Surf similarity ξ = ${xi.toFixed(2)} (slope ${slope.tanBeta.toFixed(3)}, swell ${(h0 * FT_PER_M).toFixed(1)} ft at ${t.toFixed(0)} s): ${type}. ${slope.basis} Deep-water ξ₀ classes (spilling < ${SPILLING_MAX}, plunging ≤ ${PLUNGING_MAX}, surging above): Battjes 1974.`};
}
/** What Board Match can use in place of "wave character unknown": spilling is soft, plunging is steep and hollow; surging does not break normally, so no character. Our own mapping. */
export const characterFromBreaker = (t: BreakerType): 'soft' | 'steep' | null => (t === 'spilling' ? 'soft' : t === 'plunging' ? 'steep' : null);
/** Plain words for a verdict sentence. */
export const BREAKER_WORD: Record<BreakerType, string> = {spilling: 'Spilling (soft, slow-breaking)', plunging: 'Plunging (hollow, powerful)', surging: 'Surging (collapses on the shore)', unknown: 'Unknown'};

/** Onshore wind may never score as good (T-049). The factor itself carries the rule, so every tick and rating built from it agrees.
 *  Threshold: Beaufort force 1 (light air) ends at 3 mph, the last force at which the sea surface is still unbroken ripples; from force 2 (4–7 mph, "small wavelets")
 *  the water surface is textured and from force 3 (8–12 mph) "crests begin to break". Source: U.S. National Weather Service (NOAA), "Beaufort Wind Scale", https://www.weather.gov/mfl/beaufort.
 *  Onshore wind up to this speed keeps its usual score; above it the score is held below the "good" band (the ✓ tick starts at 70, the positive list at 65), so it can read "~" but not ✓.
 *  Offshore and cross-shore scoring, and every weight, are unchanged. */
export const ONSHORE_LIGHT_MPH = 3;
export const ONSHORE_SCORE_CEILING = 59; // just under the "Good" label threshold (60) and the tick (70) and positive (65) cut-offs
export const ONSHORE_SOURCE = 'NWS Beaufort Wind Scale: force 1 (light air) ends at 3 mph';
/** Applies the ceiling to a wind score. `relation` is case-insensitive; unknown relations are not capped. */
let enabled = true;
/** Backtest only (docs/forecast/data/backtest-rating.ts): switches the ceiling off to reproduce the pre-T-049 rule. The app never calls this. */
export const setOnshoreCapEnabled = (on: boolean) => { enabled = on; };
export function capOnshore(score: number, relation: string, speedMph: number): number {
  return !enabled ? score : String(relation).toLowerCase() === 'onshore' && Number.isFinite(speedMph) && speedMph > ONSHORE_LIGHT_MPH ? Math.min(score, ONSHORE_SCORE_CEILING) : score;
}

/** T-055 rating ceilings (RATING-V2-PLAN Phase 1). Product rules, not fitted: they only ever LOWER a score, and each says why in `explainRating`.
 *  - Wind relation unknown (no surveyed shore normal) and wind above CALM_MPH: the rating cannot say whether the wind helps, so it stops at NOT BAD (64).
 *  - Cross-shore wind above CROSS_FRESH_MPH (8 mph = Beaufort force 3, "crests begin to break", NWS): stops at NOT BAD (64).
 *  - A breaking estimate whose range is WIDE_RANGE_FT or more wide is too uncertain to support a high rating: stops at SOLID (69).
 *  Nothing here raises a score, and nothing here uses the estimate to score. */
export const CALM_MPH = 5;
export const CROSS_FRESH_MPH = 8;
export const WIND_CEILING = 64;
export const WIDE_RANGE_FT = 4;
export const WIDE_RANGE_CEILING = 69;
import {WIDE_HALF_WIDTH} from '../services/uncertainty.ts';
export interface Ceiling {id: 'wind-unknown' | 'cross-shore' | 'wide-range'; limit: number; reason: string}
/** T-081: ceiling from the headline's forecast uncertainty (half-width in ln units from services/uncertainty.ts), replacing the width of the legacy breaking range. */
export function uncertaintyCeiling(halfWidth: number | null | undefined, threshold = WIDE_HALF_WIDTH): Ceiling | null {
  if (!enabled || typeof halfWidth !== 'number' || !Number.isFinite(halfWidth) || halfWidth < threshold) return null;
  return {id: 'wide-range', limit: WIDE_RANGE_CEILING, reason: `The forecast height is uncertain by about ±${Math.round((Math.exp(halfWidth) - 1) * 100)}% (long lead or the wave models disagree): too uncertain for a high rating, which stops at SOLID.`};
}
export function windCeilings(relation: string, speedMph: number): Ceiling[] {
  const rel = String(relation).toLowerCase(), out: Ceiling[] = [];
  if (!Number.isFinite(speedMph) || !enabled) return out;
  if (rel === 'unknown' && speedMph > CALM_MPH) out.push({id: 'wind-unknown', limit: WIND_CEILING, reason: `Wind is ${speedMph.toFixed(1)} mph but this spot's shore direction is not surveyed, so we cannot tell offshore from onshore: the rating stops at NOT BAD.`});
  if (rel === 'cross-shore' && speedMph > CROSS_FRESH_MPH) out.push({id: 'cross-shore', limit: WIND_CEILING, reason: `Cross-shore ${speedMph.toFixed(1)} mph (above ${CROSS_FRESH_MPH} mph) chops the face: the rating stops at NOT BAD.`});
  return out;
}
export function rangeCeiling(rangeFt: [number, number] | null | undefined): Ceiling | null {
  if (!enabled || !rangeFt) return null;
  const w = rangeFt[1] - rangeFt[0];
  return Number.isFinite(w) && w >= WIDE_RANGE_FT ? {id: 'wide-range', limit: WIDE_RANGE_CEILING, reason: `The estimated size range is ${w.toFixed(0)} ft wide (${WIDE_RANGE_FT} ft or more): too uncertain for a high rating, which stops at SOLID.`} : null;
}

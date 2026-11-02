/** Onshore wind may never score as good (T-049). The factor itself carries the rule, so every tick and rating built from it agrees.
 *  Threshold: Beaufort force 1 (light air) ends at 3 mph, the last force at which the sea surface is still unbroken ripples; from force 2 (4–7 mph, "small wavelets")
 *  the water surface is textured and from force 3 (8–12 mph) "crests begin to break". Source: U.S. National Weather Service (NOAA), "Beaufort Wind Scale", https://www.weather.gov/mfl/beaufort.
 *  Onshore wind up to this speed keeps its usual score; above it the score is held below the "good" band (the ✓ tick starts at 70, the positive list at 65), so it can read "~" but not ✓.
 *  Offshore and cross-shore scoring, and every weight, are unchanged. */
export const ONSHORE_LIGHT_MPH = 3;
export const ONSHORE_SCORE_CEILING = 59; // just under the "Good" label threshold (60) and the tick (70) and positive (65) cut-offs
export const ONSHORE_SOURCE = 'NWS Beaufort Wind Scale: force 1 (light air) ends at 3 mph';
/** Applies the ceiling to a wind score. `relation` is case-insensitive; unknown relations are not capped. */
export function capOnshore(score: number, relation: string, speedMph: number): number {
  return String(relation).toLowerCase() === 'onshore' && Number.isFinite(speedMph) && speedMph > ONSHORE_LIGHT_MPH ? Math.min(score, ONSHORE_SCORE_CEILING) : score;
}

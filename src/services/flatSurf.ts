import type {HeadlineSurf} from './headlineSurf.ts';

/** T-130: a Flat hour is an `estimate` whose nearshore model height is under the flat threshold (loFt = hiFt = 0, `nearshoreOnly.flat`).
 *  Every surface that reads loFt/hiFt directly asks this first and says "Flat", never "0–0 ft" or an empty bar. */
export const isFlat = (h: HeadlineSurf | null | undefined): boolean => !!h && h.kind === 'estimate' && !!h.nearshoreOnly?.flat;
/** The one wording for a Flat hour wherever an estimate names itself (lead / data-honesty review: never "Est. Flat" or "Flat est."). */
export const FLAT_ESTIMATE_TEXT = 'Flat (model estimate)';

/** T-130: the hour's height comes from the CDIP nowcast at the spot's MOP point (the nearshore model run on measured buoy waves). It is a model,
 *  so the UI says "nowcast nearby (CDIP model)", never "measured". */
export const NOWCAST_NEARBY_TEXT = 'nowcast nearby (CDIP model)';
export function nowcastNearby(h: HeadlineSurf | null | undefined): {source: string} | null {
  if (!h || h.kind !== 'estimate') return null;
  return h.nowcastNearby ?? null;
}
/** Why a Flat hour is flat, in a few words for the line under the number. */
export function flatWhy(h: HeadlineSurf | null | undefined): string {
  const code = h && h.kind === 'estimate' ? h.nearshoreOnly?.code : undefined;
  return code && ['outside-window', 'short-period', 'no-break'].includes(code) ? 'swell mostly blocked here' : 'under half a foot nearshore';
}

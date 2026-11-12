import type {Forecast} from '../../models/index.ts';
import type {OceanBundle} from '../../ocean/types.ts';
import {headlineSurf} from '../../services/headlineSurf.ts';

/** T-119: the 7-day surf-height points for a spot card: the middle of the hour's surf estimate every 3 hours from now (offshore-only and missing
 *  hours are gaps, never surf). Pure enough to test; the same headline the card's number uses. */
export function sparkPoints(spotId: string, records: Forecast[], nowMs: number, bundle: Pick<OceanBundle, 'nearshore' | 'mop' | 'srf'> | null | undefined): {t: number; ft: number | null}[] {
  const from = Math.floor(nowMs / 36e5) * 36e5;
  return records.filter((f) => f.spotId === spotId && Date.parse(f.timestamp) >= from && Date.parse(f.timestamp) < from + 7 * 864e5)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).filter((_, i) => i % 3 === 0)
    .map((f) => { const h = headlineSurf(spotId, f, {bundle, nowMs}); return {t: Date.parse(f.timestamp), ft: h.kind === 'estimate' && Number.isFinite((h.loFt + h.hiFt) / 2) ? (h.loFt + h.hiFt) / 2 : null}; });
}

/** Any point that is not a finite number is a gap. A failed or missing series therefore never reaches the drawing as NaN. */
export const cleanSpark = (points: {t: number; ft: number | null}[] | null | undefined) => (points ?? []).map((q) => ({t: q.t, ft: typeof q.ft === 'number' && Number.isFinite(q.ft) ? q.ft : null}));
/** Worth drawing only with at least two real points; otherwise the card shows no sparkline. */
export const drawable = (points: {t: number; ft: number | null}[] | null | undefined) => cleanSpark(points).filter((q) => q.ft !== null).length >= 2;

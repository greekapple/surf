import type {FaceEstimate} from '../ocean/types.ts';
import {intervalFor} from './uncertainty.ts';
import {spreadAt} from './modelSpread.ts';
import {canPresentBreakingEstimate} from '../utils/waveHeight.ts';

/** The surf-height range (T-081) for a record's own estimate, for consumers that only have the ocean record (Board Match scoring, the rating, the observation context): the same convention height and the same uncertainty as the
 *  headline (services/headlineSurf.ts), so none of them reads the legacy breaking range stored on the record. It is the record's offshore-swell (v1) estimate and its v1 uncertainty. Where a spot has MOP data the headline uses the nearshore model (v2, a different centre), which these callers do not see: for those spots Board Match and the estimate view can differ from the headline (known, documented limit; the rating and the observation context use the headline's or this record's own figure as stated at each call). Null when there is no estimate or it predates the convention. */
export function recordSurfRange(rec: {spotId?: string; timestamp: string; faceEstimate?: FaceEstimate}, nowMs: number, spotId = rec.spotId): {loFt: number; hiFt: number; centralFt: number; halfWidth: number} | null {
  const fe = rec.faceEstimate;
  if (!fe?.input || !canPresentBreakingEstimate(fe.input) || !Number.isFinite(fe.breakingFt) || !Number.isFinite(fe.centralFt)) return null;
  const iv = intervalFor({method: 'v1', centralFt: fe.centralFt as number, modelSpread: spotId ? spreadAt(spotId, rec.timestamp) : null, leadHours: Math.max(0, (Date.parse(rec.timestamp) - nowMs) / 3600000)});
  return iv ? {loFt: iv.loFt, hiFt: iv.hiFt, centralFt: iv.centralFt, halfWidth: iv.halfWidth} : null;
}

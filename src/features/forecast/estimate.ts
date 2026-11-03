import type {Forecast, UserProfile} from '../../models/index.ts';
import {canPresentBreakingEstimate, formatWaveHeight} from '../../utils/waveHeight.ts';
import {recordSurfRange} from '../../services/surfRange.ts';
/** The unvalidated surf-height estimate for a forecast hour, or why there is none (T-081: the convention height and its uncertainty via services/surfRange.ts, not the legacy breaking range). null = this record has no estimate concept (demonstration data). */
export type FaceEstimateView = {state: 'range'; rangeFt: [number, number]; midFt: number; text: string} | {state: 'none'; reason: string};
export function faceEstimateView(f: Forecast, p: UserProfile, nowMs: number = Date.now()): FaceEstimateView | null {
  const e = f.evidence?.faceEstimate;
  if (!e) return f.evidence ? {state: 'none', reason: 'No breaking-wave estimate for this spot.'} : null;
  const sr = e.input && canPresentBreakingEstimate(e.input) ? recordSurfRange(f.evidence!, nowMs) : null;
  if (e.input && sr) {
    const r: [number, number] = [sr.loFt, sr.hiFt];
    return {state: 'range', rangeFt: r, midFt: sr.centralFt, text: formatWaveHeight({...e.input, rangeFt: r}, p).text};
  }
  return {state: 'none', reason: e.refusal ?? 'No breaking-wave estimate for this spot.'};
}

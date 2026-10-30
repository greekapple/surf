import type {Forecast, UserProfile} from '../../models/index.ts';
import {canPresentBreakingEstimate, formatWaveHeight} from '../../utils/waveHeight.ts';
/** The unvalidated breaking-wave estimate (T-008) for a forecast hour, or why there is none. null = this record has no estimate concept (demonstration data). */
export type FaceEstimateView = {state: 'range'; rangeFt: [number, number]; midFt: number; text: string} | {state: 'none'; reason: string};
export function faceEstimateView(f: Forecast, p: UserProfile): FaceEstimateView | null {
  const e = f.evidence?.faceEstimate;
  if (!e) return f.evidence ? {state: 'none', reason: 'No breaking-wave estimate for this spot.'} : null;
  if (e.input && canPresentBreakingEstimate(e.input)) {
    const r = e.input.rangeFt as [number, number];
    return {state: 'range', rangeFt: r, midFt: (r[0] + r[1]) / 2, text: formatWaveHeight(e.input, p).text};
  }
  return {state: 'none', reason: e.refusal ?? 'No breaking-wave estimate for this spot.'};
}

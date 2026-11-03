import {estimateBreakingV2, type BreakingResultV2} from '../ocean/breakingEstimate.ts';
import {breakingProfile} from '../ocean/localCalibration.ts';
import {assignmentFor, mopPoint} from '../ocean/mop.ts';
import type {NearshoreRecord} from '../ocean/nearshore.ts';

/** Breaking estimate v2 is OFF by default (T-041). It never feeds ratings or headline heights; it only adds a labelled experimental line to the nearshore card.
 *  Turn on in the browser with localStorage `swello-flag-breaking-v2` = `on`, or at build time with VITE_BREAKING_V2=on. */
export function breakingV2Enabled(storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null, env: string | undefined = (import.meta as any).env?.VITE_BREAKING_V2): boolean {
  if (env === 'on') return true;
  try { return storage?.getItem('swello-flag-breaking-v2') === 'on'; } catch { return false; }
}

/** v2 estimate for one MOP record at its assigned spot; refuses (with a reason) when the spot has no reviewed MOP point or profile. */
/* T-091: the same record is re-evaluated on every render for every hour (the integration marches over depth); the result is a pure function of the inputs, so it is memoised on them (bounded). */
const v2Memo = new Map<string, BreakingResultV2>();
export function mopBreaking(spotId: string, rec: NearshoreRecord): BreakingResultV2 {
  const a = assignmentFor(spotId), pt = a ? mopPoint(a.mopId) : null;
  if (!a || !pt || rec.mopId !== a.mopId) return {ok: false, code: 'no-profile', reason: 'No reviewed MOP point for this spot.'};
  const key = `${spotId}|${rec.height.value}|${rec.period.value}|${rec.direction.value}`, hit = v2Memo.get(key); if (hit) return hit;
  if (v2Memo.size > 20000) v2Memo.clear();
  const out = compute(spotId, rec, pt); v2Memo.set(key, out); return out;
}
function compute(spotId: string, rec: NearshoreRecord, pt: NonNullable<ReturnType<typeof mopPoint>>): BreakingResultV2 {
  return estimateBreakingV2({hsFt: rec.height.value, periodS: rec.period.value, directionDeg: rec.direction.value, depthM: pt.depthM, shoreNormalDeg: pt.shoreNormalDeg}, breakingProfile(spotId));
}

import type {SurfBandPoint} from '../../services/surfSeries.ts';
import {estimateBand} from './trustRules.ts';
import {CERTAINTY_WORD} from '../../services/certainty.ts';

/** forecast-charts: the chart readout's surf, in its own kind, the same words the Surf card uses (CONTRACTS.md). The estimate's range (Flat when flat) is a
 *  "model estimate", with its tags (buoy-corrected ×f, tuned to your reports, saved copy · not current), how sure when not high, and "models differ" (with the
 *  wider range the models allow in `could`). Past the horizon the number is not called: "too far out", and the model's value is only reported. Any other hour shows
 *  the OFFSHORE height and says it is not surf size (with the NWS zone forecast pointed to the header, where it is shown), or that it is a demonstration.
 *  `fmt(ft)` formats a height in the user's unit with its unit; `fmtR(lo, hi)` a range ("3–4 ft", "0.9–1.2 m"). */
export function surfReadout(heightFt: number | null | undefined, pt: SurfBandPoint | undefined, fmt: (ft: number) => string, fmtR: (lo: number, hi: number) => string): {v: string; kind: string; could?: string} {
  const b = estimateBand(pt), c = pt?.certainty, far = c === 'too-far';
  if (b) {
    const tags = `model estimate${b.transfer ? ` · ${b.transfer}` : ''}${b.tuned ? ' · tuned to your reports' : ''}${b.saved ? ' · saved copy, not current' : ''}`;
    const value = b.flat ? 'Flat' : fmtR(b.lo, b.hi), could = b.wide ? `models differ; could be ${fmtR(b.wide.loFt, b.wide.hiFt)}` : undefined;
    if (far) return {v: 'too far out', kind: `to call; the model says ${value} · ${tags}`, could};
    return {v: value, kind: `${tags}${c && c !== 'high' ? ` · ${CERTAINTY_WORD[c]}` : ''}${b.wide ? ' · models differ' : ''}`, could};
  }
  const off = Number.isFinite(heightFt) ? fmt(heightFt as number) : '—', farW = far ? ' · too far out' : '';
  if (pt?.kind === 'demonstration') return {v: off, kind: 'demonstration · not live'};
  if (pt?.official) return {v: off, kind: `offshore · not surf size${farW}; the NWS surf forecast for the zone is in the header`};
  return {v: off, kind: `offshore · not surf size${farW}`};
}

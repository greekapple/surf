import type {Forecast, SurfSpot} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {headlineSurf} from './headlineSurf.ts';
import {isDark} from './daylight.ts';

/** The main graph's series (T-064): one point per hour from the SAME engine as the Surf card (`headlineSurf`), with offshore Hs as a secondary series.
 *  `lo`/`hi` are the surf-estimate band for estimates; for demonstration or offshore hours they are the single labelled height (lo === hi); `none` has nulls.
 *  `offshoreFt` is the offshore significant wave height ("not surf size") for the thin secondary line. `dark` lets the chart shade night. */
export interface SurfBandPoint {t: string; lo: number | null; hi: number | null; kind: 'estimate' | 'demonstration' | 'offshore' | 'none'; offshoreFt: number | null; dark: boolean}
export function surfBandSeries(spot: SurfSpot, records: Forecast[], ctx: {bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null; nowMs: number}): SurfBandPoint[] {
  return records.filter((f) => f.spotId === spot.id && Number.isFinite(Date.parse(f.timestamp))).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).map((f) => {
    const h = headlineSurf(spot.id, f, {bundle: ctx.bundle, nowMs: ctx.nowMs}), off = Number.isFinite(f.offshore) && f.offshore >= 0 ? f.offshore : null, dark = isDark(spot.id, f.timestamp);
    if (h.kind === 'estimate') return {t: f.timestamp, lo: h.loFt, hi: h.hiFt, kind: 'estimate' as const, offshoreFt: off, dark};
    if (h.kind === 'demonstration' || h.kind === 'offshore') return {t: f.timestamp, lo: h.ft, hi: h.ft, kind: h.kind, offshoreFt: off, dark};
    return {t: f.timestamp, lo: null, hi: null, kind: 'none' as const, offshoreFt: off, dark};
  });
}

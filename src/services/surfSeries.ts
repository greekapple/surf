import type {Forecast, SurfSpot} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {headlineSurf} from './headlineSurf.ts';
import {isDark} from './daylight.ts';
import {isFlat} from './flatSurf.ts';
import {certaintyOf, type Certainty} from './certainty.ts';

/** The main graph's series (T-064): one point per hour from the SAME engine as the Surf card (`headlineSurf`), with offshore Hs as a secondary series.
 *  `lo`/`hi` are the surf-estimate band for estimates; for demonstration or offshore hours they are the single labelled height (lo === hi); `none` has nulls.
 *  `offshoreFt` is the offshore significant wave height ("not surf size") for the thin secondary line. `dark` lets the chart shade night. */
export interface SurfBandPoint {t: string; lo: number | null; hi: number | null; kind: 'estimate' | 'demonstration' | 'offshore' | 'none'; /** offshore-surf: the NWS surf zone forecast covers this hour (shown in the header and day cards, not drawn here) */ official?: boolean; /** T-130: a Flat estimate hour (lo = hi = 0): the band sits on the baseline and the text says Flat. */ flat?: boolean; offshoreFt: number | null; dark: boolean; /** certainty (2026-11-06): the hour's level (certainty.ts), null when none is honest to show; `wide` is the range widened over the wave models where they disagree. */ certainty?: Certainty | null; wide?: {loFt: number; hiFt: number} | null}
export function surfBandSeries(spot: SurfSpot, records: Forecast[], ctx: {bundle?: Pick<OceanBundle, 'nearshore' | 'mop' | 'srf'> | null; nowMs: number}): SurfBandPoint[] {
  return records.filter((f) => f.spotId === spot.id && Number.isFinite(Date.parse(f.timestamp))).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).map((f) => {
    const h = headlineSurf(spot.id, f, {bundle: ctx.bundle, nowMs: ctx.nowMs}), off = Number.isFinite(f.offshore) && f.offshore >= 0 ? f.offshore : null, dark = isDark(spot.id, f.timestamp);
    const cv = certaintyOf(spot.id, h, f.timestamp, ctx.nowMs), c = {certainty: cv?.level ?? null, wide: cv?.wide ?? null};
    if (h.kind === 'estimate') return {t: f.timestamp, lo: h.loFt, hi: h.hiFt, kind: 'estimate' as const, ...(isFlat(h) ? {flat: true} : {}), offshoreFt: off, dark, ...c};
    if (h.kind === 'demonstration' || h.kind === 'offshore') return {t: f.timestamp, lo: h.ft, hi: h.ft, kind: h.kind, offshoreFt: off, dark, ...c};
    // offshore-surf: an NWS range is one range for the zone and day, not an hourly value: it is shown in the header and day cards, never drawn as hours on this chart
    return {t: f.timestamp, lo: null, hi: null, kind: 'none' as const, offshoreFt: off, dark, ...(h.kind === 'official' ? {official: true} : {})};
  });
}

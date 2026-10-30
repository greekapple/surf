import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {canPresentBreakingEstimate, formatWaveHeight} from '../utils/waveHeight.ts';
/** One saved spot for the Home strip (T-024). */
export interface SpotStripItem {
  id: string; name: string; region: string;
  /** Rating band, or FLAT / UNRATED; UNRATED when there is no usable record. */
  category: string;
  /** "Est. 3–7 ft" only when an estimate passes the presentation guard, otherwise "3.9 ft offshore". Never a bare height. */
  heightLabel: string;
  heightKind: 'estimate' | 'offshore' | 'none';
  /** ISO time of the record used, or null when the spot has no record. */
  validTime: string | null;
  /** No ocean evidence behind the record (demonstration data). */
  demo: boolean;
}
/** The record for the current hour: the nearest at or after the top of the hour; failing that, the latest earlier one is NOT used (no stale values). */
export function currentRecord(records: Forecast[], spotId: string, now: number): Forecast | undefined {
  const from = Math.floor(now / 3600000) * 3600000;
  let best: Forecast | undefined, bt = Infinity;
  for (const f of records) {
    if (f.spotId !== spotId) continue;
    const t = Date.parse(f.timestamp);
    if (Number.isFinite(t) && t >= from && t < bt) { best = f; bt = t; }
  }
  return best;
}
/** Saved spots in saved order. Pure: records and profile are passed in. */
export function spotStrip(spots: SurfSpot[], records: Forecast[], savedIds: string[], now: number, profile: UserProfile): SpotStripItem[] {
  const out: SpotStripItem[] = [];
  for (const id of new Set(savedIds)) {
    const spot = spots.find((s) => s.id === id);
    if (!spot) continue;
    const f = currentRecord(records, id, now);
    const base = {id, name: spot.name, region: spot.region};
    if (!f) { out.push({...base, category: 'UNRATED', heightLabel: 'No forecast data', heightKind: 'none', validTime: null, demo: false}); continue; }
    const category = String(rateForecast(spot, f, now).category);
    const est = f.evidence?.faceEstimate?.input;
    if (est && canPresentBreakingEstimate(est)) {
      out.push({...base, category, heightLabel: `Est. ${formatWaveHeight(est, profile).text}`, heightKind: 'estimate', validTime: f.timestamp, demo: !f.evidence});
    } else if (Number.isFinite(f.offshore) && f.offshore >= 0) {
      out.push({...base, category, heightLabel: `${formatWaveHeight({kind: 'offshore', valueFt: f.offshore}, profile, 'technical').text} offshore`, heightKind: 'offshore', validTime: f.timestamp, demo: !f.evidence});
    } else {
      out.push({...base, category, heightLabel: 'No offshore height', heightKind: 'none', validTime: f.timestamp, demo: !f.evidence});
    }
  }
  return out;
}

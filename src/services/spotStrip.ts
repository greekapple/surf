import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {formatWaveHeight} from '../utils/waveHeight.ts';
import {headlineSurf, headlineText} from './headlineSurf.ts';
import type {HourContext} from './spotHour.ts';
import {recordAt} from './spotHour.ts';
/** One saved spot for the Home strip (T-024). */
export interface SpotStripItem {
  id: string; name: string; region: string;
  /** Rating band, or FLAT / UNRATED; UNRATED when there is no usable record. */
  category: string;
  /** "Est. 3–7 ft" only when an estimate passes the presentation guard, otherwise "3.9 ft offshore". Never a bare height. */
  heightLabel: string;
  heightKind: 'estimate' | 'official' | 'offshore' | 'none';
  /** The rating is of a dark hour (after last light / before first light): shown dimmed, never a surf call. */
  dark?: boolean;
  /** ISO time of the record used, or null when the spot has no record. */
  validTime: string | null;
  /** No ocean evidence behind the record (demonstration data). */
  demo: boolean;
}
/** The record for the current hour: the nearest at or after the top of the hour; failing that, the latest earlier one is NOT used (no stale values). */
export const currentRecord = (records: Forecast[], spotId: string, now: number): Forecast | undefined => recordAt(records, spotId, now);
/** Saved spots in saved order. Pure: records and profile are passed in. */
export function spotStrip(spots: SurfSpot[], records: Forecast[], savedIds: string[], now: number, profile: UserProfile, ctx: HourContext = {}): SpotStripItem[] {
  const out: SpotStripItem[] = [];
  for (const id of new Set(savedIds)) {
    const spot = spots.find((s) => s.id === id);
    if (!spot) continue;
    const f = currentRecord(records, id, now);
    const base = {id, name: spot.name, region: spot.region};
    if (!f) { out.push({...base, category: 'UNRATED', heightLabel: 'No forecast data', heightKind: 'none', validTime: null, demo: false}); continue; }
    const rt = rateForecast(spot, f, now), category = String(rt.category);
    if (rt.dark) Object.assign(base, {dark: true});
    // One engine for every surface (T-055): the same headline the Surf card and Home show for this hour.
    const h = headlineSurf(id, f, {bundle: ctx.bundle, nowMs: now}), t = headlineText(h, profile);
    if (h.kind === 'estimate') out.push({...base, category, heightLabel: `Est. ${t.value}`, heightKind: 'estimate', validTime: f.timestamp, demo: !f.evidence});
    else if (h.kind === 'official') out.push({...base, category, heightLabel: `NWS ${t.value}`, heightKind: 'official', validTime: f.timestamp, demo: !f.evidence});
    else if (Number.isFinite(f.offshore) && f.offshore >= 0) out.push({...base, category, heightLabel: `${formatWaveHeight({kind: 'offshore', valueFt: f.offshore}, profile, 'technical').text} offshore`, heightKind: 'offshore', validTime: f.timestamp, demo: !f.evidence});
    else out.push({...base, category, heightLabel: 'No offshore height', heightKind: 'none', validTime: f.timestamp, demo: !f.evidence});
  }
  return out;
}

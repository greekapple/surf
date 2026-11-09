// Presentation model for the Forecast verdict board. It only reshapes what the
// existing data, rating and unit modules return; it never estimates new values.
import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import type {SurfRating} from '../../ratings/types';
import {rateForecast} from '../../ratings/adapters';
import {formatWaveHeight} from '../../utils/waveHeight';
import {dateIn, hourIn, fmtIn, addDaysKey} from '../../ocean/time';
import {timeZoneOf, activeZone} from '../../ocean/spotZone';

export type DataMode = 'Retrieved' | 'Demonstration';

export interface HeroHeight {
  approx: boolean;
  number: string;
  unit: string;
  label: string;
  note: string | null;
}

export function heroHeight(f: Forecast, p: UserProfile, mode: DataMode): HeroHeight {
  const hasFace = f.availability.face && Number.isFinite(f.face);
  const formatted = hasFace
    ? formatWaveHeight({kind: mode === 'Demonstration' ? 'demonstration' : 'breaking-estimate', valueFt: f.face}, p)
    : formatWaveHeight({kind: 'offshore', valueFt: Number.isFinite(f.offshore) ? f.offshore : null}, p);
  const match = formatted.text.match(/^(≈ |<)?([\d.–]+)\s(.+)$/);
  return {
    approx: !!match?.[1],
    number: match ? match[2] : '—',
    unit: match ? match[3] : '',
    label: formatted.label,
    note: hasFace
      ? null
      : 'Surf-face estimate unavailable: no calibrated breaking-wave method for this break. Offshore height is not surf size.',
  };
}

export interface HourSample {
  forecast: Forecast;
  timestamp: string;
  date: string;
  hour: number;
  heightFt: number | null;
  rating: SurfRating;
}

export function hourlySeries(spot: SurfSpot, records: Forecast[], now: number): HourSample[] {
  return records
    .filter(f => f.spotId === spot.id && Number.isFinite(Date.parse(f.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map(f => {
      const tz = timeZoneOf(spot);
      const face = f.availability.face && Number.isFinite(f.face) ? f.face : null;
      const offshore = Number.isFinite(f.offshore) ? f.offshore : null;
      return {
        forecast: f,
        timestamp: f.timestamp,
        date: dateIn(tz, f.timestamp),
        hour: hourIn(tz, f.timestamp),
        heightFt: face ?? offshore,
        rating: rateForecast(spot, f, now),
      };
    });
}

/** Highest-scoring hour in the next 24 h, using the existing provisional rating. */
export function bestUpcoming(series: HourSample[], now: number): HourSample | null {
  const start = Math.floor(now / 3600000) * 3600000;
  const end = start + 24 * 3600000;
  let best: HourSample | null = null;
  for (const s of series) {
    const t = Date.parse(s.timestamp);
    if (t < start || t > end || s.rating.score === null) continue;
    if (!best || s.rating.score > (best.rating.score ?? -1)) best = s;
  }
  return best;
}

export function hourLabel(iso: string, tz: string = activeZone()) {
  return fmtIn(tz, {hour: 'numeric'}).format(new Date(iso));
}

export function dayLabel(iso: string, now: number, tz: string = activeZone()) {
  const date = dateIn(tz, iso), today = dateIn(tz, new Date(now).toISOString());
  if (date === today) return 'Today';
  if (date === addDaysKey(today, 1)) return 'Tomorrow';
  return fmtIn(tz, {weekday: 'short', day: 'numeric'}).format(new Date(iso));
}

export function fullTimeLabel(iso: string, tz: string = activeZone()) {
  return fmtIn(tz, {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}).format(new Date(iso));
}

export type Band = 'good' | 'fair' | 'poor' | 'none';
export const BAND_COLOR: Record<Band, string> = {good: 'var(--good)', fair: 'var(--fair)', poor: 'var(--poor)', none: 'var(--none)'};
export function bandOf(category: string): Band {
  if (['EPIC', 'FIRING', 'GOOD', 'SOLID'].includes(category)) return 'good';
  if (['NOT BAD', 'SURFABLE'].includes(category)) return 'fair';
  return category === 'UNRATED' ? 'none' : 'poor';
}
/** Rating band of one legacy record at a spot, using the existing provisional engine. */
export const band = (f: Forecast, spot: SurfSpot, now = Date.now()) => bandOf(rateForecast(spot, f, now).category);
export const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\w/g, (m) => m.toUpperCase());
/** Factual 6-hour trend of the plotted height (offshore Hs, or the demonstration face). */
export function trendOf(series: HourSample[], i: number): 'building' | 'easing' | 'steady' | 'unknown' {
  const a = series[i]?.heightFt, b = series[Math.min(series.length - 1, i + 6)]?.heightFt;
  if (a === null || a === undefined || b === null || b === undefined) return 'unknown';
  return b - a > 0.4 ? 'building' : a - b > 0.4 ? 'easing' : 'steady';
}

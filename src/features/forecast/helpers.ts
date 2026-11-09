// Presentation helpers for the Forecast area. They only reshape existing data.
import {dateIn} from '../../ocean/time';
import {activeZone} from '../../ocean/spotZone';
import type {SurfSpot, UserProfile} from '../../models/index';
import {evidenceSpots} from '../../ocean/spots';
import {solarTimes} from '../../ocean/sun';
import {heightValue, wind as windText, compass} from '../../utils/units';
import type {HourSample} from './model';

export {compass};
/** Spot coordinates: retrieved spots have them; demonstration spots fall back to the San Francisco coast. */
export function spotLatLon(spot: SurfSpot): [number, number] {
  const e = evidenceSpots.find((x) => x.id === spot.id);
  return e ? [e.latitude, e.longitude] : [37.76, -122.51];
}

/** Approximate sunrise/sunset (NOAA simplified solar position) for the local date of `iso` (the spot's zone). */
export function sunTimes(iso: string, lat: number, lon: number, tz: string = activeZone()) {
  const key = dateIn(tz, iso);
  return solarTimes(key, lat, lon);
}
export const isDaylight = (iso: string, lat: number, lon: number, tz: string = activeZone()) => {
  const {rise, set} = sunTimes(iso, lat, lon, tz), t = Date.parse(iso);
  return t >= rise && t <= set;
};

/** Highest provisional score among daylight hours in [from, to). The rating engine itself ignores daylight. */
export function bestDaylight(series: HourSample[], spot: SurfSpot, from: number, to: number) {
  const [lat, lon] = spotLatLon(spot);
  let best: HourSample | null = null;
  for (const h of series) {
    const t = Date.parse(h.timestamp);
    if (t < from || t >= to || h.rating.score === null || !isDaylight(h.timestamp, lat, lon)) continue;
    if (!best || h.rating.score > (best.rating.score ?? -1)) best = h;
  }
  return best;
}

/** Offshore and swell heights are never converted to Hawaiian (that scale is for breaking faces only). */
export const ht = (ft: number | null | undefined, p: UserProfile, digits = 1) =>
  ft === null || ft === undefined || !Number.isFinite(ft) ? '—' : heightValue(ft, p, false).toFixed(digits);
export const windVal = (mph: number | null | undefined, p: UserProfile) =>
  mph === null || mph === undefined || !Number.isFinite(mph) ? '—' : windText(mph, p).split(' ')[0];

export interface Day {key: string; start: number; end: number; t: string; max: number}
export function groupDays(series: HourSample[]): Day[] {
  const days: Day[] = [];
  series.forEach((h, i) => {
    const d = days[days.length - 1];
    if (!d || d.key !== h.date) days.push({key: h.date, start: i, end: i, t: h.timestamp, max: h.heightFt ?? 0});
    else { d.end = i; d.max = Math.max(d.max, h.heightFt ?? 0); }
  });
  return days;
}

/** Monotone cubic path through points; never overshoots the values it passes through. */
export function monotonePath(pts: [number, number][]) {
  const n = pts.length;
  if (!n) return '';
  if (n === 1) return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`; // a one-hour day still yields a valid path
  const dx: number[] = [], dy: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0] || 1e-6; dy[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  m[0] = dy[0]; m[n - 1] = dy[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = dy[i - 1] * dy[i] <= 0 ? 0 : (dy[i - 1] + dy[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (dy[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / dy[i], b = m[i + 1] / dy[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * dy[i]; m[i + 1] = k * b * dy[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    d += `C${(pts[i][0] + h / 3).toFixed(1)},${(pts[i][1] + (m[i] * h) / 3).toFixed(1)} ${(pts[i + 1][0] - h / 3).toFixed(1)},${(pts[i + 1][1] - (m[i + 1] * h) / 3).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

const WIND: [number, number[]][] = [[0, [96, 128, 214]], [6, [118, 160, 236]], [10, [150, 200, 120]], [14, [214, 210, 96]], [18, [236, 168, 72]], [24, [230, 96, 72]]];
/** Windy-like speed colour (mph). */
export function windColor(mph: number) {
  let lo = WIND[0], hi = WIND[WIND.length - 1];
  for (let i = 0; i < WIND.length - 1; i++) if (mph >= WIND[i][0] && mph <= WIND[i + 1][0]) { lo = WIND[i]; hi = WIND[i + 1]; }
  const t = hi[0] === lo[0] ? 0 : Math.max(0, Math.min(1, (mph - lo[0]) / (hi[0] - lo[0])));
  return `rgb(${lo[1].map((v, k) => Math.round(v + (hi[1][k] - v) * t)).join(',')})`;
}

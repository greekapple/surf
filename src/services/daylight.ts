import {evidenceSpots} from '../ocean/spots.ts';
import {solarTimes} from '../ocean/sun.ts';
import {pacificDate} from '../ocean/time.ts';

/** Daylight for a spot and a Pacific date (T-064). First light and last light are civil twilight (sun 6° below the horizon, zenith 96°); sunrise and sunset use 90.833°.
 *  From a solar-position formula (a few minutes accurate), not an observation. Spots without coordinates fall back to Ocean Beach. */
export interface Daylight {firstLight: string; sunrise: string; sunset: string; lastLight: string}
const coords = (spotId: string): [number, number] => { const e = evidenceSpots.find((s) => s.id === spotId); return [e?.latitude ?? 37.76, e?.longitude ?? -122.51]; };
const iso = (ms: number) => new Date(ms).toISOString();
export function daylightFor(spotId: string, dateKey: string): Daylight {
  const [lat, lon] = coords(spotId), civil = solarTimes(dateKey, lat, lon, 96), sun = solarTimes(dateKey, lat, lon, 90.833);
  return {firstLight: iso(civil.rise), sunrise: iso(sun.rise), sunset: iso(sun.set), lastLight: iso(civil.set)};
}
/** Is the HOUR starting at `isoTime` dark? The hour's midpoint is compared with first and last light, so the hour containing first light counts as light. */
export function isDark(spotId: string, isoTime: string): boolean {
  const t = Date.parse(isoTime); if (!Number.isFinite(t)) return false;
  const mid = t + 1800000, [lat, lon] = coords(spotId), c = solarTimes(pacificDate(isoTime), lat, lon, 96);
  return mid < c.rise || mid > c.set;
}

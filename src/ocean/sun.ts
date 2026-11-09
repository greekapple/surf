import {localMiddayMs} from './time.ts';
/** Sunrise/sunset (NOAA simplified solar position, a few minutes accurate) for a Pacific date key 'YYYY-MM-DD'. Zenith 90.833° is sunrise/sunset; 96° is civil twilight (first and last light). */
export function solarTimes(dateKey: string, lat: number, lon: number, zenithDeg = 90.833, tz?: string) {
  // The solar noon nearest to the LOCAL midday of the date key. With no zone the date's 12:00 UTC is used (right where the zone is near lon/15, the case for every US West Coast spot);
  // a zone ahead of its meridian (Samoa UTC+13 at 171.8 W, Tonga, Chatham) needs the zone, or the whole local day lands a day late.
  const r = Math.PI / 180, J = (tz ? localMiddayMs(tz, dateKey) : new Date(`${dateKey}T12:00:00Z`).getTime()) / 86400000 + 2440587.5 - 2451545;
  const n = Math.round(J - 0.0009 + lon / 360), Js = n + 0.0009 - lon / 360;
  const M = (357.5291 + 0.98560028 * Js) % 360;
  const C = 1.9148 * Math.sin(M * r) + 0.02 * Math.sin(2 * M * r) + 0.0003 * Math.sin(3 * M * r);
  const L = (M + C + 282.9372) % 360;
  const Jt = 2451545 + Js + 0.0053 * Math.sin(M * r) - 0.0069 * Math.sin(2 * L * r);
  const dec = Math.asin(Math.sin(L * r) * Math.sin(23.44 * r));
  const w = Math.acos(Math.max(-1, Math.min(1, (Math.cos(zenithDeg * r) - Math.sin(lat * r) * Math.sin(dec)) / (Math.cos(lat * r) * Math.cos(dec))))) / r;
  const ms = (jd: number) => (jd - 2440587.5) * 86400000;
  return {rise: ms(Jt - w / 360), set: ms(Jt + w / 360)};
}

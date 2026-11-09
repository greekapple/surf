import {evidenceSpots} from './spots.ts';

/** Where each national data source reaches (spec 2026-11-09 C2). CO-OPS tide predictions, NWS alerts, CDIP MOP nearshore points and NDBC/ASOS shore stations are US sources; a spot in another country must never borrow
 *  one from across a border (a Baja beach 20 km from Imperial Beach is not "near" the Imperial Beach tide station). Open-Meteo marine and weather are global, so the forecast, the rating and the offshore numbers always run.
 *  `country` is an ISO 3166-1 alpha-2 code on the spot; absent = 'US' (every spot until the world catalogue). */
export const NOT_AVAILABLE_IN_REGION = 'not available in this region';
export type CoverageKind = 'tide' | 'alerts' | 'nearshore' | 'shoreWind';
export const DEFAULT_COUNTRY = 'US';
export const countryOf = (spot: string | {id: string; country?: string} | null | undefined): string => {
  if (!spot) return DEFAULT_COUNTRY;
  if (typeof spot !== 'string' && spot.country) return spot.country.toUpperCase();
  const id = typeof spot === 'string' ? spot : spot.id;
  return (evidenceSpots.find((s) => s.id === id)?.country ?? DEFAULT_COUNTRY).toUpperCase();
};
/** The four US sources cover a spot only in the US (Hawaii included). */
/** Bounding boxes of the US for a map POINT (no spot to look a country up): the West Coast to 49.1 N, Hawaii, Alaska and the Aleutians. Used for points on the map and by the guard test on spot countries. */
export const US_BOXES: [string, number, number, number, number][] = [['West Coast', 32.4, 49.1, -125.0, -117.0], ['Hawaii', 18.5, 22.5, -160.8, -154.5], ['Alaska', 51.0, 72.0, -180.0, -129.9], ['Aleutians (east of the date line)', 51.0, 55.5, 167.0, 180.0]];
export const pointInUs = (lat: number, lon: number): boolean => US_BOXES.some(([, a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);
/** US territories use the same national services (NWS, CO-OPS, NDBC): Puerto Rico, Guam, the US Virgin Islands, American Samoa, the Northern Marianas and the minor outlying islands. */
export const US_COUNTRY_CODES = ['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM'] as const;
export const hasUsData = (spot: string | {id: string; country?: string} | null | undefined): boolean => (US_COUNTRY_CODES as readonly string[]).includes(countryOf(spot));
/** The words a screen shows where a source has no coverage for the spot's region, else null (a US spot with no station simply has none nearby: that is a different, existing message). */
export const regionNote = (spot: string | {id: string; country?: string} | null | undefined, kind: CoverageKind): string | null =>
  hasUsData(spot) ? null : `${({tide: 'Tide predictions', alerts: 'Weather alerts', nearshore: 'Nearshore wave model', shoreWind: 'Measured shore wind'} as const)[kind]}: ${NOT_AVAILABLE_IN_REGION}`;

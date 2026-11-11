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
/** Bounding boxes of the US for a map POINT (no spot to look a country up): the West Coast to 49.1 N, Hawaii, Alaska and the Aleutians, and the Atlantic coast from Maine to Florida. Used for points on the map and by the guard test on spot countries. */
export const US_BOXES: [string, number, number, number, number][] = [['West Coast', 32.4, 49.1, -125.0, -117.0], ['Hawaii', 18.5, 22.5, -160.8, -154.5], ['Alaska', 51.0, 72.0, -180.0, -129.9], ['Aleutians (east of the date line)', 51.0, 55.5, 167.0, 180.0],
  // Atlantic coast (US East round, 2026-11-09): open-ocean and inland US only; the boxes stop at the Canadian border and east of Florida at -79.95 (the Bahamas start at -79.3).
  ['Maine and New Hampshire coast', 42.7, 44.9, -71.0, -66.9], ['Massachusetts to New Jersey', 38.9, 42.8, -75.6, -69.8], ['Delaware to Georgia and north Florida', 30.7, 38.9, -82.0, -74.7], ['Florida Atlantic coast', 24.4, 30.7, -82.0, -79.95],
  // Gulf of Mexico coast (US East/Gulf/PR round 3, 2026-11-10): Texas to the Florida panhandle (north of the Rio Grande mouth, 26.0 N), and the Florida peninsula's Gulf coast to the Keys. A box says only that a point is a US point for the national services (NOAA CO-OPS, NWS, NDBC); it assigns no shore wind (the wind build reads CA/OR/WA ASOS only).
  ['Gulf coast: Texas to the Florida panhandle', 26.0, 31.1, -97.5, -85.0], ['Florida Gulf coast', 24.4, 30.8, -85.0, -81.0],
  // US Caribbean territories (same national services): Puerto Rico with Vieques and Culebra, and the US Virgin Islands.
  ['Puerto Rico', 17.8, 18.6, -67.5, -65.1], ['US Virgin Islands', 17.6, 18.45, -65.15, -64.5]];
export const pointInUs = (lat: number, lon: number): boolean => US_BOXES.some(([, a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);
/** US territories use the same national services (NWS, CO-OPS, NDBC): Puerto Rico, Guam, the US Virgin Islands, American Samoa, the Northern Marianas and the minor outlying islands. */
export const US_COUNTRY_CODES = ['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM'] as const;
export const hasUsData = (spot: string | {id: string; country?: string} | null | undefined): boolean => (US_COUNTRY_CODES as readonly string[]).includes(countryOf(spot));
/** The words a screen shows where a source has no coverage for the spot's region, else null (a US spot with no station simply has none nearby: that is a different, existing message). */
export const regionNote = (spot: string | {id: string; country?: string} | null | undefined, kind: CoverageKind): string | null =>
  hasUsData(spot) ? null : `${({tide: 'Tide predictions', alerts: 'Weather alerts', nearshore: 'Nearshore wave model', shoreWind: 'Measured shore wind'} as const)[kind]}: ${NOT_AVAILABLE_IN_REGION}`;

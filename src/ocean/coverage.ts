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
export const hasUsData = (spot: string | {id: string; country?: string} | null | undefined): boolean => countryOf(spot) === 'US';
/** The words a screen shows where a source has no coverage for the spot's region, else null (a US spot with no station simply has none nearby: that is a different, existing message). */
export const regionNote = (spot: string | {id: string; country?: string} | null | undefined, kind: CoverageKind): string | null =>
  hasUsData(spot) ? null : `${({tide: 'Tide predictions', alerts: 'Weather alerts', nearshore: 'Nearshore wave model', shoreWind: 'Measured shore wind'} as const)[kind]}: ${NOT_AVAILABLE_IN_REGION}`;

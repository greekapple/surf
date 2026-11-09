/** NWS public forecast zone per spot (T-064), resolved on 2026-11-02 from https://api.weather.gov/points/{lat},{lon} (`properties.forecastZone`) with docs/forecast/data/nws-zones.ts.
 *  Only land/coastal zones (CAZ...) are used: Beach Hazards Statements, High Surf and Rip Current alerts are issued for them. A spot whose point resolves to a marine zone (PZZ...) has no zone here and shows no alerts.
 *  Zones change rarely; re-run the script to refresh. Source: National Weather Service (public domain). */
export const NWS_ZONES_RESOLVED = '2026-11-02';
export const NWS_ZONE: Record<string, string | null> = {
  'spot-2': "CAZ006",
  'spot-0': "CAZ505",
  'spot-3': "CAZ509",
  'spot-1': "CAZ505",
  'spot-4': "CAZ509",
  'spot-5': null, // marine zone PZZ545: no land beach-hazard zone resolved
  'spot-6': null, // marine zone PZZ535: no land beach-hazard zone resolved
  'spot-7': "CAZ529",
  'spot-8': null, // marine zone PZZ535: no land beach-hazard zone resolved
  'spot-9': "CAZ529",
  'cs-crescent-city': null, // marine zone PZZ450: no land beach-hazard zone resolved
  'cs-moonstone': "CAZ103",
  'cs-north-jetty': null, // marine zone PZZ450: no land beach-hazard zone resolved
  'cs-shelter-cove': "CAZ104",
  'cs-point-arena': null, // marine zone PZZ540: no land beach-hazard zone resolved
  'cs-salmon-creek': null, // marine zone PZZ540: no land beach-hazard zone resolved
  'cs-dillon-beach': null, // marine zone PZZ540: no land beach-hazard zone resolved
  'cs-waddell': null, // marine zone PZZ560: no land beach-hazard zone resolved
  'cs-manresa': null, // marine zone PZZ535: no land beach-hazard zone resolved
  'cs-moss-landing': null, // marine zone PZZ535: no land beach-hazard zone resolved
  'cs-asilomar': "CAZ530",
  'cs-carmel': "CAZ530",
  'cs-sand-dollar': null, // marine zone PZZ565: no land beach-hazard zone resolved
  'cs-morro-rock': null, // marine zone PZZ645: no land beach-hazard zone resolved
  'cs-pismo': "CAZ340",
  'cs-jalama': "CAZ349",
  'cs-rincon': "CAZ350",
  'cs-c-street': "CAZ354",
  'cs-county-line': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-zuma': "CAZ362",
  'cs-malibu': "CAZ362",
  'cs-topanga': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-el-porto': "CAZ366",
  'cs-hermosa': "CAZ366",
  'cs-huntington': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-wedge': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-salt-creek': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-trestles': "CAZ043",
  'cs-oceanside': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-swamis': "CAZ043",
  'cs-cardiff': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-blacks': "CAZ043",
  'cs-windansea': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-ob-sd': "CAZ043",
  'cs-imperial': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-rodeo-beach': "CAZ505",
  'cs-kellys-cove': null, // marine zone PZZ545: no land beach-hazard zone resolved
  'cs-sloat': "CAZ006",
  'cs-sharp-park': "CAZ509",
  'cs-rockaway': "CAZ509",
  'cs-princeton-jetty': null, // marine zone PZZ545: no land beach-hazard zone resolved
  'cs-half-moon-bay': "CAZ509",
  'cs-pescadero': null, // marine zone PZZ545: no land beach-hazard zone resolved
  'cs-pigeon-point': "CAZ509",
  'cs-scott-creek': "CAZ509",
  'cs-capitola': null, // marine zone PZZ535: no land beach-hazard zone resolved
  'cs-natural-bridges': "CAZ529",
  'cs-marina': "CAZ530",
  'cs-andrew-molera': null, // marine zone PZZ565: no land beach-hazard zone resolved
};

/** Spots whose own point falls in a marine zone borrow the coastal zone of the nearest zoned spot, only when it is within 15 km (the same stretch of coast). Marked approximate in the UI text; farther spots have no zone. */
export const NWS_ZONE_APPROX: Record<string, {zone: string; viaSpot: string; km: number}> = {
  'spot-5': {zone: 'CAZ509', viaSpot: 'spot-4', km: 6}, // Mavericks -> Montara
  'spot-6': {zone: 'CAZ529', viaSpot: 'spot-7', km: 1}, // Steamer Lane -> Cowell’s
  'spot-8': {zone: 'CAZ529', viaSpot: 'spot-7', km: 5}, // Pleasure Point -> Cowell’s
  'cs-waddell': {zone: 'CAZ529', viaSpot: 'spot-9', km: 12}, // Waddell Creek -> Davenport
  'cs-manresa': {zone: 'CAZ529', viaSpot: 'spot-7', km: 15}, // Manresa -> Cowell’s
  'cs-county-line': {zone: 'CAZ362', viaSpot: 'cs-zuma', km: 14}, // County Line -> Zuma
  'cs-topanga': {zone: 'CAZ362', viaSpot: 'cs-malibu', km: 9}, // Topanga -> Malibu (Surfrider)
  'cs-cardiff': {zone: 'CAZ043', viaSpot: 'cs-swamis', km: 3}, // Cardiff Reef -> Swami’s
  'cs-windansea': {zone: 'CAZ043', viaSpot: 'cs-blacks', km: 7}, // Windansea -> Black’s Beach
  'cs-kellys-cove': {zone: 'CAZ006', viaSpot: 'spot-2', km: 2}, // Kelly's Cove -> Ocean Beach
  'cs-princeton-jetty': {zone: 'CAZ509', viaSpot: 'cs-half-moon-bay', km: 2.3}, // Princeton Jetty -> Half Moon Bay (Dunes Beach)
  'cs-pescadero': {zone: 'CAZ509', viaSpot: 'cs-pigeon-point', km: 8.8}, // Pescadero State Beach -> Pigeon Point
  'cs-capitola': {zone: 'CAZ529', viaSpot: 'spot-7', km: 6.4}, // Capitola -> Cowell’s
};
export interface ZoneInfo {zone: string; approx: boolean; viaSpot?: string}
export function zoneFor(spotId: string): ZoneInfo | null {
  const z = NWS_ZONE[spotId]; if (z) return {zone: z, approx: false};
  const a = NWS_ZONE_APPROX[spotId]; return a ? {zone: a.zone, approx: true, viaSpot: a.viaSpot} : null;
}

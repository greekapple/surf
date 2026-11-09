/** NWS public forecast zone per spot (T-064), resolved on 2026-11-02 from https://api.weather.gov/points/{lat},{lon} (`properties.forecastZone`) with docs/forecast/data/nws-zones.ts.
 *  Only land/coastal zones (CAZ...) are used: Beach Hazards Statements, High Surf and Rip Current alerts are issued for them. A spot whose point resolves to a marine zone (PZZ...) has no zone here and shows no alerts.
 *  Zones change rarely; re-run the script to refresh. Source: National Weather Service (public domain). */
import {hasUsData} from '../ocean/coverage.ts';
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
  'cs-huntington': "CAZ552", // the beach point resolves to marine zone PZZ655; CAZ552 (Orange County Coastal) is api.weather.gov/points about 0.8 km inland, checked 2026-11-09
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
  'cs-cayucos': null, // marine zone PZZ645: no land beach-hazard zone resolved
  'cs-shell-beach': null, // marine zone PZZ645: no land beach-hazard zone resolved
  'cs-hammonds': null, // marine zone PZZ650: no land beach-hazard zone resolved
  'cs-sands': null, // marine zone PZZ650: no land beach-hazard zone resolved
  'cs-campus-point': "CAZ350",
  'cs-leadbetter': "CAZ350",
  'cs-mondos': null, // marine zone PZZ650: no land beach-hazard zone resolved
  'cs-emma-wood': "CAZ354",
  'cs-silver-strand': null, // marine zone PZZ650: no land beach-hazard zone resolved
  'cs-leo-carrillo': "CAZ362",
  'cs-sunset-point': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-venice-breakwater': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-manhattan-beach': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-redondo-breakwater': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-bolsa-chica': "CAZ552",
  'cs-blackies': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-doheny': "CAZ552", // the beach point resolves to marine zone PZZ655; CAZ552 (Orange County Coastal) is api.weather.gov/points about 0.8 km inland, checked 2026-11-09
  'cs-san-clemente-pier': "CAZ552", // the beach point resolves to marine zone PZZ655; CAZ552 (Orange County Coastal) is api.weather.gov/points about 0.8 km inland, checked 2026-11-09
  'cs-t-street': "CAZ552", // the beach point resolves to marine zone PZZ655; CAZ552 (Orange County Coastal) is api.weather.gov/points about 0.8 km inland, checked 2026-11-09
  'cs-san-onofre': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-oceanside-harbor': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-tamarack': "CAZ043",
  'cs-ponto': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-beacons': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-seaside-reef': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-torrey-pines': "CAZ043",
  'cs-scripps': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-pacific-beach': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-sunset-cliffs': null, // marine zone PZZ740: no land beach-hazard zone resolved
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
  'cs-shell-beach': {zone: 'CAZ340', viaSpot: 'cs-pismo', km: 5}, // Shell Beach -> Pismo Beach Pier
  'cs-hammonds': {zone: 'CAZ350', viaSpot: 'cs-leadbetter', km: 6.1}, // Hammond's -> Leadbetter
  'cs-sands': {zone: 'CAZ350', viaSpot: 'cs-campus-point', km: 3.5}, // Sands (Isla Vista) -> Campus Point
  'cs-mondos': {zone: 'CAZ354', viaSpot: 'cs-emma-wood', km: 6.4}, // Mondos -> Emma Wood
  'cs-sunset-point': {zone: 'CAZ362', viaSpot: 'cs-malibu', km: 11.5}, // Sunset Point -> Malibu (Surfrider)
  'cs-venice-breakwater': {zone: 'CAZ366', viaSpot: 'cs-el-porto', km: 10.7}, // Venice Breakwater -> El Porto
  'cs-manhattan-beach': {zone: 'CAZ366', viaSpot: 'cs-el-porto', km: 2}, // Manhattan Beach -> El Porto
  'cs-redondo-breakwater': {zone: 'CAZ366', viaSpot: 'cs-hermosa', km: 1.2}, // Redondo Breakwater -> Hermosa Pier
  'cs-san-onofre': {zone: 'CAZ043', viaSpot: 'cs-trestles', km: 2.4}, // San Onofre -> Trestles
  'cs-oceanside-harbor': {zone: 'CAZ043', viaSpot: 'cs-tamarack', km: 7.3}, // Oceanside Harbor -> Tamarack
  'cs-ponto': {zone: 'CAZ043', viaSpot: 'cs-swamis', km: 6.3}, // Ponto -> Swami’s
  'cs-beacons': {zone: 'CAZ043', viaSpot: 'cs-swamis', km: 3.4}, // Beacons -> Swami’s
  'cs-seaside-reef': {zone: 'CAZ043', viaSpot: 'cs-swamis', km: 3.8}, // Seaside Reef -> Swami’s
  'cs-scripps': {zone: 'CAZ043', viaSpot: 'cs-blacks', km: 2.5}, // Scripps -> Black’s Beach
  'cs-pacific-beach': {zone: 'CAZ043', viaSpot: 'cs-ob-sd', km: 5.4}, // Pacific Beach -> Ocean Beach (San Diego)
  'cs-sunset-cliffs': {zone: 'CAZ043', viaSpot: 'cs-ob-sd', km: 2.8}, // Sunset Cliffs -> Ocean Beach (San Diego)
};
export interface ZoneInfo {zone: string; approx: boolean; viaSpot?: string}
export function zoneFor(spotId: string): ZoneInfo | null {
  if (!hasUsData(spotId)) return null;   // NWS covers the US only: a spot elsewhere has no alerts zone, never a neighbour country's
  const z = NWS_ZONE[spotId]; if (z) return {zone: z, approx: false};
  const a = NWS_ZONE_APPROX[spotId]; return a ? {zone: a.zone, approx: true, viaSpot: a.viaSpot} : null;
}

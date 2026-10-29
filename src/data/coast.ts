import type {SurfSpot} from '../models/index.ts';
import type {SpotEvidence} from '../ocean/types.ts';

/**
 * California coast spots with live model data (added 2026-10-29).
 * Coordinates are approximate beach points (public map positions, rounded), not surveyed takeoffs. The marine query
 * point sits ~9 km seaward so the wave model returns a sea cell. `seaward` is the approximate direction the beach faces.
 * Profiles (type, skill, ideal swell) are generic coastal defaults for the provisional rating and are labelled as such.
 * Keep ids and coordinates in sync with `coastServiceSpots` in services/forecast-service.mjs (tested in coast.test.ts).
 */
type Row = [id: string, name: string, region: string, type: SurfSpot['type'], lat: number, lon: number, seaward: number];
export const COAST_ROWS: Row[] = [
  ['cs-crescent-city', 'Crescent City', 'Del Norte', 'Beach', 41.745, -124.188, 200],
  ['cs-moonstone', 'Moonstone Beach', 'Humboldt', 'Beach', 41.033, -124.113, 250],
  ['cs-north-jetty', 'Humboldt North Jetty', 'Humboldt', 'Beach', 40.768, -124.236, 285],
  ['cs-shelter-cove', 'Shelter Cove', 'Humboldt', 'Point', 40.024, -124.07, 200],
  ['cs-point-arena', 'Point Arena', 'Mendocino', 'Reef', 38.914, -123.712, 240],
  ['cs-salmon-creek', 'Salmon Creek', 'Sonoma', 'Beach', 38.354, -123.068, 260],
  ['cs-dillon-beach', 'Dillon Beach', 'Marin', 'Beach', 38.25, -122.969, 280],
  ['cs-waddell', 'Waddell Creek', 'Santa Cruz', 'Beach', 37.096, -122.278, 240],
  ['cs-manresa', 'Manresa', 'Santa Cruz', 'Beach', 36.93, -121.864, 240],
  ['cs-moss-landing', 'Moss Landing', 'Monterey', 'Beach', 36.804, -121.79, 270],
  ['cs-asilomar', 'Asilomar', 'Monterey', 'Reef', 36.619, -121.94, 280],
  ['cs-carmel', 'Carmel Beach', 'Monterey', 'Beach', 36.553, -121.928, 260],
  ['cs-sand-dollar', 'Sand Dollar', 'Big Sur', 'Beach', 35.924, -121.469, 220],
  ['cs-morro-rock', 'Morro Rock', 'San Luis Obispo', 'Beach', 35.372, -120.866, 280],
  ['cs-pismo', 'Pismo Beach Pier', 'San Luis Obispo', 'Beach', 35.138, -120.644, 240],
  ['cs-jalama', 'Jalama', 'Santa Barbara', 'Beach', 34.511, -120.502, 230],
  ['cs-rincon', 'Rincon', 'Santa Barbara', 'Point', 34.373, -119.478, 220],
  ['cs-c-street', 'C Street', 'Ventura', 'Point', 34.274, -119.3, 220],
  ['cs-county-line', 'County Line', 'Ventura', 'Beach', 34.051, -118.964, 200],
  ['cs-zuma', 'Zuma', 'Los Angeles', 'Beach', 34.015, -118.822, 200],
  ['cs-malibu', 'Malibu (Surfrider)', 'Los Angeles', 'Point', 34.036, -118.678, 180],
  ['cs-topanga', 'Topanga', 'Los Angeles', 'Point', 34.038, -118.582, 190],
  ['cs-el-porto', 'El Porto', 'Los Angeles', 'Beach', 33.901, -118.421, 255],
  ['cs-hermosa', 'Hermosa Pier', 'Los Angeles', 'Beach', 33.862, -118.402, 260],
  ['cs-huntington', 'Huntington Pier', 'Orange County', 'Beach', 33.655, -118.003, 215],
  ['cs-wedge', 'The Wedge', 'Orange County', 'Beach', 33.593, -117.882, 190],
  ['cs-salt-creek', 'Salt Creek', 'Orange County', 'Reef', 33.479, -117.729, 240],
  ['cs-trestles', 'Trestles', 'Orange County', 'Point', 33.384, -117.589, 220],
  ['cs-oceanside', 'Oceanside Pier', 'San Diego', 'Beach', 33.193, -117.387, 250],
  ['cs-swamis', 'Swami’s', 'San Diego', 'Reef', 33.035, -117.293, 260],
  ['cs-cardiff', 'Cardiff Reef', 'San Diego', 'Reef', 33.014, -117.282, 250],
  ['cs-blacks', 'Black’s Beach', 'San Diego', 'Beach', 32.889, -117.253, 270],
  ['cs-windansea', 'Windansea', 'San Diego', 'Reef', 32.83, -117.281, 260],
  ['cs-ob-sd', 'Ocean Beach (San Diego)', 'San Diego', 'Beach', 32.749, -117.253, 260],
  ['cs-imperial', 'Imperial Beach', 'San Diego', 'Beach', 32.579, -117.134, 250],
];

/** Coordinates for the seven Bay Area / Santa Cruz demonstration profiles that now also get live data. */
export const UPGRADED_ROWS: Row[] = [
  ['spot-1', 'Stinson Beach', 'Marin', 'Beach', 37.9, -122.644, 220],
  ['spot-4', 'Montara', 'San Mateo', 'Beach', 37.545, -122.515, 270],
  ['spot-5', 'Mavericks', 'San Mateo', 'Reef', 37.495, -122.5, 250],
  ['spot-6', 'Steamer Lane', 'Santa Cruz', 'Point', 36.951, -122.026, 200],
  ['spot-7', 'Cowell’s', 'Santa Cruz', 'Point', 36.962, -122.023, 190],
  ['spot-8', 'Pleasure Point', 'Santa Cruz', 'Reef', 36.955, -121.971, 200],
  ['spot-9', 'Davenport', 'Santa Cruz', 'Beach', 37.011, -122.196, 250],
];

const r3 = (n: number) => Math.round(n * 1000) / 1000;
/** ~9 km seaward of the beach point, so the marine model returns a sea cell. */
export function marinePoint(lat: number, lon: number, seaward: number) {
  const th = (seaward * Math.PI) / 180, d = 0.08;
  return {lat: r3(lat + d * Math.cos(th)), lon: r3(lon + (d * Math.sin(th)) / Math.cos((lat * Math.PI) / 180))};
}

export const coastSurfSpots: SurfSpot[] = COAST_ROWS.map(([id, name, region, type, , , seaward]) => ({
  id, name, region, type, skill: 'Intermediate', idealDirection: seaward, exposure: 1, period: [9, 18], tides: ['Low', 'Rising'],
  seaward, character: 'Generic profile', hazards: null, illustrative: true, waveRange: [2, 8], windTolerance: 1, organizationPreference: 70,
}));

const common = {difficulty: null, orientation: null, idealSwell: null, periodRange: null, tidePreferences: null, faceRange: null, hazards: null, hazardsComplete: false, sources: [], checkedOn: '2026-10-29'} as const;
const note = 'Approximate public map position for the beach; the marine point is ~9 km seaward. Spot profile is a generic coastal default, not a surveyed break.';

export const coastEvidence: SpotEvidence[] = [...UPGRADED_ROWS, ...COAST_ROWS].map(([id, name, region, type, lat, lon, seaward]) => {
  const m = marinePoint(lat, lon, seaward);
  return {...common, sources: [], hazards: null, id, name, region, location: `${name} (approximate)`, latitude: lat, longitude: lon,
    marineLatitude: m.lat, marineLongitude: m.lon, queryNote: note, breakType: type};
});

/** True when the San Francisco tide station (9414290) is a fair regional reference (within ~70 km). */
export const nearSanFrancisco = (lat: number, lon: number) => Math.hypot(lat - 37.806, (lon + 122.466) * Math.cos((37.8 * Math.PI) / 180)) < 0.65;

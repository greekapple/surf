/** CO-OPS tide-prediction stations (T-041). A spot may use a station's tide only by a reviewed assignment; labels always say "station tide", never "beach tide".
 *  Positions read from the CO-OPS metadata API (mdapi) on 2026-11-02; predictions verified live for both new stations. */
export interface TideStation {id: string; name: string; lat: number; lon: number; retrievedOn: string; url: string}
export const tideStations: TideStation[] = [
  {id: '9414290', name: 'San Francisco', lat: 37.806305, lon: -122.46589, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414290'},
  {id: '9414131', name: 'Pillar Point Harbor', lat: 37.5025, lon: -122.48217, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414131'},
  {id: '9415020', name: 'Point Reyes', lat: 37.994167, lon: -122.97361, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9415020'},
];
export const SF_STATION = '9414290';
/** Stations whose predictions the server ingests in addition to the existing San Francisco feed. Kept in sync with services/forecast-service.mjs by a test. */
export const extraTideStationIds = ['9414131', '9415020'];
export const tideStation = (id: string) => tideStations.find((s) => s.id === id) ?? null;

/** Reviewed spot → station assignments for the NEW stations. Empty until the owner approves one; the San Francisco rule (`nearSanFrancisco` in data/coast.ts) is unchanged and not listed here. */
export interface TideAssignment {spotId: string; stationId: string; status: 'owner-reviewed'; reviewedBy: string; reviewedOn: string; note: string}
export const tideAssignments: TideAssignment[] = [];

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => { const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
/** Nearest stations by distance, for the owner's review list only (never an assignment). */
export const nearestTideStations = (lat: number, lon: number) => tideStations.map((s) => ({station: s, distanceKm: Math.round(km(lat, lon, s.lat, s.lon) * 10) / 10})).sort((a, b) => a.distanceKm - b.distanceKm);

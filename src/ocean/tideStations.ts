/** CO-OPS tide-prediction stations (T-041). A spot may use a station's tide only by a reviewed assignment; labels always say "station tide", never "beach tide".
 *  Positions read from the CO-OPS metadata API (mdapi) on 2026-11-02; predictions verified live for both new stations. */
import {hasUsData} from './coverage.ts';
export interface TideStation {id: string; name: string; lat: number; lon: number; retrievedOn: string; url: string}
export const tideStations: TideStation[] = [
  {id: '9414290', name: 'San Francisco', lat: 37.806305, lon: -122.46589, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414290'},
  {id: '9414131', name: 'Pillar Point Harbor', lat: 37.5025, lon: -122.48217, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414131'},
  {id: '9415020', name: 'Point Reyes', lat: 37.994167, lon: -122.97361, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9415020'},
  // T-082 (2026-11-02): the nearest CO-OPS prediction station (reference or subordinate) of every covered spot, from the mdapi station list.
  // High/low predictions only (subordinate stations have no hourly series); used for the 'next tide' line, labelled "<name> station".
  {id: '9410120', name: "Imperial Beach", lat: 32.57830, lon: -117.13500, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410120'},
  {id: '9410230', name: "La Jolla (Scripps Institution Wharf)", lat: 32.86689, lon: -117.25714, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410230'},
  {id: '9410580', name: "Newport Bay Entrance, Corona del Mar", lat: 33.60330, lon: -117.88300, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410580'},
  {id: '9410599', name: "Santa Ana River entrance (inside)", lat: 33.63000, lon: -117.95800, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410599'},
  {id: '9410738', name: "King Harbor, Santa Monica Bay", lat: 33.84670, lon: -118.39800, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410738'},
  {id: '9410777', name: "El Segundo, Santa Monica Bay", lat: 33.90830, lon: -118.43300, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410777'},
  {id: '9410840', name: "Santa Monica, Municipal Pier", lat: 34.00830, lon: -118.50000, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410840'},
  {id: '9411189', name: "Ventura", lat: 34.26670, lon: -119.28300, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9411189'},
  {id: '9411270', name: "Rincon Island, Mussel Shoals", lat: 34.34830, lon: -119.44300, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9411270'},
  {id: '9412110', name: "Port San Luis", lat: 35.16889, lon: -120.75417, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9412110'},
  {id: '9412802', name: "Mansfield Cone", lat: 35.94953, lon: -121.48194, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9412802'},
  {id: '9413375', name: "Carmel Cove, Carmel Bay", lat: 36.52000, lon: -121.94000, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413375'},
  {id: '9413450', name: "Monterey, Monterey Bay", lat: 36.60889, lon: -121.89139, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413450'},
  {id: '9413616', name: "Moss Landing, Ocean Pier", lat: 36.80170, lon: -121.79000, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413616'},
  {id: '9413663', name: "Elkhorn Slough railroad bridge", lat: 36.85667, lon: -121.75500, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413663'},
  {id: '9413745', name: "Santa Cruz, Monterey Bay", lat: 36.95830, lon: -122.01700, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413745'},
  {id: '9413878', name: "Ano Nuevo Island", lat: 37.10830, lon: -122.33800, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413878'},
  {id: '9414275', name: "Ocean Beach, outer coast", lat: 37.77500, lon: -122.51300, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414275'},
  {id: '9414958', name: "Bolinas Lagoon", lat: 37.90800, lon: -122.67850, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414958'},
  {id: '9415469', name: "Tomales Bay entrance", lat: 38.22830, lon: -122.97700, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9415469'},
  {id: '9415625', name: "Bodega Harbor entrance", lat: 38.30830, lon: -123.05500, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9415625'},
  {id: '9416841', name: "Arena Cove", lat: 38.91456, lon: -123.71108, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9416841'},
  {id: '9418024', name: "Shelter Cove", lat: 40.02500, lon: -124.05800, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9418024'},
  {id: '9418767', name: "Humboldt Bay (North Spit)", lat: 40.76691, lon: -124.21734, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9418767'},
  {id: '9419059', name: "Trinidad Harbor", lat: 41.05670, lon: -124.14700, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9419059'},
  {id: '9419750', name: "Crescent City", lat: 41.74561, lon: -124.18439, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9419750'},
  {id: 'TWC0413', name: "Quivira Basin, Mission Bay", lat: 32.76667, lon: -117.23333, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0413'},
  {id: 'TWC0419', name: "San Clemente", lat: 33.41667, lon: -117.61667, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0419'},
  {id: 'TWC0445', name: "Mugu Lagoon (ocean pier)", lat: 34.10000, lon: -119.10000, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0445'},
  {id: 'TWC0473', name: "Point Arguello", lat: 34.58333, lon: -120.65000, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0473'},
  {id: '9411340', name: "Santa Barbara", lat: 34.40459, lon: -119.69249, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9411340'},
  {id: '9442861', name: "Makah Bay", lat: 48.29670, lon: -124.67200, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9442861'},
  {id: '9442388', name: "James Island", lat: 47.90670, lon: -124.64700, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9442388'},
  {id: '9441102', name: "Westport, Point Chehalis", lat: 46.90431, lon: -124.10508, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9441102'},
  {id: '9440581', name: "Cape Disappointment", lat: 46.28103, lon: -124.04628, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9440581'},
  {id: 'TWC0881', name: "Point Adams, Oreg.", lat: 46.20000, lon: -123.95000, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0881'},
  {id: '9437908', name: "Nehalem", lat: 45.71000, lon: -123.89000, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9437908'},
  {id: 'TWC0857', name: "Nestucca Bay entrance", lat: 45.16667, lon: -123.96667, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0857'},
  {id: '9435385', name: "YAQUINA USCG STA, NEWPORT", lat: 44.62670, lon: -124.05500, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9435385'},
  {id: '9434132', name: "Siuslaw River Entrance", lat: 44.01670, lon: -124.13000, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9434132'},
  {id: '9432780', name: "CHARLESTON", lat: 43.34500, lon: -124.32200, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9432780'},
  {id: '9431647', name: "Port Orford", lat: 42.73900, lon: -124.49830, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9431647'},
  {id: '9430104', name: "Brookings, Chetco Cove", lat: 42.04330, lon: -124.28500, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9430104'},
];
export const SF_STATION = '9414290';
/** Stations whose predictions the server ingests in addition to the existing San Francisco feed. Kept in sync with services/forecast-service.mjs by a test. */
export const extraTideStationIds = ['9414131', '9415020'];
/** T-082: stations ingested for high/low predictions only (the nearest station of every covered spot). Kept in sync with services/forecast-service.mjs by a test. */
export const hiloTideStationIds = ['9410120',  '9410230',  '9410580',  '9410599',  '9410738',  '9410777',  '9410840',  '9411189',  '9411270',  '9412110',  '9412802',  '9413375',  '9413450',  '9413616',  '9413663',  '9413745',  '9413878',  '9414275',  '9414958',  '9415469',  '9415625',  '9416841',  '9418024',  '9418767',  '9419059',  '9419750',  'TWC0413',  'TWC0419',  'TWC0445',  'TWC0473',  '9411340',  '9442861',  '9442388',  '9441102',  '9440581',  'TWC0881',  '9437908',  'TWC0857',  '9435385',  '9434132',  '9432780',  '9431647',  '9430104'];
/** Open-coast rule for choosing a tide station for a spot (spot expansion): a CO-OPS station far up a river, slough or lagoon, in an estuary bay or inside a harbour basin, says little about the beach (Seaside's nearest station was Cathcart Landing on Youngs River, 19.8 km;
 *  Pacific Beach's was Quivira Basin in Mission Bay; Blackies' was "Santa Ana River entrance (inside)"; Long Beach WA's was Tarlatt Slough, then "Ilwaco, Baker Bay"). CO-OPS metadata (mdapi) has no open-coast flag, so the rule is explicit and reads the station NAME, in this order:
 *    1. "inside" in the name: closed.
 *    2. a structure or entrance word (entrance, jetty, bar, spit, pier, wharf, ocean, outer coast): open ("Columbia River entrance (N. Jetty)", "Mugu Lagoon (ocean pier)").
 *    3. river, slough, creek, landing, bridge, lagoon, canal, channel, basin, marsh, docks, or a Bay (except the open bays Monterey, Santa Monica, Carmel and Makah): closed. A town name never rescues it ("Gold Beach, Rogue River" is up the Rogue).
 *    4. cape, point, island, head, beach, rock, light, reef: open.
 *    5. anything else (a town or harbour name such as "Nehalem" or "Santa Cruz"): unknown, allowed.
 *  A spot takes the nearest station that is not closed. The enclosed-water mask is NOT used: at 0.01 degrees it also calls harbour-mouth piers (Moss Landing, Monterey) enclosed, and it does not reach north of 43.6 N. */
export type TideExposure = 'open' | 'closed' | 'unknown';
const STRONG_OPEN = /\b(entrance|jetty|jetties|bar|spit|pier|wharf|ocean|outer coast)\b/i;
const WEAK_OPEN = /\b(cape|point|island|head|beach|rock|light|reef)\b/i;
const CLOSED_WORDS = /\b(river|slough|creek|landing|bridge|lagoon|canal|channel|basin|marsh|docks)\b/i;
const ESTUARY_BAY = /\bbay\b/i, OPEN_BAYS = /\b(monterey|santa monica|carmel|makah) bay\b/i;
export function tideStationExposure(name: string): {exposure: TideExposure; why: string} {
  if (/\binside\b/i.test(name)) return {exposure: 'closed', why: 'its name says "inside"'};
  const so = STRONG_OPEN.exec(name); if (so) return {exposure: 'open', why: `name says open coast or an entrance ("${so[1].toLowerCase()}")`};
  const c = CLOSED_WORDS.exec(name); if (c) return {exposure: 'closed', why: `name says "${c[1].toLowerCase()}" (up a river, slough, lagoon or basin)`};
  if (ESTUARY_BAY.test(name) && !OPEN_BAYS.test(name)) return {exposure: 'closed', why: 'name says "bay" (an estuary or harbour bay, not the open coast)'};
  const wo = WEAK_OPEN.exec(name); if (wo) return {exposure: 'open', why: `name says "${wo[1].toLowerCase()}"`};
  return {exposure: 'unknown', why: 'nothing in its name says open coast or enclosed (a town or harbour name)'};
}
/** The station a spot uses: the nearest one within `maxKm` that is not closed. `stations` are {name, lat, lon, ...}. */
export function pickTideStation<T extends {name: string; lat: number; lon: number}>(spotLat: number, spotLon: number, stations: T[], maxKm = 40): {station: T; distanceKm: number; exposure: TideExposure} | null {
  const ranked = stations.map((s) => ({station: s, distanceKm: Math.round(km(spotLat, spotLon, s.lat, s.lon) * 10) / 10, exposure: tideStationExposure(s.name).exposure})).filter((x) => x.distanceKm <= maxKm && x.exposure !== 'closed').sort((a, b) => a.distanceKm - b.distanceKm);
  return ranked[0] ?? null;
}
/** The registry station a SPOT uses for its "next tide": the nearest that is not closed (see tideStationExposure), within 40 km. Same shape as nearestTideStations()[0]. */
export const tideStationForSpot = (lat: number, lon: number): {station: TideStation; distanceKm: number} | null => pickTideStation(lat, lon, tideStations);
export const tideStation = (id: string) => tideStations.find((s) => s.id === id) ?? null;

/** Reviewed spot → station assignments for the NEW stations. Empty until the owner approves one; the San Francisco rule (`nearSanFrancisco` in data/coast.ts) is unchanged and not listed here. */
export interface TideAssignment {spotId: string; stationId: string; status: 'owner-reviewed'; reviewedBy: string; reviewedOn: string; note: string}
export const tideAssignments: TideAssignment[] = [];

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => { const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
/** The nearest stations of a SPOT: none for a spot outside US coverage (CO-OPS is a US source; nothing is borrowed across a border). */
/** The station a spot uses: the open-coast pick (tideStationForSpot) for a spot with US data, none elsewhere (coverage.ts). */
export const tideStationFor = (spot: {id: string; country?: string; latitude: number; longitude: number}) => (hasUsData(spot) ? tideStationForSpot(spot.latitude, spot.longitude) : null);
export const nearestTideStationsFor = (spot: {id: string; country?: string; latitude: number; longitude: number}) => (hasUsData(spot) ? nearestTideStations(spot.latitude, spot.longitude) : []);
/** Nearest stations by distance, for the owner's review list only (never an assignment). */
export const nearestTideStations = (lat: number, lon: number) => tideStations.map((s) => ({station: s, distanceKm: Math.round(km(lat, lon, s.lat, s.lon) * 10) / 10})).sort((a, b) => a.distanceKm - b.distanceKm);

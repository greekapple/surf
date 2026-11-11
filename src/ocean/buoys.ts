import type {Measurement, ObservationSet} from './types.ts';

/** Extra buoys for the "buoy now vs forecast" context (T-049). They are CONTEXT: observed at different points than any forecast spot, never a validation.
 *  NDBC 46214 and CDIP 029 are two feeds of the SAME instrument (the Point Reyes buoy, CDIP 029p1; checked 2026-11-02: matching Hs, Tp and direction at the same times),
 *  so they are labelled as one buoy seen twice, not as two independent readings. */
export interface ContextBuoy {/** the same instrument, or the same site, as this other context buoy: only one of the pair is shown on a card (the one that carries more: the NDBC buoy over a second feed, a wave buoy over a pier gauge) */twinOf?: string; /** why the buoy is sheltered, in a few words ("inside the Strait of Juan de Fuca"); shown on the card, any provider. Default wording for a bay buoy: "inside a bay or sound, not the open ocean" */shelterWhy?: string; /** inside a bay or sound (Cape Cod Bay, Buzzards Bay, Chesapeake): its waves are not the open ocean's, so it is listed after the open-ocean buoys and never counted as a buoy near an open-coast spot */sheltered?: boolean; id: string; provider: 'NDBC' | 'CDIP'; label: string; place: string; note?: string; fetchKey: string; /** where the buoy floats (agency metadata), for "is it near this spot" */ lat: number; lon: number}
export const contextBuoys: ContextBuoy[] = [
  {id: '46012', provider: 'NDBC', label: 'NDBC 46012', place: 'Half Moon Bay', fetchKey: 'ndbc-46012', lat: 37.363, lon: -122.881},
  {id: '46214', provider: 'NDBC', label: 'NDBC 46214', place: 'Point Reyes', note: 'Same buoy as CDIP 029', fetchKey: 'ndbc-46214', lat: 37.94, lon: -123.47},
  {id: '029p1', provider: 'CDIP', label: 'CDIP 029', place: 'Point Reyes', twinOf: '46214', note: 'Same buoy as NDBC 46214: a second feed, not an independent reading', fetchKey: 'cdip-029', lat: 37.941, lon: -123.464},
  {id: '098p1', provider: 'CDIP', label: 'CDIP 098', place: 'Mokapu Point, Oahu', note: 'Windward (east) side of Oahu: partly blocked from south and west swell', fetchKey: 'cdip-098', lat: 21.414, lon: -157.681},
  {id: '106p1', provider: 'CDIP', label: 'CDIP 106', place: 'Waimea Bay, Oahu', note: 'North Shore: sees north and northwest swell, blocked from south swell', fetchKey: 'cdip-106', lat: 21.67, lon: -158.117},
  // Atlantic (US East round, 2026-11-09): every live NDBC wave buoy within 50 km of a spot of the first batch (nearestSources of docs/forecast/data/world-spots/us-east.json: WVHT in NDBC latest_obs on 2026-11-09), with the owner NDBC lists. Context only, never a validation.
  {id: '44098', provider: 'NDBC', label: 'NDBC 44098', place: 'Jeffrey\'s Ledge, NH (160)', note: 'Owner: University of New Hampshire; Atlantic buoy', fetchKey: 'ndbc-44098', lat: 42.8, lon: -70.169},
  {id: '44090', provider: 'NDBC', label: 'NDBC 44090', place: 'Cape Cod Bay, MA (221)', note: 'Owner: Woods Hole Group/NERACOOS; bay buoy, sheltered: inside a bay, not the open ocean', fetchKey: 'ndbc-44090', sheltered: true, lat: 41.84, lon: -70.329},
  {id: '44085', provider: 'NDBC', label: 'NDBC 44085', place: 'Buzzards Bay, MA (260)', note: 'Owner: Woods Hole Group/NERACOOS; bay buoy, sheltered: inside a bay, not the open ocean', fetchKey: 'ndbc-44085', sheltered: true, lat: 41.387, lon: -71.032},
  {id: '44097', provider: 'NDBC', label: 'NDBC 44097', place: 'Block Island, RI (154)', note: 'Owner: SCRIPPS; Atlantic buoy', fetchKey: 'ndbc-44097', lat: 40.966, lon: -71.123},
  {id: '44025', provider: 'NDBC', label: 'NDBC 44025', place: 'LONG ISLAND - 30 NM South of Islip, NY', note: 'Owner: NDBC; Atlantic buoy', fetchKey: 'ndbc-44025', lat: 40.258, lon: -73.175},
  {id: '44091', provider: 'NDBC', label: 'NDBC 44091', place: 'Barnegat, NJ (209)', note: 'Owner: U.S. Army Corps of Engineers; Atlantic buoy', fetchKey: 'ndbc-44091', lat: 39.772, lon: -73.769},
  {id: '44087', provider: 'NDBC', label: 'NDBC 44087', place: 'Thimble Shoal, VA (240)', note: 'Owner: U.S. Navy; bay buoy, sheltered: inside a bay, not the open ocean', fetchKey: 'ndbc-44087', sheltered: true, lat: 37.043, lon: -76.129},
  {id: '44099', provider: 'NDBC', label: 'NDBC 44099', place: 'Cape Henry, VA (147)', note: 'Owner: SCRIPPS; Atlantic buoy', fetchKey: 'ndbc-44099', lat: 36.915, lon: -75.722},
  {id: '44056', provider: 'NDBC', label: 'NDBC 44056', place: 'Duck FRF, NC', note: 'Owner: U.S. Army Corps of Engineers; Atlantic buoy', fetchKey: 'ndbc-44056', lat: 36.2, lon: -75.714},
  {id: '44086', provider: 'NDBC', label: 'NDBC 44086', place: 'Nags Head, NC (243)', note: 'Owner: UNC Coastal Studies Institute; Atlantic buoy', fetchKey: 'ndbc-44086', lat: 36.001, lon: -75.421},
  {id: '44095', provider: 'NDBC', label: 'NDBC 44095', place: 'Oregon Inlet, NC (192)', note: 'Owner: UNC Coastal Studies Institute; Atlantic buoy', fetchKey: 'ndbc-44095', lat: 35.75, lon: -75.33},
  {id: '41120', provider: 'NDBC', label: 'NDBC 41120', place: 'Cape Hatteras East, NC (250)', note: 'Owner: SCRIPPS; Atlantic buoy', fetchKey: 'ndbc-41120', lat: 35.258, lon: -75.285},
  {id: '41159', provider: 'NDBC', label: 'NDBC 41159', place: 'Onslow Bay Outer, NC (217)', note: 'Owner: CORMP; Atlantic buoy', fetchKey: 'ndbc-41159', lat: 34.211, lon: -76.944},
  {id: '41110', provider: 'NDBC', label: 'NDBC 41110', place: 'Masonboro Inlet, ILM2, NC (150)', note: 'Owner: CORMP; Atlantic buoy', fetchKey: 'ndbc-41110', lat: 34.144, lon: -77.715},
  {id: '41108', provider: 'NDBC', label: 'NDBC 41108', place: 'Wilmington Harbor, NC - (200)', note: 'Owner: SCRIPPS; Atlantic buoy', fetchKey: 'ndbc-41108', lat: 33.719, lon: -78.016},
  {id: '41065', provider: 'NDBC', label: 'NDBC 41065', place: 'Capers Nearshore Waves (CAP2WAVE)', note: 'Owner: CORMP; Atlantic buoy', fetchKey: 'ndbc-41065', lat: 32.802, lon: -79.619},
  {id: '41076', provider: 'NDBC', label: 'NDBC 41076', place: 'CHR60WAVE', note: 'Owner: CORMP; Atlantic buoy', fetchKey: 'ndbc-41076', lat: 32.536, lon: -79.659},
  {id: '41067', provider: 'NDBC', label: 'NDBC 41067', place: 'FRP2WAVE', note: 'Owner: CORMP; Atlantic buoy', fetchKey: 'ndbc-41067', lat: 32.276, lon: -80.406},
  {id: '41112', provider: 'NDBC', label: 'NDBC 41112', place: 'Offshore Fernandina Beach, FL (132)', note: 'Owner: SCRIPPS; Atlantic buoy', fetchKey: 'ndbc-41112', lat: 30.709, lon: -81.292},
  {id: '41117', provider: 'NDBC', label: 'NDBC 41117', place: 'St. Augustine, FL (194)', note: 'Owner: U.S. Army Corps of Engineers; Atlantic buoy', fetchKey: 'ndbc-41117', lat: 29.999, lon: -81.079},
  {id: '41070', provider: 'NDBC', label: 'NDBC 41070', place: 'Ponce de Leon Inlet Waves (PNCWAVE)', note: 'Owner: CORMP; Atlantic buoy', fetchKey: 'ndbc-41070', lat: 29.289, lon: -80.803},
  {id: '41113', provider: 'NDBC', label: 'NDBC 41113', place: 'Cape Canaveral Nearshore, FL (143)', note: 'Owner: SCRIPPS; Atlantic buoy', fetchKey: 'ndbc-41113', lat: 28.4, lon: -80.533},
  {id: '41114', provider: 'NDBC', label: 'NDBC 41114', place: 'Fort Pierce, FL (134)', note: 'Owner: SCRIPPS; Atlantic buoy', fetchKey: 'ndbc-41114', lat: 27.564, lon: -80.215},
  {id: '41122', provider: 'NDBC', label: 'NDBC 41122', place: 'Hollywood Beach, FL (265)', note: 'Owner: SCRIPPS; Atlantic buoy', fetchKey: 'ndbc-41122', lat: 26.001, lon: -80.096},
  // US West (round 4, 2026-11-10): every live NDBC/CDIP wave buoy within 50 km of a California spot of the west-ca batch (docs/forecast/data/world-spots/us-west.json nearestSources); none is sheltered (Monterey 46236 and Santa Monica 46221 are buoys in open bays, not enclosed ones).
  {id: '46244', provider: 'NDBC', label: 'NDBC 46244', place: 'Humboldt Bay, North Spit, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46244', lat: 40.896, lon: -124.358},
  {id: '46014', provider: 'NDBC', label: 'NDBC 46014', place: 'PT ARENA - 19NM North of Point Arena, CA', note: 'Owner: NDBC; Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46014', lat: 39.225, lon: -123.98},
  {id: '46237', provider: 'NDBC', label: 'NDBC 46237', place: 'San Francisco Bar, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46237', lat: 37.788, lon: -122.634},
  {id: '46026', provider: 'NDBC', label: 'NDBC 46026', place: 'SAN FRANCISCO - 18NM West of San Francisco, CA', note: 'Owner: NDBC; Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46026', lat: 37.75, lon: -122.838},
  {id: '46042', provider: 'NDBC', label: 'NDBC 46042', place: 'MONTEREY - 27NM WNW of Monterey, CA', note: 'Owner: NDBC; Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46042', lat: 36.787, lon: -122.408},
  {id: '46236', provider: 'NDBC', label: 'NDBC 46236', place: 'Monterey Canyon Outer, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46236', lat: 36.759, lon: -121.95},
  {id: '46028', provider: 'NDBC', label: 'NDBC 46028', place: 'CAPE SAN MARTIN - 55NM West NW of Morro Bay, CA', note: 'Owner: NDBC; Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46028', lat: 35.763, lon: -121.9},
  {id: '46215', provider: 'NDBC', label: 'NDBC 46215', place: 'Diablo Canyon, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46215', lat: 35.204, lon: -120.859},
  {id: '46286', provider: 'NDBC', label: 'NDBC 46286', place: 'Avila Beach Nearshore, CA', note: 'Owner: National Laboratory of the Rockies (NLR); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46286', lat: 35.164, lon: -120.737},
  {id: '46218', provider: 'NDBC', label: 'NDBC 46218', place: 'Harvest, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46218', lat: 34.452, lon: -120.78},
  {id: '46053', provider: 'NDBC', label: 'NDBC 46053', place: 'EAST SANTA BARBARA - 12NM Southwest of Santa Barbara, CA', note: 'Owner: NDBC; Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46053', lat: 34.246, lon: -119.842},
  {id: '46268', provider: 'NDBC', label: 'NDBC 46268', place: 'Topanga Nearshore, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46268', lat: 34.022, lon: -118.578},
  {id: '46221', provider: 'NDBC', label: 'NDBC 46221', place: 'Santa Monica Bay, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46221', lat: 33.86, lon: -118.641},
  {id: '46025', provider: 'NDBC', label: 'NDBC 46025', place: 'Santa Monica Basin - 33NM WSW of Santa Monica, CA', note: 'Owner: NDBC; Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46025', lat: 33.765, lon: -119.077},
  {id: '46256', provider: 'NDBC', label: 'NDBC 46256', place: 'Long Beach Channel, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46256', lat: 33.7, lon: -118.201},
  {id: '46222', provider: 'NDBC', label: 'NDBC 46222', place: 'San Pedro, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46222', lat: 33.614, lon: -118.314},
  {id: '46253', provider: 'NDBC', label: 'NDBC 46253', place: 'San Pedro South, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46253', lat: 33.576, lon: -118.182},
  {id: '46285', provider: 'NDBC', label: 'NDBC 46285', place: 'Capistrano Beach Nearshore, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46285', lat: 33.445, lon: -117.68},
  {id: '46277', provider: 'NDBC', label: 'NDBC 46277', place: 'Green Beach Offshore, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46277', lat: 33.336, lon: -117.659},
  {id: '46275', provider: 'NDBC', label: 'NDBC 46275', place: 'Red Beach Nearshore, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46275', lat: 33.291, lon: -117.501},
  {id: '46274', provider: 'NDBC', label: 'NDBC 46274', place: 'Leucadia Nearshore, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46274', lat: 33.062, lon: -117.314},
  {id: '46266', provider: 'NDBC', label: 'NDBC 46266', place: 'Del Mar Nearshore, CA', note: 'Owner: U.S. Army Corps of Engineers; Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46266', lat: 32.957, lon: -117.279},
  {id: '46254', provider: 'NDBC', label: 'NDBC 46254', place: 'SCRIPPS Nearshore, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46254', lat: 32.868, lon: -117.267},
    {id: 'LJPC1', provider: 'NDBC', label: 'NDBC LJPC1', place: 'La Jolla pier (Scripps Pier gauge)', twinOf: '46254', note: 'Pier-mounted gauge, no wave direction; the Scripps Nearshore buoy 46254 floats 1 km away and is shown instead (US West round, 2026-11-10)', fetchKey: 'ndbc-LJPC1', lat: 32.867, lon: -117.257},
  {id: '46232', provider: 'NDBC', label: 'NDBC 46232', place: 'Point Loma South, CA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46232', lat: 32.517, lon: -117.425},
  // US West batch 2 (Oregon, Washington, Sitka; 2026-11-10): the live wave buoys within 50 km of an imported spot. The two Strait of Juan de Fuca buoys are inside the strait (sheltered).
  {id: '46084', provider: 'NDBC', label: 'NDBC 46084', place: 'CAPE EDGECUMBE - 25NM SSW of Cape Edgecumbe, AK', note: 'Owner: NDBC; Pacific buoy (US West round 4, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46084', lat: 56.614, lon: -136.04},
  {id: '46087', provider: 'NDBC', label: 'NDBC 46087', place: 'Neah Bay - 6 NM North of Cape Flattery, WA (Traffic Separation Lighted Buoy)', note: 'Owner: NDBC; Pacific buoy (US West round 4, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46087', lat: 48.493, lon: -124.727},
  {id: '46088', provider: 'NDBC', label: 'NDBC 46088', place: 'NEW DUNGENESS - 17 NM NE of Port Angeles, WA', shelterWhy: 'inside the Strait of Juan de Fuca', note: 'Owner: NDBC; Pacific buoy; inside the Strait of Juan de Fuca (New Dungeness): its waves are not the open ocean\'s (US West round 4, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46088', lat: 48.332, lon: -123.179, sheltered: true},
  {id: '46267', provider: 'NDBC', label: 'NDBC 46267', place: 'Angeles Point, WA', shelterWhy: 'inside the Strait of Juan de Fuca', note: 'Owner: SCRIPPS (CDIP); Pacific buoy; inside the Strait of Juan de Fuca (Angeles Point, Port Angeles): its waves are not the open ocean\'s (US West round 4, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46267', lat: 48.171, lon: -123.6, sheltered: true},
  {id: '46211', provider: 'NDBC', label: 'NDBC 46211', place: 'Grays Harbor, WA', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round 4, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46211', lat: 46.857, lon: -124.243},
  {id: '46243', provider: 'NDBC', label: 'NDBC 46243', place: 'Clatsop Spit, OR', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round 4, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46243', lat: 46.215, lon: -124.129},
  {id: '46278', provider: 'NDBC', label: 'NDBC 46278', place: 'Tillamook Bay South Jetty, OR', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round 4, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46278', lat: 45.559, lon: -123.991},
  {id: '46050', provider: 'NDBC', label: 'NDBC 46050', place: 'STONEWALL BANK - 20NM West of Newport, OR', note: 'Owner: NDBC; Pacific buoy (US West round 4, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46050', lat: 44.679, lon: -124.535},
  {id: '46229', provider: 'NDBC', label: 'NDBC 46229', place: 'UMPQUA OFFSHORE, OR', note: 'Owner: SCRIPPS (CDIP); Pacific buoy (US West round 4, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46229', lat: 43.772, lon: -124.549},
  {id: '46015', provider: 'NDBC', label: 'NDBC 46015', place: 'PORT ORFORD - 15 NM West of Port Orford, OR', note: 'Owner: NDBC; Pacific buoy (US West round 4, 2026-11-10: a live wave buoy within 50 km of an imported spot)', fetchKey: 'ndbc-46015', lat: 42.754, lon: -124.839},
];
export const ndbcBuoyURL = (id: string) => `https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`;
export const cdipBuoyURL = (id = '029p1', now = Date.now()) => `https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/realtime/${id}_rt.nc?` + new URLSearchParams({var: 'waveHs,waveTp,waveDp', time_start: new Date(now - 86400000).toISOString(), time_end: new Date(now + 3600000).toISOString(), accept: 'csv'});
/** Distance in km from a point to a buoy. */
export const buoyKm = (b: {lat: number; lon: number}, lat: number, lon: number) => { const r = Math.PI / 180, dLat = (b.lat - lat) * r, dLon = (b.lon - lon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
/** Context buoys within `maxKm` of a point, nearest first: a buoy in another ocean basin is not context for a spot (the Hawaii spots must not show the Point Reyes buoy). */
/** At most this many (nearest first): the Atlantic registry has two dozen buoys along 2,000 km of coast, a spot shows the few around it. */
export const MAX_CONTEXT_BUOYS = 4;
export const CONTEXT_BUOY_KM = 500;   // a buoy is context only within 500 km of the spot (Sitka must not show Washington buoys 1,100 km away)
/** The three original Bay Area context buoys keep the whole US West Coast within reach (Seaside 860 km, San Diego 1,000 km): the app's first California coverage, until a region has buoys of its own. Hawaii is 3,800 km away and gets its own. */
export const BAY_AREA_CONTEXT = new Set(['46012', '46214', '029p1']); export const BAY_AREA_CONTEXT_KM = 1500;
/** A SHELTERED buoy is sorted after the open-ocean ones, except for a spot in the same water: within this distance, and with no open-ocean buoy nearer (the Strait of Juan de Fuca and Admiralty Inlet spots, whose relevant buoys are the strait ones). */
export const SAME_WATER_KM = 35;
export function buoysNear(lat: number, lon: number, maxKm = CONTEXT_BUOY_KM): ContextBuoy[] {
  const km = (b: ContextBuoy) => buoyKm(b, lat, lon);
  const inRange = contextBuoys.map((b) => ({b, d: km(b)})).filter((x) => x.d <= (BAY_AREA_CONTEXT.has(x.b.id) ? Math.max(maxKm, BAY_AREA_CONTEXT_KM) : maxKm)), ids = new Set(inRange.map((x) => x.b.id));
  // a twin (the same instrument or site as another buoy in range) is not shown beside it: Point Reyes is one buoy, not two; the La Jolla pier gauge gives way to the Scripps buoy
  const shown = inRange.filter((x) => !(x.b.twinOf && ids.has(x.b.twinOf))), nearestOpen = Math.min(...shown.filter((x) => !x.b.sheltered).map((x) => x.d), Infinity);
  const lastRank = (x: {b: ContextBuoy; d: number}) => Number(!!x.b.sheltered && !(x.d <= SAME_WATER_KM && x.d < nearestOpen));
  return shown.sort((a, b) => lastRank(a) - lastRank(b) || a.d - b.d).slice(0, MAX_CONTEXT_BUOYS).map((x) => x.b);
}
/** NDBC 46026 (the SF buoy `bundle.buoy` is read from): where it floats, so "buoy now vs forecast" is only drawn for a spot in the same basin. */
export const SF_BUOY = {lat: 37.754, lon: -122.839};
export const nearSfBuoy = (lat: number, lon: number): boolean => { const r = Math.PI / 180, dLat = (SF_BUOY.lat - lat) * r, dLon = (SF_BUOY.lon - lon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * r) * Math.cos(SF_BUOY.lat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)) <= CONTEXT_BUOY_KM; };
export const contextBuoyFor = (key: string) => contextBuoys.find((b) => b.id === key || b.fetchKey === key) ?? null;

const FT = 1 / 0.3048;
/** CDIP realtime buoy CSV (NCSS point). The station name contains a comma ("POINT REYES, CA BUOY - 029p1"), so numeric columns are read from the END of each row.
 *  Newest row with a finite Hs inside 24 h and not in the future; missing values stay out (no fill). Each value keeps the row's own time. */
export function normalizeCdipBuoy(csv: string, retrievedAt: string, url: string, buoy: ContextBuoy = contextBuoys[2]): ObservationSet | null {
  const lines = csv.trim().split(/\r?\n/), header = lines.shift()?.split(',') ?? [];
  if (!/^time/.test(header[0] ?? '') || !header.some((h) => h.startsWith('waveHs[unit="meter"')) || !header.some((h) => h.startsWith('waveTp[unit="second"')) || !header.some((h) => h.startsWith('waveDp[unit="degreeT"'))) return null;
  const now = Date.parse(retrievedAt); if (!Number.isFinite(now)) return null;
  const rows = lines.map((l) => { const c = l.split(','), n = c.length, t = Date.parse(c[0]); return {t, iso: Number.isFinite(t) ? new Date(t).toISOString() : '', hs: Number(c[n - 3]), tp: Number(c[n - 2]), dp: Number(c[n - 1]), blank: [c[n - 3], c[n - 2], c[n - 1]].map((x) => x?.trim() === '')}; })
    .filter((r) => Number.isFinite(r.t) && now - r.t <= 86400000 && r.t <= now + 300000).sort((a, b) => b.t - a.t);
  const src = (validAt: string, native: string): Measurement['source'] => ({provider: `CDIP ${buoy.id} (${buoy.place})`, kind: 'observation', validAt, retrievedAt, issuedAt: null, updatedAt: null, url, nativeUnit: native, location: `${buoy.place} buoy, offshore; regional context only`, delivery: 'direct', notes: `${buoy.note ?? ''} Not breaking-wave height or a primary-swell component.`.trim()});
  const values: Record<string, Measurement> = {};
  const first = (key: 'hs' | 'tp' | 'dp', i: number, ok: (n: number) => boolean) => rows.find((r) => !r.blank[i] && Number.isFinite(r[key]) && ok(r[key]));
  const h = first('hs', 0, (n) => n >= 0 && n < 50), p = first('tp', 1, (n) => n > 0 && n < 100), d = first('dp', 2, (n) => n >= 0 && n < 360);
  if (h) values['Offshore significant height'] = {value: h.hs * FT, unit: 'ft', source: src(h.iso, 'm')};
  if (p) values['Dominant wave period'] = {value: p.tp, unit: 's', source: src(p.iso, 's')};
  if (d) values['Peak wave direction'] = {value: d.dp, unit: 'deg', source: src(d.iso, 'deg true')};
  return Object.keys(values).length ? {station: buoy.label, location: `${buoy.place}${buoy.note ? ` · ${buoy.note}` : ''}`, values, delivery: 'direct'} : null;
}

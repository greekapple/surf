import type {Measurement, ObservationSet} from './types.ts';

/** Extra buoys for the "buoy now vs forecast" context (T-049). They are CONTEXT: observed at different points than any forecast spot, never a validation.
 *  NDBC 46214 and CDIP 029 are two feeds of the SAME instrument (the Point Reyes buoy, CDIP 029p1; checked 2026-11-02: matching Hs, Tp and direction at the same times),
 *  so they are labelled as one buoy seen twice, not as two independent readings. */
export interface ContextBuoy {/** inside a bay or sound (Cape Cod Bay, Buzzards Bay, Chesapeake): its waves are not the open ocean's, so it is listed after the open-ocean buoys and never counted as a buoy near an open-coast spot */sheltered?: boolean; id: string; provider: 'NDBC' | 'CDIP'; label: string; place: string; note?: string; fetchKey: string; /** where the buoy floats (agency metadata), for "is it near this spot" */ lat: number; lon: number}
export const contextBuoys: ContextBuoy[] = [
  {id: '46012', provider: 'NDBC', label: 'NDBC 46012', place: 'Half Moon Bay', fetchKey: 'ndbc-46012', lat: 37.363, lon: -122.881},
  {id: '46214', provider: 'NDBC', label: 'NDBC 46214', place: 'Point Reyes', note: 'Same buoy as CDIP 029', fetchKey: 'ndbc-46214', lat: 37.94, lon: -123.47},
  {id: '029p1', provider: 'CDIP', label: 'CDIP 029', place: 'Point Reyes', note: 'Same buoy as NDBC 46214: a second feed, not an independent reading', fetchKey: 'cdip-029', lat: 37.941, lon: -123.464},
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
];
export const ndbcBuoyURL = (id: string) => `https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`;
export const cdipBuoyURL = (id = '029p1', now = Date.now()) => `https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/realtime/${id}_rt.nc?` + new URLSearchParams({var: 'waveHs,waveTp,waveDp', time_start: new Date(now - 86400000).toISOString(), time_end: new Date(now + 3600000).toISOString(), accept: 'csv'});
/** Distance in km from a point to a buoy. */
export const buoyKm = (b: {lat: number; lon: number}, lat: number, lon: number) => { const r = Math.PI / 180, dLat = (b.lat - lat) * r, dLon = (b.lon - lon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
/** Context buoys within `maxKm` of a point, nearest first: a buoy in another ocean basin is not context for a spot (the Hawaii spots must not show the Point Reyes buoy). */
/** At most this many (nearest first): the Atlantic registry has two dozen buoys along 2,000 km of coast, a spot shows the few around it. */
export const MAX_CONTEXT_BUOYS = 4;
export const CONTEXT_BUOY_KM = 1500;   // the whole US West Coast keeps its Bay Area context buoys (Seaside 860 km, San Diego 1,000 km); Hawaii is 3,800 km away and gets its own
export function buoysNear(lat: number, lon: number, maxKm = CONTEXT_BUOY_KM): ContextBuoy[] {
  const km = (b: ContextBuoy) => buoyKm(b, lat, lon);
  return contextBuoys.map((b) => ({b, d: km(b)})).filter((x) => x.d <= maxKm).sort((a, b) => Number(!!a.b.sheltered) - Number(!!b.b.sheltered) || a.d - b.d).slice(0, MAX_CONTEXT_BUOYS).map((x) => x.b);
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

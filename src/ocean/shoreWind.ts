/** Wind now (spec docs/specs/2026-11-08-wind-now.md): the measured wind at a SHORE station next to a spot, shown beside the forecast wind.
 *  Pure: the registry (src/ocean/shoreWind.json, built by docs/forecast/data/build-shore-wind.ts), the two feed URLs and the two normalisers.
 *  The fetch is src/services/shoreWindNow.ts. The offshore buoys the app reads for waves (46026, 46012) are not used here: they are 18-24 NM out. */
import registry from './shoreWind.json' with {type: 'json'};
import {hasUsData} from './coverage.ts';
import type {SourceInfo} from './types.ts';

/** A station counts for a spot only inside this radius (the audits read 7 km; an airfield 6 km inland is not the wind at the beach). */
export const SHORE_WIND_MAX_KM = 4;
/** At build time a station must have reported wind within this many days. */
export const SHORE_WIND_WINDOW_DAYS = 7;
/** A reading older than this is shown as missing, never as now. */
export const SHORE_WIND_STALE_MS = 2 * 3600000;
export const SHORE_WIND_RULE = `The nearest fixed NDBC/NOS met station or West Coast / Hawaii airport ASOS (the CA, OR, WA and HI networks; no East Coast airports, because the enclosed-water mask is West-only) within ${SHORE_WIND_MAX_KM} km of the spot, outside enclosed water (src/map/enclosed.ts, both kinds), not in a harbour basin or estuary (an NDBC/NOS station only once its siting is checked, NDBC_EXPOSURE), that reported wind in the last ${SHORE_WIND_WINDOW_DAYS} days at build time. No latitude band. A spot with no such station shows no measured wind.`;
const MS_TO_MPH = 2.2369362921, KMH_TO_MPH = 0.6213711922;

/** Where a station's anemometer stands. An airport ASOS is always 'airfield'. An NDBC/NOS station is shown only once its siting is checked
 *  here: one in a harbour basin or an estuary reads sheltered wind that does not stand for the beach, so it is not shown at all (the spot then
 *  falls through to the next station inside the radius, or has none). Sources: each station's NOAA page (NDBC station page / CO-OPS station
 *  info) and its own name; checked 2026-11-08. */
export type Exposure = 'airfield' | 'cove' | 'pier' | 'harbour' | 'estuary';
export const NDBC_EXPOSURE: Record<string, {exposure: Exposure; label: string; why: string}> = {
  ANVC1: {exposure: 'cove', label: 'Arena Cove pier', why: 'CO-OPS 9416841 Arena Cove: the station is named for and positioned in Arena Cove (NDBC position 38.915, -123.711), 0.1 km from the spot. A cove, so not open water; the label says "in the cove" and nothing more.'},
  LJAC1: {exposure: 'pier', label: 'Scripps Pier, La Jolla', why: 'CO-OPS 9410230 La Jolla (Scripps Pier): NDBC position 32.867, -117.257, at the end of the pier on the open coast.'},
  CECC1: {exposure: 'harbour', label: 'Crescent City harbour', why: 'CO-OPS 9419750 Crescent City: NDBC position 41.746, -124.184, inside the harbour breakwater.'},
  MLSC1: {exposure: 'harbour', label: 'Moss Landing harbour', why: 'Moss Landing Marine Labs, South Harbor (the station name): inside the harbour.'},
  TIXC1: {exposure: 'estuary', label: 'Tijuana River estuary', why: 'Tidal Linkage, Tijuana River Reserve (the station name): in the estuary.'},
  // US East (checked 2026-11-09; each verdict rests on the station's own NDBC / CO-OPS NAME, nothing else; a station whose name does not say where it floats is left out and shows nothing):
  DUKN7: {exposure: 'pier', label: 'Duck Pier, NC', why: 'NDBC lists "8651370 - Duck Pier, NC" (CO-OPS 8651370 Duck, 36.184, -75.746): a pier on the open Atlantic coast.'},
  TRDF1: {exposure: 'pier', label: 'Trident Pier, Port Canaveral', why: 'NDBC lists "8721604 - Trident Pier, FL" (CO-OPS 8721604 "Trident Pier, Port Canaveral"): a pier on the Atlantic side of the port entrance. Spots right at the port jetties may feel the port channel.'},
  SIPF1: {exposure: 'pier', label: 'Sebastian Inlet north jetty', why: 'NDBC lists "Sebastian Inlet State Park North Jetty, FL" (Florida Institute of Technology): on the jetty at the inlet mouth, open to the Atlantic. Shown as a pier-type exposure: wind over water, not over land.'},
  FRDF1: {exposure: 'estuary', label: 'Fernandina Beach, Amelia River', why: 'CO-OPS 8720030 is named "Fernandina Beach, Amelia River": on the river, not the beach.'},
  MYPF1: {exposure: 'harbour', label: 'Mayport Bar Pilots Dock', why: 'CO-OPS 8720218 "Mayport (Bar Pilots Dock)" (the station name): inside the St. Johns River entrance.'},
  PEGF1: {exposure: 'harbour', label: 'Port Everglades', why: 'CO-OPS 8722956 "Port Everglades" (the station name): inside the port.'},
};
/** The station as a surfer would name it ("Half Moon Bay airport", "Scripps Pier, La Jolla"), not the provider's id string. Airports: IEM's name, title-cased, plus "airport". */
const ASOS_LABEL: Record<string, string> = {NRS: 'Imperial Beach airfield (Ream Field)'};
const titleCase = (t: string) => t.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
export const stationLabel = (s: {id: string; kind: 'ndbc' | 'asos'; name: string}) =>
  s.kind === 'asos' ? ASOS_LABEL[s.id] ?? `${titleCase(s.name)} airport` : NDBC_EXPOSURE[s.id]?.label ?? s.name;
export const exposureOf = (s: {id: string; kind: 'ndbc' | 'asos'}): Exposure | null => s.kind === 'asos' ? 'airfield' : NDBC_EXPOSURE[s.id]?.exposure ?? null;
/** Shown as the wind at the beach: an airfield, a pier, or a pier in the break's own cove. Not a harbour, an estuary, or an unchecked station. */
export const exposureShown = (e: Exposure | null) => e === 'airfield' || e === 'pier' || e === 'cove';

export interface ShoreStation {id: string; name: string; kind: 'ndbc' | 'asos'; lat: number; lon: number; distanceKm?: number}
export interface ShoreAssignment {spotId: string; spotName: string; stationId: string; stationName: string; kind: 'ndbc' | 'asos'; exposure: Exposure; lat: number; lon: number; distanceKm: number; url: string}
export interface ShoreWindRegistry {builtAt: string; maxKm: number; windowDays: number; rule: string; spotsChecked: number; assignments: ShoreAssignment[]}
export const shoreWindRegistry = registry as ShoreWindRegistry;

/** What the UI shows. mph/gustMph are miles per hour, dirDeg is the direction the wind blows FROM (degrees true), like the forecast. */
export interface ShoreWindNow {stationId: string; stationName: string; kind: 'ndbc' | 'asos'; exposure: Exposure; distanceKm: number; observedAt: string; mph: number | null; gustMph: number | null; dirDeg: number | null; source: SourceInfo}

/** The selection rule's core: stations within maxKm of a spot, nearest first. (The build script then takes the first that reports wind, so a silent station falls through to the next.) */
export function stationsWithin<T extends {lat: number; lon: number}>(lat: number, lon: number, stations: T[], km: (aLat: number, aLon: number, bLat: number, bLon: number) => number, maxKm = SHORE_WIND_MAX_KM): {s: T; km: number}[] {
  return stations.map((s) => ({s, km: km(lat, lon, s.lat, s.lon)})).filter((x) => x.km <= maxKm).sort((a, b) => a.km - b.km);
}
export const shoreAssignmentFor = (spotId: string): ShoreAssignment | null => (hasUsData(spotId) ? shoreWindRegistry.assignments.find((a) => a.spotId === spotId) ?? null : null);   // NDBC/ASOS stations: US sources, none for a spot elsewhere
/** One entry per distinct station (several spots can share one). */
export const shoreStations = (): ShoreStation[] => { const m = new Map<string, ShoreStation>(); for (const a of shoreWindRegistry.assignments) m.set(a.kind + a.stationId, {id: a.stationId, name: a.stationName, kind: a.kind, lat: a.lat, lon: a.lon, distanceKm: a.distanceKm}); return [...m.values()]; };
/** Server key of a station's feed (forecast-service.mjs ingests exactly these; a test keeps the lists equal). */
export const shoreFeedKey = (s: Pick<ShoreStation, 'id' | 'kind'>) => `shore-${s.kind}-${s.id}`;

export const ndbcWindURL = (id: string) => `https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`;
/** The latest few observations, not `observations/latest`: an ASOS report with no wind (a fog-only METAR) would otherwise hide the report an hour or two older that has it. */
export const nwsObservationURL = (id: string) => `https://api.weather.gov/stations/K${id}/observations?limit=6`;

const iso = (ms: number) => new Date(ms).toISOString();
const fresh = (t: number, now: number, maxAgeMs: number) => Number.isFinite(t) && now - t <= maxAgeMs && t <= now + 300000;
const r1 = (n: number) => Math.round(n * 10) / 10;
function build(st: ShoreStation, observedMs: number, now: number, mph: number, gust: number | null, dir: number | null, url: string, native: string, provider: string): ShoreWindNow {
  const distanceKm = st.distanceKm ?? 0, observedAt = iso(observedMs);
  return {stationId: st.id, stationName: st.name, kind: st.kind, exposure: exposureOf(st) ?? 'harbour', distanceKm, observedAt, mph: r1(mph), gustMph: gust === null ? null : r1(gust), dirDeg: dir,
    source: {provider, kind: 'observation', validAt: observedAt, retrievedAt: iso(now), issuedAt: null, updatedAt: null, url, nativeUnit: native, location: `${st.name}, ${distanceKm} km from the spot (${st.kind === 'ndbc' ? 'NDBC/NOS met station' : 'airport ASOS'})`}};
}

/** NDBC realtime2 text (newest row first; WDIR deg true, WSPD and GST m/s; MM = missing). The newest row that has a wind speed and is no older than maxAgeMs; null if none. A missing direction is null (never 0). */
export function normalizeNdbcWind(text: string, st: ShoreStation, now: number, maxAgeMs = SHORE_WIND_STALE_MS): ShoreWindNow | null {
  const lines = text.trim().split(/\r?\n/), header = lines.find((l) => l.startsWith('#YY'))?.replace(/^#/, '').trim().split(/\s+/); if (!header) return null;
  const [iD, iS, iG] = [header.indexOf('WDIR'), header.indexOf('WSPD'), header.indexOf('GST')]; if (iS < 0) return null;
  const num = (c: string | undefined) => (c !== undefined && c !== 'MM' && c !== '' && Number.isFinite(Number(c)) ? Number(c) : null);
  for (const l of lines) {
    if (l.startsWith('#') || !l.trim()) continue;
    const c = l.trim().split(/\s+/), [y, mo, d, h, mi] = c.slice(0, 5).map(Number); if (![y, mo, d, h, mi].every(Number.isFinite) || y < 2000) continue;
    const t = Date.UTC(y, mo - 1, d, h, mi), ws = num(c[iS]); if (ws === null || ws < 0 || ws > 60 || !fresh(t, now, maxAgeMs)) continue;
    const g = iG >= 0 ? num(c[iG]) : null, wd = iD >= 0 ? num(c[iD]) : null;
    return build(st, t, now, ws * MS_TO_MPH, g !== null && g >= ws ? g * MS_TO_MPH : null, wd !== null && wd >= 0 && wd <= 360 ? wd : null, ndbcWindURL(st.id), 'm/s', `NOAA NDBC ${st.id}`);
  }
  return null;
}

/** NWS observations (a GeoJSON Feature or a FeatureCollection, newest first). Speeds carry a `unitCode` and are converted by it; an unknown unit is refused, never guessed.
 *  The newest observation that has a wind speed and is no older than maxAgeMs; a null direction (variable or missing) stays null. */
export function normalizeNwsWind(body: string | any, st: ShoreStation, now: number, maxAgeMs = SHORE_WIND_STALE_MS): ShoreWindNow | null {
  let j: any; try { j = typeof body === 'string' ? JSON.parse(body) : body; } catch { return null; }
  const feats: any[] = Array.isArray(j?.features) ? j.features : j?.properties ? [j] : [];
  const speed = (q: any): number | null | undefined => {   // undefined = unit we do not know; null = no value
    if (!q || q.value === null || q.value === undefined) return null; const v = Number(q.value); if (!Number.isFinite(v) || v < 0) return null;
    const u = String(q.unitCode ?? ''); if (u === 'wmoUnit:km_h-1') return v * KMH_TO_MPH; if (u === 'wmoUnit:m_s-1') return v * MS_TO_MPH; if (u === 'wmoUnit:kn' || u === 'wmoUnit:kt') return v * 1.150779; return undefined;
  };
  // NWS quality control: 'X' = rejected, 'Q' = questioned. Such a value is skipped, never shown.
  const qcBad = (q: any) => q?.qualityControl === 'X' || q?.qualityControl === 'Q';
  for (const f of feats) {
    const p = f?.properties; if (!p || qcBad(p.windSpeed)) continue;
    const t = Date.parse(p.timestamp), mph = speed(p.windSpeed); if (mph === undefined || mph === null || mph > 140 || !fresh(t, now, maxAgeMs)) continue;
    const gs = qcBad(p.windGust) ? null : speed(p.windGust), wd = p.windDirection && p.windDirection.value !== null && !qcBad(p.windDirection) ? Number(p.windDirection.value) : null;
    const native = ({'wmoUnit:km_h-1': 'km/h', 'wmoUnit:m_s-1': 'm/s', 'wmoUnit:kn': 'kn', 'wmoUnit:kt': 'kn'} as Record<string, string>)[String(p.windSpeed?.unitCode)] ?? 'unknown';
    return build(st, t, now, mph, typeof gs === 'number' && gs >= mph ? gs : null, wd !== null && Number.isFinite(wd) && wd >= 0 && wd <= 360 ? wd : null, nwsObservationURL(st.id), native, `NWS observation K${st.id}`);
  }
  return null;
}

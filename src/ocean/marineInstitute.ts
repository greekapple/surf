/** Marine Institute, Ireland: wave buoys and tide predictions (ERDDAP, keyless, CC BY 4.0). Source notes: docs/forecast/IRELAND-SOURCES.md; plan: docs/specs/DRAFT-europe-wiring.md. NOT wired into the app yet (no Irish spot exists).
 *  Two readers that return the shapes the app already uses: an `ObservationSet` per buoy (the context-buoy shape of buoys.ts, same value names) and `TidePrediction[]` (the tide card's extrema, noaa.ts), both with the Marine Institute attribution in each value's source notes. */
import type {Measurement, ObservationSet, TidePrediction} from './types.ts';

export const MI_ATTRIBUTION = 'Marine Institute, Ireland: data under CC BY 4.0';
export const MI_LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/';
/** The IWBNetwork `acknowledgement` attribute, verbatim (it goes on the source sheet). */
export const MI_BUOY_ACKNOWLEDGEMENT = 'The Irish Buoy Network was established in 2000 and maintains five buoys operating around the coast of Ireland. The project was set up through a highly successful collaboration between Met Eireann, the Marine Institute, the UK Met Office and the Department of Transport, Tourism and Sport (DTTAS). Since 2017 the project is run by the Marine Institute in collaboration with Met Eireann funded through the Department of Agriculture and the Marine (DAFM).';
export const MI_USER_AGENT = 'SWELLO surf forecast prototype';
/** The local time zone of the Irish stations and spots. ERDDAP times are UTC instants; this is the zone to show them in. */
export const IRELAND_ZONE = 'Europe/Dublin';
/** A buoy reading older than this is not shown (the study measured a 1.3 h lag; a station silent for longer is dead, like M4 since 2026-03-29). */
export const MI_MAX_AGE_MS = 24 * 3600000;
const FT = 1 / 0.3048, ERDDAP = 'https://erddap.marine.ie/erddap/tabledap/';

/* ---------- wave buoys: IWBNetwork ---------- */
const IWB_FIELDS = 'station_id,longitude,latitude,time,WaveHeight,WavePeriod,MeanWaveDirection,Hmax,Tp,ThTp,SprTp,QC_Flag';
/** One request covers every station: the last 24 h of rows (a live station has about 24, a dead one none). */
export const miBuoyURL = (nowMs: number = Date.now()) => `${ERDDAP}IWBNetwork.csv?${IWB_FIELDS}&time%3E=${new Date(Math.floor((nowMs - MI_MAX_AGE_MS) / 3600000) * 3600000).toISOString().replace('.000Z', 'Z')}`;
export interface MiBuoyRow {station: string; lon: number; lat: number; time: number; iso: string; hsM: number | null; tpS: number | null; dpDeg: number | null; qc: number | null}
const num = (s: string | undefined): number | null => { const t = (s ?? '').trim(); if (t === '' || t === 'NaN') return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
/** ERDDAP CSV: line 1 the column names, line 2 the UNITS (skipped). Rows with an unreadable station or time are dropped; "NaN" and blanks are null, never 0. */
export function parseMiBuoyCsv(csv: string): MiBuoyRow[] {
  const lines = csv.trim().split(/\r?\n/), head = (lines.shift() ?? '').split(','); lines.shift();   // the units line
  const ix = (n: string) => head.indexOf(n); if (['station_id', 'time', 'WaveHeight', 'Tp', 'ThTp', 'QC_Flag'].some((n) => ix(n) < 0)) return [];
  return lines.flatMap((l) => { const c = l.split(','), t = Date.parse(c[ix('time')] ?? ''), id = (c[ix('station_id')] ?? '').trim(); if (!id || !Number.isFinite(t)) return []; return [{station: id, lon: Number(c[ix('longitude')]), lat: Number(c[ix('latitude')]), time: t, iso: new Date(t).toISOString(), hsM: num(c[ix('WaveHeight')]), tpS: num(c[ix('Tp')]), dpDeg: num(c[ix('ThTp')]), qc: num(c[ix('QC_Flag')])}]; });
}
export interface MiBuoyNow {id: string; lat: number; lon: number; /** newest accepted reading */ validAt: string; ageMinutes: number; obs: ObservationSet}
export interface MiBuoyResult {buoys: MiBuoyNow[]; /** stations in the response with no acceptable reading in the last 24 h, with the newest row seen */ silent: {id: string; lastSeen: string | null}[]}
/** The buoys of one response, as context observations. Value names are the context-buoy ones of buoys.ts ("Offshore significant height" in ft, "Dominant wave period" = Tp in s, "Peak wave direction" = ThTp in degrees true).
 *  A row counts only when it is within 24 h of `retrievedAt`, not in the future, and QC_Flag is not 9 (missing); flag 0 means "unknown" in this dataset, flag 1 "good": both are accepted and the notes say which. Each variable takes its own newest valid row (never filled across hours). */
export function normalizeMiBuoys(csv: string, retrievedAt: string, urlIn?: string): MiBuoyResult {
  const now = Date.parse(retrievedAt); if (!Number.isFinite(now)) return {buoys: [], silent: []};
  const url = urlIn ?? miBuoyURL(now);
  const byStation = new Map<string, MiBuoyRow[]>(); for (const r of parseMiBuoyCsv(csv)) (byStation.get(r.station) ?? byStation.set(r.station, []).get(r.station)!).push(r);
  const buoys: MiBuoyNow[] = [], silent: MiBuoyResult['silent'] = [];
  for (const [id, all] of [...byStation].sort(([a], [b]) => a.localeCompare(b))) {
    const rows = all.sort((a, b) => b.time - a.time), fresh = rows.filter((r) => now - r.time <= MI_MAX_AGE_MS && r.time <= now + 300000 && r.qc !== 9);
    const first = fresh.find((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon)); if (!fresh.length || !first) { silent.push({id, lastSeen: rows[0]?.iso ?? null}); continue; }
    const place = `${id} weather buoy (${Math.abs(first.lat).toFixed(2)}° ${first.lat >= 0 ? 'N' : 'S'}, ${Math.abs(first.lon).toFixed(2)}° ${first.lon >= 0 ? 'E' : 'W'}), Irish Weather Buoy Network`;
    const src = (validAt: string, native: string, qc: number | null): Measurement['source'] => ({provider: `Marine Institute ${id} (Irish Weather Buoy Network)`, kind: 'observation', validAt, retrievedAt, issuedAt: null, updatedAt: null, url, nativeUnit: native, location: `${place}, offshore; regional context only`, delivery: 'direct',
      notes: `${MI_ATTRIBUTION} (${MI_LICENCE_URL}). Hourly reading, quality flag ${qc === 1 ? '1 (good)' : qc === 0 ? '0 (unknown: the dataset does not qualify it)' : String(qc)}. Not breaking-wave height or a primary-swell component; no swell split is published.`});
    const values: Record<string, Measurement> = {};
    const h = fresh.find((r) => r.hsM !== null && r.hsM >= 0 && r.hsM < 50), p = fresh.find((r) => r.tpS !== null && r.tpS > 0 && r.tpS < 100), d = fresh.find((r) => r.dpDeg !== null && r.dpDeg >= 0 && r.dpDeg <= 360);
    if (h) values['Offshore significant height'] = {value: h.hsM! * FT, unit: 'ft', source: src(h.iso, 'm', h.qc)};
    if (p) values['Dominant wave period'] = {value: p.tpS!, unit: 's', source: src(p.iso, 's', p.qc)};
    if (d) values['Peak wave direction'] = {value: d.dpDeg! % 360, unit: 'deg', source: src(d.iso, 'deg true', d.qc)};
    if (!Object.keys(values).length) { silent.push({id, lastSeen: rows[0]?.iso ?? null}); continue; }
    buoys.push({id, lat: first.lat, lon: first.lon, validAt: first.iso, ageMinutes: Math.round((now - first.time) / 60000), obs: {station: `MI ${id}`, location: place, values, delivery: 'direct'}});
  }
  return {buoys, silent};
}

/* ---------- tide predictions: IMI_TidePrediction_HighLow ---------- */
/** The 38 Marine Institute tide-prediction stations (the dataset's own list and positions, read 2026-11-10). The station id is the ERDDAP `stationID` value. */
export const MI_TIDE_STATIONS: {id: string; name: string; lat: number; lon: number}[] = [
  {id: 'Achill_Island', name: 'Achill Island', lat: 53.9522, lon: -10.1016},
  {id: 'Aranmore', name: 'Aranmore', lat: 54.9896, lon: -8.49562},
  {id: 'Arklow', name: 'Arklow', lat: 52.792046, lon: -6.145231},
  {id: 'Ballycotton', name: 'Ballycotton', lat: 51.82776, lon: -8.0007},
  {id: 'Ballyglass', name: 'Ballyglass', lat: 54.253, lon: -9.89},
  {id: 'Bray_Harbour', name: 'Bray Harbour', lat: 53.2191, lon: -6.0901},
  {id: 'Buncranna', name: 'Buncranna', lat: 55.126617, lon: -7.464125},
  {id: 'Carrigaholt', name: 'Carrigaholt', lat: 52.5965, lon: -9.6812},
  {id: 'Castletownbere', name: 'Castletownbere', lat: 51.6496, lon: -9.9034},
  {id: 'Clare_Island', name: 'Clare Island', lat: 53.8019, lon: -9.9443},
  {id: 'Crosshaven', name: 'Crosshaven', lat: 51.7794, lon: -8.2411},
  {id: 'Dingle', name: 'Dingle', lat: 52.13924, lon: -10.27732},
  {id: 'Dublin_Port', name: 'Dublin Port', lat: 53.34574, lon: -6.22166},
  {id: 'Dungarvan', name: 'Dungarvan', lat: 52.0672, lon: -7.5521},
  {id: 'Dunmore', name: 'Dunmore', lat: 52.14754, lon: -6.99166},
  {id: 'Fenit', name: 'Fenit', lat: 52.27129, lon: -9.8644},
  {id: 'Galway', name: 'Galway', lat: 53.26895, lon: -9.04796},
  {id: 'Howth', name: 'Howth', lat: 53.39148, lon: -6.0683},
  {id: 'Inishmore', name: 'Inishmore', lat: 53.126, lon: -9.66},
  {id: 'Killary_Harbour', name: 'Killary Harbour', lat: 53.6316, lon: -9.9016},
  {id: 'Killybegs', name: 'Killybegs', lat: 54.6364, lon: -8.3949},
  {id: 'Kilrush', name: 'Kilrush', lat: 52.63191, lon: -9.50208},
  {id: 'Kinsale', name: 'Kinsale', lat: 51.6777, lon: -8.446},
  {id: 'Lahinch', name: 'Lahinch', lat: 52.911, lon: -9.3899},
  {id: 'Letterfrack', name: 'Letterfrack', lat: 53.582, lon: -10.0388},
  {id: 'Malin_Head', name: 'Malin Head', lat: 55.37168, lon: -7.33432},
  {id: 'Port_Oriel', name: 'Port Oriel', lat: 53.79899, lon: -6.221713},
  {id: 'Ringaskiddy', name: 'Ringaskiddy', lat: 51.84, lon: -8.304},
  {id: 'Roonagh', name: 'Roonagh', lat: 53.76235, lon: -9.90442},
  {id: 'Rossaveel', name: 'Rossaveel', lat: 53.266926, lon: -9.562056},
  {id: 'Rosslare', name: 'Rosslare', lat: 52.2546, lon: -6.334861},
  {id: 'Skerries', name: 'Skerries', lat: 53.585, lon: -6.108117},
  {id: 'Sligo', name: 'Sligo', lat: 54.3046, lon: -8.5689},
  {id: 'Tom_Clarke_Bridge', name: 'Tom Clarke Bridge', lat: 53.346233, lon: -6.227383},
  {id: 'Tory_Island', name: 'Tory Island', lat: 55.2508, lon: -8.1962},
  {id: 'Union_Hall', name: 'Union Hall', lat: 51.559, lon: -9.1335},
  {id: 'Wexford', name: 'Wexford', lat: 52.33852, lon: -6.4589},
  {id: 'Wicklow', name: 'Wicklow', lat: 52.9889, lon: -6.0127},
];
export const MI_TIDE_DATUM = 'OD Malin';
/** The variable `Water_Level_ODMalin` carries `sea_level_datum = "OD Malin"`; the dataset SUMMARY says "above local Lowest Astronomical Tide". They contradict; the reader labels the datum from the variable and says the summary differs until the Marine Institute confirms. */
export const MI_TIDE_DATUM_NOTE = 'Heights are labelled with the variable\'s own datum, OD Malin (Ordnance Datum Malin Head). The dataset summary says "above local Lowest Astronomical Tide": unconfirmed, so heights are not shown as chart-datum depths.';
export const miTideURL = (stationId: string, startMs: number, endMs: number) => `${ERDDAP}IMI_TidePrediction_HighLow.csv?stationID,time,tide_time_category,Water_Level_ODMalin&stationID=%22${encodeURIComponent(stationId)}%22&time%3E=${new Date(startMs).toISOString().replace('.000Z', 'Z')}&time%3C=${new Date(endMs).toISOString().replace('.000Z', 'Z')}`;
export const parseMiTideStations = (csv: string): {id: string; lat: number; lon: number}[] => csv.trim().split(/\r?\n/).slice(2).flatMap((l) => { const [id, lat, lon] = l.split(','); return id && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) ? [{id, lat: Number(lat), lon: Number(lon)}] : []; });
export interface MiTides {stationId: string; stationName: string; /** the zone to show the (UTC) times in */ zone: typeof IRELAND_ZONE; datum: typeof MI_TIDE_DATUM; datumNote: string; attribution: string; extrema: TidePrediction[]}
/** High and low water of one station: ERDDAP CSV (line 2 = units, UTC, metres) -> the tide card's extrema (ISO UTC instants, height in ft like the NOAA ones, the native metres and datum named in the source). 5-minute resolution: the times are the Marine Institute's own, never interpolated. */
export function normalizeMiTides(csv: string, stationId: string, retrievedAt: string, url: string): MiTides {
  const lines = csv.trim().split(/\r?\n/), head = (lines.shift() ?? '').split(','); lines.shift();
  const iT = head.indexOf('time'), iC = head.indexOf('tide_time_category'), iH = head.indexOf('Water_Level_ODMalin'), name = MI_TIDE_STATIONS.find((s) => s.id === stationId)?.name ?? stationId.replace(/_/g, ' ');
  const extrema = iT < 0 || iC < 0 || iH < 0 ? [] : lines.flatMap((l) => {
    const c = l.split(','), t = Date.parse(c[iT] ?? ''), v = num(c[iH]), cat = (c[iC] ?? '').trim().toUpperCase(); if (!Number.isFinite(t) || v === null || !(cat === 'HIGH' || cat === 'LOW') || (c[0] ?? '').trim() !== stationId) return [];
    const iso = new Date(t).toISOString();
    return [{timestamp: iso, type: cat === 'HIGH' ? 'High' : 'Low', height: {value: v * FT, unit: 'ft', source: {provider: `Marine Institute tide prediction, ${name}`, kind: 'forecast', validAt: iso, retrievedAt, issuedAt: null, updatedAt: null, url, nativeUnit: `m ${MI_TIDE_DATUM}`, location: `Irish Marine Institute prediction at ${name}`, delivery: 'direct',
      notes: `${MI_ATTRIBUTION} (${MI_LICENCE_URL}). Astronomical high/low water to the nearest 5 minutes, times UTC (show in ${IRELAND_ZONE}). ${MI_TIDE_DATUM_NOTE} Local beach tide and surf compatibility are uncalibrated.`}}} as TidePrediction];
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return {stationId, stationName: name, zone: IRELAND_ZONE, datum: MI_TIDE_DATUM, datumNote: MI_TIDE_DATUM_NOTE, attribution: MI_ATTRIBUTION, extrema};
}

/* ---------- live fetches (keyless; at most one request per second; the project's User-Agent) ---------- */
type Fetcher = typeof fetch;
export async function fetchMiBuoys(fetcher: Fetcher = fetch, now: () => number = Date.now): Promise<MiBuoyResult & {url: string; retrievedAt: string}> {
  const t = now(), url = miBuoyURL(t), r = await fetcher(url, {headers: {'User-Agent': MI_USER_AGENT}, signal: AbortSignal.timeout(30000)}); if (!r.ok) throw new Error(`Marine Institute IWBNetwork: HTTP ${r.status}`);
  const retrievedAt = new Date(now()).toISOString(); return {...normalizeMiBuoys(await r.text(), retrievedAt, url), url, retrievedAt};
}
export async function fetchMiTides(stationId: string, fetcher: Fetcher = fetch, now: () => number = Date.now, days = 2): Promise<MiTides> {
  const t = now(), start = Math.floor(t / 86400000) * 86400000, url = miTideURL(stationId, start, start + days * 86400000), r = await fetcher(url, {headers: {'User-Agent': MI_USER_AGENT}, signal: AbortSignal.timeout(30000)});
  if (!r.ok) throw new Error(`Marine Institute tide predictions ${stationId}: HTTP ${r.status}`); return normalizeMiTides(await r.text(), stationId, new Date(now()).toISOString(), url);
}

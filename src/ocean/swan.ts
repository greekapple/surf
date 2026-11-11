import type {Measurement} from './types.ts';
import type {SwanPoint} from './swanPointsSourced.ts';
import {SWAN_ENABLED} from './swanFlag.ts';
import {swanTable} from './swanTable.ts';

/** PacIOOS SWAN (University of Hawaii) point forecasts read through ERDDAP (docs/research/NEARSHORE-MODELS.md section 2). One request per distinct cell; the answer is ERDDAP's own JSON table, nothing is decoded.
 *  Nothing is interpolated, shifted or filled: a row with a missing value is dropped. The model is not validated by us; every value is labelled as a model at a named cell. */
export const SWAN_BASE = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/';
export const SWAN_CREDIT = 'Nearshore model: PacIOOS (UH SOEST, NOAA IOOS), SWAN regional wave model';
export const SWAN_LABEL = 'PacIOOS SWAN nearshore model';
export interface SwanRecord {timestamp: string; height: Measurement; period: Measurement; direction: Measurement; pointKey: string}
export interface SwanForecast {pointKey: string; dataset: string; lat: number; lon: number; depthM: number; records: SwanRecord[]; retrievedAt: string; url: string; /** the last hour the model run covers (its own time_coverage_end as the time axis returned it): the run marker; PacIOOS publishes no issue time */ runEnd: string | null; delivery?: 'saved'}
export const swanKey = (p: Pick<SwanPoint, 'dataset' | 'lat' | 'lon'>) => `${p.dataset}:${p.lat},${p.lon}`;
/** The Worker's provider key for a cell: starts with "nearshore-" and ends with "-forecast" so it is a shared, hot-gated group like a MOP point. */
export const swanProviderKey = (p: Pick<SwanPoint, 'dataset' | 'lat' | 'lon'>) => `nearshore-swan-${p.dataset}-${p.lat}_${p.lon}-forecast`;
const stamp = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
export function swanURL(p: Pick<SwanPoint, 'dataset' | 'lat' | 'lon'>, now = Date.now()): string {
  const t0 = stamp(now - 6 * 3600000), sel = (v: string) => `${v}%5B(${t0}):1:(last)%5D%5B(0)%5D%5B(${p.lat})%5D%5B(${p.lon})%5D`;
  return `${SWAN_BASE}${p.dataset}_lon180.json?${sel('shgt')},${sel('pper')},${sel('pdir')}`;
}
/** Every distinct cell the table proposes (spots share cells). */
/** The table, only while the flag is on and swanEnable.ts has registered it (swanTable.ts). Tests pass a table explicitly or import it directly. */
const active = (): readonly SwanPoint[] => (SWAN_ENABLED ? swanTable() : []);
export const swanPointFor = (spotId: string): SwanPoint | null => active().find((p) => p.spotId === spotId) ?? null;
export const swanCells = (points: readonly SwanPoint[] = active()): SwanPoint[] => [...new Map(points.map((p) => [swanKey(p), p])).values()];
export const swanCellsFor = (spotIds: Iterable<string>, points: readonly SwanPoint[] = active()): SwanPoint[] => { const want = new Set(spotIds); return swanCells(points.filter((p) => want.has(p.spotId))); };
const FT = 1 / 0.3048;
/** ERDDAP JSON table with columns time, shgt (meters), pper (seconds), pdir (degrees, "from"). Anything else returns nothing. */
export function normalizeSwanPoint(payload: any, retrievedAt: string, url: string, p: Pick<SwanPoint, 'dataset' | 'lat' | 'lon' | 'depthM'>): SwanForecast | null {
  const t = payload?.table, names: string[] = t?.columnNames, units: string[] = t?.columnUnits, rows = t?.rows;
  if (!Array.isArray(names) || !Array.isArray(rows) || !Number.isFinite(Date.parse(retrievedAt))) return null;
  const i = (n: string) => names.indexOf(n), ti = i('time'), hs = i('shgt'), tp = i('pper'), dp = i('pdir');
  if ([ti, hs, tp, dp].some((x) => x < 0) || units?.[hs] !== 'meters' || !/^s/i.test(units?.[tp] ?? '') || !/degree/i.test(units?.[dp] ?? '')) return null;
  const pointKey = swanKey(p), meas = (v: unknown, unit: Measurement['unit'], native: string, convert: number, validAt: string, hi: number): Measurement | null => {
    const n = typeof v === 'number' ? v : NaN; if (!Number.isFinite(n) || n < 0 || n >= hi) return null;
    return {value: n * convert, unit, source: {provider: `${SWAN_LABEL} (${p.dataset})`, kind: 'forecast', validAt, retrievedAt, issuedAt: null, updatedAt: null, url, nativeUnit: native, location: `SWAN cell ${p.lat}, ${p.lon} · about ${p.depthM} m deep (50 m bathymetry); the cell averages about 500 m`, delivery: 'direct', notes: 'A model value at a 500 m cell, not at the break. PacIOOS says part of the nested setup is still in testing and validation. Not validated by us.'}};
  };
  const records: SwanRecord[] = [];
  for (const r of rows) {
    const ms = Date.parse(r[ti]); if (!Number.isFinite(ms)) continue; const timestamp = new Date(ms).toISOString();
    const height = meas(r[hs], 'ft', 'meters', FT, timestamp, 100), period = meas(r[tp], 's', 'seconds', 1, timestamp, 100), direction = meas(r[dp], 'deg', 'degrees', 1, timestamp, 360);
    if (!height || !period || !direction) continue;   // a missing value drops the hour; it is never filled
    records.push({timestamp, height, period, direction, pointKey});
  }
  records.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return {pointKey, dataset: p.dataset, lat: p.lat, lon: p.lon, depthM: p.depthM, records, retrievedAt, url, runEnd: records.length ? records[records.length - 1].timestamp : null};
}
/** The record for an hour: the one at that timestamp, or the nearest within 30 minutes of it. No interpolation, no shifting. */
export function pickSwan(records: readonly SwanRecord[] | undefined, atMs: number): SwanRecord | null {
  let best: SwanRecord | null = null, bd = Infinity;
  for (const r of records ?? []) { const d = Math.abs(Date.parse(r.timestamp) - atMs); if (d < bd) { bd = d; best = r; } }
  return best && bd <= 30 * 60000 ? best : null;
}

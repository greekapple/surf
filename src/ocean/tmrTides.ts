/** Queensland Transport and Main Roads: tide gauge PREDICTED HIGH/LOW data (data.qld.gov.au, CC BY 4.0, CKAN datastore API, keyless). Source notes: docs/forecast/AUSTRALIA-SOURCES.md; plan: docs/specs/DRAFT-australia-wiring.md. NOT wired.
 *  Returns `TidePrediction[]` in the tide card's shape. The record states neither the time zone nor the datum; both are SAID, not assumed (see below). No BoM data is read anywhere. */
import type {TidePrediction} from './types.ts';

export const TMR_USER_AGENT = 'SWELLO surf forecast prototype';
export const TMR_LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/';
/** CC BY 4.0 asks for the creator and the licence; the CKAN record gives the publisher (opendata@tmr.qld.gov.au) and "Creative Commons Attribution 4.0" and no stricter wording. */
export const TMR_ATTRIBUTION = 'Tide predictions: State of Queensland (Department of Transport and Main Roads), CC BY 4.0';
/** Queensland has no daylight saving: the zone is a fixed UTC+10 all year (AEST). */
export const TMR_ZONE = 'Australia/Brisbane';
export const TMR_UTC_OFFSET_MS = 10 * 3600000;
/** The record says only "Predicted high and low water level heights at <gauge>". Nothing states the zone of `Date`/`Time` or the datum.
 *  ZONE (inferred): the times are the Brisbane clock (AEST): the Gold Coast Seaway predictions for 2026-11-05/06 fall within 12-26 minutes of the DES storm-tide prediction series for the same gauge, whose clock is AEST (its `Seconds` epoch is 10 h behind its `DateTime`); a UTC reading would be 10 h off.
 *  DATUM (not stated): the Reading is metres above an unstated gauge datum (TMR tide tables are usually LAT); it matches the DES prediction level of the same gauge within 0.06 m. Heights carry that wording; times alone are safe. Confirm with opendata@tmr.qld.gov.au. */
export const TMR_ZONE_NOTE = 'The record does not state the time zone; the times are the Brisbane clock (AEST, UTC+10, no daylight saving), inferred from the DES storm-tide prediction series of the same gauge.';
export const TMR_DATUM_NOTE = 'The record does not state the datum: heights are metres above an unstated gauge datum (TMR tables are usually Lowest Astronomical Tide), unconfirmed. They are not shown as chart-datum depths.';
export const TMR_DATUM = 'not stated';

export interface TmrGauge {id: string; name: string; lat: number; lon: number; /** CKAN package id: its resources are one per year ("2026 — ... predicted high/low data") */ packageId: string; /** the datastore resource id of each year (2026 and 2027 read 2026-11-10); a new one is published every year */ resources: Record<number, string>}
/** Gauges with a published position (the DES storm-tide CSV's own coordinates). Noosa Head also has a predicted set, with no machine-readable position found, so it is not here. */
export const TMR_GAUGES: TmrGauge[] = [
  {id: 'gold-coast-seaway', name: 'Gold Coast Seaway', lat: -27.9386, lon: 153.4326, packageId: '98e7afb8-e249-4c7d-aac7-b24dda7cc789', resources: {2026: '94a28942-b589-4c41-849c-619bae60f2ba', 2027: '784e567b-e780-490d-acea-919c52bbf274'}},
  {id: 'mooloolaba', name: 'Mooloolaba', lat: -26.6843, lon: 153.1334, packageId: 'fa4f1aca-3294-444a-ae7f-2a3fbfaf29ef', resources: {2026: '58920636-0eb3-419f-bc28-68e1d0b88c82', 2027: '3b846b9c-09b2-47f4-b1a8-07a8da59d355'}},
];
/** The resource of a year, or null: a missing year means "not available", never last year's table. */
export const tmrResourceFor = (g: TmrGauge, year: number): string | null => g.resources[year] ?? null;
/** Resolve the year's resource from the package record (CKAN package_show): the resource name starts with the year. */
export function tmrResourceFromPackage(pkg: {result?: {resources?: {name?: string; id?: string}[]}}, year: number): string | null {
  return pkg?.result?.resources?.find((r) => new RegExp(`^${year}\\b`).test(r.name ?? ''))?.id ?? null;
}
const BASE = 'https://www.data.qld.gov.au/api/3/action/';
export const tmrPackageURL = (g: Pick<TmrGauge, 'packageId'>) => `${BASE}package_show?id=${g.packageId}`;
/** "DD/MM/YYYY" of the Brisbane calendar days from `startMs`. */
export const tmrDates = (startMs: number, days: number): string[] => Array.from({length: days}, (_, i) => { const d = new Date(startMs + TMR_UTC_OFFSET_MS + i * 86400000); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; });
export const tmrTideURL = (resourceId: string, dates: string[]) => `${BASE}datastore_search?${new URLSearchParams({resource_id: resourceId, filters: JSON.stringify({Date: dates}), limit: '200'})}`;
const FT = 1 / 0.3048;
export interface TmrTides {gaugeId: string; gaugeName: string; zone: typeof TMR_ZONE; datum: typeof TMR_DATUM; zoneNote: string; datumNote: string; attribution: string; extrema: TidePrediction[]}
/** CKAN datastore_search JSON -> extrema. Records: `Date` "DD/MM/YYYY", `Time` "HH:MM" (Brisbane clock), `Ind` "1" high / "-1" low, `Reading` metres (strings). The Brisbane clock time becomes an ISO UTC instant (UTC+10, no DST). Unreadable records are dropped. */
export function normalizeTmrTides(json: unknown, gauge: Pick<TmrGauge, 'id' | 'name'>, retrievedAt: string, url: string): TmrTides {
  const recs = ((json as {result?: {records?: Record<string, string>[]}})?.result?.records ?? []);
  const extrema = recs.flatMap((r) => {
    const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.Date ?? ''), t = /^(\d{2}):(\d{2})$/.exec(r.Time ?? ''), v = (r.Reading ?? '').trim() === '' ? NaN : Number(r.Reading), ind = String(r.Ind ?? '').trim();
    if (!d || !t || !Number.isFinite(v) || (ind !== '1' && ind !== '-1')) return [];
    const iso = new Date(Date.UTC(+d[3], +d[2] - 1, +d[1], +t[1], +t[2]) - TMR_UTC_OFFSET_MS).toISOString();
    return [{timestamp: iso, type: ind === '1' ? 'High' : 'Low', height: {value: v * FT, unit: 'ft', source: {provider: `Queensland TMR tide prediction, ${gauge.name}`, kind: 'forecast', validAt: iso, retrievedAt, issuedAt: null, updatedAt: null, url, nativeUnit: `m above an unstated gauge datum`, location: `Queensland predicted tide at ${gauge.name}`, delivery: 'direct',
      notes: `${TMR_ATTRIBUTION} (${TMR_LICENCE_URL}). Predicted high/low water. ${TMR_ZONE_NOTE} ${TMR_DATUM_NOTE} Local beach tide and surf compatibility are uncalibrated.`}}} as TidePrediction];
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return {gaugeId: gauge.id, gaugeName: gauge.name, zone: TMR_ZONE, datum: TMR_DATUM, zoneNote: TMR_ZONE_NOTE, datumNote: TMR_DATUM_NOTE, attribution: TMR_ATTRIBUTION, extrema};
}
/** Live: the Brisbane day and the next. A year with no resource (a January before next year's table exists) is `{available: false}`, never a stale year. */
export async function fetchTmrTides(gauge: TmrGauge, fetcher: typeof fetch = fetch, now: () => number = Date.now, days = 2): Promise<{available: true; tides: TmrTides} | {available: false; reason: string}> {
  const t = now(), year = new Date(t + TMR_UTC_OFFSET_MS).getUTCFullYear(), res = tmrResourceFor(gauge, year);
  if (!res) return {available: false, reason: `no ${year} predicted table for ${gauge.name} yet`};
  const url = tmrTideURL(res, tmrDates(t, days)), r = await fetcher(url, {headers: {'User-Agent': TMR_USER_AGENT}, signal: AbortSignal.timeout(30000)});
  if (!r.ok) throw new Error(`Queensland TMR tide predictions ${gauge.name}: HTTP ${r.status}`);
  const j = await r.json() as {success?: boolean}; if (!j?.success) throw new Error(`Queensland TMR tide predictions ${gauge.name}: the API did not succeed`);
  const tides = normalizeTmrTides(j, gauge, new Date(now()).toISOString(), url); return tides.extrema.length ? {available: true, tides} : {available: false, reason: `no predictions for ${tmrDates(t, days).join(', ')}`};
}

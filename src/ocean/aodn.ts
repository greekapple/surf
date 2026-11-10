/** Australian Ocean Data Network (AODN / IMOS) THREDDS wave buoys, realtime (CC BY 4.0 plus the IMOS acknowledgement). Source notes: docs/forecast/AUSTRALIA-SOURCES.md; study: docs/forecast/AUSTRALIA-DATA.md; plan: docs/specs/DRAFT-australia-wiring.md.
 *  NOT wired into the app (no Australian spot exists). The reader returns the context-buoy `ObservationSet` of buoys.ts (same value names), and reports buoys that are silent. No BoM data is read here. */
import type {Measurement, ObservationSet} from './types.ts';

export const AODN_USER_AGENT = 'SWELLO surf forecast prototype';
export const AODN_BASE = 'https://thredds.aodn.org.au/thredds';
export const AODN_LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/';
/** The sentence every AODN file carries in its `acknowledgement` attribute (IMOS wording, verbatim, with the typographic apostrophe). It must appear wherever an AODN value is shown. */
export const IMOS_ACKNOWLEDGEMENT = 'Data was sourced from Australia’s Integrated Marine Observing System (IMOS) - IMOS is enabled by the National Collaborative Research Infrastructure Strategy (NCRIS)';
/** NSW DPE Nearshore Wave Data Program buoys (Tathra...) add this line (file attribute, verbatim). */
export const NSW_DPE_ACKNOWLEDGEMENT = 'NSW wave data sourced from IMOS were collected, processed and provided by the NSW Nearshore Wave Data Program operated by the NSW Department of Climate Change, Energy, the Environment and Water';
export const aodnCredit = (owner: string) => `Wave buoy data: ${owner}, via the Australian Ocean Data Network (AODN), CC BY 4.0`;
export const AODN_MAX_AGE_MS = 24 * 3600000;
const FT = 1 / 0.3048;

/** Waverider networks (MHL, BoM, QLD DES, WA DoT, Gippsland Ports) carry WHTH (zero-crossing Hs); Spotter networks (IMOS, NSW DPE, UWA, Deakin, Flinders, SA DEW) carry WSSH (spectral Hs). No file carries both. */
export type AodnKind = 'waverider' | 'spotter';
export interface AodnBuoy {id: string; /** the owner's THREDDS folder, e.g. "Department_of_Transport-Western_Australia" */ folder: string; owner: string; kind: AodnKind; lat: number; lon: number; /** extra acknowledgement the owner asks for */ extraAcknowledgement?: string}
export const aodnVars = (kind: AodnKind) => (kind === 'waverider' ? 'WHTH,WPPE,WPDI,WPDS,WMXH' : 'WSSH,WPPE,WPDI,WPDS') + ',WAVE_quality_control';
const folderOf = (b: Pick<AodnBuoy, 'id' | 'folder'>, year: number) => `${b.folder}/WAVE-BUOYS/REALTIME/WAVE-PARAMETERS/${b.id}/${year}`;
/** The year folder's catalog: the monthly file's name starts on a day that is NOT always the 1st (Rottnest 20261102), so the newest file is resolved from here, never guessed. */
export const aodnCatalogURL = (b: Pick<AodnBuoy, 'id' | 'folder'>, year: number) => `${AODN_BASE}/catalog/${folderOf(b, year)}/catalog.xml`;
/** The newest `..._monthly.nc` urlPath of a catalog.xml (by the YYYYMMDD in the file name), or null. */
export function latestAodnFile(catalogXml: string): string | null {
  const paths = [...catalogXml.matchAll(/urlPath="([^"]+_monthly\.nc)"/g)].map((m) => m[1]);
  const key = (p: string) => /_(\d{8})_/.exec(p.split('/').pop() ?? '')?.[1] ?? '';
  return paths.filter((p) => key(p)).sort((a, b) => key(a).localeCompare(key(b))).at(-1) ?? null;
}
/** The UTC years a 24 h window touches: in the first hours of January the window needs last year's file too. */
export const aodnYears = (nowMs: number): number[] => [...new Set([new Date(nowMs - AODN_MAX_AGE_MS).getUTCFullYear(), new Date(nowMs).getUTCFullYear()])];
/** NCSS point CSV of one file for the last 24 h (+1 h). */
export const aodnNcssURL = (urlPath: string, kind: AodnKind, nowMs: number) => `${AODN_BASE}/ncss/point/${urlPath}?${new URLSearchParams({var: aodnVars(kind), time_start: new Date(nowMs - AODN_MAX_AGE_MS).toISOString().replace(/\.\d+Z$/, 'Z'), time_end: new Date(nowMs + 3600000).toISOString().replace(/\.\d+Z$/, 'Z'), accept: 'csv'})}`;

export interface AodnRow {t: number; iso: string; hs: number | null; hsKind: 'zero-crossing' | 'spectral' | null; tp: number | null; dp: number | null; qc: number | null}
const num = (s: string | undefined): number | null => { const t = (s ?? '').trim(); if (t === '' || t === 'NaN') return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
/** A realtime file writes 0.0 into the period, direction, spread and max height of a row that has no such measurement (Gold Coast, QLD DES, the :30 rows beside a real WHTH): an exact 0.0 there is a FILL, read as missing, never as a measurement. Hs of 0.0 is not a wave height either. */
const fill = (n: number | null) => (n === null || n === 0 ? null : n);
/** NCSS CSV: columns are read by NAME (header like `WHTH[unit="m"]`; there is no station column). */
export function parseAodnCsv(csv: string): AodnRow[] {
  const lines = csv.trim().split(/\r?\n/), head = (lines.shift() ?? '').split(',').map((h) => h.replace(/\[.*$/, '').trim()), ix = (n: string) => head.indexOf(n);
  if (ix('time') < 0 || (ix('WHTH') < 0 && ix('WSSH') < 0)) return [];
  const hsCol = ix('WHTH') >= 0 ? ix('WHTH') : ix('WSSH'), hsKind = ix('WHTH') >= 0 ? 'zero-crossing' as const : 'spectral' as const;
  return lines.flatMap((l) => { const c = l.split(','), t = Date.parse(c[ix('time')] ?? ''); if (!Number.isFinite(t)) return []; return [{t, iso: new Date(t).toISOString(), hs: fill(num(c[hsCol])), hsKind, tp: fill(num(c[ix('WPPE')])), dp: fill(num(c[ix('WPDI')])), qc: ix('WAVE_quality_control') >= 0 ? num(c[ix('WAVE_quality_control')]) : null}]; });
}
/** WAVE_quality_control: 1 good, 2 not_evaluated, 3 questionable, 4 bad, 9 missing. Realtime rows are 2 ("not quality-controlled"). 3, 4 and 9 are dropped. */
const qcText = (qc: number | null) => (qc === 1 ? 'good' : qc === 2 ? 'realtime, not quality-controlled' : qc === null ? 'no quality flag in the file' : `flag ${qc}`);
export interface AodnBuoyNow {id: string; owner: string; lat: number; lon: number; validAt: string; ageMinutes: number; /** how often the buoy reports (median spacing of its rows in the window): 30 and 60 min for most, 180 for WA DoT */ cadenceMinutes: number | null; hsKind: 'zero-crossing' | 'spectral'; obs: ObservationSet}
export type AodnBuoyResult = {ok: true; buoy: AodnBuoyNow} | {ok: false; id: string; /** the newest row seen at all (any age, any flag) */ lastSeen: string | null; reason: string};
const cadence = (rows: AodnRow[]) => { const ts = rows.map((r) => r.t).sort((a, b) => a - b), d = ts.slice(1).map((t, i) => t - ts[i]).filter((x) => x > 0).sort((a, b) => a - b); return d.length ? Math.round(d[d.length >> 1] / 60000) : null; };
/** One buoy's NCSS CSV as context observations (the value names of buoys.ts). A row counts when within 24 h of `retrievedAt`, not in the future (5 min grace) and QC not 3, 4 or 9; each variable takes its own newest valid row (fill 0.0 is missing). A buoy with nothing acceptable is returned as silent with its newest row, so the caller can say so. */
export function normalizeAodnBuoy(csv: string, retrievedAt: string, url: string, buoy: AodnBuoy): AodnBuoyResult {
  const now = Date.parse(retrievedAt), all = parseAodnCsv(csv).sort((a, b) => b.t - a.t), lastSeen = all[0]?.iso ?? null;
  if (!Number.isFinite(now)) return {ok: false, id: buoy.id, lastSeen, reason: 'no retrieval time'};
  if (!all.length) return {ok: false, id: buoy.id, lastSeen: null, reason: 'no rows in the last 24 h'};
  const fresh = all.filter((r) => now - r.t <= AODN_MAX_AGE_MS && r.t <= now + 300000 && ![3, 4, 9].includes(r.qc ?? 2));
  const h = fresh.find((r) => r.hs !== null), p = fresh.find((r) => r.tp !== null), d = fresh.find((r) => r.dp !== null && r.dp >= 0 && r.dp <= 360);
  if (!h && !p && !d) return {ok: false, id: buoy.id, lastSeen, reason: fresh.length ? 'only fill rows' : 'no acceptable reading in the last 24 h'};
  const hsKind = all[0].hsKind ?? 'zero-crossing', cad = cadence(all.filter((r) => now - r.t <= AODN_MAX_AGE_MS));
  const ack = [IMOS_ACKNOWLEDGEMENT, buoy.extraAcknowledgement].filter(Boolean).join('. ');
  const src = (r: AodnRow, native: string, what: string): Measurement['source'] => ({provider: `${buoy.owner} ${buoy.id} (AODN)`, kind: 'observation', validAt: r.iso, retrievedAt, issuedAt: null, updatedAt: null, url, nativeUnit: native, location: `${buoy.id} wave buoy (${buoy.lat.toFixed(2)}°, ${buoy.lon.toFixed(2)}°), ${buoy.owner}, offshore; regional context only`, delivery: 'direct',
    notes: `${aodnCredit(buoy.owner)} (${AODN_LICENCE_URL}). ${ack}. ${what}Quality: ${qcText(r.qc)}. Reports about every ${cad ?? '?'} minutes. No swell/sea split is published; not breaking-wave height.`});
  const values: Record<string, Measurement> = {};
  if (h) values['Offshore significant height'] = {value: h.hs! * FT, unit: 'ft', source: src(h, 'm', `Significant wave height (${hsKind}). `)};
  if (p) values['Dominant wave period'] = {value: p.tp!, unit: 's', source: src(p, 's', 'Peak period. ')};
  if (d) values['Peak wave direction'] = {value: d.dp! % 360, unit: 'deg', source: src(d, 'deg true (direction the waves come from)', 'Peak direction. ')};
  const first = h ?? p ?? d!;
  return {ok: true, buoy: {id: buoy.id, owner: buoy.owner, lat: buoy.lat, lon: buoy.lon, validAt: first.iso, ageMinutes: Math.round((now - first.t) / 60000), cadenceMinutes: cad, hsKind, obs: {station: `AODN ${buoy.id}`, location: `${buoy.id} wave buoy, ${buoy.owner}`, values, delivery: 'direct'}}};
}
/** Many buoys at once: the live ones, and the silent ones with the reason (the study found 63 of 135 folders silent). */
export const summariseAodn = (results: AodnBuoyResult[]) => ({buoys: results.flatMap((r) => (r.ok ? [r.buoy] : [])), silent: results.flatMap((r) => (r.ok ? [] : [{id: r.id, lastSeen: r.lastSeen, reason: r.reason}]))});

/* ---------- live (keyless; one request a second; the project's User-Agent) ---------- */
type Fetcher = typeof fetch;
const get = async (fetcher: Fetcher, url: string) => { const r = await fetcher(url, {headers: {'User-Agent': AODN_USER_AGENT}, signal: AbortSignal.timeout(60000)}); if (!r.ok) throw new Error(`AODN ${new URL(url).pathname.split('/').slice(-2).join('/')}: HTTP ${r.status}`); return r.text(); };
/** Two requests: the year folder's catalog (newest file) and the file's NCSS CSV, a pause between them. A catalog or file failure is thrown (an HTTP error is not "silent"). */
export async function fetchAodnBuoy(buoy: AodnBuoy, fetcher: Fetcher = fetch, now: () => number = Date.now, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<AodnBuoyResult> {
  const t = now(); let file: string | null = null;
  for (const year of aodnYears(t).reverse()) { file = latestAodnFile(await get(fetcher, aodnCatalogURL(buoy, year))); await sleep(1100); if (file) break; }
  if (!file) return {ok: false, id: buoy.id, lastSeen: null, reason: 'no monthly file in the catalog'};
  const url = aodnNcssURL(file, buoy.kind, t); return normalizeAodnBuoy(await get(fetcher, url), new Date(now()).toISOString(), url, buoy);
}

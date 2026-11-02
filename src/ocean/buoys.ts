import type {Measurement, ObservationSet} from './types.ts';

/** Extra buoys for the "buoy now vs forecast" context (T-049). They are CONTEXT: observed at different points than any forecast spot, never a validation.
 *  NDBC 46214 and CDIP 029 are two feeds of the SAME instrument (the Point Reyes buoy, CDIP 029p1; checked 2026-11-02: matching Hs, Tp and direction at the same times),
 *  so they are labelled as one buoy seen twice, not as two independent readings. */
export interface ContextBuoy {id: string; provider: 'NDBC' | 'CDIP'; label: string; place: string; note?: string; fetchKey: string}
export const contextBuoys: ContextBuoy[] = [
  {id: '46012', provider: 'NDBC', label: 'NDBC 46012', place: 'Half Moon Bay', fetchKey: 'ndbc-46012'},
  {id: '46214', provider: 'NDBC', label: 'NDBC 46214', place: 'Point Reyes', note: 'Same buoy as CDIP 029', fetchKey: 'ndbc-46214'},
  {id: '029p1', provider: 'CDIP', label: 'CDIP 029', place: 'Point Reyes', note: 'Same buoy as NDBC 46214: a second feed, not an independent reading', fetchKey: 'cdip-029'},
];
export const ndbcBuoyURL = (id: string) => `https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`;
export const cdipBuoyURL = (id = '029p1', now = Date.now()) => `https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/realtime/${id}_rt.nc?` + new URLSearchParams({var: 'waveHs,waveTp,waveDp', time_start: new Date(now - 86400000).toISOString(), time_end: new Date(now + 3600000).toISOString(), accept: 'csv'});
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

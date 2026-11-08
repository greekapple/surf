import type {NearshoreRecord} from '../ocean/nearshore.ts';

/** Which MOP record (if any) may be shown for the selected hour. Nothing is interpolated, shifted or extrapolated. */
export type MopPick =
  | {state: 'ok'; record: NearshoreRecord; product: 'nowcast' | 'forecast'; offsetMin: number}
  | {state: 'no-data'}
  | {state: 'outside'; first: string; last: string};

const NOWCAST_TOL = 30 * 60000, FORECAST_TOL = 90 * 60000; // hourly nowcast, 3-hourly forecast: nearest step at most half a step away
const nearest = (rows: NearshoreRecord[], t: number) => rows.reduce<{r: NearshoreRecord; d: number} | null>((b, r) => { const d = Math.abs(Date.parse(r.timestamp) - t); return !b || d < b.d ? {r, d} : b; }, null);

/** The only MOP nowcast the app fetches is SF023's (`bundle.nearshore`). A point's nowcast may be shown only for that point: for any other assigned MOP (e.g. Linda Mar's SM382) there is NO nowcast, so the forecast is used,
 *  and Ocean Beach measurements are never shown under another point's label. Records that carry a `mopId` must also match. */
export const NOWCAST_MOP_ID = 'SF023';
export const nowcastFor = (mopId: string, nowcast: NearshoreRecord[] | undefined): NearshoreRecord[] | undefined => (mopId === NOWCAST_MOP_ID ? nowcast?.filter((r) => !r.mopId || r.mopId === mopId) : undefined);

/** Past and present hours prefer the nowcast (initialised from observations); future hours use the forecast. Either falls back to the other only when it has the hour. */
export function pickMop(selectedMs: number, nowMs: number, nowcast: NearshoreRecord[] | undefined, forecast: NearshoreRecord[] | undefined): MopPick {
  const nc = nowcast ?? [], fc = forecast ?? [];
  if (!Number.isFinite(selectedMs) || (!nc.length && !fc.length)) return {state: 'no-data'};
  const order: ['nowcast' | 'forecast', NearshoreRecord[], number][] = selectedMs <= nowMs + NOWCAST_TOL ? [['nowcast', nc, NOWCAST_TOL], ['forecast', fc, FORECAST_TOL]] : [['forecast', fc, FORECAST_TOL], ['nowcast', nc, NOWCAST_TOL]];
  for (const [product, rows, tol] of order) {
    const n = rows.length ? nearest(rows, selectedMs) : null;
    if (n && n.d <= tol) return {state: 'ok', record: n.r, product, offsetMin: Math.round((Date.parse(n.r.timestamp) - selectedMs) / 60000)};
  }
  const all = [...nc, ...fc].map((r) => r.timestamp).sort();
  return {state: 'outside', first: all[0], last: all[all.length - 1]};
}

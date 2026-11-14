/** prod-nan: the last good NOAA tide prediction, kept on this device. When the live fetch fails (the server copy and the direct call both down, e.g. a short network outage), the app shows this copy LABELLED as saved
 *  (delivery 'saved', "retrieved <time>") instead of "no tide". A tide prediction is astronomical, so a copy from hours ago is still right for the hours it covers; it is used only while it still covers the present.
 *  Counts and the prediction rows only: no personal data. Bounded: 24 entries, newest kept. */
export interface SavedTide { at: string; /** the CO-OPS station the rows are for (from the request URL): a copy is never used for another station */ station?: string; payload: {predictions: {t: string; v: string; type?: string}[]} }
const KEY = 'swello-tide-last-good-v1', MAX_ENTRIES = 24;
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const store = (): Store | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
const read = (s: Store): Record<string, SavedTide> => { try { const j = JSON.parse(s.getItem(KEY) ?? '{}'); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } };
/** NOAA CO-OPS rows carry "YYYY-MM-DD HH:mm" in GMT (the request asks time_zone=gmt). */
const rowMs = (t: unknown) => (typeof t === 'string' ? Date.parse(t.replace(' ', 'T') + ':00Z') : NaN);
export const usableTide = (p: SavedTide['payload'] | null | undefined, nowMs: number): boolean => !!p && Array.isArray(p.predictions) && p.predictions.length >= 24 && p.predictions.some((r) => rowMs(r.t) >= nowMs - 3600000);
/** Save a good prediction payload (rows with a numeric value only). Never throws. */
export function saveTide(id: string, payload: unknown, atIso: string, s: Store | null = store(), station?: string): void {
  try {
    const rows = (payload as any)?.predictions; if (!s || !Array.isArray(rows) || rows.length < 24 || !Number.isFinite(Date.parse(atIso))) return;
    const clean = rows.filter((r: any) => typeof r?.t === 'string' && typeof r?.v === 'string' && Number.isFinite(Number(r.v)) && r.v.trim() !== '').map((r: any) => (r.type ? {t: r.t, v: r.v, type: r.type} : {t: r.t, v: r.v}));
    if (clean.length < 24) return;
    const all = read(s); all[id] = {at: atIso, ...(station ? {station} : {}), payload: {predictions: clean}};
    const keep = Object.entries(all).sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at)).slice(0, MAX_ENTRIES);
    s.setItem(KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch { /* storage full or unavailable: the live path is unaffected */ }
}
/** The saved copy for this feed, or null when there is none or it no longer covers the present. */
export function lastGoodTide(id: string, nowMs = Date.now(), s: Store | null = store(), station?: string): SavedTide | null {
  try { const e = s ? read(s)[id] : null; if (e && station && e.station !== station) return null;   // a copy saved for another station (or before stations were recorded) is not this feed's
    return e && Number.isFinite(Date.parse(e.at)) && usableTide(e.payload, nowMs) ? e : null; } catch { return null; }
}

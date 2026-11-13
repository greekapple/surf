// First-paint cache (T-128c): the last global and regional frames, persisted in IndexedDB so a repeat visit colours the sea at once instead of waiting 10 s on ERDDAP.
// Honesty: a stored frame keeps its OWN valid time, source text and retrievedAt; it comes back marked `cached: {savedAt}` and is replaced as soon as the network frame lands (see useGlobe / useSpatial). It is only ever offered as the FIRST picture of a field, never when scrubbing hours, and never when its valid time is more than MAX_OFFSET_MS from the hour asked for.
// Keyed by field + dataset (the SpatialSpec without its time) and the frame's own valid time. Frames are public NOAA model values; nothing personal is stored. Failure of IndexedDB (private window, quota) is silent: the map simply loads as before.
import type {SpatialFrame, SpatialSpec} from './spatial.ts';

const DB_NAME = 'swello-map-frames', STORE = 'frames', KEEP = 14, MAX_OFFSET_MS = 24 * 3600_000;
interface Row {id: string; group: string; field: string; validMs: number; savedAt: string; frame: SpatialFrame}
export type FrameGroup = 'globe' | 'regional';

let dbP: Promise<IDBDatabase | null> | null = null;
const open = (): Promise<IDBDatabase | null> => (dbP ??= new Promise((res) => {
  try {
    if (typeof indexedDB === 'undefined') return res(null);
    const rq = indexedDB.open(DB_NAME, 2); // v2 (sea-field): a savedAt index, so the trim walks keys instead of reading every stored frame back
    rq.onupgradeneeded = () => { const db = rq.result, st = db.objectStoreNames.contains(STORE) ? rq.transaction!.objectStore(STORE) : db.createObjectStore(STORE, {keyPath: 'id'}); if (!st.indexNames.contains('field')) st.createIndex('field', ['group', 'field']); if (!st.indexNames.contains('savedAt')) st.createIndex('savedAt', 'savedAt'); };
    rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
  } catch { res(null); }
}));
const done = <T,>(rq: IDBRequest<T>): Promise<T | null> => new Promise((res) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); });

/** The field part of a spec (everything but its time): one cache lane per field/dataset. */
export const fieldKeyOf = (spec: SpatialSpec): string => [spec.dataset, spec.scalar, spec.direction ?? '', spec.unit].join('|');

/** sea-field (B8): writing a frame (structured clone of a ~10 MB grid) and the trim's read-back on every hour of a scrub cost ~15 ms per step on the main thread. Only the frame still on screen
 *  once the hour has settled is written (the cache is only a first-paint picture, so the last settled frame is the one worth keeping). */
const SAVE_SETTLE_MS = 2000;
const pendingSave = new Map<string, ReturnType<typeof setTimeout>>();   // keyed by group and field, so waves then wind within 2 s both get saved
/** Stores a frame under its own valid time (fire and forget, once the hour has settled) and trims the store to the newest KEEP rows. */
export function saveFrame(group: FrameGroup, spec: SpatialSpec, frame: SpatialFrame): void {
  if (frame.cached) return; // never re-store a cached picture as if it were fresh
  const pk = `${group}|${fieldKeyOf(spec)}`; clearTimeout(pendingSave.get(pk));
  const idle = typeof window !== 'undefined' ? (window as unknown as {requestIdleCallback?: (cb: () => void, o?: {timeout: number}) => number}).requestIdleCallback : undefined;
  pendingSave.set(pk, setTimeout(() => { pendingSave.delete(pk); if (idle) idle(() => writeFrame(group, spec, frame), {timeout: 10_000}); else writeFrame(group, spec, frame); }, SAVE_SETTLE_MS));
}
function writeFrame(group: FrameGroup, spec: SpatialSpec, frame: SpatialFrame): void {
  void open().then(async (db) => {
    if (!db) return;
    const field = fieldKeyOf(spec), validMs = Date.parse(frame.validAt); if (!Number.isFinite(validMs)) return;
    const row: Row = {id: `${group}|${field}|${validMs}`, group, field, validMs, savedAt: new Date().toISOString(), frame};
    try {
      const tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE); st.put(row);
      // trim the oldest-saved beyond KEEP, walking the savedAt index by key (reading every row back cost a ~100 MB deserialisation per write)
      const n = await done(st.count()); let extra = (n ?? 0) - KEEP;
      if (extra > 0) { const cur = st.index('savedAt').openKeyCursor(); cur.onsuccess = () => { const c = cur.result; if (!c || extra <= 0) return; st.delete(c.primaryKey); extra--; c.continue(); }; }
    } catch { /* quota or closed: skip */ }
  });
}

/** The stored frame of this field whose valid time is nearest the wanted one (within 24 h), marked `cached`; null if none. */
export async function nearestFrame(group: FrameGroup, spec: SpatialSpec, wantedIso: string | null): Promise<SpatialFrame | null> {
  const db = await open(); if (!db) return null;
  try {
    const want = wantedIso ? Date.parse(wantedIso) : Date.parse(spec.validAt); if (!Number.isFinite(want)) return null;
    const rows = await done(db.transaction(STORE).objectStore(STORE).index('field').getAll([group, fieldKeyOf(spec)])) as Row[] | null;
    let best: Row | null = null; for (const r of rows ?? []) if (Math.abs(r.validMs - want) <= MAX_OFFSET_MS && (!best || Math.abs(r.validMs - want) < Math.abs(best.validMs - want))) best = r;
    return best ? {...best.frame, cached: {savedAt: best.savedAt}} : null;
  } catch { return null; }
}

import {useEffect, useRef, useState, type KeyboardEvent} from 'react';

/* T-063 surf-analysis shell (plan: docs/product/SURF-ANALYSIS-PLAN.md). A session can hold one clip the surfer picks from their device.
 * The video never leaves the device: it is kept in this browser's IndexedDB (or, if that fails, only for this visit, and the panel says so).
 * Rides are marked by hand (start, end); stats come only from those marks. No AI, no upload, no detection: the analysis row says it needs approval. */

const DB = 'swello-clips', STORE = 'clips', MARKS = 'swello-clip-rides', FPS = 30;
type Stored = {blob: Blob; name: string; savedAt: string};
export type Ride = {start: number; end: number};

const openDb = () => new Promise<IDBDatabase>((res, rej) => {
  if (typeof indexedDB === 'undefined') return rej(new Error('no IndexedDB'));
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((res, rej) => { const q = f(db.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error); });
};
const getClip = (id: string) => tx<Stored | undefined>('readonly', (s) => s.get(id)).catch(() => undefined);
const putClip = (id: string, v: Stored) => tx('readwrite', (s) => s.put(v, id)).then(() => true).catch(() => false);
const delClip = (id: string) => tx('readwrite', (s) => s.delete(id)).catch(() => undefined);
/** Ride marks per session (small, so localStorage). */
const loadRides = (id: string): Ride[] => { try { const all = JSON.parse(localStorage.getItem(MARKS) ?? '{}'); return Array.isArray(all[id]) ? all[id] : []; } catch { return []; } };
const saveRides = (id: string, r: Ride[]) => { try { const all = JSON.parse(localStorage.getItem(MARKS) ?? '{}'); if (r.length) all[id] = r; else delete all[id]; localStorage.setItem(MARKS, JSON.stringify(all)); } catch { /* blocked: marks last for this visit */ } };

const t = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const secs = (s: number) => `${s.toFixed(1)} s`;

export function rideStats(rides: Ride[]) {
  const len = rides.map((r) => r.end - r.start);
  return {count: rides.length, total: len.reduce((a, b) => a + b, 0), longest: len.length ? Math.max(...len) : 0, average: len.length ? len.reduce((a, b) => a + b, 0) / len.length : 0};
}

export function ClipPanel({sessionId, title}: {sessionId: string; title: string}) {
  const [src, setSrc] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kept, setKept] = useState<'device' | 'visit' | null>(null);
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<Ride[]>(() => loadRides(sessionId));
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0), [dur, setDur] = useState(0), [playing, setPlaying] = useState(false);
  const vid = useRef<HTMLVideoElement>(null), file = useRef<HTMLInputElement>(null), probing = useRef(false); // recorded WebM often reports no duration until it is sought to the end

  useEffect(() => {
    let on = true, url: string | null = null;
    getClip(sessionId).then((c) => { if (!on) return; if (c) { url = URL.createObjectURL(c.blob); setSrc(url); setName(c.name); setKept('device'); } setLoading(false); });
    return () => { on = false; if (url) URL.revokeObjectURL(url); };
  }, [sessionId]);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setSrc(url); setName(f.name); setStart(null);
    setKept((await putClip(sessionId, {blob: f, name: f.name, savedAt: new Date().toISOString()})) ? 'device' : 'visit');
  };
  const remove = async () => { await delClip(sessionId); setSrc(null); setName(''); setKept(null); setRides([]); saveRides(sessionId, []); setStart(null); if (file.current) file.current.value = ''; };
  const seek = (s: number) => { const v = vid.current; if (!v) return; v.currentTime = Math.max(0, Math.min(dur || v.duration || 0, s)); setNow(v.currentTime); };
  const step = (frames: number) => { vid.current?.pause(); seek(now + frames / FPS); };
  const toggle = () => { const v = vid.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); };
  const mark = () => {
    if (start === null) { setStart(now); return; }
    if (now <= start) return;
    const next = [...rides, {start, end: now}].sort((a, b) => a.start - b.start);
    setRides(next); saveRides(sessionId, next); setStart(null);
  };
  const removeRide = (i: number) => { const next = rides.filter((_, k) => k !== i); setRides(next); saveRides(sessionId, next); };
  const keys = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === ',' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.shiftKey ? -FPS : -1); }
    else if (e.key === '.' || e.key === 'ArrowRight') { e.preventDefault(); step(e.shiftKey ? FPS : 1); }
    else if (e.key === 'm') { e.preventDefault(); mark(); }
  };
  const st = rideStats(rides);

  return (
    <section className="clip" aria-label={`Clip for ${title}`}>
      {loading ? <p className="fine">Looking for a saved clip…</p> : !src ? (
        <div className="clip-add">
          <label className="clip-pick"><input ref={file} type="file" accept="video/*" onChange={(e) => void pick(e.target.files?.[0])} /><span>Choose a video</span></label>
          <p className="fine">The video stays on this device. Nothing is uploaded.</p>
          {rides.length > 0 && <p className="fine">{rides.length} ride{rides.length === 1 ? '' : 's'} marked earlier; the clip itself is no longer on this device. Choose it again to see them.</p>}
        </div>
      ) : (
        <>
          <div className="clip-stage" tabIndex={0} onKeyDown={keys} aria-label="Clip player. Space plays or pauses, comma and period step one frame, M marks a ride.">
            <video ref={vid} src={src} playsInline preload="metadata" onLoadedMetadata={(e) => { const v = e.currentTarget; if (Number.isFinite(v.duration)) setDur(v.duration); else { probing.current = true; v.currentTime = 1e7; } }}
              onTimeUpdate={(e) => { const v = e.currentTarget; if (probing.current) { if (Number.isFinite(v.duration)) { probing.current = false; setDur(v.duration); v.currentTime = 0; } return; } setNow(v.currentTime); }}
              onDurationChange={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0 && !probing.current) setDur(d); }}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onClick={toggle} />
          </div>
          <div className="clip-ctl">
            <button type="button" className="clip-b" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Pause' : 'Play'}</button>
            <button type="button" className="clip-b" onClick={() => step(-1)} aria-label="Back one frame">−1 f</button>
            <button type="button" className="clip-b" onClick={() => step(1)} aria-label="Forward one frame">+1 f</button>
            <input className="clip-scrub" type="range" min={0} max={dur || 0} step={1 / FPS} value={now} onChange={(e) => { vid.current?.pause(); seek(Number(e.target.value)); }} aria-label="Scrub" aria-valuetext={`${t(now)} of ${t(dur)}`} />
            <output className="clip-t">{t(now)} / {t(dur)}</output>
          </div>
          <div className="clip-mark">
            <button type="button" className="clip-go" onClick={mark} disabled={start !== null && now <= start}>{start === null ? 'Mark ride start' : `Mark ride end (started ${t(start)})`}</button>
            {start !== null && <button type="button" className="clip-link" onClick={() => setStart(null)}>Cancel</button>}
          </div>
          <p className="fine">{name} · {kept === 'device' ? 'kept in this browser on this device, never uploaded' : 'kept only for this visit (this browser would not store it); it is gone after a reload'} · <button type="button" className="clip-link" onClick={() => void remove()}>Remove clip</button></p>
        </>
      )}
      {(src || rides.length > 0) && (
        <div className="clip-stats" aria-label="Ride stats, from your marks">
          <dl>
            <div><dt>Rides</dt><dd>{st.count}</dd></div>
            <div><dt>Longest</dt><dd>{st.count ? secs(st.longest) : '—'}</dd></div>
            <div><dt>Average</dt><dd>{st.count ? secs(st.average) : '—'}</dd></div>
            <div><dt>Time riding</dt><dd>{st.count ? secs(st.total) : '—'}</dd></div>
          </dl>
          {rides.length > 0 && <ol className="clip-rides">{rides.map((r, i) => (
            <li key={`${r.start}-${r.end}`}><button type="button" className="clip-link" onClick={() => seek(r.start)} disabled={!src}>Ride {i + 1} · {t(r.start)}–{t(r.end)} · {secs(r.end - r.start)}</button><button type="button" className="clip-link clip-del" onClick={() => removeRide(i)} aria-label={`Delete ride ${i + 1}`}>Delete</button></li>
          ))}</ol>}
          <p className="fine">From the start and end you marked by hand; nothing is detected automatically.</p>
        </div>
      )}
      <p className="clip-ai"><span>AI analysis</span><span>Coming: needs your OK first (what it would look at and where it would run)</span></p>
    </section>
  );
}

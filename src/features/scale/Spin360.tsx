import {useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import {SPIN_CAPTION, counterText, frameFromDrag, frameFromKey} from '../../services/scaleFrames';

/** Drag, swipe or arrow through N pre-rendered frames of a 3D illustration (T-044).
 *  Frames preload on mount; until the first frame is ready, and whenever `still` is set or a frame fails to load, the poster is shown instead. */
export function Spin360({frames, poster, alt, still = false, onFail, intro = false}: {frames: string[]; poster: string; alt: string; still?: boolean; onFail?: () => void; intro?: boolean}) {
  const n = frames.length;
  const [frame, setFrame] = useState(0), [ready, setReady] = useState(0), [failed, setFailed] = useState(false), [armed, setArmed] = useState(!still), [dragging, setDragging] = useState(false);
  const stage = useRef<HTMLDivElement>(null), start = useRef({x: 0, frame: 0, id: -1});
  useEffect(() => { setArmed(!still); }, [still]);
  // Preload every frame once; any failure drops to the still poster (never a broken image).
  useEffect(() => {
    if (!armed) return;
    let live = true, done = 0; setReady(0); setFailed(false);
    const imgs = frames.map((src) => { const im = new Image(); im.decoding = 'async'; im.onload = () => { if (live) setReady(++done); }; im.onerror = () => { if (live) { setFailed(true); onFail?.(); } }; im.src = src; return im; });
    return () => { live = false; imgs.forEach((im) => { im.onload = null; im.onerror = null; }); };
  }, [armed, frames.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const spinning = armed && !failed && ready >= n;
  // One gentle turn once the frames are in, so it reads as 3D; any touch, drag or key stops it (never under reduced motion: `still` is set then).
  const touched = useRef(false);
  useEffect(() => {
    if (!intro || !spinning || touched.current) return;
    let i = 0;
    const id = setInterval(() => { i += 1; if (touched.current || i > n) { clearInterval(id); if (!touched.current) setFrame(0); return; } setFrame(i % n); }, 110);
    return () => clearInterval(id);
  }, [intro, spinning, n]);
  const go = useCallback((i: number) => setFrame(i), []);
  const down = (e: PointerEvent) => { touched.current = true; if (!spinning) return; start.current = {x: e.clientX, frame, id: e.pointerId}; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDragging(true); };
  const move = (e: PointerEvent) => { if (!dragging || e.pointerId !== start.current.id) return; go(frameFromDrag(start.current.frame, e.clientX - start.current.x, stage.current?.clientWidth ?? 0, n)); };
  const up = (e: PointerEvent) => { if (e.pointerId === start.current.id) { setDragging(false); start.current.id = -1; } };
  const key = (e: KeyboardEvent) => { touched.current = true; if (!spinning) return; const next = frameFromKey(e.key, frame, n); if (next !== null) { e.preventDefault(); go(next); } };
  const src = spinning ? frames[frame] : poster;
  return (
    <div ref={stage} className={'spin' + (dragging ? ' is-dragging' : '') + (spinning ? ' is-live' : '')} role="slider" aria-label={`3D view, ${alt}. Drag or use the arrow keys to rotate.`} aria-valuemin={1} aria-valuemax={n} aria-valuenow={frame + 1} aria-valuetext={`Frame ${counterText(frame, n)}`} aria-disabled={!spinning} tabIndex={spinning ? 0 : -1}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key} data-frame={frame + 1} data-state={failed ? 'failed' : spinning ? 'live' : armed ? 'loading' : 'still'}>
      <img className="spin-img" src={src} alt={alt} draggable={false} />
      <p className="spin-cap">{SPIN_CAPTION}</p>
      {spinning && <p className="spin-count" aria-hidden="true">{counterText(frame, n)}</p>}
      {spinning && frame === 0 && !dragging && <p className="spin-hint" aria-hidden="true">Drag to rotate</p>}
      {armed && !failed && !spinning && <p className="spin-count" role="status">Loading {ready} / {n}</p>}
      {!armed && <button type="button" className="spin-start" onClick={() => setArmed(true)}>Rotate in 3D</button>}
      {failed && <p className="spin-count" role="status">Still view only</p>}
    </div>
  );
}

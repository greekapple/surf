import {useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent} from 'react';
import {lengthLabel, parseDimension} from '../../utils/units';
import {scaleFrame, straighten, traceBoard, traceBoardIn, TEX_MAX, type Box, type Frame, type Outline, type TraceResult} from './outline';

const TRACE = 520, FULL = 1600, TEX_W = 1024;

export interface Scan {outline: Outline; aspect: number}

/** Encode RGBA as a JPEG data URL of at most TEX_MAX characters, lowering quality and then size until it fits. */
function encode(px: {data: Uint8ClampedArray; w: number; h: number}): string | null {
  let w = px.w, h = px.h, src = document.createElement('canvas');
  src.width = w; src.height = h; src.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.data), w, h), 0, 0);
  for (let pass = 0; pass < 4; pass++) {
    for (const q of [0.85, 0.72, 0.6, 0.48]) {
      const url = src.toDataURL('image/jpeg', q);
      if (url.length <= TEX_MAX) return url;
    }
    const c = document.createElement('canvas'); w = Math.round(w * 0.75); h = Math.round(h * 0.75); c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(src, 0, 0, w, h); src = c;
  }
  return null;
}

/** Scan a board: a photo is traced to an outline, and the board region is straightened into a deck texture. The photo is read on
 *  this device only: nothing is uploaded. A box dragged on the photo traces only inside it. Nothing is handed to the form until the
 *  person has checked the outline and pressed "Use this outline". */
export function ScanPanel({lengthText, value, onChange}: {lengthText: string; value: Scan | null; onChange: (s: Scan | null) => void}) {
  const overlay = useRef<HTMLCanvasElement>(null), small = useRef<ImageData | null>(null), full = useRef<ImageData | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TraceResult | null>(null);
  const [flip, setFlip] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [box, setBox] = useState<Box | null>(null); // in traced-image (small) pixels
  const [boxNote, setBoxNote] = useState('');
  const drag = useRef<{x: number; y: number} | null>(null);
  const big = useRef<Frame | null>(null); // frame in full-resolution pixels, for the deck texture
  const lengthIn = parseDimension(lengthText, true);

  const paint = (r: TraceResult | null, b: Box | null) => {
    const d = small.current, c = overlay.current; if (!d || !c) return;
    c.width = d.width; c.height = d.height;
    const g = c.getContext('2d')!; g.putImageData(d, 0, 0);
    if (r?.ok) { g.beginPath(); r.edge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = 'rgb(255 155 92 / 0.28)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#ff7a2f'; g.stroke(); }
    if (b) { g.setLineDash([6, 4]); g.lineWidth = 2; g.strokeStyle = '#2f9bff'; g.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.setLineDash([]); }
  };
  const run = (f: boolean, b: Box | null) => {
    const d = small.current, F = full.current; if (!d || !F) return;
    let r: TraceResult;
    if (b) {
      // The box is cut from the full-resolution photo; edge points come back in full pixels and are scaled to the overlay.
      const k = F.width / d.width, rb = traceBoardIn(F.data, F.width, F.height, {x0: b.x0 * k, y0: b.y0 * k, x1: b.x1 * k, y1: b.y1 * k}, TRACE, f);
      big.current = rb.ok ? rb.frame : null;
      r = rb.ok ? {...rb, edge: rb.edge.map(([x, y]) => [x / k, y / k]), w: d.width, h: d.height} : rb;
    } else {
      r = traceBoard(d.data, d.width, d.height, f);
      big.current = r.ok ? scaleFrame(r.frame, F.width / d.width) : null;
    }
    setRes(r); setFlip(f); setNote(''); onChange(null); paint(r, b);
  };
  /** The person checked the outline: build the deck texture and hand the scan to the form. */
  const accept = () => {
    const F = full.current, f = big.current; if (!res?.ok || !F || !f) return;
    const tex = encode(straighten(F.data, F.width, F.height, f, TEX_W));
    if (!tex) setNote('The deck photo could not be made small enough to keep, so the board will use a plain colour. The outline still works.');
    onChange({outline: {...res.outline, ...(tex ? {tex} : {})}, aspect: res.aspect});
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setRes(null); setBox(null); onChange(null); setName(file.name);
    try {
      const bmp = await createImageBitmap(file);
      const draw = (max: number) => {
        const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        const g = c.getContext('2d', {willReadFrequently: true})!; g.drawImage(bmp, 0, 0, c.width, c.height); return g.getImageData(0, 0, c.width, c.height);
      };
      small.current = draw(TRACE); full.current = draw(FULL); bmp.close();
      run(false, null);
    } catch { small.current = full.current = null; setRes({ok: false, reason: 'That file could not be read as an image.'}); }
    setBusy(false);
  };
  // Drag on the photo to draw a box; releasing traces inside it. A tiny drag (a tap) is ignored.
  const at = (e: ReactPointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(), d = small.current!; return {x: ((e.clientX - r.left) / r.width) * d.width, y: ((e.clientY - r.top) / r.height) * d.height}; };
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => { if (!small.current) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = at(e); };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => { const s0 = drag.current; if (!s0) return; const p = at(e); paint(null, {x0: s0.x, y0: s0.y, x1: p.x, y1: p.y}); };
  const up = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s0 = drag.current; drag.current = null; if (!s0) return;
    const p = at(e), b = {x0: Math.min(s0.x, p.x), y0: Math.min(s0.y, p.y), x1: Math.max(s0.x, p.x), y1: Math.max(s0.y, p.y)};
    if (b.x1 - b.x0 < 8 || b.y1 - b.y0 < 8) { paint(res, box); return; }
    setBox(b); run(flip, b);
  };
  // Keyboard path for the crop box: arrows move it, Shift+arrows resize it from the bottom-right corner, Escape clears it. The outline is re-traced once the keys pause.
  const keyTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(keyTimer.current), []);
  const keys = (e: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const d = small.current; if (!d) return;
    if (e.key === 'Escape' && box) { e.preventDefault(); window.clearTimeout(keyTimer.current); setBox(null); setBoxNote('Box cleared. The whole photo is traced.'); run(flip, null); return; }
    const dir = ({ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]} as Record<string, number[]>)[e.key]; if (!dir) return;
    e.preventDefault();
    const st = Math.max(4, Math.round(Math.min(d.width, d.height) * (e.altKey ? 0.005 : 0.02))), MIN = 24;
    let {x0, y0, x1, y1} = box ?? {x0: d.width * 0.2, y0: d.height * 0.2, x1: d.width * 0.8, y1: d.height * 0.8};
    if (e.shiftKey) { x1 = Math.min(d.width, Math.max(x0 + MIN, x1 + dir[0] * st)); y1 = Math.min(d.height, Math.max(y0 + MIN, y1 + dir[1] * st)); }
    else { const dx = Math.max(-x0, Math.min(d.width - x1, dir[0] * st)), dy = Math.max(-y0, Math.min(d.height - y1, dir[1] * st)); x0 += dx; x1 += dx; y0 += dy; y1 += dy; }
    const b = {x0, y0, x1, y1}; setBox(b); paint(null, b);
    setBoxNote(`Box ${e.shiftKey ? 'resized' : 'moved'}: ${Math.round(((x1 - x0) / d.width) * 100)}% wide, ${Math.round(((y1 - y0) / d.height) * 100)}% tall, left edge ${Math.round((x0 / d.width) * 100)}%, top edge ${Math.round((y0 / d.height) * 100)}%.`);
    window.clearTimeout(keyTimer.current); keyTimer.current = window.setTimeout(() => run(flip, b), 450);
  };
  const lenBad = !Number.isFinite(lengthIn), loaded = !!small.current && !busy;
  const even = res?.ok ? res.quality.asym < 0.03 && res.quality.rough < 0.04 : false;

  return (
    <fieldset className="qv-scan">
      <legend className="sr-only">Scan a board photo</legend>
      <p className="fine">Photograph the whole board on a plain background that contrasts with it: from above on a floor, or standing against a plain wall or studio backdrop. Enter the board length below. The photo stays on this device.</p>
      <label className="field"><span>Board photo</span><input type="file" accept="image/*" onChange={(e) => void pick(e.target.files?.[0])} /></label>
      {busy && <div className="skel" aria-hidden="true"><i style={{height: 48}} /></div>}
      {res && !res.ok && <p role="alert" className="qv-trace-fail">{res.reason} Nothing was saved from this photo.</p>}
      <canvas ref={overlay} className="qv-trace-canvas" hidden={!loaded} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; paint(res, box); }}
        tabIndex={loaded ? 0 : -1} onKeyDown={keys} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Escape"
        role="img" aria-label={`${name || 'Photo'}${res?.ok ? ' with the traced board outline drawn over it' : ''}${box ? ', with a box drawn around the board' : ''}`} />
      {loaded && <p className="fine">{box ? 'Only the area inside the blue box is traced. Drag again to redraw it.' : 'If other things in the photo get in the way, drag a box around the board to trace only inside it.'} With the keyboard: focus the photo, then arrow keys move the box, Shift+arrows resize it, Escape clears it.</p>}
      <p className="sr-only" role="status" aria-live="polite">{boxNote}</p>
      {res?.ok && !value && (
        <div className="qv-check" role="group" aria-label="Check the outline">
          <p className="fine" role="status"><b>Check the outline</b> before using it{lenBad ? '' : ` for a ${lengthLabel(lengthIn)} board`}. The orange line should follow the board edge all the way round, and the nose should be the pointier end. {even ? 'The outline is even and symmetric.' : 'The outline is a little uneven; look closely at the rails.'}</p>
          {lenBad && <p role="alert" className="qv-trace-fail">Enter the length (for example 6'0") so the width can be worked out.</p>}
          <div className="qv-actions">
            <button type="button" className="btn primary" disabled={lenBad} onClick={accept}>Use this outline</button>
            <button type="button" className="btn" onClick={() => run(!flip, box)}>Swap nose and tail</button>
            {box && <button type="button" className="btn" onClick={() => { setBox(null); run(flip, null); }}>Clear the box</button>}
          </div>
        </div>
      )}
      {note && <p className="fine" role="status">{note}</p>}
      {value && <div className="qv-actions"><span className="chip">From your photo</span>{value.outline.tex && <img className="qv-tex-s" src={value.outline.tex} alt="Saved deck texture" />}<button type="button" className="btn" onClick={() => { onChange(null); small.current = full.current = null; setRes(null); setBox(null); }}>Remove scan</button></div>}
      {loaded && !value && <div className="qv-actions"><button type="button" className="btn" onClick={() => { small.current = full.current = null; setRes(null); setBox(null); onChange(null); }}>Use another photo</button></div>}
    </fieldset>
  );
}

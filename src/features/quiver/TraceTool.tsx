import {useRef, useState} from 'react';
import {lengthLabel, parseDimension} from '../../utils/units';
import {traceBoard, type Outline, type TraceResult} from './outline';

const MAX = 520;

/** Trace the outline of a board from a top-down photo. The photo is read on this device only: nothing is uploaded. */
export function TraceTool({lengthText, widthIn, value, onChange}: {lengthText: string; widthIn: number; value: Outline | null; onChange: (o: Outline | null) => void}) {
  const canvas = useRef<HTMLCanvasElement>(null), img = useRef<ImageData | null>(null);
  const [len, setLen] = useState(lengthText);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TraceResult | null>(null);
  const [flip, setFlip] = useState(false);
  const [name, setName] = useState('');
  const lengthIn = parseDimension(len, true);

  const draw = (r: TraceResult | null) => {
    const c = canvas.current, d = img.current; if (!c || !d) return;
    c.width = d.width; c.height = d.height;
    const g = c.getContext('2d')!; g.putImageData(d, 0, 0);
    if (r?.ok) {
      g.beginPath(); r.edge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      g.fillStyle = 'rgb(255 155 92 / 0.28)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#ff7a2f'; g.stroke();
    }
  };
  const run = (f: boolean) => {
    const d = img.current; if (!d) return;
    const r = traceBoard(d.data, d.width, d.height, f);
    setRes(r); setFlip(f); draw(r); onChange(null);
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setRes(null); onChange(null); setName(file.name);
    try {
      const bmp = await createImageBitmap(file), k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const g = c.getContext('2d', {willReadFrequently: true})!; g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
      img.current = g.getImageData(0, 0, c.width, c.height);
      run(false);
    } catch { img.current = null; setRes({ok: false, reason: 'That file could not be read as an image.'}); }
    setBusy(false);
  };
  const aspectNote = res?.ok && Number.isFinite(lengthIn) && widthIn > 0 && Math.abs(lengthIn / widthIn - res.aspect) / res.aspect > 0.25
    ? `The photo shape is ${res.aspect.toFixed(1)} times longer than wide, but ${lengthLabel(lengthIn)} by ${widthIn} in is ${(lengthIn / widthIn).toFixed(1)}. Check the length, or retake the photo from directly above.` : '';

  return (
    <details className="qv-trace" open={!!value || undefined}>
      <summary>Trace outline from a photo{value ? ' (traced)' : ''}</summary>
      <div className="qv-trace-body">
        <p className="fine">Photograph the board from directly above on a plain floor that contrasts with it. The photo is read in your browser and is never uploaded.</p>
        <div className="form-grid">
          <label className="field"><span>Photo</span><input type="file" accept="image/*" onChange={(e) => void pick(e.target.files?.[0])} /></label>
          <label className="field"><span>Board length in the photo (e.g. 6'0")</span><input value={len} onChange={(e) => setLen(e.target.value)} aria-invalid={!Number.isFinite(lengthIn)} /></label>
        </div>
        {busy && <p role="status" className="fine">Tracing…</p>}
        {res && !res.ok && <p role="alert" className="qv-trace-fail">{res.reason} Nothing was saved from this photo.</p>}
        <canvas ref={canvas} className="qv-trace-canvas" hidden={!res?.ok} role="img" aria-label={`${name || 'Photo'} with the traced board outline drawn over it`} />
        {res?.ok && (
          <>
            <p className="fine" role="status">Outline found with {res.outline.hw.length} stations. Is the orange line on the board's edge, with the nose at the narrower end?</p>
            {aspectNote && <p className="fine" role="status">{aspectNote}</p>}
            <div className="qv-actions">
              <button type="button" className="btn primary" disabled={!Number.isFinite(lengthIn)} onClick={() => { onChange(res.outline); }}>{value ? 'Outline kept' : 'Use this outline'}</button>
              <button type="button" className="btn" onClick={() => run(!flip)}>Swap nose and tail</button>
              <button type="button" className="btn" onClick={() => { img.current = null; setRes(null); onChange(null); }}>Redo with another photo</button>
            </div>
          </>
        )}
        {value && <div className="qv-actions"><span className="chip">Traced from your photo</span><button type="button" className="btn" onClick={() => onChange(null)}>Remove traced outline</button></div>}
      </div>
    </details>
  );
}

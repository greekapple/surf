import {useRef, useState} from 'react';
import {lengthLabel, parseDimension} from '../../utils/units';
import {scaleFrame, straighten, traceBoard, TEX_MAX, type Outline, type TraceResult} from './outline';

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

/** Scan a board: a top-down photo is traced to an outline, and the board region is straightened into a deck texture. The photo is read on this device only: nothing is uploaded. */
export function ScanPanel({lengthText, value, onChange}: {lengthText: string; value: Scan | null; onChange: (s: Scan | null) => void}) {
  const overlay = useRef<HTMLCanvasElement>(null), small = useRef<ImageData | null>(null), full = useRef<ImageData | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TraceResult | null>(null);
  const [flip, setFlip] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState('');
  const lengthIn = parseDimension(lengthText, true);

  const run = (f: boolean) => {
    const d = small.current, big = full.current; if (!d || !big) return;
    const r = traceBoard(d.data, d.width, d.height, f);
    setRes(r); setFlip(f); setNote(''); setPreview('');
    const c = overlay.current;
    if (c) {
      c.width = d.width; c.height = d.height;
      const g = c.getContext('2d')!; g.putImageData(d, 0, 0);
      if (r.ok) { g.beginPath(); r.edge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = 'rgb(255 155 92 / 0.28)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#ff7a2f'; g.stroke(); }
    }
    if (!r.ok) { onChange(null); return; }
    const px = straighten(big.data, big.width, big.height, scaleFrame(r.frame, big.width / d.width), TEX_W), tex = encode(px);
    if (!tex) setNote('The deck photo could not be made small enough to keep, so the board will use a plain colour. The outline still works.');
    else setPreview(tex);
    onChange({outline: {...r.outline, ...(tex ? {tex} : {})}, aspect: r.aspect});
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setRes(null); onChange(null); setName(file.name);
    try {
      const bmp = await createImageBitmap(file);
      const draw = (max: number) => {
        const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        const g = c.getContext('2d', {willReadFrequently: true})!; g.drawImage(bmp, 0, 0, c.width, c.height); return g.getImageData(0, 0, c.width, c.height);
      };
      small.current = draw(TRACE); full.current = draw(FULL); bmp.close();
      run(false);
    } catch { small.current = full.current = null; setRes({ok: false, reason: 'That file could not be read as an image.'}); }
    setBusy(false);
  };
  const lenBad = !Number.isFinite(lengthIn);

  return (
    <fieldset className="qv-scan">
      <legend className="sr-only">Scan a board photo</legend>
      <p className="fine">Photograph the whole board from directly above, on a plain floor that contrasts with it. Enter the board length below. The photo stays on this device.</p>
      <label className="field"><span>Top-down photo</span><input type="file" accept="image/*" onChange={(e) => void pick(e.target.files?.[0])} /></label>
      {busy && <div className="skel" aria-hidden="true"><i style={{height: 48}} /></div>}
      {res && !res.ok && <p role="alert" className="qv-trace-fail">{res.reason} Nothing was saved from this photo.</p>}
      <canvas ref={overlay} className="qv-trace-canvas" hidden={!res?.ok} role="img" aria-label={`${name || 'Photo'} with the traced board outline drawn over it`} />
      {res?.ok && (
        <>
          <p className="fine" role="status">Outline found{lenBad ? '' : ` for a ${lengthLabel(lengthIn)} board`}. Check that the orange line follows the board edge and the nose is the narrower end.</p>
          {lenBad && <p role="alert" className="qv-trace-fail">Enter the length (for example 6'0") so the width can be worked out.</p>}
          {note && <p className="fine" role="status">{note}</p>}
          {preview && <figure className="qv-tex"><img src={preview} alt="Deck of your board, straightened, nose at the left" /><figcaption className="fine">Deck texture used on the 3D board</figcaption></figure>}
          <div className="qv-actions">
            <button type="button" className="btn" onClick={() => run(!flip)}>Swap nose and tail</button>
            <button type="button" className="btn" onClick={() => { small.current = full.current = null; setRes(null); setPreview(''); onChange(null); }}>Use another photo</button>
          </div>
        </>
      )}
      {value && !res && <div className="qv-actions"><span className="chip">From your photo</span>{value.outline.tex && <img className="qv-tex-s" src={value.outline.tex} alt="Saved deck texture" />}<button type="button" className="btn" onClick={() => onChange(null)}>Remove scan</button></div>}
    </fieldset>
  );
}

import {useEffect, useId, useState} from 'react';
import type {BoardType, Surfboard} from '../../models/index';
import {lengthLabel} from '../../utils/units';
import {BoardOutline} from './BoardOutline';
import {loadLook} from './looks';
import {STATIONS, type Outline} from './outline';

/** A board standing on its tail, nose up. A traced board uses its own outline (and deck photo when scanned); any other board is the category outline in the board's colour. Never an exact scan unless the person scanned it. */
function Upright({b, px, outline}: {b: Surfboard; px: number; outline: Outline | null}) {
  const id = useId().replace(/:/g, '');
  const look = loadLook(b);
  if (!outline) return <BoardOutline b={b} scale={px} color={look.deck} />;
  const L = b.length * px, W = b.width * px, cx = W / 2;
  const half = outline.hw.map((h) => h * L), maxHalf = Math.max(...half), k = maxHalf > 0 ? W / 2 / maxHalf : 1; // stored halves are fractions of length; the typed width wins
  const pts = half.map((h, i) => [(i / (STATIONS - 1)) * L, h * k] as const);
  const d = `M${cx},0 ` + pts.map(([y, h]) => `L${cx + h},${y}`).join(' ') + ' ' + [...pts].reverse().map(([y, h]) => `L${cx - h},${y}`).join(' ') + 'Z';
  return (
    <svg className="outline-svg" width={W + 2} height={L + 2} viewBox={`-1 -1 ${W + 2} ${L + 2}`} role="img" aria-label={`${b.name}, traced from your photo, ${lengthLabel(b.length)} by ${b.width} inches`}>
      <defs><clipPath id={`rk-${id}`}><path d={d} /></clipPath></defs>
      {outline.tex
        ? <g clipPath={`url(#rk-${id})`}><g transform={`translate(${cx},0) rotate(90)`}><image href={outline.tex} x={0} y={-W / 2} width={L} height={W} preserveAspectRatio="none" /></g></g>
        : <path d={d} fill={look.deck} fillOpacity={0.92} />}
      <path d={d} fill="none" stroke="var(--board-line)" />
    </svg>
  );
}

/** AI board illustrations by board type (lead, T-032 addition). 'Other' has none and keeps the drawn outline. */
const ILLUSTRATION: Partial<Record<BoardType, [file: string, word: string]>> = {
  'Performance shortboard': ['shortboard', 'shortboard'], 'Everyday shortboard': ['shortboard', 'shortboard'], Groveler: ['shortboard', 'shortboard'],
  Fish: ['fish', 'fish'], Hybrid: ['midlength', 'midlength'], Midlength: ['midlength', 'midlength'], Funboard: ['midlength', 'midlength'],
  Longboard: ['longboard', 'longboard'], 'Step-up': ['stepup', 'step-up'], Gun: ['stepup', 'step-up'], 'Soft-top': ['softtop', 'soft-top'],
};
/** The illustration used for this board, or null when its own traced/scanned outline exists (the person's shape wins) or the type has none. */
export function illustrationFor(b: Surfboard, outline: Outline | null) {
  const hit = outline ? undefined : ILLUSTRATION[b.type];
  return hit ? {src: `/media/ai/ai-board-${hit[0]}`, caption: `Illustration of a ${hit[1]} · AI-generated, not your board`} : null;
}

/** T-053 cutout. The illustrations are JPEGs on a white seamless with a soft grey vignette and floor shadow, which showed as a box.
 *  In a canvas: (1) levels: the white point is taken from the image border (the seamless), and every pixel is stretched so the whole
 *  background becomes pure white; (2) white-to-alpha: pure white becomes transparent and every other colour keeps its exact tone over white,
 *  so rails, stringers and shading stay (a white board stays white over a light wall, as on the seamless); (3) crop: top/bottom where the board is
 *  clearly opaque, so the picture's height is the board's length and its bottom is the tail. Cached per file. If anything fails the caller
 *  keeps the masked JPEG with no drop shadow (never a box). */
type Cut = {url: string; w: number; h: number};
const cuts = new Map<string, Promise<Cut | null>>();
export function cutout(src: string): Promise<Cut | null> {
  let p = cuts.get(src);
  if (!p) {
    p = new Promise<Cut | null>((resolve) => {
      const img = new Image(); img.decoding = 'async';
      img.onload = () => {
        try {
          const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
          const g = c.getContext('2d', {willReadFrequently: true}); if (!g) return resolve(null);
          g.drawImage(img, 0, 0); const im = g.getImageData(0, 0, W, H), d = im.data;
          // White point that follows the vignette: fit background ≈ a + b·r² (r = normalised distance from the centre) to the border frame,
          // so each pixel is compared with its own local seamless brightness (one global white point erased white boards).
          const bw = Math.max(4, Math.round(W * 0.05)), bh = Math.max(4, Math.round(H * 0.04)), cx = W / 2, cy = H / 2;
          let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
          for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (x < bw || x >= W - bw || y < bh || y >= H - bh) {
            const i = (y * W + x) * 4, l = Math.min(d[i], d[i + 1], d[i + 2]), r2 = ((x - cx) / cx) ** 2 + ((y - cy) / cy) ** 2;
            n++; sx += r2; sy += l; sxx += r2 * r2; sxy += r2 * l;
          }
          const slope = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
          const wpAt = (x: number, y: number) => Math.min(255, Math.max(170, icpt + slope * (((x - cx) / cx) ** 2 + ((y - cy) / cy) ** 2) - 3));
          let top = H, bot = -1, left = W, right = -1;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4, k = 255 / wpAt(x, y), r = Math.min(255, d[i] * k), gg = Math.min(255, d[i + 1] * k), bb = Math.min(255, d[i + 2] * k);
            const a = Math.max(255 - r, 255 - gg, 255 - bb) / 255;
            // Noise floor: JPEG noise and the last of the vignette (alpha < 0.08) become fully transparent, the rest is rescaled; otherwise the
            // faint residue reads as a pale box once the crop is widened for pale rails.
            const a2 = Math.max(0, (a - 0.08) / 0.92);
            if (a2 <= 0.004) { d[i + 3] = 0; continue; }
            d[i] = 255 - (255 - r) / a; d[i + 1] = 255 - (255 - gg) / a; d[i + 2] = 255 - (255 - bb) / a; d[i + 3] = Math.round(a2 * 255);
            // Length (top/bottom) from clearly opaque pixels; width (left/right) from faint ones too, so a pale rail isn't cropped off.
            if (a > 0.3) { if (y < top) top = y; if (y > bot) bot = y; }
            if (a2 > 0.03) { if (x < left) left = x; if (x > right) right = x; }
          }
          if (bot < 0 || bot - top < H * 0.3) return resolve(null);
          g.putImageData(im, 0, 0);
          const cw = right - left + 1, ch = bot - top + 1, o = document.createElement('canvas'); o.width = cw; o.height = ch;
          o.getContext('2d')!.drawImage(c, left, top, cw, ch, 0, 0, cw, ch);
          resolve({url: o.toDataURL('image/png'), w: cw, h: ch});
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    cuts.set(src, p);
  }
  return p;
}

/** The one slot that draws a board picture (rack, annotated stage, phone strip). The person's traced outline or scanned photo first; otherwise
 *  an AI illustration of the board's type, cut out of its white seamless and scaled so its height is the board's real length, labelled as not
 *  their board; otherwise the category outline. `drawn` forces the outline (dark theme stage). */
export function BoardPicture({b, px, outline, drawn}: {b: Surfboard; px: number; outline: Outline | null; drawn?: boolean}) {
  const ill = drawn ? null : illustrationFor(b, outline);
  const src = ill ? `${ill.src}-${px * b.length * (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) > 700 ? 1400 : 700}.jpg` : null;
  const [cut, setCut] = useState<Cut | null | 'pending'>('pending');
  useEffect(() => { if (!src) return; let on = true; setCut('pending'); cutout(src).then((c) => on && setCut(c)); return () => { on = false; }; }, [src]);
  if (!ill || !src) return <Upright b={b} px={px} outline={outline} />;
  const h = Math.round(b.length * px);
  if (cut === 'pending') return <span className="bp-ill bp-wait" style={{height: h, width: Math.round(h * 0.18)}} aria-label={`${b.name}: ${ill.caption}`} role="img" />;
  if (cut) return <img className="bp-ill bp-cut" src={cut.url} height={h} width={Math.round((h * cut.w) / cut.h)} alt={`${b.name}: ${ill.caption}`} title={ill.caption} decoding="async" />;
  // Fallback: the JPEG with the soft mask, blended by multiply on its container (no drop shadow, so no box). It has ~5% white above and below.
  return <img className="bp-ill" src={`${ill.src}-700.jpg`} srcSet={`${ill.src}-700.jpg 1x, ${ill.src}-1400.jpg 2x`} height={h} alt={`${b.name}: ${ill.caption}`} title={ill.caption} decoding="async" />;
}

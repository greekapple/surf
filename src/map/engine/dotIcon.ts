// map-dots → map-clusters: one dot's picture, drawn on a canvas at 2x (engine-neutral; MapLibre registers it as a style image). The look follows the kind of number
// (spec docs/specs/2026-11-12-map-dots.md, -forecast-order-and-map-clusters.md B):
// - est: a pill filled with the rating colour, the surf range in the person's unit ('3–4 ft'); an unrated estimate is an outline pill;
// - nws: a dashed-outline pill with the NWS range (theirs, not ours);
// - off: a hollow pill reading 'off' (offshore height only: never a size);
// - snap: a striped pill, no number (the daily forecast, not live);
// - none: a small grey ring (not loaded, or nothing this hour).
// A tick on the rim points where the swell comes from. Faded = a saved or stale copy. The selected spot is bigger and ringed.
// A cluster is a circle with the NUMBER OF SPOTS inside and a ring split by the share of its spots at each rating (good, fair, poor, none).
import type {DotIcon} from './types.ts';

export const DOT_PR = 2;
/** the image's side in CSS px for the round dot: the dot plus room for the selection ring and the swell tick */
export const dotBox = (i: DotIcon) => i.size + 14;
export const dotKey = (i: DotIcon) => `swd|${i.kind}|${i.num ?? ''}|${i.pill ?? ''}|${i.fill}|${i.ink}|${i.surface}|${i.text}|${i.dir === null ? '' : Math.round(i.dir / 15) % 24}|${i.size}|${i.sel ? 1 : 0}|${i.faded ? 1 : 0}|${i.unrated ? 1 : 0}|${i.group ? 1 : 0}`;
const FONT = 'Archivo, "Helvetica Neue", Arial, sans-serif';

let shared: HTMLCanvasElement | null = null;
/** one CPU-backed canvas for every icon (B8: a fresh GPU canvas per icon made each getImageData a GPU read-back stall) */
function canvas(w: number, h: number): CanvasRenderingContext2D | null {
  const cv = (shared ??= document.createElement('canvas')), pw = Math.ceil(w * DOT_PR), ph = Math.ceil(h * DOT_PR);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const g = cv.getContext('2d', {willReadFrequently: true}); if (!g) return null;
  g.setTransform(DOT_PR, 0, 0, DOT_PR, 0, 0); g.clearRect(0, 0, w, h); g.setLineDash([]); g.globalAlpha = 1;
  return g;
}
const tabular = (g: CanvasRenderingContext2D) => { try { (g as unknown as {fontVariantNumeric?: string}).fontVariantNumeric = 'tabular-nums'; } catch { /* older canvas */ } };
/** The swell tick from a point on the shape's edge (cx, cy, the edge distance along the bearing) outward, with a surface halo so it reads on any sea colour. */
function tick(g: CanvasRenderingContext2D, i: DotIcon, cx: number, cy: number, edge: (sx: number, sy: number) => number) {
  if (i.dir === null || i.kind === 'none') return;
  const a = (i.dir * Math.PI) / 180, sx = Math.sin(a), sy = -Math.cos(a), r0 = edge(sx, sy) + (i.sel ? 3.5 : 0.5), r1 = r0 + 5;
  g.lineCap = 'round';
  g.strokeStyle = i.surface; g.lineWidth = 4.5; g.beginPath(); g.moveTo(cx + sx * r0, cy + sy * r0); g.lineTo(cx + sx * r1, cy + sy * r1); g.stroke();
  g.strokeStyle = i.text; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx + sx * r0, cy + sy * r0); g.lineTo(cx + sx * r1, cy + sy * r1); g.stroke();
}

/** The pill (est, nws, off, snap): a rounded bar sized to its text, with room around it for the selection ring and the swell tick. */
function drawPill(i: DotIcon): ImageData | null {
  const sel = i.sel, fs = sel ? 13 : 11.5, h = sel ? 24 : 20, text = i.kind === 'off' ? 'off' : i.kind === 'snap' ? '' : i.pill ?? '';
  const g0 = canvas(8, 8); if (!g0) return null; g0.font = `700 ${fs}px ${FONT}`; tabular(g0);
  const tw = text ? Math.ceil(g0.measureText(text).width) : 14, w = Math.max(h, tw + (sel ? 18 : 14)), M = 10, W = w + 2 * M, H = h + 2 * M;
  const g = canvas(W, H); if (!g) return null;
  g.font = `700 ${fs}px ${FONT}`; tabular(g);
  const x0 = M, y0 = M, r = h / 2, cx = W / 2, cy = H / 2;
  const shape = (pad: number) => { g.beginPath(); g.roundRect(x0 - pad, y0 - pad, w + 2 * pad, h + 2 * pad, r + pad); };
  g.globalAlpha = i.faded ? 0.55 : 1;
  tick(g, i, cx, cy, (sx, sy) => Math.min(Math.abs(sx) > 1e-6 ? (w / 2) / Math.abs(sx) : Infinity, Math.abs(sy) > 1e-6 ? (h / 2) / Math.abs(sy) : Infinity));
  if (sel) { shape(3); g.fillStyle = i.surface; g.fill(); shape(2.2); g.lineWidth = 1.8; g.strokeStyle = i.text; g.stroke(); }
  let ink = i.text;
  if (i.kind === 'est' && !i.unrated) { shape(0); g.fillStyle = i.fill; g.fill(); g.lineWidth = 1.5; g.strokeStyle = i.surface; g.stroke(); ink = i.ink; }
  else if (i.kind === 'est') { shape(-0.5); g.fillStyle = i.surface; g.fill(); g.lineWidth = 2; g.strokeStyle = i.text; g.stroke(); }
  else if (i.kind === 'nws') { shape(-0.5); g.fillStyle = i.surface; g.fill(); shape(-1.2); g.setLineDash([3, 2.2]); g.lineWidth = 2.2; g.strokeStyle = i.fill; g.stroke(); g.setLineDash([]); }
  else if (i.kind === 'off') { shape(-1); g.lineWidth = 4.6; g.strokeStyle = i.surface; g.stroke(); shape(-1); g.lineWidth = 2.4; g.strokeStyle = i.fill; g.stroke(); g.fillStyle = 'rgba(0,0,0,0)'; }
  else if (i.kind === 'snap') { shape(0); g.fillStyle = i.surface; g.fill(); g.save(); shape(-1); g.clip(); g.strokeStyle = i.fill; g.lineWidth = 2.2; for (let k = -h; k < w + h; k += 5) { g.beginPath(); g.moveTo(x0 + k - h, y0 + h); g.lineTo(x0 + k, y0); g.stroke(); } g.restore(); shape(-0.8); g.lineWidth = 1.6; g.strokeStyle = i.fill; g.stroke(); }
  if (text) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (i.kind === 'off') { g.lineWidth = 3; g.strokeStyle = i.surface; g.lineJoin = 'round'; g.strokeText(text, cx, cy + 0.5); }
    g.fillStyle = ink; g.fillText(text, cx, cy + 0.5);
  }
  return g.getImageData(0, 0, Math.ceil(W * DOT_PR), Math.ceil(H * DOT_PR));
}

/** The round dot: the not-loaded ring, and the fallback for an estimate without a pill text. */
export function drawDot(i: DotIcon): ImageData | null {
  if ((i.kind === 'est' || i.kind === 'nws') && i.pill) return drawPill(i);
  if (i.kind === 'off' || i.kind === 'snap') return drawPill(i);
  const W = dotBox(i), g = canvas(W, W); if (!g) return null;
  const c = W / 2, r = i.size / 2;
  g.globalAlpha = i.faded ? 0.55 : 1;
  tick(g, i, c, c, () => r);
  const circle = (rad: number) => { g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); };
  if (i.sel) { circle(r + 3); g.fillStyle = i.surface; g.fill(); circle(r + 2.2); g.lineWidth = 1.8; g.strokeStyle = i.text; g.stroke(); }
  if (i.kind === 'est' && i.unrated) { circle(r - 0.5); g.fillStyle = i.surface; g.fill(); g.lineWidth = 2; g.strokeStyle = i.text; g.stroke(); }
  else if (i.kind === 'est') { circle(r); g.fillStyle = i.fill; g.fill(); g.lineWidth = 1.5; g.strokeStyle = i.surface; g.stroke(); }
  else if (i.kind === 'nws') { circle(r - 0.5); g.fillStyle = i.surface; g.fill(); circle(r - 1.2); g.setLineDash([2.6, 2]); g.lineWidth = 2.2; g.strokeStyle = i.fill; g.stroke(); g.setLineDash([]); }
  else { circle(r - 1); g.fillStyle = i.surface; g.globalAlpha *= 0.85; g.fill(); g.globalAlpha = i.faded ? 0.55 : 1; g.lineWidth = 2; g.strokeStyle = i.fill; g.stroke(); }
  if (i.num && (i.kind === 'est' || i.kind === 'nws')) {
    const long = i.num.length >= 3, fs = Math.round(i.size * (long ? 0.44 : 0.54));
    g.font = `${long ? 650 : 700} ${fs}px ${FONT}`; tabular(g);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = i.kind === 'est' && !i.unrated ? i.ink : i.text;
    g.fillText(i.num, c, c + fs * 0.06);
  }
  return g.getImageData(0, 0, Math.ceil(W * DOT_PR), Math.ceil(W * DOT_PR));
}

/** A cluster's ring: the share of its spots at each rating, in a fixed order (good, fair, poor, none), as [band, from, to] fractions of the circle (0 = top,
 *  clockwise). Shares are exactly count / total; bands with no spots get no segment. */
export type RingBand = 'good' | 'fair' | 'poor' | 'none';
export function ringSegments(c: Record<RingBand, number>): [RingBand, number, number][] {
  const order: RingBand[] = ['good', 'fair', 'poor', 'none'], total = order.reduce((n, b) => n + Math.max(0, c[b] || 0), 0); if (!total) return [];
  let at = 0; const out: [RingBand, number, number][] = [];
  for (const b of order) { const n = Math.max(0, c[b] || 0); if (!n) continue; out.push([b, at, at + n / total]); at += n / total; }
  return out;
}
/** The cluster image's name: the four counts and the theme's colours (a new theme draws new images). */
export const clusterKey = (c: Record<RingBand, number>, colours: Record<RingBand | 'surface' | 'text', string>) => `swc|${c.good}|${c.fair}|${c.poor}|${c.none}|${Object.values(colours).join('|')}`;
/** Parses a cluster image name back into its counts (for MapLibre's styleimagemissing). */
export function parseClusterKey(key: string): Record<RingBand, number> | null {
  const m = /^swc\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|/.exec(key); return m ? {good: +m[1], fair: +m[2], poor: +m[3], none: +m[4]} : null;
}
/** The cluster: a circle sized by its count, the number of spots in the middle, and the proportional ring. */
export function drawCluster(c: Record<RingBand, number>, colours: Record<RingBand | 'surface' | 'text', string>): ImageData | null {
  const n = c.good + c.fair + c.poor + c.none, d = n < 10 ? 30 : n < 50 ? 34 : n < 200 ? 40 : 46, W = d + 4, g = canvas(W, W); if (!g) return null;
  const cx = W / 2, r = d / 2, ring = 4.5;
  g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.fillStyle = colours.surface; g.fill();
  for (const [b, from, to] of ringSegments(c)) {
    // (review) 'none' (no live rating: not loaded, or a daily forecast) is a thin hairline, so it can never be read as a grey 'poor' arc
    g.beginPath(); g.arc(cx, cx, b === 'none' ? r - 1 : r - ring / 2, -Math.PI / 2 + from * 2 * Math.PI, -Math.PI / 2 + to * 2 * Math.PI); g.lineWidth = b === 'none' ? 1.2 : ring; g.lineCap = 'butt'; g.strokeStyle = colours[b]; g.stroke();
  }
  const txt = String(n), fs = n < 100 ? 13 : 12;
  g.font = `700 ${fs}px ${FONT}`; tabular(g); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = colours.text; g.fillText(txt, cx, cx + 0.5);
  return g.getImageData(0, 0, Math.ceil(W * DOT_PR), Math.ceil(W * DOT_PR));
}

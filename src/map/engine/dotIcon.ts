// map-dots: one dot's picture, drawn on a canvas at 2x (engine-neutral; MapLibre registers it as a style image). The look follows the kind of number
// (spec docs/specs/2026-11-12-map-dots.md): solid + number = our estimate; dashed ring + number = NWS; hollow ring = offshore only; striped = daily forecast;
// small grey ring = not loaded. A tick on the rim points where the swell comes from. Faded = a saved or stale copy.
import type {DotIcon} from './types.ts';

export const DOT_PR = 2;
/** the image's side in CSS px: the dot plus room for the selection ring and the swell tick */
export const dotBox = (i: DotIcon) => i.size + 14;
export const dotKey = (i: DotIcon) => `swd|${i.kind}|${i.num ?? ''}|${i.fill}|${i.ink}|${i.surface}|${i.text}|${i.dir === null ? '' : Math.round(i.dir / 15) % 24}|${i.size}|${i.sel ? 1 : 0}|${i.faded ? 1 : 0}|${i.unrated ? 1 : 0}|${i.group ? 1 : 0}`;

let shared: HTMLCanvasElement | null = null;
export function drawDot(i: DotIcon): ImageData | null {
  // one CPU-backed canvas for every icon (B8: a fresh GPU canvas per icon made each getImageData a GPU read-back stall, ~10 s over a 16-step scrub)
  const W = dotBox(i), px = W * DOT_PR, cv = (shared ??= document.createElement('canvas'));
  if (cv.width !== px || cv.height !== px) { cv.width = px; cv.height = px; }
  const g = cv.getContext('2d', {willReadFrequently: true}); if (!g) return null;
  g.setTransform(DOT_PR, 0, 0, DOT_PR, 0, 0); g.clearRect(0, 0, W, W); g.setLineDash([]); g.globalAlpha = 1;
  const c = W / 2, r = i.size / 2;
  g.globalAlpha = i.faded ? 0.55 : 1;
  // the swell tick: outside the rim at the bearing the swell comes from (0 = north = up), with a surface halo so it reads on any sea colour
  if (i.dir !== null && i.kind !== 'none') {
    const a = (i.dir * Math.PI) / 180, sx = Math.sin(a), sy = -Math.cos(a), r0 = r + (i.sel ? 3.5 : 0.5), r1 = r0 + 5;
    g.lineCap = 'round';
    g.strokeStyle = i.surface; g.lineWidth = 4.5; g.beginPath(); g.moveTo(c + sx * r0, c + sy * r0); g.lineTo(c + sx * r1, c + sy * r1); g.stroke();
    g.strokeStyle = i.text; g.lineWidth = 2.2; g.beginPath(); g.moveTo(c + sx * r0, c + sy * r0); g.lineTo(c + sx * r1, c + sy * r1); g.stroke();
  }
  const circle = (rad: number) => { g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); };
  // a group's dot is a small stack: a second rim behind it, up and to the right (one dot stands for a stretch of coast)
  if (i.group && i.kind !== 'none') { g.beginPath(); g.arc(c + 3, c - 3, r, 0, Math.PI * 2); g.fillStyle = i.surface; g.fill(); g.lineWidth = 1.6; g.strokeStyle = i.kind === 'est' && !i.unrated ? i.fill : i.text; g.globalAlpha *= 0.8; g.stroke(); g.globalAlpha = i.faded ? 0.55 : 1; }
  if (i.sel) { circle(r + 3); g.fillStyle = i.surface; g.fill(); circle(r + 2.2); g.lineWidth = 1.8; g.strokeStyle = i.text; g.stroke(); }
  if (i.kind === 'est' && i.unrated) {
    circle(r - 0.5); g.fillStyle = i.surface; g.fill(); g.lineWidth = 2; g.strokeStyle = i.text; g.stroke();
  } else if (i.kind === 'est') {
    circle(r); g.fillStyle = i.fill; g.fill(); g.lineWidth = 1.5; g.strokeStyle = i.surface; g.stroke();
  } else if (i.kind === 'nws') {
    circle(r - 0.5); g.fillStyle = i.surface; g.fill();
    circle(r - 1.2); g.setLineDash([2.6, 2]); g.lineWidth = 2.2; g.strokeStyle = i.fill; g.stroke(); g.setLineDash([]);
  } else if (i.kind === 'off') {
    circle(r - 1); g.lineWidth = 4.6; g.strokeStyle = i.surface; g.stroke();
    circle(r - 1); g.lineWidth = 2.6; g.strokeStyle = i.fill; g.stroke();
  } else if (i.kind === 'snap') {
    circle(r); g.fillStyle = i.surface; g.fill();
    g.save(); circle(r - 1); g.clip(); g.strokeStyle = i.fill; g.lineWidth = 2.2; for (let k = -i.size; k < i.size; k += 5) { g.beginPath(); g.moveTo(c + k - r, c + r); g.lineTo(c + k + r, c - r); g.stroke(); } g.restore();
    circle(r - 0.8); g.lineWidth = 1.6; g.strokeStyle = i.fill; g.stroke();
  } else {
    circle(r - 1); g.fillStyle = i.surface; g.globalAlpha *= 0.85; g.fill(); g.globalAlpha = i.faded ? 0.55 : 1; g.lineWidth = 2; g.strokeStyle = i.fill; g.stroke();
  }
  if (i.num && (i.kind === 'est' || i.kind === 'nws')) {
    const long = i.num.length >= 3, fs = Math.round(i.size * (long ? 0.44 : 0.54));
    g.font = `${long ? 650 : 700} ${fs}px Archivo, "Helvetica Neue", Arial, sans-serif`;
    try { (g as unknown as {fontVariantNumeric?: string}).fontVariantNumeric = 'tabular-nums'; (g as unknown as {letterSpacing?: string}).letterSpacing = long ? '-0.4px' : '0px'; } catch { /* older canvas */ }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = i.kind === 'est' && !i.unrated ? i.ink : i.text;
    g.fillText(i.num, c, c + fs * 0.06);
  }
  return g.getImageData(0, 0, px, px);
}

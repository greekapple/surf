import type {DayBand, ShareCard} from '../services/shareCard';

/** The share card as a 1080×1080 PNG, drawn on a canvas in the browser (no dependency, no server: the production site is behind Cloudflare Access, so chat apps cannot fetch a link preview;
 *  the image travels with the message instead). Same content as the text (services/shareCard.ts): nothing is drawn that the card does not carry. Always the LIGHT theme.
 *  Nothing is cut short: a value's number is on its row and its tags wrap on a smaller line under it; long lines shrink, then wrap. */
export const SHARE_IMAGE_SIZE = 1080;
/** Light-theme tokens (src/ui/tokens.css :root; a test keeps them equal). */
export const SHARE_INK = {bg: '#f5f8f7', s1: '#ffffff', line: '#e4e8e7', text: '#1d1d1f', muted: '#5e5e63', hsHi: '#0a6cc2', good: '#248a3d', goodInk: '#1d7334', fair: '#b8860b', fairInk: '#7d5f00', poor: '#8e8e93', none: '#d1d1d6'} as const;
const SQUARE: Record<DayBand, string> = {good: SHARE_INK.good, fair: SHARE_INK.fair, poor: SHARE_INK.poor, none: SHARE_INK.none};
const WORD: Record<DayBand, string> = {good: SHARE_INK.goodInk, fair: SHARE_INK.fairInk, poor: SHARE_INK.muted, none: SHARE_INK.muted};
/** The key, in the rating scale's own words (ratings/engine.ts bands; FLAT is in the poor band). */
export const KEY_WORDS: Record<DayBand | 'far', string> = {good: 'Solid or better', fair: 'Not bad / Surfable', poor: 'Weak / Poor / Flat', none: 'No rating', far: 'Too far out'};
const DISPLAY = "'Instrument Sans', 'Inter', -apple-system, system-ui, sans-serif", SANS = "'Inter', -apple-system, system-ui, sans-serif";
/** The wordmark's curl (app/Nav.tsx .wm-mark), 24-unit viewBox. */
const MARK = ['M2 17c3.5 0 5-2.2 6.4-5.4C10 8 12 5 16 5c3 0 5 2 5 4.6 0 2-1.5 3.4-3.3 3.4-1.5 0-2.6-1-2.6-2.4 0-1 .6-1.8 1.5-2.1', 'M2 20.5c2.2 0 3.6-.8 5-.8s2.8.8 5 .8 3.6-.8 5-.8 2.8.8 5 .8'];

const ratingBand = (c: ShareCard): DayBand => {
  const w = (c.rating ?? '').split(' (')[0].toUpperCase();
  return ['EPIC', 'FIRING', 'GOOD', 'SOLID'].includes(w) ? 'good' : ['NOT BAD', 'SURFABLE'].includes(w) ? 'fair' : w ? 'poor' : 'none';
};
/** Shrink to fit one line down to `min` px; below that, wrap at spaces (never cut). Returns the lines and the size used. */
function layout(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, px: number, min: number, width: number): {lines: string[]; px: number} {
  for (let s = px; s >= min; s -= 2) { ctx.font = font(s); if (ctx.measureText(text).width <= width) return {lines: [text], px: s}; }
  ctx.font = font(min); const lines: string[] = []; let cur = '';
  for (const word of text.split(' ')) { const next = cur ? `${cur} ${word}` : word; if (cur && ctx.measureText(next).width > width) { lines.push(cur); cur = word; } else cur = next; }
  if (cur) lines.push(cur);
  return {lines, px: min};
}
function draw(ctx: CanvasRenderingContext2D, l: {lines: string[]; px: number}, font: (px: number) => string, x: number, y: number, lh = 1.22): number {
  ctx.font = font(l.px); l.lines.forEach((t, i) => ctx.fillText(t, x, y + i * l.px * lh)); return y + (l.lines.length - 1) * l.px * lh;
}

export async function loadShareFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(['650 96px "Instrument Sans"', '600 44px "Instrument Sans"', '400 36px "Inter"', '600 44px "Inter"'].map((f) => document.fonts.load(f).catch(() => [])));
}

export function drawShareCard(canvas: HTMLCanvasElement, c: ShareCard): void {
  const S = SHARE_IMAGE_SIZE, M = 64, W = S - 2 * M; canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = SHARE_INK.bg; ctx.fillRect(0, 0, S, S);
  ctx.textBaseline = 'alphabetic';
  const sans = (w: number) => (px: number) => `${w} ${px}px ${SANS}`, display = (px: number) => `650 ${px}px ${DISPLAY}`;
  // header: the wordmark (curl + "Swello") and when it was shared
  ctx.save(); ctx.translate(M, M - 10); ctx.scale(2, 2); ctx.strokeStyle = SHARE_INK.hsHi; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const d of MARK) ctx.stroke(new Path2D(d)); ctx.restore();
  ctx.fillStyle = SHARE_INK.text; ctx.font = `600 42px ${DISPLAY}`; ctx.fillText('Swello', M + 58, M + 30);
  ctx.fillStyle = SHARE_INK.muted; ctx.font = `400 24px ${SANS}`; ctx.textAlign = 'right'; ctx.fillText(`Shared ${c.generated}`, S - M, M + 27); ctx.textAlign = 'left';

  // spot, when (and the no-window reason), the hour the numbers are for, and the rating word in the app's band colour
  let y = M + 128;
  ctx.fillStyle = SHARE_INK.text; y = draw(ctx, layout(ctx, c.spot, display, 76, 48, W), display, M, y, 1.08);
  y += 50; ctx.fillStyle = SHARE_INK.muted;
  y = draw(ctx, layout(ctx, c.when, sans(400), 32, 26, W), sans(400), M, y);
  if (c.noWindowText) { y += 40; ctx.fillStyle = SHARE_INK.text; y = draw(ctx, layout(ctx, c.noWindowText, sans(500), 28, 24, W), sans(500), M, y); }
  y += 92;
  if (c.rating) {
    const word = c.rating.split(' (')[0], rest = c.rating.slice(c.rating.indexOf('(') + 1, -1);
    ctx.fillStyle = WORD[ratingBand(c)]; ctx.font = `650 84px ${DISPLAY}`; ctx.fillText(word, M, y);
    const ww = ctx.measureText(word).width; ctx.fillStyle = SHARE_INK.muted; ctx.font = `400 26px ${SANS}`; ctx.fillText(`${rest} rating · numbers for ${c.numbersFor}`, M + ww + 20, y);
  } else { ctx.fillStyle = SHARE_INK.muted; ctx.font = `400 36px ${SANS}`; ctx.fillText(`No rating · numbers for ${c.numbersFor}`, M, y); }

  // the day row's geometry first (bottom up), so the value rows take exactly the space left above it
  const sq = 80, gap = (W - 7 * sq) / 6, keyY = S - M + 4, dowY = keyY - 44, top = dowY - 34 - sq, labelY = top - 18, rowsEnd = c.days.length ? labelY - 44 : S - M;
  // the values: label, the number on the row, its tags wrapping on a smaller line under it; a value the card does not have is not drawn
  const rows: [string, string, string | null][] = [];
  if (c.surf) rows.push(['Surf', c.surf.main, c.surf.tags.join(' · ') || null]);
  if (c.swell) rows.push(['Swell', c.swell, null]);
  if (c.wind) rows.push(['Wind', c.wind, null]);
  if (c.tide) rows.push(['Tide', c.tide.main, `${c.tide.source}, ${c.tide.datum}`]);
  y += 30; const VX = M + 150, VW = W - 150;
  const slot = (rowsEnd - y) / Math.max(1, rows.length);
  for (const [k, v, tags] of rows) {
    ctx.fillStyle = SHARE_INK.line; ctx.fillRect(M, y, W, 2);
    const vl = layout(ctx, v, sans(600), 36, 26, VW), tl = tags ? layout(ctx, tags, sans(400), 24, 22, VW) : null;
    const h = vl.lines.length * vl.px * 1.2 + (tl ? tl.lines.length * tl.px * 1.25 + 4 : 0), y0 = y + Math.max(8, (Math.min(slot, 120) - h) / 2) + vl.px;
    ctx.fillStyle = SHARE_INK.muted; ctx.font = `400 28px ${SANS}`; ctx.fillText(k, M, y0);
    ctx.fillStyle = SHARE_INK.text; let yy = draw(ctx, vl, sans(600), VX, y0, 1.2);
    if (tl) { ctx.fillStyle = SHARE_INK.muted; draw(ctx, tl, sans(400), VX, yy + tl.px * 1.3, 1.25); }
    y += Math.min(slot, 120);
  }
  ctx.fillStyle = SHARE_INK.line; ctx.fillRect(M, y, W, 2);

  // the day row: a square per day (outlined, uncoloured past the certainty horizon), its weekday under it, and the key in the scale's own words
  if (c.days.length && c.daysLabel) {
    ctx.fillStyle = SHARE_INK.muted;
    const title = layout(ctx, `${c.daysLabel.replace(' (provisional)', ' (provisional, not a go call)')} · ${c.days[0].dow} from ${c.sharedShort}`, sans(400), 26, 20, W); draw(ctx, title, sans(400), M, labelY);
    c.days.forEach((d, i) => {
      const x = M + i * (sq + gap); ctx.beginPath(); ctx.roundRect(x, top, sq, sq, 8);
      if (d.tooFar) { ctx.setLineDash([8, 6]); ctx.strokeStyle = SHARE_INK.poor; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); }
      else { ctx.fillStyle = SQUARE[d.band]; ctx.fill(); }
      ctx.fillStyle = d.tooFar ? SHARE_INK.muted : SHARE_INK.text; ctx.font = `600 26px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(d.dow, x + sq / 2, dowY); ctx.textAlign = 'left';
    });
    const used: (DayBand | 'far')[] = [...(['good', 'fair', 'poor', 'none'] as DayBand[]).filter((b) => c.days.some((d) => !d.tooFar && d.band === b)), ...(c.days.some((d) => d.tooFar) ? ['far' as const] : [])];
    const items = used.map((b) => ({b, t: KEY_WORDS[b]}));
    let kx = M; ctx.font = `400 22px ${SANS}`;
    for (const {b, t} of items) {
      if (b) { ctx.beginPath(); ctx.roundRect(kx, keyY - 18, 20, 20, 4); if (b === 'far') { ctx.setLineDash([4, 3]); ctx.strokeStyle = SHARE_INK.poor; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); } else { ctx.fillStyle = SQUARE[b]; ctx.fill(); } kx += 28; }
      ctx.fillStyle = SHARE_INK.muted; ctx.fillText(t, kx, keyY); kx += ctx.measureText(t).width + 26;
    }
  }
}

/** The PNG as a Blob (null where the browser has no canvas). */
export async function renderShareImage(c: ShareCard): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  await loadShareFonts();
  const canvas = document.createElement('canvas'); drawShareCard(canvas, c);
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
}

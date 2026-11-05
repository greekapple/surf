import {useId} from 'react';
import type {Surfboard} from '../../models/index';
import {lengthLabel} from '../../utils/units';
import {CARBON_RIM, STRIPE_BANDS, effectiveDeck, resolvedLook, trimFor, type Look} from './looks';
import {wallOutline} from './outline';

/** T-094: the one 2D board renderer (wall, phone strip, board-room rail, Compare, Board Match), drawn to the board's real length and width in the
 *  board's own look (the same `looks` record the 3D showroom uses): deck colour with the resin tint, gloss or matte rail shading, the stringer and
 *  the fin boxes of its fin set.
 *  quiver-look: the planshape is the traced one when there is one (the person's own trace, or an example model's outline traced from the maker's
 *  product photo, src/data/referenceBoards.ts), so every picture of a board shows the same shape at one common scale; otherwise the category
 *  outline. A swallow tail gets its notch. Example models carry their trim (centre line, fin colour) and a 2D version of their deck pattern
 *  (the carbon deck's white rail band, the soft-top's stripes). Never an exact shape. */
// The whole record where there is one: an example model's reference shape, look and trim apply only while it is the published, unedited record
// (referenceFor checks demo and the published numbers).
type BoardLike = Pick<Surfboard, 'length' | 'width' | 'type'> & Partial<Pick<Surfboard, 'id' | 'fins' | 'tail' | 'model' | 'demo' | 'thickness'>>;
const TAIL: Record<string, {w: number; notch: number}> = {pin: {w: 0.22, notch: 0}, 'rounded pin': {w: 0.32, notch: 0}, round: {w: 0.42, notch: 0}, diamond: {w: 0.46, notch: 0},
  squash: {w: 0.5, notch: 0}, square: {w: 0.56, notch: 0}, swallow: {w: 0.66, notch: 0.18}};
const shade = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16), f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k))); return `rgb(${f(n >> 16)} ${f((n >> 8) & 255)} ${f(n & 255)})`; };

/** `decorative`: drawn inside another labelled picture (BoardPicture), so it carries no role or label of its own; `at` offsets it there. */
export function BoardOutline({b, scale = 3.4, look, decorative, at}: {b: BoardLike; scale?: number; look?: Look; decorative?: boolean; at?: number}) {
  const id = useId().replace(/:/g, '');
  // T-098: the record's Fins wins over the saved cosmetic fins (as in the showroom); an explicit draft look still overrides.
  const rec = b.id ? {...b, id: b.id} : null;
  const lk = look ?? (rec ? resolvedLook(rec) : null);
  const deck = lk ? effectiveDeck(lk) : '#e9e5dc'; // the showroom's own colour rule (clear finish = foam, multiplicative tint)
  const L = b.length * scale, W = b.width * scale, t = b.type;
  const typeTail = t === 'Gun' || t === 'Step-up' ? 'pin' : t === 'Fish' ? 'swallow' : t === 'Longboard' || t === 'Soft-top' ? 'round' : 'squash';
  const tk = TAIL[(b.tail ?? '').trim().toLowerCase()] ?? TAIL[typeTail];
  const hw = W / 2, cx = hw, y = (f: number) => f * L;
  const traced = rec ? wallOutline(rec)?.hw ?? null : null;
  const trim = rec ? trimFor(rec) : null;

  // Half-width (px) at a fraction of the length from the nose, scaled so the widest point is the typed width.
  let halfAt: (f: number) => number;
  /** The outline at a fraction r of the half-width (1 = the rail): the deck pattern's bands are drawn with it. */
  let path: (r: number) => string;
  const notchD = tk.notch ? W * tk.notch : 0;
  if (traced) {
    const n = traced.length, mx = Math.max(...traced), k = mx > 0 ? hw / mx : 0;
    halfAt = (f: number) => { const u = Math.min(n - 1, Math.max(0, f * (n - 1))), i = Math.min(n - 2, Math.floor(u)); return (traced[i] + (traced[i + 1] - traced[i]) * (u - i)) * k; };
    path = (r: number) => {
      const pts = traced.map((h, i) => [(i / (n - 1)) * L, h * k * r] as const);
      const right = pts.map(([yy, h]) => `L${(cx + h).toFixed(2)},${yy.toFixed(2)}`).join(' ');
      const left = [...pts].reverse().map(([yy, h]) => `L${(cx - h).toFixed(2)},${yy.toFixed(2)}`).join(' ');
      return `M${cx},0 ${right} ${notchD && r >= 1 ? `L${cx},${(L - notchD).toFixed(2)}` : ''} ${left}Z`;
    };
  } else {
    const nose = t === 'Longboard' || t === 'Funboard' || t === 'Soft-top' ? 0.62 : t === 'Fish' || t === 'Midlength' || t === 'Hybrid' || t === 'Groveler' ? 0.42 : 0.2;
    const wide = t === 'Fish' ? 0.55 : t === 'Gun' ? 0.42 : 0.48, tail = tk.w;
    halfAt = (f: number) => hw * (f < wide ? Math.sin((Math.PI / 2) * Math.min(1, f / wide)) ** 0.6 : 1 - (1 - tail) * ((f - wide) / (1 - wide)) ** 1.6);
    path = (r: number) => {
      const h = hw * r;
      const right = `M${cx},0 C${cx + h * nose},${y(0.02)} ${cx + h},${y(wide - 0.22)} ${cx + h},${y(wide)} C${cx + h},${y(wide + 0.28)} ${cx + h * tail * 1.25},${y(0.93)} ${cx + h * tail},${L}`;
      const notch = notchD && r >= 1 ? `L${cx},${L - notchD}` : '';
      const left = `L${cx - h * tail},${L} C${cx - h * tail * 1.25},${y(0.93)} ${cx - h},${y(wide + 0.28)} ${cx - h},${y(wide)} C${cx - h},${y(wide - 0.22)} ${cx - h * nose},${y(0.02)} ${cx},0Z`;
      return `${right} ${notch} ${left}`;
    };
  }
  const d = path(1);
  const matte = lk?.finish === 'matte';
  // Fin boxes where the fins sit (seen through the deck as faint marks; an example model's fins in their own colour): single centre, twin near
  // the rails, thruster both, quad two pairs.
  const fins = lk?.fins ?? 'thruster', fy = (f: number) => L - y(f), side = (f: number) => halfAt(1 - f) * 0.78;
  const boxes: [number, number, number][] = fins === 'single' ? [[cx, fy(0.1), 0.07]] : fins === 'twin' ? [[cx - side(0.16), fy(0.16), 0.05], [cx + side(0.16), fy(0.16), 0.05]]
    : fins === 'thruster' ? [[cx - side(0.19), fy(0.19), 0.045], [cx + side(0.19), fy(0.19), 0.045], [cx, fy(0.07), 0.045]]
    : fins === 'quad' ? [[cx - side(0.2), fy(0.2), 0.045], [cx + side(0.2), fy(0.2), 0.045], [cx - side(0.11) * 0.72, fy(0.11), 0.04], [cx + side(0.11) * 0.72, fy(0.11), 0.04]] : [];
  const stringer = trim ? trim.stringer : lk ? '#9a7149' : 'var(--board-line)';
  const pattern = lk?.pattern;
  return (
    <svg className="outline-svg board-art" width={W + 2} height={L + 2} viewBox={`-1 -1 ${W + 2} ${L + 2}`} {...(at !== undefined ? {x: at, y: at} : {})}
      {...(decorative ? {'aria-hidden': true} : {role: 'img'})} aria-label={decorative ? undefined : `${b.type}, ${lengthLabel(b.length)} by ${b.width} inches${lk ? `, ${fins === 'none' ? 'no fins' : `${fins} fins`}` : ''}; ${traced ? 'traced outline, approximate' : 'category outline, not an exact shape'}`}>
      <defs>
        <clipPath id={`c${id}`}><path d={d} /></clipPath>
        {/* Rail shading across the width: darker rails, a lit crown; gloss adds a narrow highlight off-centre, matte stays flat. */}
        <linearGradient id={`r${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={shade(deck, 0.72)} /><stop offset="0.16" stopColor={shade(deck, 0.94)} /><stop offset="0.5" stopColor={deck} />
          <stop offset="0.84" stopColor={shade(deck, 0.9)} /><stop offset="1" stopColor={shade(deck, 0.68)} />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={0.22} /><stop offset="0.14" stopColor="#000" stopOpacity={0} /><stop offset="0.86" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.22} />
        </linearGradient>
        <linearGradient id={`h${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" /><stop offset="0.38" stopColor="#fff" stopOpacity={matte ? 0.06 : 0.42} /><stop offset="0.46" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {pattern === 'stripes'
        ? <>{[...STRIPE_BANDS].reverse().map(([r, c], i) => <path key={i} d={path(Math.min(1, r))} fill={c} />)}<path d={d} fill={`url(#s${id})`} /></>
        : pattern === 'carbon'
          ? <><path d={d} fill="#f1efea" /><path d={path(CARBON_RIM)} fill={deck} /><path d={d} fill={`url(#s${id})`} /></>
          : <path d={d} fill={`url(#r${id})`} />}
      <g clipPath={`url(#c${id})`}>
        <rect x={0} y={0} width={W} height={L} fill={`url(#h${id})`} />
        {stringer && <line x1={cx} x2={cx} y1={0} y2={L - notchD} stroke={stringer} strokeWidth={Math.max(0.6, W * 0.012)} strokeOpacity={0.8} />}
        {boxes.map(([x, yy, len], i) => <rect key={i} x={x - Math.max(0.6, W * 0.02)} y={yy - y(len) / 2} width={Math.max(1.2, W * 0.04)} height={y(len)} rx={Math.max(0.6, W * 0.02)}
          fill={trim ? trim.fin : shade(deck, 0.55)} fillOpacity={trim ? 0.7 : 0.35} />)}
      </g>
      <path d={d} fill="none" stroke={shade(pattern === 'stripes' ? '#1d3f8f' : deck, 0.6)} strokeOpacity={0.55} strokeWidth={1} />
    </svg>
  );
}

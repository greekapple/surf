import {useId} from 'react';
import type {Surfboard} from '../../models/index';
import {lengthLabel} from '../../utils/units';
import {effectiveDeck, resolvedLook, type Look} from './looks';

/** T-094: the one 2D board renderer (wall, phone strip, board-room rail, Compare, Board Match). Drawn to the board's real length and width from its
 *  type's category outline and its own tail word, in the board's own look (the same `looks` record the 3D showroom uses): deck colour with the resin
 *  tint, gloss or matte rail shading, the stringer, and the fin boxes of its fin set. A category approximation, never an exact shape (the person's
 *  traced outline replaces it, see BoardPicture). */
type BoardLike = Pick<Surfboard, 'length' | 'width' | 'type'> & Partial<Pick<Surfboard, 'id' | 'fins' | 'tail'>>;
const TAIL: Record<string, {w: number; notch: number}> = {pin: {w: 0.22, notch: 0}, 'rounded pin': {w: 0.32, notch: 0}, round: {w: 0.42, notch: 0}, diamond: {w: 0.46, notch: 0},
  squash: {w: 0.5, notch: 0}, square: {w: 0.56, notch: 0}, swallow: {w: 0.66, notch: 0.18}};
const shade = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16), f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k))); return `rgb(${f(n >> 16)} ${f((n >> 8) & 255)} ${f(n & 255)})`; };

export function BoardOutline({b, scale = 3.4, look}: {b: BoardLike; scale?: number; look?: Look}) {
  const id = useId().replace(/:/g, '');
  // T-098: the record's Fins wins over the saved cosmetic fins (as in the showroom); an explicit draft look still overrides.
  const lk = look ?? (b.id ? resolvedLook({id: b.id, fins: b.fins, type: b.type}) : null);
  const deck = lk ? effectiveDeck(lk) : '#e9e5dc'; // the showroom's own colour rule (clear finish = foam, multiplicative tint)
  const L = b.length * scale, W = b.width * scale, t = b.type;
  const nose = t === 'Longboard' || t === 'Funboard' || t === 'Soft-top' ? 0.62 : t === 'Fish' || t === 'Midlength' || t === 'Hybrid' || t === 'Groveler' ? 0.42 : 0.2;
  const typeTail = t === 'Gun' || t === 'Step-up' ? 'pin' : t === 'Fish' ? 'swallow' : t === 'Longboard' || t === 'Soft-top' ? 'round' : 'squash';
  const tk = TAIL[(b.tail ?? '').trim().toLowerCase()] ?? TAIL[typeTail];
  const wide = t === 'Fish' ? 0.55 : t === 'Gun' ? 0.42 : 0.48;
  const hw = W / 2, cx = hw, y = (f: number) => f * L, tail = tk.w;
  const right = `M${cx},0 C${cx + hw * nose},${y(0.02)} ${cx + hw},${y(wide - 0.22)} ${cx + hw},${y(wide)} C${cx + hw},${y(wide + 0.28)} ${cx + hw * tail * 1.25},${y(0.93)} ${cx + hw * tail},${L}`;
  const notch = tk.notch ? `L${cx},${L - W * tk.notch}` : '';
  const left = `L${cx - hw * tail},${L} C${cx - hw * tail * 1.25},${y(0.93)} ${cx - hw},${y(wide + 0.28)} ${cx - hw},${y(wide)} C${cx - hw},${y(wide - 0.22)} ${cx - hw * nose},${y(0.02)} ${cx},0Z`;
  const d = `${right} ${notch} ${left}`;
  const matte = lk?.finish === 'matte';
  // Fin boxes where the fins sit (seen through the deck as faint marks): single centre, twin near the rails, thruster both.
  const fins = lk?.fins ?? 'thruster', fy = (f: number) => L - y(f), side = hw * (tail + 0.35);
  const boxes: [number, number, number][] = fins === 'single' ? [[cx, fy(0.1), 0.07]] : fins === 'twin' ? [[cx - side * 0.62, fy(0.16), 0.05], [cx + side * 0.62, fy(0.16), 0.05]]
    : fins === 'thruster' ? [[cx - side * 0.6, fy(0.19), 0.045], [cx + side * 0.6, fy(0.19), 0.045], [cx, fy(0.07), 0.045]] : [];
  const stringer = lk ? '#9a7149' : 'var(--board-line)';
  return (
    <svg className="outline-svg board-art" width={W + 2} height={L + 2} viewBox={`-1 -1 ${W + 2} ${L + 2}`} role="img"
      aria-label={`${b.type}, ${lengthLabel(b.length)} by ${b.width} inches${lk ? `, ${fins === 'none' ? 'no fins' : `${fins} fins`}` : ''}; category outline, not an exact shape`}>
      <defs>
        <clipPath id={`c${id}`}><path d={d} /></clipPath>
        {/* Rail shading across the width: darker rails, a lit crown; gloss adds a narrow highlight off-centre, matte stays flat. */}
        <linearGradient id={`r${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={shade(deck, 0.72)} /><stop offset="0.16" stopColor={shade(deck, 0.94)} /><stop offset="0.5" stopColor={deck} />
          <stop offset="0.84" stopColor={shade(deck, 0.9)} /><stop offset="1" stopColor={shade(deck, 0.68)} />
        </linearGradient>
        <linearGradient id={`h${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" /><stop offset="0.38" stopColor="#fff" stopOpacity={matte ? 0.06 : 0.42} /><stop offset="0.46" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#r${id})`} />
      <g clipPath={`url(#c${id})`}>
        <rect x={0} y={0} width={W} height={L} fill={`url(#h${id})`} />
        <line x1={cx} x2={cx} y1={0} y2={L} stroke={stringer} strokeWidth={Math.max(0.6, W * 0.012)} strokeOpacity={0.75} />
        {boxes.map(([x, yy, len], i) => <rect key={i} x={x - Math.max(0.6, W * 0.02)} y={yy - y(len) / 2} width={Math.max(1.2, W * 0.04)} height={y(len)} rx={Math.max(0.6, W * 0.02)} fill={shade(deck, 0.55)} fillOpacity={0.35} />)}
      </g>
      <path d={d} fill="none" stroke={shade(deck, 0.6)} strokeOpacity={0.55} strokeWidth={1} />
    </svg>
  );
}

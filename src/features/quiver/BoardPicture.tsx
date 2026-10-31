import {useId} from 'react';
import type {Surfboard} from '../../models/index';
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

/** The one slot that draws a board picture (rack and annotated stage). Today: the person's traced outline or the category outline.
 *  Later board renders (lead, T-032 follow-up) replace the body here; they must still be the person's own board, never a stand-in. */
export function BoardPicture({b, px, outline}: {b: Surfboard; px: number; outline: Outline | null}) {
  return <Upright b={b} px={px} outline={outline} />;
}

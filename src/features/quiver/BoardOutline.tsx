import type {Surfboard} from '../../models/index';
import {lengthLabel} from '../../utils/units';

/** Category outline drawn to the board's real length and width. Not an exact shape. */
export function BoardOutline({b, scale = 3.4, color = 'var(--board-a)'}: {b: Pick<Surfboard, 'length' | 'width' | 'type'>; scale?: number; color?: string}) {
  const L = b.length * scale, W = b.width * scale, t = b.type;
  const nose = t === 'Longboard' || t === 'Funboard' || t === 'Soft-top' ? 0.62 : t === 'Fish' || t === 'Midlength' || t === 'Hybrid' || t === 'Groveler' ? 0.42 : 0.2;
  const tail = t === 'Gun' || t === 'Step-up' ? 0.22 : t === 'Fish' ? 0.68 : 0.5;
  const wide = t === 'Fish' ? 0.55 : t === 'Gun' ? 0.42 : 0.48;
  const hw = W / 2, cx = hw, y = (f: number) => f * L;
  const right = `M${cx},0 C${cx + hw * nose},${y(0.02)} ${cx + hw},${y(wide - 0.22)} ${cx + hw},${y(wide)} C${cx + hw},${y(wide + 0.28)} ${cx + hw * tail * 1.25},${y(0.93)} ${cx + hw * tail},${L}`;
  const swallow = t === 'Fish' ? `L${cx},${L - W * 0.18}` : '';
  const left = `L${cx - hw * tail},${L} C${cx - hw * tail * 1.25},${y(0.93)} ${cx - hw},${y(wide + 0.28)} ${cx - hw},${y(wide)} C${cx - hw},${y(wide - 0.22)} ${cx - hw * nose},${y(0.02)} ${cx},0Z`;
  return (
    <svg className="outline-svg" width={W + 2} height={L + 2} viewBox={`-1 -1 ${W + 2} ${L + 2}`} role="img" aria-label={`${b.type} outline, ${lengthLabel(b.length)} by ${b.width} inches, category approximation`}>
      <path d={`${right} ${swallow} ${left}`} fill={color} fillOpacity={0.92} stroke="var(--board-line)" />
      <line x1={cx} x2={cx} y1={4} y2={L - 4} stroke="var(--board-line)" strokeOpacity={0.6} />
    </svg>
  );
}

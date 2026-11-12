import {glyphLayout, swellLine, type Glyph} from '../services/waveGlyph';
import {formatHeight} from '../services/heightMath';
import {PersonShape, type Figure} from './PersonShape';
import './waveglyph.css';

/** T-106: the drawn wave (see services/waveGlyph.ts), in the spot page Wave scale card's style (blue outer/inner range, the same person).
 *  Inline SVG, no images. */
export const DRAWN_CAPTION = 'Drawn from the forecast · approximate';
const SIZES = {lg: [300, 150], md: [104, 56], xs: [40, 20]} as const;
const fmt = (ft: number, unit: 'ft' | 'm') => (unit === 'm' ? `${(ft * 0.3048).toFixed(1)} m` : `${Math.round(ft)} ft`);

export function glyphAria(g: Glyph, personIn: number, unit: 'ft' | 'm'): string {
  const r = (ft: number) => (unit === 'm' ? (ft * 0.3048).toFixed(1) : String(Math.round(ft)));
  if (g.kind === 'flat') return `Flat (model estimate): the nearshore model has under half a foot here; still water drawn beside a ${formatHeight(personIn, unit)} person`;
  return g.kind === 'surf'
    ? `Drawn to scale: est. ${r(g.loFt)}–${r(g.hiFt)} ${unit} surf height beside a ${formatHeight(personIn, unit)} person${g.curl ? ', curling (est. plunging)' : ''}`
    : `Offshore swell only, ${fmt(g.ft, unit)} offshore; no surf estimate to draw`;
}

/** The person (ui/PersonShape: the standard figure, or the female one), standing on the waterline at height h. */
function Person({x, w, h, base, figure}: {x: number; w: number; h: number; base: number; figure: Figure}) {
  return <g className="wg-person" transform={`translate(${(x + w / 2 - (15 * h) / 100).toFixed(2)} ${(base - h).toFixed(2)}) scale(${(h / 100).toFixed(4)})`}><PersonShape figure={figure} /></g>;
}

export function WaveGlyph({glyph, size, personIn, unit, decorative = false, className = '', figure = 'standard'}: {glyph: Glyph; size: keyof typeof SIZES; personIn: number; unit: 'ft' | 'm'; decorative?: boolean; className?: string; /** profile-sex: which figure stands beside the wave */ figure?: Figure}) {
  const [W, H] = SIZES[size], label = glyphAria(glyph, personIn, unit);
  const a11y = decorative ? {'aria-hidden': true as const} : {role: 'img', 'aria-label': label};
  if (glyph.kind === 'offshore') return (
    <svg className={`wglyph wglyph-${size} is-off ${className}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} {...a11y}>
      <path className="wg-swell" d={swellLine(W, H)} />
      {size !== 'xs' && <text className="wg-off" x={W / 2} y={H * 0.42} textAnchor="middle">offshore only</text>}
    </svg>
  );
  if (glyph.kind === 'flat') { // T-130: still water at the person's feet, to the same scale as a surf glyph's person (pad 2, 8% headroom)
    const base = H - 2, ph = (H - 4) / 1.08, pw = Math.max(2, ph * 0.3), x = W * 0.62;
    return (
      <svg className={`wglyph wglyph-${size} is-flat ${className}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} {...a11y}>
        <path className="wg-water" d={`M0 ${base} H${W}`} />
        <Person x={x} w={pw} h={ph} base={base} figure={figure} />
        {size !== 'xs' && <text className="wg-off" x={W * 0.3} y={H * 0.62} textAnchor="middle">Flat</text>}
      </svg>
    );
  }
  const L = glyphLayout(glyph, W, H);
  return (
    <svg className={`wglyph wglyph-${size} ${className}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} {...a11y}>
      <path className="wg-hi" d={L.hi} />
      <path className="wg-lo" d={L.lo} />
      <path className="wg-water" d={L.water} />
      <Person x={L.person.x} w={L.person.w} h={L.person.h} base={L.base} figure={figure} />
    </svg>
  );
}

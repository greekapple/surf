import type {CSSProperties} from 'react';
import type {Forecast} from '../../models/index';
import {windInk} from './charts';
import {compass} from './helpers';
import './seastate.css';

/* T-038: the hero backdrop is the forecast itself, not an illustration (user: "it's literally an app to tell you the current conditions").
 * Swell crests run perpendicular to the primary swell direction, spaced by its period and moving the way it travels; a fainter set shows the
 * secondary swell; short streaks show the wind's direction and strength in the wind colour scale. Missing values draw nothing for that layer.
 * Reduced motion: still. It is decoration under the real numbers, so it is hidden from assistive tech; the caption says what it is. */

const W = 1600, H = 1000, CX = W / 2, CY = H / 2;
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const rnd = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function Crests({dir, period, height, faint}: {dir: number; period: number; height: number; faint?: boolean}) {
  const gap = 34 + Math.min(20, period) * 7, n = Math.ceil(2400 / gap) + 2, sec = Math.max(4, Math.min(18, gap / (period * 3.2)));
  const op = Math.min(0.55, 0.16 + Math.min(12, height) * 0.035) * (faint ? 0.5 : 1);
  return (
    <g transform={`rotate(${dir} ${CX} ${CY})`}>
      <g className="ss-move" style={{'--gap': `${gap}px`, '--dur': `${sec}s`} as CSSProperties}>
        {Array.from({length: n}, (_, i) => {
          const y = CY - 1200 + i * gap;
          return <path key={i} d={`M-400 ${y} C 300 ${y - 18}, 900 ${y + 22}, ${W + 400} ${y - 6}`} className={faint ? 'ss-crest faint' : 'ss-crest'} style={{opacity: op}} />;
        })}
      </g>
    </g>
  );
}

function Wind({dir, mph}: {dir: number; mph: number}) {
  const r = rnd(7919), n = Math.round(14 + Math.min(30, mph) * 2.2), len = 26 + Math.min(30, mph) * 2.4, sec = Math.max(1.6, 9 - Math.min(30, mph) * 0.25);
  return (
    <g transform={`rotate(${dir} ${CX} ${CY})`} style={{color: windInk(mph)}}>
      <g className="ss-move wind" style={{'--gap': '420px', '--dur': `${sec}s`} as CSSProperties}>
        {/* One 420 px tile of streaks repeated, so the loop has no visible jump. */}
        {(() => { const tile = Array.from({length: Math.ceil(n / 6)}, () => [-300 + r() * (W + 600), r() * 420] as const); return Array.from({length: 7}, (_, k) => tile.map(([x, y], i) => <line key={`${k}-${i}`} x1={x} y1={CY - 1470 + k * 420 + y} x2={x} y2={CY - 1470 + k * 420 + y + len} className="ss-wind" />)); })()}
      </g>
    </g>
  );
}

/** Swell and wind for one forecast hour, drawn as a backdrop. `caption` decides how much the visible caption says (Home shows no numbers). */
export function SeaState({f, className = '', caption, where}: {f: Forecast; className?: string; caption: 'full' | 'plain'; where?: string}) {
  const p = f.primary && ok(f.primary.direction) && ok(f.primary.period) && ok(f.primary.height) ? f.primary : null;
  const s = f.secondary && ok(f.secondary.direction) && ok(f.secondary.period) && ok(f.secondary.height) ? f.secondary : null;
  const w = ok(f.wind?.direction) && ok(f.wind?.speed) ? f.wind : null;
  const bits = [p ? (caption === 'full' ? `swell from ${compass(p.direction)} at ${Math.round(p.period)} s` : `swell from ${compass(p.direction)}`) : 'no swell data',
    w ? `wind from ${compass(w.direction)}` : 'no wind data'];
  return (
    <figure className={`ss ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {s && <Crests dir={s.direction} period={s.period} height={s.height} faint />}
        {p && <Crests dir={p.direction} period={p.period} height={p.height} />}
        {w && <Wind dir={w.direction} mph={w.speed} />}
      </svg>
      <figcaption className="ss-cap">{where ? `${where}, d` : 'D'}rawn from the forecast: {bits.join(', ')}. North is up.</figcaption>
    </figure>
  );
}

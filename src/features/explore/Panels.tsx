import type {CSSProperties} from 'react';
import {Icon, type IconName} from '../../ui/Icon';
import {Condition} from '../../ui/Condition';
import {SPOT_PHOTOS} from '../../ui/photos';
import {localHour, timeLabelPT} from '../forecast/format';

/** A spot's own photograph, or null. */
export const ownPhoto = (id: string) => (SPOT_PHOTOS[id]?.[0] ? `/photos/${SPOT_PHOTOS[id][0]}-800.jpg` : null);
// Generic coastal frames only (not tied to one named beach); spots without their own photo get one plus initials.
const GENERIC_THUMBS = ['gen-surfer-under-wave', 'surfer-wave-cc0'];
const initials = (name: string) => name.replace(/[()’']/g, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function SpotThumb({id, name}: {id: string; name: string}) {
  const own = ownPhoto(id);
  const src = own ?? `/photos/${GENERIC_THUMBS[hash(id) % GENERIC_THUMBS.length]}-800.jpg`;
  return <span className={`xthumbw${own ? '' : ' generic'}`} aria-hidden="true"><img src={src} alt="" loading="lazy" decoding="async" /></span>;
}

export function SpotRow({id, name, range, unit, category, current, highlighted, onPick, onHover}: {id: string; name: string; range: string; unit: string; category: string | null; current: boolean; highlighted: boolean; onPick: () => void; onHover: (on: boolean) => void}) {
  return (
    <button aria-current={current} data-hl={highlighted || undefined} onClick={onPick}
      onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} onFocus={() => onHover(true)} onBlur={() => onHover(false)}>
      <SpotThumb id={id} name={name} />
      <span className="xr-t"><b>{name}</b><span className="xr-m"><small>{range === '—' ? '—' : `${range} ${unit}`}</small>{category && <Condition category={category} chip />}</span></span>
    </button>
  );
}

export interface LayerRowDef {key: string; label: string; icon: IconName; on: boolean; set: () => void; soon?: boolean}
export function LayerRows({rows}: {rows: LayerRowDef[]}) {
  return (
    <ul className="xlr">
      {rows.map((r) => (
        <li key={r.key}>
          <button role="switch" aria-checked={r.on && !r.soon} disabled={r.soon} onClick={r.set} data-on={r.on && !r.soon}>
            <Icon name={r.icon} size={18} />
            <span>{r.label}</span>
            {r.soon && <em>soon</em>}
            <i className="xsw" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

const fmtDay = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric'});
export const stampLabel = (iso: string) => `${fmtDay.format(new Date(iso))} · ${timeLabelPT(iso).replace(':00', '')}`;

export const STEPS = [{h: 1, label: '1h'}, {h: 3, label: '3h'}, {h: 24, label: '1d'}] as const;
export const HORIZONS = [{d: 1, label: '1 day'}, {d: 3, label: '3 days'}, {d: 7, label: '7 days'}] as const;

export function TimeCard({times, index, stamp, playing, step, horizon, onPlay, onStep, onRange, onHorizon, onScrub, days, valueText}: {
  times: string[]; index: number; stamp: string | null; playing: boolean; step: number; horizon: number;
  onPlay: () => void; onStep: (dir: -1 | 1) => void; onRange: (h: number) => void; onHorizon: (d: number) => void; onScrub: (i: number) => void;
  days: {t: string; i: number; label: string}[]; valueText: string;
}) {
  const n = times.length, pct = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 0);
  const dots = times.map((t, i) => ({t, i, big: localHour(t) === 0})).filter((d) => d.big || localHour(d.t) % 6 === 0);
  return (
    <div className="xtime">
      <div className="xt-top">
        <b className="xt-now">{stamp ?? '—'}</b>
        <div className="xt-step" role="group" aria-label="Step forecast hour">
          <button aria-label={`Back ${step === 24 ? '1 day' : `${step} h`}`} disabled={index <= 0} onClick={() => onStep(-1)}><Icon name="chevron" size={16} style={{transform: 'rotate(90deg)'}} /></button>
          <button aria-label={`Forward ${step === 24 ? '1 day' : `${step} h`}`} disabled={index >= n - 1} onClick={() => onStep(1)}><Icon name="chevron" size={16} style={{transform: 'rotate(-90deg)'}} /></button>
        </div>
        <div className="xt-range" role="group" aria-label="Step size and play speed">
          {STEPS.map((s) => <button key={s.h} aria-pressed={step === s.h} onClick={() => onRange(s.h)}>{s.label}</button>)}
        </div>
        <label className="xt-hor"><span className="sr">Forecast window</span>
          <select value={horizon} onChange={(e) => onHorizon(Number(e.target.value))}>{HORIZONS.map((h) => <option key={h.d} value={h.d}>{h.label}</option>)}</select>
          <Icon name="chevron" size={14} />
        </label>
      </div>
      <div className="xt-bot">
        <button className="xplay" aria-label={playing ? 'Pause' : 'Play forecast'} aria-pressed={playing} onClick={onPlay}><Icon name={playing ? 'pause' : 'play'} size={16} /></button>
        <div className="xtrack">
          <div className="xt-dots" aria-hidden="true">
            {dots.map((d) => <i key={d.t} data-big={d.big || undefined} data-on={d.i <= index || undefined} style={{left: `${pct(d.i)}%`}} />)}
          </div>
          <div className="xt-days" aria-hidden="true">{days.map((d) => <span key={d.t} style={{left: `${pct(d.i)}%`}}>{d.label}</span>)}</div>
          <input type="range" min={0} max={Math.max(0, n - 1)} value={index} aria-label="Forecast hour" aria-valuetext={valueText}
            style={{'--pct': `${pct(index)}%`} as CSSProperties} onChange={(e) => onScrub(Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}

import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {Icon, type IconName} from '../../ui/Icon';
import {Condition} from '../../ui/Condition';
import {BAND_COLOR, bandOf} from '../forecast/model';
import {localHour, timeLabelPT} from '../forecast/format';

/** One compact spot row (T-043: no photos in the map list; rating colour, name, region, offshore range, rating word). */
export function SpotRow({id, name, sub, category, current, highlighted, onPick, onHover}: {id: string; name: string; sub: string; category: string | null; current: boolean; highlighted: boolean; onPick: () => void; onHover: (on: boolean) => void}) {
  return (
    <button id={`xrow-${id}`} aria-current={current} data-hl={highlighted || undefined} onClick={onPick}
      onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} onFocus={() => onHover(true)} onBlur={() => onHover(false)}>
      <i className="xr-dot" style={{'--c': category ? BAND_COLOR[bandOf(category)] : 'var(--none)'} as CSSProperties} aria-hidden="true" />
      <span className="xr-t"><b>{name}</b><small>{sub}</small></span>
      {category && <Condition category={category} chip />}
    </button>
  );
}

/** Closes a popover on Escape or a press outside it; focus returns to the opener on Escape. */
export function useDismiss(open: boolean, close: () => void, box: React.RefObject<HTMLElement | null>, opener?: React.RefObject<HTMLElement | null>) {
  const cb = useRef(close); cb.current = close;
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { cb.current(); opener?.current?.focus(); } };
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !opener?.current?.contains(t)) cb.current(); };
    addEventListener('keydown', key); addEventListener('pointerdown', down, true);
    return () => { removeEventListener('keydown', key); removeEventListener('pointerdown', down, true); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}

export interface FieldChoice {id: string; label: string; icon: IconName}
/** The single layer control (Windy/Apple): a button that opens one popover with the colour field and two overlays. */
export function LayerMenu({fields, field, on, setField, flow, setFlow, arrows, setArrows, onPoint, note}: {
  fields: FieldChoice[]; field: string; on: boolean; setField: (id: string | null) => void; flow: boolean; setFlow: (v: boolean) => void; arrows: boolean; setArrows: (v: boolean) => void; onPoint: () => void; note: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null), box = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), box, btn);
  return (
    <div className="xlm">
      <button ref={btn} className="xfab" aria-label="Map layers" aria-expanded={open} aria-controls="xlm-pop" onClick={() => setOpen(!open)}><Icon name="layers" size={20} /></button>
      {open && (
        <div ref={box} className="xpop xlm-pop" id="xlm-pop" role="dialog" aria-label="Map layers">
          <p className="xpop-t">Colour the sea by</p>
          <div className="xlm-grid" role="radiogroup" aria-label="Colour the sea by">
            {[...fields, {id: '', label: 'None', icon: 'close' as IconName}].map((f) => {
              const sel = f.id ? on && field === f.id : !on;
              return <button key={f.id || 'none'} role="radio" aria-checked={sel} onClick={() => setField(f.id || null)}><Icon name={f.icon} size={18} /><span>{f.label}</span></button>;
            })}
          </div>
          <ul className="xlm-sw">
            <li><button role="switch" aria-checked={flow} onClick={() => setFlow(!flow)}><span>Flow animation</span><i className="xsw" aria-hidden="true" /></button></li>
            <li><button role="switch" aria-checked={arrows} onClick={() => setArrows(!arrows)}><span>Swell direction arrows</span><i className="xsw" aria-hidden="true" /></button></li>
          </ul>
          <button className="xlm-pt" onClick={() => { setOpen(false); onPoint(); }}><Icon name="forecast" size={16} />Model point at map centre</button>
          <p className="xpop-note">{note}</p>
        </div>
      )}
    </div>
  );
}

/** One legend chip with the unit inside it (Windy); a press shows the source and validity. */
export function LegendChip({unit, ramp, lo, hi, label, loading, note}: {unit: string; ramp: string[]; lo: string; hi: string; label: string; loading: boolean; note: ReactNode}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null), box = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), box, btn);
  return (
    <div className="xleg">
      <button ref={btn} className="xchip" aria-expanded={open} aria-label={`${label} legend, ${lo} to ${hi} ${unit}. Show source`} data-loading={loading || undefined} onClick={() => setOpen(!open)}>
        {/offshore/i.test(label) && <span className="xleg-k">{label}</span>}<b>{unit}</b><span className="xleg-lo">{lo}</span><i style={{background: `linear-gradient(90deg, ${ramp.join(',')})`}} /><span>{hi}</span>
      </button>
      {open && <div ref={box} className="xpop xleg-pop" role="status"><p className="xpop-t">{label}</p><p className="xpop-note">{note}</p></div>}
    </div>
  );
}

const fmtDay = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric'});
export const stampLabel = (iso: string) => `${fmtDay.format(new Date(iso))} · ${timeLabelPT(iso).replace(':00', '')}`;

export const STEPS = [{h: 1, label: '1h'}, {h: 3, label: '3h'}, {h: 24, label: '1d'}] as const;
export const HORIZONS = [{d: 1, label: '1 day'}, {d: 3, label: '3 days'}, {d: 7, label: '7 days'}] as const;

interface TimeProps {
  times: string[]; index: number; stamp: string | null; playing: boolean; step: number; horizon: number;
  onPlay: () => void; onStep: (dir: -1 | 1) => void; onRange: (h: number) => void; onHorizon: (d: number) => void; onScrub: (i: number) => void;
  days: {t: string; i: number; label: string}[]; valueText: string;
}

/** The time scrubber (Windy): a thin bar (play, the hour, progress) until touched; opens to the full card, folds back when idle. */
export function TimeBar(props: TimeProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null), idle = useRef(0);
  const {times, index, playing} = props, n = times.length, pct = n > 1 ? (index / (n - 1)) * 100 : 0;
  // Fold back 5 s after the last touch, unless playing or keyboard focus is inside.
  const poke = () => {
    clearTimeout(idle.current);
    idle.current = window.setTimeout(() => { const a = document.activeElement; if (!(box.current?.contains(a) && a?.matches(':focus-visible')) && !playingRef.current) setOpen(false); }, 5000);
  };
  const playingRef = useRef(playing); playingRef.current = playing;
  useEffect(() => { if (open) poke(); return () => clearTimeout(idle.current); }, [open, playing, index]); // eslint-disable-line react-hooks/exhaustive-deps
  useDismiss(open, () => { if (!playingRef.current) setOpen(false); }, box);
  return (
    <div ref={box} className={`xtime${open ? ' open' : ''}`} data-valuetext={props.valueText} onPointerDown={poke} onKeyDown={poke}>
      {open ? <TimeCard {...props} onClose={() => setOpen(false)} /> : (
        <div className="xt-thin">
          <button className="xplay" aria-label={playing ? 'Pause' : 'Play forecast'} aria-pressed={playing} onClick={(e) => { e.stopPropagation(); props.onPlay(); }}><Icon name={playing ? 'pause' : 'play'} size={14} /></button>
          <button className="xt-open" aria-label={`Forecast hour ${props.valueText}. Open time controls`} aria-expanded={false} onClick={() => setOpen(true)}>
            <b><span className="xt-long">{props.stamp ?? '—'}</span><span className="xt-short">{props.valueText || '—'}</span></b><span className="xt-line" aria-hidden="true"><i style={{width: `${pct}%`}} /></span>
          </button>
        </div>
      )}
    </div>
  );
}

function TimeCard({times, index, stamp, playing, step, horizon, onPlay, onStep, onRange, onHorizon, onScrub, days, valueText, onClose}: TimeProps & {onClose: () => void}) {
  const n = times.length, pct = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 0);
  const dots = times.map((t, i) => ({t, i, big: localHour(t) === 0})).filter((d) => d.big || localHour(d.t) % 6 === 0);
  return (
    <div className="xt-card">
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
        <button className="xt-x" aria-label="Fold time controls" onClick={onClose}><Icon name="chevron" size={16} /></button>
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

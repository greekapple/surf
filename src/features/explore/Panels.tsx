import {stampLabel, mapDayKey, mapClock, mapZoneAbbr, mapWeekLong, mapWeekShort, mapWeekdayShort} from './mapTime';
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

export interface FieldChoice {id: string; label: string; short?: string; icon: IconName}
/** T-117 (Windy): the layers down the right edge, each a label and a round thumbnail painted with that layer's own colour scale; the active one is
 *  highlighted. Pressing the active layer turns the sea colour off. "More" holds the overlays, the model point and the source note. Phones show
 *  the same list in a sheet behind one round menu button. */
export interface LayerItem extends FieldChoice {ramp: string[]}
export function LayerList({fields, field, on, setField, flow, setFlow, arrows, setArrows, onPoint, note, phone}: {
  fields: LayerItem[]; field: string; on: boolean; setField: (id: string | null) => void; flow: boolean; setFlow: (v: boolean) => void; arrows: boolean; setArrows: (v: boolean) => void; onPoint: () => void; note: ReactNode; phone: boolean;
}) {
  const [open, setOpen] = useState(false), [menu, setMenu] = useState(false);
  const btn = useRef<HTMLButtonElement>(null), box = useRef<HTMLDivElement>(null), mbtn = useRef<HTMLButtonElement>(null), mbox = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), box, btn);
  useDismiss(menu, () => setMenu(false), mbox, mbtn);
  const list = (
    <div className="xl-list" role="radiogroup" aria-label="Colour the sea by">
      {fields.map((f) => {
        const sel = on && field === f.id;
        return <button key={f.id} type="button" role="radio" aria-checked={sel} aria-label={f.label} title={f.label} onClick={() => { setField(sel ? null : f.id); setMenu(false); }}>
          <span className="xl-t">{f.short ?? f.label}</span><i className="xl-th" style={{background: `conic-gradient(from 200deg, ${f.ramp.join(',')}, ${f.ramp[0]})`}} aria-hidden="true"><Icon name={f.icon} size={15} /></i></button>;
      })}
      <div className="xlm">
        <button ref={btn} type="button" className="xl-more" aria-label="More map options" aria-expanded={open} aria-controls="xlm-pop" onClick={() => setOpen(!open)}><span className="xl-t">More layers…</span><i className="xl-th xl-th-more" aria-hidden="true"><Icon name="layers" size={15} /></i></button>
        {open && (
          <div ref={box} className="xpop xlm-pop" id="xlm-pop" role="dialog" aria-label="More map options">
            <ul className="xlm-sw">
              <li><button role="switch" aria-checked={on} onClick={() => setField(on ? null : field)}><span>Sea colour</span><i className="xsw" aria-hidden="true" /></button></li>
              <li><button role="switch" aria-checked={flow} onClick={() => setFlow(!flow)}><span>Particles animation</span><i className="xsw" aria-hidden="true" /></button></li>
              <li><button role="switch" aria-checked={arrows} onClick={() => setArrows(!arrows)}><span>Swell direction arrows</span><i className="xsw" aria-hidden="true" /></button></li>
            </ul>
            <button className="xlm-pt" onClick={() => { setOpen(false); setMenu(false); onPoint(); }}><Icon name="forecast" size={16} />Point forecast at map centre</button>
            <p className="xpop-note">{note}</p>
          </div>
        )}
      </div>
    </div>
  );
  if (!phone) return <div className="xlayers">{list}</div>;
  return (
    <div className="xlayers phone">
      <button ref={mbtn} type="button" className="xround xl-menu" aria-label="Map layers" aria-expanded={menu} aria-controls="xl-sheet" onClick={() => setMenu(!menu)}><Icon name="menu" size={22} /></button>
      {menu && <div ref={mbox} className="xl-sheet" id="xl-sheet" role="dialog" aria-label="Map layers">{list}</div>}
    </div>
  );
}

/** T-117 (Windy): the legend with the unit inside it; a tap cycles the unit (ft/m for heights, mph/kn/km/h for wind). The honest name stays on it. */
/** The one inner tick phones keep: the one nearest 55% of the bar that stays clear of both ends (a fixed 70% index put "13" against "30+" on the swell scale). */
const midTick = (ticks: {pos: number}[]) => { let best = -1, d = 9; ticks.forEach((t, i) => { const e = Math.abs(t.pos - 0.55); if (i > 0 && i < ticks.length - 1 && t.pos > 0.2 && t.pos < 0.75 && e < d) { d = e; best = i; } }); return best; };

export function LegendChip({unit, ramp, lo, hi, label, loading, onCycle, ticks}: {unit: string; ramp: string[]; lo: string; hi: string; label: string; loading: boolean; onCycle: (() => void) | null; /** Stage 3: tick labels at the scale's breakpoints (evenly spaced along the ramp), from the same config as the painter. */ ticks?: {pos: number; label: string}[]}) {
  return (
    <div className="xleg">
      <button className="xchip" aria-label={`${label} legend, fixed scale ${ticks ? ticks.map((x) => x.label).join(', ') : `${lo} to ${hi}`} ${unit}.${onCycle ? ' Press to change the unit' : ''}`} title={ticks ? `Fixed scale, ${unit}: ${ticks.map((x) => x.label).join(' · ')}` : undefined} data-loading={loading || undefined} onClick={onCycle ?? undefined} disabled={!onCycle}>
        {/offshore/i.test(label) && <><span className="xleg-k">{label}</span><span className="xleg-ks">Offshore Hs · not surf</span></>}{/swell height/i.test(label) && <span className="xleg-ks" title="No swell system there: the model's swell partition is empty and the sea is all wind sea, which can still be large (see the Waves layer). Painted at the calm end of the swell scale.">0 = no swell (wind sea only)<span className="sr">: the sea there is all wind sea, which can still be large; the Waves layer shows its height</span></span>}<b>{unit}</b>{!ticks && <span className="xleg-lo">{lo}</span>}<span className="xleg-bar"><i style={{background: `linear-gradient(90deg, ${ramp.join(',')})`}} />{ticks && <span className="xleg-tk" aria-hidden="true">{ticks.map((x, i) => <em key={x.pos} className={i === 0 || i === ticks.length - 1 || i === midTick(ticks) ? 'maj' : undefined} style={{left: `${x.pos * 100}%`}}>{x.label}</em>)}</span>}</span>{!ticks && <span>{hi}</span>}
      </button>
    </div>
  );
}
/** T-117: the model chip names the field's real source (never a model we don't use); a press shows the full source and validity note. */
export function ModelChip({name, sub, note}: {name: string; sub?: string; note: ReactNode}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null), box = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), box, btn);
  return (
    <div className="xmodel">
      <button ref={btn} className="xchip xmodel-c" aria-expanded={open} aria-label={`Source: ${name}${sub ? `, ${sub.replace(/…$/, '')}` : ''}. Show details`} onClick={() => setOpen(!open)}>{name}{sub && <span className="xmodel-sub"> · {sub}</span>}</button>
      {open && <div ref={box} className="xpop xleg-pop" role="status"><p className="xpop-t">Source</p><p className="xpop-note">{note}</p></div>}
    </div>
  );
}

export {stampLabel};   // the global map's labels: mapTime.ts, one explicit zone
/** T-117 (Windy): the bottom timeline is one full-width day strip: play on the left, each day a segment, the hour in a bubble over the playhead.
 *  Drag or click anywhere on the strip, or use the arrow keys (a native range input underneath carries the value for screen readers). */
export function DayStrip({times, index, playing, onPlay, onScrub, valueText}: {times: string[]; index: number; playing: boolean; onPlay: () => void; onScrub: (i: number) => void; valueText: string}) {
  const n = times.length, pct = n > 1 ? (index / (n - 1)) * 100 : 0;
  const days: {k: string; t: string; from: number; to: number}[] = [];
  times.forEach((t, i) => { const k = mapDayKey(t), d = days[days.length - 1]; if (d && d.k === k) d.to = i; else days.push({k, t, from: i, to: i}); });
  const hour = times[index] ? `${mapClock(times[index]).replace(':00', '')} ${mapZoneAbbr(times[index])}` : '—';
  return (
    <div className="xstrip" data-valuetext={valueText}>
      <button className="xplay xround" aria-label={playing ? 'Pause' : 'Play forecast'} aria-pressed={playing} onClick={onPlay}><Icon name={playing ? 'pause' : 'play'} size={16} /></button>
      <div className="xs-track">
        <div className="xs-days" aria-hidden="true">
          {days.map((d) => <span key={d.k} style={{width: `${((d.to - d.from + 1) / Math.max(1, n)) * 100}%`}} data-on={index >= d.from && index <= d.to || undefined}>
            <b className="xs-long">{mapWeekLong(d.t)}</b><b className="xs-short">{mapWeekShort(d.t)}</b><b className="xs-tiny">{mapWeekdayShort(d.t)}</b></span>)}
        </div>
        <i className="xs-fill" style={{width: `${pct}%`}} aria-hidden="true" />
        <span className="xs-bubble" style={{left: `${pct}%`}} aria-hidden="true">{hour}</span>
        <input type="range" min={0} max={Math.max(0, n - 1)} value={index} aria-label="Forecast hour" aria-valuetext={valueText} onChange={(e) => onScrub(Number(e.target.value))} />
      </div>
    </div>
  );
}

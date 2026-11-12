import {stampLabel, mapDayKey, mapClock, mapZoneAbbr, mapWeekLong, mapWeekShort, mapWeekdayShort} from './mapTime';
import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {Icon, type IconName} from '../../ui/Icon';
import {Condition} from '../../ui/Condition';
import {BAND_COLOR, bandOf} from '../forecast/model';
import {localHour, timeLabelPT} from '../forecast/format';

/** One compact spot row (T-043: no photos in the map list; rating colour, name, region, offshore range, rating word). */
export function SpotRow({id, name, sub, category, current, highlighted, onPick, onHover, selected, rowId}: {id: string; name: string; sub: string; category: string | null; current: boolean; highlighted: boolean; onPick: () => void; onHover: (on: boolean) => void;
  /** §6: a search suggestion (role option); true when it is the active one (arrow keys) */ selected?: boolean; rowId?: string}) {
  return (
    <button id={rowId ?? `xrow-${id}`} aria-current={current} data-hl={highlighted || undefined} onClick={onPick} role={selected === undefined ? undefined : 'option'} aria-selected={selected}
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
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cb.current(); opener?.current?.focus(); } };   // handled: the map's Esc leaves its spot focused (1B)
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
    <div className="xl-list" role="radiogroup" aria-label="Color the sea by">
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
              <li><button role="switch" aria-checked={on} onClick={() => setField(on ? null : field)}><span>Sea color</span><i className="xsw" aria-hidden="true" /></button></li>
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

export function LegendChip({unit, ramp, lo, hi, label, short, word, loading, onCycle, ticks, children}: {/** map-dots: the dots key, shown with the open legend on phones */ children?: ReactNode; /** the phone chip's one word for the painted layer */ word?: string; unit: string; ramp: string[]; lo: string; hi: string; label: string; /** A18: the phone's two-line name (spelled out, no 'Hs') */ short?: string; loading: boolean; onCycle: (() => void) | null; /** Stage 3: tick labels at the scale's breakpoints (evenly spaced along the ramp), from the same config as the painter. */ ticks?: {pos: number; label: string}[]}) {
  // phone pass 2: on phones the legend is a small chip (the ramp, the unit, and 'not surf' for a height layer) that expands to the full legend on a tap
  const [open, setOpen] = useState(false);
  const tog = useRef<HTMLButtonElement>(null), box = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), box, tog);
  const notSurf = /not surf/.test(label);
  return (
    <div ref={box} className={`xleg${open ? ' open' : ''}`}>
      <button ref={tog} type="button" className="xleg-t" aria-expanded={open} aria-label={`Legend: ${label}, ${unit}. ${open ? 'Hide' : 'Show'} the scale`} onClick={() => setOpen(!open)}>
        {word && <b className="xleg-w">{word}</b>}<b>{unit}</b>{notSurf && <span>offshore · not surf</span>}<i style={{background: `linear-gradient(90deg, ${ramp.join(',')})`}} aria-hidden="true" />
      </button>
      <button className="xchip" aria-label={`${label}${/swell height/i.test(label) ? ' (0 = no swell, wind sea only)' : ''} legend, fixed scale ${ticks ? ticks.map((x) => x.label).join(', ') : `${lo} to ${hi}`} ${unit}.${onCycle ? ' Press to change the unit' : ''}`} title={ticks ? `Fixed scale, ${unit}: ${ticks.map((x) => x.label).join(' · ')}` : undefined} data-loading={loading || undefined} onClick={onCycle ?? undefined} disabled={!onCycle}>
        {/* A18 (audit M7): every legend names the layer it paints (wide: the full name; phone: the short one) */}<span className="xleg-k">{label}</span><span className="xleg-ks">{short ?? label}</span>{/swell height/i.test(label) && <span className="xleg-note" title="No swell system there: the model's swell partition is empty and the sea is all wind sea, which can still be large (see the Waves layer). Painted at the calm end of the swell scale.">0 = no swell (wind sea only)<span className="sr">: the sea there is all wind sea, which can still be large; the Waves layer shows its height</span></span>}<b>{unit}</b>{!ticks && <span className="xleg-lo">{lo}</span>}<span className="xleg-bar"><i style={{background: `linear-gradient(90deg, ${ramp.join(',')})`}} />{ticks && <span className="xleg-tk" aria-hidden="true">{ticks.map((x, i) => <em key={x.pos} className={i === 0 || i === ticks.length - 1 || i === midTick(ticks) ? 'maj' : undefined} style={{left: `${x.pos * 100}%`}}>{x.label}</em>)}</span>}</span>{!ticks && <span>{hi}</span>}
      </button>
      {children && <div className="xleg-dots">{children}</div>}
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

/** map-dots: what the map's dots mean (the dot's style says what kind of number it carries). The same four looks as the map, drawn in CSS. */
export function DotKeyList({unit = 'ft', hawaiian = false}: {unit?: 'ft' | 'm'; hawaiian?: boolean}) {
  const rows: [string, ReactNode, string][] = [
    ['est', '5', `Our surf estimate, in ${unit}${hawaiian ? ' (Hawaiian scale)' : ''}: the middle of the spot\u2019s range, rounded down (model)`],
    ['nws', '5', `NWS surf forecast: theirs, not ours, for the whole zone and day (${unit === 'm' ? 'its feet in m' : 'ft as published'}, never Hawaiian)`],
    ['off', null, 'Offshore height only: no surf number'],
    ['snap', null, 'Daily forecast, not live'],
    ['none', null, 'Not loaded yet, or nothing this hour'],
  ];
  return (
    <div className="xdk-l">
      <ul>{rows.map(([k, n, t]) => <li key={k}><i className={`xg-dot k-${k}`} style={{'--c': k === 'none' ? 'var(--muted)' : 'var(--good)', color: k === 'est' ? '#fff' : undefined} as CSSProperties} aria-hidden="true">{n}</i><span>{t}</span></li>)}</ul>
      <p className="xdk-note">Color is our rating at this hour (green good, amber fair, grey poor); an outlined number has no rating this hour. The tick on the rim points where the swell comes from. Faded: a saved or older copy. Dimmed: after dark. Zoomed out, a stacked dot stands for a stretch of coast and shows its best-rated spot: tap it for the list, or zoom in for every spot.</p>
    </div>
  );
}
/** map-dots (wide screens): the key behind a small button beside the legend */
export function DotKey({unit = 'ft', hawaiian = false}: {unit?: 'ft' | 'm'; hawaiian?: boolean}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null), box = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), box, btn);
  return (
    <div className="xdk">
      <button ref={btn} type="button" className="xchip xdk-b" aria-expanded={open} aria-label="Map dots: what they mean" onClick={() => setOpen(!open)}><i className="xg-dot k-est" style={{'--c': 'var(--good)', color: '#fff'} as CSSProperties} aria-hidden="true">5</i>Dots</button>
      {open && <div ref={box} className="xpop xleg-pop xdk-pop" role="dialog" aria-label="Map dots"><p className="xpop-t">Map dots</p><DotKeyList unit={unit} hawaiian={hawaiian} /></div>}
    </div>
  );
}

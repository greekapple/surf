import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import type {ViewProps, Go} from '../../app/routes';
import {useSwello} from '../../app/store';
import type {SurfSpot, UserProfile} from '../../models/index';
import {windRelationship} from '../../recommendation/sqi';
import {scoreBoard} from '../../recommendation/board';
import {PHOTOS, GENERIC_PHOTOS} from '../../ui/photos';
import {StateMessage} from '../../ui/common';
import {Skeleton} from '../../ui/Skeleton';
import {Icon} from '../../ui/Icon';
import {bandOf, hourLabel, hourlySeries, titleCase, trendOf, type Band, type HourSample} from '../forecast/model';
import {bestDaylight, compass, groupDays, ht, isDaylight, monotonePath, spotLatLon, windVal} from '../forecast/helpers';
import {weekdayPT, dayNumPT, timeLabelPT} from '../forecast/format';
import {Condition, conditionWord} from '../../ui/Condition';
import {windInk} from '../forecast/charts';
import {Almanac, dayFacts} from './Almanac';
import './home.css';

/* Rating colours follow the theme tokens (same meaning as BAND_COLOR). */
const TONE: Record<Band, string> = {good: 'var(--good)', fair: 'var(--fair)', poor: 'var(--poor)', none: 'var(--none)'};
/* Hand-picked photographs: the strongest authentic image per spot, wide for the hero, portrait-friendly for lists. */
/* The hero is one sunset photograph (Ocean Beach, credited on the image); spots keep their own photographs on the cards. */
const SUNSET = 'ob-sunset-negative-tide';
const SUNSET_MAP = new Proxy({} as Record<string, string>, {get: () => SUNSET});
const PORTRAIT: Record<string, string> = {'spot-2': 'ocean-beach-seal-rocks', 'spot-0': 'bolinas-beach-wide', 'spot-3': 'lm-sunset-surfer'};
const WIDE = new Set(['ocean-beach-fog-clearing', 'ocean-beach-seal-rocks', 'pacifica-state-beach-surfer', 'bolinas-beach', 'lm-sunset-surfer', 'gen-surfer-under-wave']);
const DIR: Record<string, string> = {N: 'north', E: 'east', S: 'south', W: 'west'};
const dirWord = (deg: number) => compass(deg).split('').map((c) => DIR[c]).join('');
const ratingWord = conditionWord;
type Preview = {spotId: string; h: HourSample} | null;
type OnPreview = (p: Preview) => void;
/** Mouse hover or keyboard focus previews an hour in the hero; touch just opens on tap. */
const previewProps = (spotId: string, h: HourSample, on: OnPreview) => ({
  onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') on({spotId, h}); },
  onPointerLeave: () => on(null), onFocus: () => on({spotId, h}), onBlur: () => on(null),
});

function photoFor(spotId: string, map: Record<string, string>, i = 0) {
  const id = map[spotId] ?? GENERIC_PHOTOS[i % GENERIC_PHOTOS.length];
  return {id, p: PHOTOS[id], generic: !map[spotId]};
}

function Shot({spotId, map, sizes, eager, i}: {spotId: string; map: Record<string, string>; sizes: string; eager?: boolean; i?: number}) {
  const {id, p, generic} = photoFor(spotId, map, i);
  const [ready, setReady] = useState(false);
  return (
    <>
      <img className={ready ? 'ready' : ''} alt={generic ? 'Generic surf photograph, not this spot' : p.location}
        src={`/photos/${id}-1600.jpg`} sizes={sizes} loading={eager ? 'eager' : 'lazy'} decoding="async"
        srcSet={`/photos/${id}-800.jpg 800w, /photos/${id}-1600.jpg 1600w${WIDE.has(id) ? `, /photos/${id}-2400.jpg 2400w` : ''}`}
        ref={(el) => { if (el?.complete && el.naturalWidth) setReady(true); }} onLoad={() => setReady(true)} />
      <small className="credit">{generic && 'Generic photo, not this spot · '}<a href={p.source} target="_blank" rel="noreferrer">{p.photographer}</a> · <a href={p.licenseUrl} target="_blank" rel="noreferrer">{p.license}</a></small>
    </>
  );
}

/** One plain-language reading of the hour: the rating, then the numbers inside the sentence. */
function Bulletin({h, series, spot, p}: {h: HourSample; series: HourSample[]; spot: SurfSpot; p: UserProfile}) {
  const f = h.forecast, u = p.heightUnit, face = f.availability.face && Number.isFinite(f.face);
  const tr = trendOf(series, series.indexOf(h));
  const parts: ReactNode[] = [];
  parts.push(<><b>{ht(h.heightFt, p)} {u}</b> {face ? 'faces (demonstration estimate)' : 'offshore'}{f.primary && Number.isFinite(f.primary.period) ? <> from a <b>{Math.round(f.primary.period)}-second</b> {dirWord(f.primary.direction)} swell</> : null}</>);
  if (Number.isFinite(f.wind.speed)) {
    const mph = f.wind.speed, rel = windRelationship(spot, f);
    const kind = mph < 3 ? 'calm' : mph < 10 ? 'light' : mph < 18 ? 'moderate' : 'strong';
    parts.push(kind === 'calm' ? <>calm wind</> : <>{kind} {rel === 'Unknown' ? dirWord(f.wind.direction) : rel.toLowerCase()} wind, <b>{windVal(mph, p)} {p.windUnit}</b></>);
  }
  if (f.tide.trend === 'Rising' || f.tide.trend === 'Falling') parts.push(<>tide {f.tide.trend.toLowerCase()}</>);
  return (
    <p className="bulletin tick" key={h.timestamp + spot.id}>
      <span className="verdict"><Condition category={h.rating.category} />{tr === 'building' || tr === 'easing' ? ` and ${tr}` : tr === 'steady' ? ', holding steady' : ''}.</span>{' '}
      {parts.map((x, k) => <span key={k}>{k ? ', ' : ''}{x}</span>)}.
    </p>
  );
}

/** The next 24 hours as one drawing: offshore height, rating, wind and night, labelled in place. */
function Next24({hours, spot, p, onPick}: {hours: HourSample[]; spot: SurfSpot; p: UserProfile; onPick: (t: string) => void}) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1100);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, e.contentRect.width)));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const n = hours.length;
  if (n < 2) return null;
  const narrow = W < 640, every = narrow ? 4 : 3, H = 236, L = 44, R = narrow ? 30 : 22, base = 134, top0 = 22;
  const P0 = L + 18; // points start clear of the y-axis labels
  const step = (W - P0 - R) / (n - 1), X = (i: number) => P0 + i * step;
  /* y-scale follows the data range (not from 0): bars show the height above a floor just under the lowest hour */
  const vals = hours.map((h) => h.heightFt ?? 0), vMin = Math.min(...vals), vMax = Math.max(...vals);
  const span = Math.max(vMax - vMin, 1), tickStep = span <= 2 ? 0.5 : span <= 5 ? 1 : 2;
  const lo = Math.max(0, Math.floor((vMin - span * 0.25) / tickStep) * tickStep), hi = Math.max(lo + tickStep * 2, Math.ceil((vMax + span * 0.2) / tickStep) * tickStep);
  const Y = (v: number) => base - ((v - lo) / (hi - lo)) * (base - top0);
  const ticks = Array.from({length: Math.round((hi - lo) / tickStep) + 1}, (_, k) => lo + k * tickStep);
  const tickLabel = (t: number) => (p.heightUnit === 'm' ? (t * 0.3048).toFixed(1) : Number.isInteger(t) ? String(t) : t.toFixed(1));
  const [lat, lon] = spotLatLon(spot);
  const line = monotonePath(hours.map((h, i) => [X(i), Y(h.heightFt ?? 0)] as [number, number]));
  const clampX = (x: number) => Math.max(L, Math.min(W - R, x));
  const nights: [number, number][] = [];
  hours.forEach((h, i) => {
    if (isDaylight(h.timestamp, lat, lon)) return;
    const last = nights[nights.length - 1];
    if (last && last[1] === i - 1) last[1] = i; else nights.push([i, i]);
  });
  const hv = hover !== null ? hours[hover] : null;
  const barW = Math.max(3, step * 0.7), windEvery = step >= 22 ? 1 : step >= 11 ? 2 : every;
  return (
    <div className="next24" ref={box} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{height: H}} aria-hidden="true">
        {nights.map(([a, b]) => <rect key={`n${a}`} x={clampX(X(a) - step / 2)} y={top0 - 8} width={clampX(X(b) + step / 2) - clampX(X(a) - step / 2)} height={base - top0 + 8} fill="var(--ch-night)" />)}
        {ticks.map((t) => <g key={`g${t}`}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--ch-grid)" shapeRendering="crispEdges" /><text x={L - 8} y={Y(t) + 4} textAnchor="end" className="t">{tickLabel(t)}{t === ticks[ticks.length - 1] ? ` ${p.heightUnit}` : ''}</text></g>)}
        {hours.map((h, i) => <rect key={`b${i}`} x={X(i) - barW / 2} y={Y(h.heightFt ?? 0)} width={barW} height={Math.max(1, base - Y(h.heightFt ?? 0))} fill={TONE[bandOf(h.rating.category)]} fillOpacity={hover === i ? 0.9 : 0.55} />)}
        <path d={line} fill="none" stroke="var(--hs-hi)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        <line x1={L} x2={W - R} y1={base} y2={base} stroke="var(--ch-div)" shapeRendering="crispEdges" />
        {hours.map((h, i) => i % every ? null : (
          <g key={`l${i}`}>
            <text x={X(i)} y={Y(h.heightFt ?? 0) - 8} textAnchor="middle" className="v">{ht(h.heightFt, p)}</text>
            <text x={X(i)} y={base + 18} textAnchor="middle" className="t">{i === 0 ? 'Now' : hourLabel(h.timestamp)}</text>
            <text x={X(i)} y={base + 70} textAnchor="middle" className="w">{windVal(h.forecast.wind.speed, p)}</text>
          </g>
        ))}
        <text x={0} y={base + 50} className="w">Wind</text>
        {hours.map((h, i) => {
          if (i % windEvery || !Number.isFinite(h.forecast.wind.direction)) return null;
          const c = windInk(h.forecast.wind.speed), len = 6 + Math.min(6, h.forecast.wind.speed / 2.5);
          return <g key={`a${i}`} transform={`translate(${X(i)},${base + 46}) rotate(${(h.forecast.wind.direction + 180) % 360})`}>
            <path d={`M0,${len} L0,${-len} M-3.5,${-len + 4.5} L0,${-len} L3.5,${-len + 4.5}`} fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </g>;
        })}
        {hover !== null && <line x1={X(hover)} x2={X(hover)} y1={top0 - 10} y2={base + 56} stroke="var(--text)" strokeOpacity={0.4} strokeDasharray="3 3" />}
      </svg>
      <div className="hit">{hours.map((h, i) => (
        <button key={h.timestamp} style={{left: X(i) - step / 2, width: step}} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => onPick(h.timestamp)}
          aria-label={`${weekdayPT(h.timestamp)} ${hourLabel(h.timestamp)}: ${ratingWord(h.rating.category)}, ${ht(h.heightFt, p)} ${p.heightUnit} offshore, wind ${windVal(h.forecast.wind.speed, p)} ${p.windUnit}. Open in forecast.`} />
      ))}</div>
      {hv && hover !== null && (
        <div className="tip" style={{left: X(hover) + 214 > W ? X(hover) - 210 : X(hover) + 14}}>
          <b>{weekdayPT(hv.timestamp)} {hourLabel(hv.timestamp)}</b>
          <span><Condition category={hv.rating.category} /></span>
          <span>{ht(hv.heightFt, p)} {p.heightUnit} offshore{hv.forecast.primary ? ` · ${Math.round(hv.forecast.primary.period)} s ${compass(hv.forecast.primary.direction)}` : ''}</span>
          <span>Wind {windVal(hv.forecast.wind.speed, p)} {p.windUnit} {compass(hv.forecast.wind.direction)}</span>
        </div>
      )}
    </div>
  );
}

interface Cell {h: HourSample | null}
/** Spots × days: the best daylight hour for each, so the week reads in one look. */
function Week({spots, cells, days, best, p, onPick, onPreview}: {spots: SurfSpot[]; cells: Cell[][]; days: string[]; best: HourSample | null; p: UserProfile; onPick: (spotId: string, t: string) => void; onPreview: OnPreview}) {
  return (
    <div className="week" role="region" aria-label="Best daylight hour per spot and day" tabIndex={0}>
      <table role="table">
        <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader"><span className="sr-only">Spot</span></th>{days.map((d) => <th key={d} scope="col" role="columnheader">{weekdayPT(d)} <span>{dayNumPT(d)}</span></th>)}</tr></thead>
        <tbody role="rowgroup">{spots.map((s, r) => (
          <tr key={s.id} role="row"><th scope="row" role="rowheader">{s.name}</th>{cells[r].map(({h}, c) => (
            <td key={c} role="cell" data-day={`${weekdayPT(days[c])} ${dayNumPT(days[c])}`}>{h ? (
              <button className={`cell ${bandOf(h.rating.category)}${h === best ? ' best' : ''}`} onClick={() => onPick(s.id, h.timestamp)} {...previewProps(s.id, h, onPreview)}
                aria-label={`${s.name}, ${weekdayPT(h.timestamp)} ${hourLabel(h.timestamp)}: ${ratingWord(h.rating.category)}, ${ht(h.heightFt, p)} ${p.heightUnit} offshore${h === best ? '. Best of the week' : ''}`}>
                <b><Condition category={h.rating.category} /></b>
                <span>{hourLabel(h.timestamp)} · {ht(h.heightFt, p)} {p.heightUnit}</span>
              </button>
            ) : <span className="empty">—</span>}</td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function SpotList({spots, now, nowH, p, onOpen, favs}: {spots: SurfSpot[]; now: number; nowH: number; p: UserProfile; onOpen: (id: string) => void; favs: string[]}) {
  const {view} = useSwello();
  return (
    <ul className="spots">{spots.map((s, k) => {
      const h = hourlySeries(s, view.mapRecords, now).find((x) => Date.parse(x.timestamp) >= nowH);
      return (
        <li key={s.id}>
          <figure className="shot portrait"><Shot spotId={s.id} map={PORTRAIT} i={k} sizes="(max-width: 860px) 80vw, 30vw" /></figure>
          <button className="spot-link" onClick={() => onOpen(s.id)}>
            <h3>{s.name}{favs.includes(s.id) && <Icon name="star" size={15} className="fav" aria-label="Saved spot" />}</h3>
            {h ? <>
              <p className="r"><Condition category={h.rating.category} /> <span>now</span></p>
              <p className="n"><b>{ht(h.heightFt, p)} {p.heightUnit}</b>{h.forecast.primary ? ` · ${Math.round(h.forecast.primary.period)} s ${compass(h.forecast.primary.direction)}` : ''} · wind {windVal(h.forecast.wind.speed, p)} {p.windUnit} {compass(h.forecast.wind.direction)}</p>
            </> : <p className="n">No record for this hour</p>}
          </button>
        </li>
      );
    })}</ul>
  );
}


const firstName = (p: UserProfile) => p.displayName?.trim().split(/\s+/)[0] ?? '';
const longDate = (t: number) => new Date(t).toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles'});
const arrow = <Icon name="arrow" size={16} style={{transform: 'rotate(90deg)'}} />;

const shortDate = (t: string) => new Date(t).toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles'});

/** A saved spot as a photograph: pick it to feature it, star to keep or drop it, or open its forecast. Hover or focus previews it in the hero. */
function FavCard({s, h, p, active, fav, i, best, onFeature, onStar, onOpen, onPreview}: {s: SurfSpot; h: HourSample | undefined; p: UserProfile; active: boolean; fav: boolean; i: number; best: SurfWindow | undefined; onFeature: () => void; onStar: () => void; onOpen: () => void; onPreview: OnPreview}) {
  const f = h?.forecast;
  return (
    <li className={`fav-card${active ? ' on' : ''}`} {...(h ? previewProps(s.id, h, onPreview) : {})}>
      <figure className="shot"><Shot spotId={s.id} map={PORTRAIT} i={i} sizes="(max-width: 860px) 74vw, 30vw" /></figure>
      <button className="fc-main" onClick={onFeature} aria-pressed={active} aria-label={`Feature ${s.name} at the top of Home`}>
        <h3>{s.name}</h3>
        <span className="fc-reg">{s.region}</span>
        {h && f ? <span className="fc-n">
          <span><Icon name="waves" size={18} /><b>{ht(h.heightFt, p)} {p.heightUnit}</b><small>Offshore</small></span>
          <span><Icon name="wind" size={18} /><b>{compass(f.wind.direction)} {windVal(f.wind.speed, p)} {p.windUnit}</b><small>Wind</small></span>
          <span><Icon name="tide" size={18} /><b>{ht(f.tide.height, p)} {p.heightUnit}</b><small>Tide</small></span>
        </span> : <span className="fc-reg">No record this hour</span>}
        <span className="fc-r">{h ? <Condition category={h.rating.category} chip /> : <span />}{best && <span className="fc-best">Best: {weekdayPT(best.h.timestamp)} {hourLabel(best.h.timestamp)}</span>}</span>
      </button>
      <button className="fc-star" aria-pressed={fav} aria-label={`${fav ? 'Remove' : 'Save'} ${s.name} ${fav ? 'from' : 'to'} favourites`} onClick={onStar}><Icon name="star" size={17} /></button>
      <button className="fc-go" onClick={onOpen} aria-label={`Forecast, ${s.name}`}><span className="sr-only">Forecast</span>{arrow}</button>
    </li>
  );
}

interface SurfWindow {s: SurfSpot; h: HourSample}
/** The best rated daylight hours ahead across the given spots, soonest first. */
function surfWindows(spots: SurfSpot[], records: Parameters<typeof hourlySeries>[1], now: number, nowH: number, n = 4): SurfWindow[] {
  const all: SurfWindow[] = [];
  for (const s of spots) {
    const ser = hourlySeries(s, records, now);
    for (const d of groupDays(ser).slice(0, 5)) {
      const h = bestDaylight(ser, s, Math.max(nowH, Date.parse(ser[d.start].timestamp)), Date.parse(ser[d.end].timestamp) + 1);
      if (h && h.rating.score !== null && h.rating.score !== undefined) all.push({s, h});
    }
  }
  return all.sort((a, b) => (b.h.rating.score ?? 0) - (a.h.rating.score ?? 0)).slice(0, n).sort((a, b) => Date.parse(a.h.timestamp) - Date.parse(b.h.timestamp));
}

function Windows({items, p, onPick, onPreview}: {items: SurfWindow[]; p: UserProfile; onPick: (spotId: string, t: string) => void; onPreview: OnPreview}) {
  return (
    <ol className="surf-windows">{items.map(({s, h}) => (
      <li key={s.id + h.timestamp}><button onClick={() => onPick(s.id, h.timestamp)} {...previewProps(s.id, h, onPreview)}
        aria-label={`${s.name}, ${weekdayPT(h.timestamp)} ${hourLabel(h.timestamp)}: ${ratingWord(h.rating.category)}, ${ht(h.heightFt, p)} ${p.heightUnit} offshore. Open in forecast.`}>
        <span className="w-when"><b>{weekdayPT(h.timestamp)}</b><small>{shortDate(h.timestamp)}</small></span>
        <span className="w-spot"><small>{hourLabel(h.timestamp)}</small><b>{s.name}</b></span>
        <span className="w-n"><b>{ht(h.heightFt, p)} {p.heightUnit}</b><Condition category={h.rating.category} chip /></span>
        <Icon name="chevron" size={18} className="w-go" />
      </button></li>
    ))}</ol>
  );
}

function SectionNav({section, go}: {section: string; go: Go}) {
  const items: [string, string][] = [['', 'Overview'], ['spots', 'My spots'], ['windows', 'Best windows']];
  return (
    <nav className="home-sections" aria-label="Home sections">
      {items.map(([id, label]) => <a key={id} href={id ? `/home/${id}` : '/home'} aria-current={section === id ? 'page' : undefined} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go('home', id); }}>{label}</a>)}
    </nav>
  );
}

export function HomeView({section, go}: ViewProps) {
  const {view, data, now, spot, spotOptions, series, live, setSpot} = useSwello();
  const p = data.state.profile, favs = data.state.favorites;
  const nowH = Math.floor(now / 3600000) * 3600000;
  const [preview, setPreview] = useState<Preview>(null);
  const root = useRef<HTMLDivElement>(null), heroRef = useRef<HTMLElement>(null);
  const home = !section;
  /* Scroll-reveal (once) and a transform-only parallax on the hero photograph; both off under reduced motion. */
  useEffect(() => {
    const el = root.current;
    if (!el || !home || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    el.classList.add('rv-on');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -8% 0px'});
    el.querySelectorAll('.rv').forEach((n) => io.observe(n));
    return () => { io.disconnect(); el.classList.remove('rv-on'); };
  }, [home]);
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || !home || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { hero.style.setProperty('--py', `${Math.min(36, Math.max(0, scrollY) * 0.08).toFixed(1)}px`); }); };
    addEventListener('scroll', on, {passive: true});
    return () => { removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, [home]);
  const mine = useMemo(() => spotOptions.filter((s) => favs.includes(s.id)), [spotOptions, favs]);
  const listed = useMemo(() => (mine.length ? mine : spotOptions.slice(0, 3)), [mine, spotOptions]);
  const current = series.find((h) => Date.parse(h.timestamp) >= nowH) ?? null;
  const next = useMemo(() => series.filter((h) => Date.parse(h.timestamp) >= nowH).slice(0, 25), [series, nowH]);

  const week = useMemo(() => {
    const rows = listed.map((s) => hourlySeries(s, view.mapRecords, now));
    const days = (rows[0] ? groupDays(rows[0]) : []).slice(0, 7);
    const cells = rows.map((ser, r) => {
      const byKey = new Map(groupDays(ser).map((d) => [d.key, d]));
      return days.map((d0) => {
        const d = byKey.get(d0.key);
        if (!d) return {h: null};
        return {h: bestDaylight(ser, listed[r], Math.max(nowH, Date.parse(ser[d.start].timestamp)), Date.parse(ser[d.end].timestamp) + 1)};
      });
    });
    let best: HourSample | null = null;
    for (const row of cells) for (const {h} of row) if (h && (h.rating.score ?? -1) > (best?.rating.score ?? -1)) best = h;
    const keep = days.map((_, c) => cells.some((row) => row[c].h));
    return {days: days.filter((_, c) => keep[c]).map((d) => d.t), cells: cells.map((row) => row.filter((_, c) => keep[c])), best};
  }, [listed, view.mapRecords, now, nowH]);

  const open = (spotId: string, t?: string) => { setSpot(spotId); if (t) view.selectTime(t); go('forecast'); };
  const name = firstName(p);
  const hr = Number(new Intl.DateTimeFormat('en-US', {hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles'}).format(now)) % 24;
  const greeting = hr < 5 ? 'Good evening' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const bestBySpot = useMemo(() => new Map(listed.map((s) => [s.id, surfWindows([s], view.mapRecords, now, nowH, 1)[0]])), [listed, view.mapRecords, now, nowH]);
  const windows = useMemo(() => surfWindows(listed, view.mapRecords, now, nowH), [listed, view.mapRecords, now, nowH]);
  const soonest = windows.reduce<SurfWindow | null>((a, w) => (!a || (w.h.rating.score ?? 0) > (a.h.rating.score ?? 0) ? w : a), null);
  const facts = useMemo(() => dayFacts(series, spot, view.ocean.bundle?.extrema ?? [], now), [series, spot, view.ocean.bundle, now]);
  const heroSpot = (preview && spotOptions.find((s) => s.id === preview.spotId)) || spot;
  const heroSeries = useMemo(() => (heroSpot.id === spot.id ? series : hourlySeries(heroSpot, view.mapRecords, now)), [heroSpot, spot.id, series, view.mapRecords, now]);
  const heroH = preview?.h ?? current;
  const board = current && current.forecast.availability.face && Number.isFinite(current.forecast.face)
    ? data.state.boards.map((b) => scoreBoard(b, current.forecast, p)).sort((a, b) => b.score - a.score)[0] : null;

  if (live && view.ocean.loading && !view.ocean.bundle) return <Skeleton label="Loading forecasts…" />;
  if (live && !view.ocean.bundle) return <div className="coast plain"><StateMessage title="Forecast data unavailable" action={<button className="btn" onClick={view.ocean.reload}>Try again</button>}>{view.ocean.error ?? 'The providers could not be reached.'}</StateMessage></div>;

  const weekBlock = (
    <section className={`band${home ? ' rv' : ''}`} aria-labelledby="week-h">
      <header className="sec-h"><h2 id="week-h">The week ahead</h2><p>Best daylight hour per spot, offshore model height</p></header>
      {week.days.length ? <Week spots={listed} cells={week.cells} days={week.days} best={week.best} p={p} onPick={open} onPreview={setPreview} /> : <p className="note">No forecast days available.</p>}
    </section>
  );

  if (section === 'spots' || section === 'windows') return (
    <div className="coast plain">
      <SectionNav section={section} go={go} />
      {section === 'spots' ? (
        <section className="band" aria-labelledby="spots-h">
          <header className="sec-h"><h2 id="spots-h">{mine.length ? 'My spots' : 'Spots'}</h2><p>{mine.length ? `${mine.length} saved` : 'Save a spot with its star to pin it here'}</p></header>
          <SpotList spots={mine.length ? mine : spotOptions} now={now} nowH={nowH} p={p} onOpen={open} favs={favs} />
        </section>
      ) : weekBlock}
    </div>
  );

  const f = heroH?.forecast;
  return (
    <div className="coast" ref={root}>
      <section className="home-hero" aria-label={`${spot.name} now`} ref={heroRef}>
        <figure className="shot hero-shot" aria-hidden="false"><Shot spotId="hero" map={SUNSET_MAP} sizes="100vw" eager /></figure>
        <div className="hero-in">
          <header className="hello">
            <p className="greet">{greeting},</p>
            <h1>{name ? <><span className="h-ink">Hello, </span>{name}<span className="h-ink">.</span></> : 'Hello.'}</h1>
            <p className="hello-sub">Here’s your surf outlook and favorite spots.{!name && <> <a href="/personal" onClick={(e) => { e.preventDefault(); go('personal'); }}>Add your name</a></>}</p>
          </header>

          {heroH && f && (
            <ul className="hero-stats" aria-label={`${heroSpot.name} ${preview ? 'preview' : 'right now'}`}>
              <li><span className="ic"><Icon name="waves" size={20} /></span><span><b>{ht(heroH.heightFt, p)} {p.heightUnit}</b><small>Offshore{f.primary && Number.isFinite(f.primary.period) ? `, ${Math.round(f.primary.period)} s` : ''}</small></span></li>
              <li><span className="ic"><Icon name="wind" size={20} /></span><span><b>{compass(f.wind.direction)} {windVal(f.wind.speed, p)} {p.windUnit}</b><small>Wind</small></span></li>
              <li><span className="ic"><Icon name="tide" size={20} /></span><span><b>{ht(f.tide.height, p)} {p.heightUnit}</b><small>Tide{f.tide.trend ? `, ${f.tide.trend.toLowerCase()}` : ''}</small></span></li>
              {Number.isFinite(f.waterTempF ?? NaN) && <li><span className="ic"><Icon name="thermo" size={20} /></span><span><b>{Math.round(f.waterTempF!)}°F</b><small>Water</small></span></li>}
            </ul>
          )}

          <section className="favs" aria-labelledby="favs-h">
            <header className="sec-h"><div id="favs-h" role="heading" aria-level={2}>{mine.length ? 'Your Favorite Spots' : 'Spots'}</div>{mine.length ? <a href="/home/spots" onClick={(e) => { e.preventDefault(); go('home', 'spots'); }}>View all</a> : <p>Star a spot to keep it here</p>}</header>
            <ul className="fav-cards">{listed.map((s, k) => (
              <FavCard key={s.id} s={s} i={k} p={p} active={s.id === spot.id} fav={favs.includes(s.id)} best={bestBySpot.get(s.id)}
                h={hourlySeries(s, view.mapRecords, now).find((x) => Date.parse(x.timestamp) >= nowH)}
                onFeature={() => { setSpot(s.id); scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); }}
                onStar={() => data.favorite(s.id)} onOpen={() => open(s.id)} onPreview={setPreview} />
            ))}</ul>
          </section>

          <div className="hero-side">
            <div className="hero-body">
              <p className="where">{favs.includes(heroSpot.id) ? 'Saved spot' : 'Selected spot'}, {heroSpot.region}</p>
              <h2>{heroSpot.name}</h2>
              {heroH ? <Bulletin h={heroH} series={heroSeries} spot={heroSpot} p={p} /> : <p className="bulletin">No forecast record for this hour.</p>}
              <p className="meta">{preview ? `Previewing ${weekdayPT(preview.h.timestamp)} ${timeLabelPT(preview.h.timestamp)}. Click to open the forecast.` : `${live ? 'Model forecast' : 'Demonstration week, not live'}${current ? `, ${weekdayPT(current.timestamp)} ${timeLabelPT(current.timestamp)}` : ''}. Heights are offshore, not surf height. Ratings provisional.`}</p>
            </div>
            {windows.length > 0 && (
              <section className="win-panel" aria-labelledby="win-h">
                <header><div id="win-h" role="heading" aria-level={2}>Next Best Windows</div><span>{mine.length ? 'Your spots' : 'All spots'}, 5 days</span></header>
                <Windows items={windows} p={p} onPick={open} onPreview={setPreview} />
              </section>
            )}
            <button className="promo" onClick={() => go('forecast', 'wave-scale')}>
              <figure className="shot"><Shot spotId="gen" map={{}} i={0} sizes="360px" /></figure>
              <span className="p-t"><Icon name="scale" size={18} />Interactive Forecast</span>
              <span className="p-d">Wave Scale puts a wave face next to a surfer in 3D. Illustrative, not a forecast.</span>
              <span className="p-go">{arrow}</span>
            </button>
          </div>

          {facts && (
            <div className="highlights" role="group" aria-label={`${facts.label}’s highlights`}>
              <p className="h-t"><Icon name="forecast" size={22} />{facts.label}’s Highlights</p>
              <div><Icon name="waves" size={24} /><span><b>{facts.best ? `${ratingWord(facts.best.rating.category)} conditions at ${spot.name}` : 'No rated daylight hours left'}</b><small>{facts.best ? `Best around ${hourLabel(facts.best.timestamp)}, provisional` : 'Check the week ahead'}</small></span></div>
              <div><Icon name="wind" size={24} /><span><b>{facts.windAm !== null || facts.windPm !== null ? `${windVal((facts.windAm ?? facts.windPm)!, p)} ${p.windUnit} ${compass((facts.dirAm ?? facts.dirPm) ?? NaN)} wind` : 'Wind unavailable'}</b><small>{facts.windAm !== null ? 'Around morning' : 'Around afternoon'}</small></span></div>
              <div><Icon name="sun" size={24} /><span><b>Sunset {timeLabelPT(new Date(facts.set).toISOString())}</b><small>Sunrise {timeLabelPT(new Date(facts.rise).toISOString())}</small></span></div>
              <button className="h-go" onClick={() => go('forecast')}>View Forecast{arrow}</button>
            </div>
          )}
        </div>
      </section>

      {facts && <section className="band glance rv" aria-label={`${spot.name} ${facts.label.toLowerCase()} at a glance`}><header className="sec-h"><h2>{facts.label} at a glance</h2><p>{spot.name}</p></header><Almanac facts={facts} p={p} onBest={(t) => { view.selectTime(t); go('forecast'); }} /></section>}

      <section className="band rv" aria-labelledby="next-h">
        <header className="sec-h"><h2 id="next-h">Next 24 hours</h2><p>{spot.name}, height in {p.heightUnit}, wind in {p.windUnit}, shaded hours are dark</p></header>
        <Next24 hours={next} spot={spot} p={p} onPick={(t) => { view.selectTime(t); go('forecast'); }} />
      </section>

      {weekBlock}

      <section className="band rv" aria-labelledby="for-h">
        <header className="sec-h"><h2 id="for-h">Your tools</h2></header>
        <ul className="for-you">
          <li><button onClick={() => go('quiver', 'match')}><b>Board for now</b><span>{board ? `${board.board.name}, ${Math.round(board.score)}/100, demonstration estimate` : 'Needs a breaking-wave estimate; live spots have offshore height only'}</span>{arrow}</button></li>
          <li><button onClick={() => go('forecast', 'wave-scale')}><b>Wave Scale</b><span>A wave face next to a surfer in 3D, illustrative</span>{arrow}</button></li>
          <li><button onClick={() => go('personal', 'preferences')}><b>Preferences</b><span>{p.skill}, {p.minWave} to {p.maxWave} ft faces, {p.style.toLowerCase()}</span>{arrow}</button></li>
          <li><button onClick={() => go('personal', 'journal')}><b>Surf journal</b><span>{data.state.sessions.length ? `${data.state.sessions.length} sessions logged` : 'Log a session to sharpen recommendations'}</span>{arrow}</button></li>
        </ul>
      </section>

      <footer className="close">
        <p>Forecasts: Open-Meteo marine and weather models. Tides: NOAA CO-OPS, San Francisco, regional. Ratings are provisional and uncalibrated. Photographs: Wikimedia Commons contributors, credited on each image.</p>
      </footer>
    </div>
  );
}

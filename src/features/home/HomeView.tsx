import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import type {ViewProps, Go} from '../../app/routes';
import {useSwello} from '../../app/store';
import type {SurfSpot, UserProfile} from '../../models/index';
import {windRelationship} from '../../recommendation/sqi';
import {scoreBoard} from '../../recommendation/board';
import {PHOTOS, GENERIC_PHOTOS} from '../../ui/photos';
import {StateMessage} from '../../ui/common';
import {Icon} from '../../ui/Icon';
import {bandOf, hourLabel, hourlySeries, titleCase, trendOf, type Band, type HourSample} from '../forecast/model';
import {bestDaylight, compass, groupDays, ht, isDaylight, monotonePath, spotLatLon, windVal} from '../forecast/helpers';
import {weekdayPT, dayNumPT, timeLabelPT} from '../forecast/format';
import {Almanac, dayFacts} from './Almanac';
import './home.css';

/* Rating colours follow the theme tokens (same meaning as BAND_COLOR). */
const TONE: Record<Band, string> = {good: 'var(--good)', fair: 'var(--fair)', poor: 'var(--poor)', none: 'var(--none)'};
/* Hand-picked photographs: the strongest authentic image per spot, wide for the hero, portrait-friendly for lists. */
const HERO: Record<string, string> = {'spot-2': 'ob-sunset-negative-tide', 'spot-0': 'bolinas-beach', 'spot-3': 'pacifica-state-beach-surfer'};
const PORTRAIT: Record<string, string> = {'spot-2': 'ocean-beach-seal-rocks', 'spot-0': 'bolinas-beach-wide', 'spot-3': 'lm-sunset-surfer'};
const WIDE = new Set(['ocean-beach-fog-clearing', 'ocean-beach-seal-rocks', 'pacifica-state-beach-surfer', 'bolinas-beach', 'lm-sunset-surfer', 'gen-surfer-under-wave']);
const DIR: Record<string, string> = {N: 'north', E: 'east', S: 'south', W: 'west'};
const dirWord = (deg: number) => compass(deg).split('').map((c) => DIR[c]).join('');
const ratingWord = (c: string) => (c === 'UNRATED' ? 'Unrated' : titleCase(c).charAt(0) + titleCase(c).slice(1).toLowerCase());

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
    <p className="bulletin">
      <span className="verdict"><i style={{background: TONE[bandOf(h.rating.category)]}} />{ratingWord(h.rating.category)}{tr === 'building' || tr === 'easing' ? ` and ${tr}` : tr === 'steady' ? ', holding steady' : ''}.</span>{' '}
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
  const narrow = W < 640, every = narrow ? 4 : 3, H = 222, L = 40, R = narrow ? 30 : 22, base = 126;
  const P0 = L + 22; // points start clear of the y-axis labels
  const step = (W - P0 - R) / (n - 1), X = (i: number) => P0 + i * step;
  const top = Math.max(2, Math.ceil(Math.max(...hours.map((h) => h.heightFt ?? 0)) * 1.15 / 2) * 2), Y = (v: number) => base - (v / top) * 104;
  const ticks = Array.from({length: top / 2 + 1}, (_, k) => k * 2);
  const [lat, lon] = spotLatLon(spot);
  const pts = hours.map((h, i) => [X(i), Y(h.heightFt ?? 0)] as [number, number]);
  const line = monotonePath(pts);
  const clampX = (x: number) => Math.max(L, Math.min(W - R, x));
  const nights: [number, number][] = [];
  hours.forEach((h, i) => {
    if (isDaylight(h.timestamp, lat, lon)) return;
    const last = nights[nights.length - 1];
    if (last && last[1] === i - 1) last[1] = i; else nights.push([i, i]);
  });
  const hv = hover !== null ? hours[hover] : null;
  return (
    <div className="next24" ref={box} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{height: H}} aria-hidden="true">
        <defs><linearGradient id="n24fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--hs)" stopOpacity={0.45} /><stop offset="1" stopColor="var(--hs)" stopOpacity={0.02} /></linearGradient></defs>
        {nights.map(([a, b]) => <rect key={`n${a}`} x={clampX(X(a) - step / 2)} y={0} width={clampX(X(b) + step / 2) - clampX(X(a) - step / 2)} height={base + 14} fill="var(--ch-night)" />)}
        {ticks.map((t) => <g key={`g${t}`}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--ch-grid)" /><text x={L - 8} y={Y(t) + 4} textAnchor="end" className="t">{p.heightUnit === 'm' ? (t * 0.3048).toFixed(1) : t}</text></g>)}
        <path d={`${line} L${X(n - 1)},${base} L${X(0)},${base} Z`} fill="url(#n24fill)" stroke="none" />
        <path d={line} fill="none" stroke="var(--hs-hi)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        {hours.map((h, i) => { const x0 = clampX(X(i) - step / 2), x1 = clampX(X(i) + step / 2); return <rect key={`r${i}`} x={x0} y={base + 6} width={x1 - x0 + 0.6} height={6} fill={TONE[bandOf(h.rating.category)]} />; })}
        {hours.map((h, i) => i % every ? null : (
          <g key={`l${i}`}>
            <circle cx={X(i)} cy={Y(h.heightFt ?? 0)} r={3} fill="var(--hs-hi)" />
            <text x={X(i)} y={Y(h.heightFt ?? 0) - 11} textAnchor="middle" className="v">{ht(h.heightFt, p)}</text>
            <text x={X(i)} y={base + 34} textAnchor="middle" className="t">{i === 0 ? 'Now' : hourLabel(h.timestamp)}</text>
            {Number.isFinite(h.forecast.wind.direction) && <g transform={`translate(${X(i) - 9},${base + 60}) rotate(${(h.forecast.wind.direction + 180) % 360})`}>
              <path d="M0,7 L0,-7 M-4,-2.5 L0,-7 L4,-2.5" fill="none" stroke="var(--muted)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
            </g>}
            <text x={X(i) + 2} y={base + 64} className="w">{windVal(h.forecast.wind.speed, p)}</text>
          </g>
        ))}
        {hover !== null && <line x1={X(hover)} x2={X(hover)} y1={8} y2={base + 12} stroke="var(--text)" strokeOpacity={0.4} strokeDasharray="3 3" />}
      </svg>
      <div className="hit">{hours.map((h, i) => (
        <button key={h.timestamp} style={{left: X(i) - step / 2, width: step}} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => onPick(h.timestamp)}
          aria-label={`${weekdayPT(h.timestamp)} ${hourLabel(h.timestamp)}: ${ratingWord(h.rating.category)}, ${ht(h.heightFt, p)} ${p.heightUnit} offshore, wind ${windVal(h.forecast.wind.speed, p)} ${p.windUnit}. Open in forecast.`} />
      ))}</div>
      {hv && hover !== null && (
        <div className="tip" style={{left: X(hover) + 214 > W ? X(hover) - 210 : X(hover) + 14}}>
          <b>{weekdayPT(hv.timestamp)} {hourLabel(hv.timestamp)}</b>
          <span><i style={{background: TONE[bandOf(hv.rating.category)]}} />{ratingWord(hv.rating.category)}</span>
          <span>{ht(hv.heightFt, p)} {p.heightUnit} offshore{hv.forecast.primary ? ` · ${Math.round(hv.forecast.primary.period)} s ${compass(hv.forecast.primary.direction)}` : ''}</span>
          <span>Wind {windVal(hv.forecast.wind.speed, p)} {p.windUnit} {compass(hv.forecast.wind.direction)}</span>
        </div>
      )}
    </div>
  );
}

interface Cell {h: HourSample | null}
/** Spots × days: the best daylight hour for each, so the week reads in one look. */
function Week({spots, cells, days, best, p, onPick}: {spots: SurfSpot[]; cells: Cell[][]; days: string[]; best: HourSample | null; p: UserProfile; onPick: (spotId: string, t: string) => void}) {
  return (
    <div className="week" role="region" aria-label="Best daylight hour per spot and day" tabIndex={0}>
      <table role="table">
        <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader"><span className="sr-only">Spot</span></th>{days.map((d) => <th key={d} scope="col" role="columnheader">{weekdayPT(d)} <span>{dayNumPT(d)}</span></th>)}</tr></thead>
        <tbody role="rowgroup">{spots.map((s, r) => (
          <tr key={s.id} role="row"><th scope="row" role="rowheader">{s.name}</th>{cells[r].map(({h}, c) => (
            <td key={c} role="cell" data-day={`${weekdayPT(days[c])} ${dayNumPT(days[c])}`}>{h ? (
              <button className={`cell ${bandOf(h.rating.category)}${h === best ? ' best' : ''}`} onClick={() => onPick(s.id, h.timestamp)}
                aria-label={`${s.name}, ${weekdayPT(h.timestamp)} ${hourLabel(h.timestamp)}: ${ratingWord(h.rating.category)}, ${ht(h.heightFt, p)} ${p.heightUnit} offshore${h === best ? '. Best of the week' : ''}`}>
                <b><i style={{background: TONE[bandOf(h.rating.category)]}} />{ratingWord(h.rating.category)}</b>
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
              <p className="r"><i style={{background: TONE[bandOf(h.rating.category)]}} />{ratingWord(h.rating.category)} <span>now · provisional</span></p>
              <p className="n"><b>{ht(h.heightFt, p)} {p.heightUnit}</b> offshore{h.forecast.primary ? ` · ${Math.round(h.forecast.primary.period)} s ${compass(h.forecast.primary.direction)}` : ''} · wind {windVal(h.forecast.wind.speed, p)} {p.windUnit} {compass(h.forecast.wind.direction)}</p>
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

/** A saved spot as a photograph: pick it to feature at the top, star to keep or drop it, or open its forecast. */
function FavCard({s, h, p, active, fav, i, onFeature, onStar, onOpen}: {s: SurfSpot; h: HourSample | undefined; p: UserProfile; active: boolean; fav: boolean; i: number; onFeature: () => void; onStar: () => void; onOpen: () => void}) {
  return (
    <li className={`fav-card${active ? ' on' : ''}`}>
      <figure className="shot"><Shot spotId={s.id} map={PORTRAIT} i={i} sizes="(max-width: 860px) 74vw, 30vw" /></figure>
      <button className="fc-main" onClick={onFeature} aria-pressed={active} aria-label={`Feature ${s.name} at the top of Home`}>
        {h ? <span className="fc-r"><i style={{background: TONE[bandOf(h.rating.category)]}} />{ratingWord(h.rating.category)} now</span> : <span className="fc-r">No record this hour</span>}
        <h3>{s.name}</h3>
        {h && <span className="fc-n"><b>{ht(h.heightFt, p)} {p.heightUnit}</b> offshore{h.forecast.primary ? ` · ${Math.round(h.forecast.primary.period)} s ${compass(h.forecast.primary.direction)}` : ''} · wind {windVal(h.forecast.wind.speed, p)} {p.windUnit}</span>}
      </button>
      <button className="fc-star" aria-pressed={fav} aria-label={`${fav ? 'Remove' : 'Save'} ${s.name} ${fav ? 'from' : 'to'} favourites`} onClick={onStar}><Icon name="star" size={17} /></button>
      <button className="fc-go" onClick={onOpen}>Forecast{arrow}</button>
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

function Windows({items, p, onPick}: {items: SurfWindow[]; p: UserProfile; onPick: (spotId: string, t: string) => void}) {
  return (
    <ol className="surf-windows">{items.map(({s, h}) => (
      <li key={s.id + h.timestamp}><button className={bandOf(h.rating.category)} onClick={() => onPick(s.id, h.timestamp)}
        aria-label={`${s.name}, ${weekdayPT(h.timestamp)} ${hourLabel(h.timestamp)}: ${ratingWord(h.rating.category)}, ${ht(h.heightFt, p)} ${p.heightUnit} offshore. Open in forecast.`}>
        <span className="w-when"><b>{weekdayPT(h.timestamp)}</b> {hourLabel(h.timestamp)}</span>
        <span className="w-spot">{s.name}</span>
        <span className="w-r"><i style={{background: TONE[bandOf(h.rating.category)]}} />{ratingWord(h.rating.category)} · provisional</span>
        <span className="w-n">{ht(h.heightFt, p)} {p.heightUnit} offshore{h.forecast.primary ? ` · ${Math.round(h.forecast.primary.period)} s ${compass(h.forecast.primary.direction)}` : ''} · wind {windVal(h.forecast.wind.speed, p)} {p.windUnit} {compass(h.forecast.wind.direction)}</span>
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
  const mine = useMemo(() => spotOptions.filter((s) => favs.includes(s.id)), [spotOptions, favs]);
  const listed = useMemo(() => (mine.length ? mine : spotOptions.slice(0, 3)), [mine, spotOptions]);
  const current = series.find((h) => Date.parse(h.timestamp) >= nowH) ?? null;
  const next = useMemo(() => series.filter((h) => Date.parse(h.timestamp) >= nowH).slice(0, 25), [series, nowH]);

  const week = useMemo(() => {
    const rows = spotOptions.map((s) => hourlySeries(s, view.mapRecords, now));
    const days = (rows[0] ? groupDays(rows[0]) : []).slice(0, 7);
    const cells = rows.map((ser, r) => {
      const byKey = new Map(groupDays(ser).map((d) => [d.key, d]));
      return days.map((d0) => {
        const d = byKey.get(d0.key);
        if (!d) return {h: null};
        return {h: bestDaylight(ser, spotOptions[r], Math.max(nowH, Date.parse(ser[d.start].timestamp)), Date.parse(ser[d.end].timestamp) + 1)};
      });
    });
    let best: HourSample | null = null;
    for (const row of cells) for (const {h} of row) if (h && (h.rating.score ?? -1) > (best?.rating.score ?? -1)) best = h;
    const keep = days.map((_, c) => cells.some((row) => row[c].h));
    return {days: days.filter((_, c) => keep[c]).map((d) => d.t), cells: cells.map((row) => row.filter((_, c) => keep[c])), best};
  }, [spotOptions, view.mapRecords, now, nowH]);

  const open = (spotId: string, t?: string) => { setSpot(spotId); if (t) view.selectTime(t); go('forecast'); };
  const name = firstName(p);
  const windows = useMemo(() => surfWindows(listed, view.mapRecords, now, nowH), [listed, view.mapRecords, now, nowH]);
  const soonest = windows.reduce<SurfWindow | null>((a, w) => (!a || (w.h.rating.score ?? 0) > (a.h.rating.score ?? 0) ? w : a), null);
  const facts = useMemo(() => dayFacts(series, spot, view.ocean.bundle?.extrema ?? [], now), [series, spot, view.ocean.bundle, now]);
  const board = current && current.forecast.availability.face && Number.isFinite(current.forecast.face)
    ? data.state.boards.map((b) => scoreBoard(b, current.forecast, p)).sort((a, b) => b.score - a.score)[0] : null;

  if (live && view.ocean.loading && !view.ocean.bundle) return <div className="coast plain"><StateMessage title="Retrieving forecasts…">Requesting Open-Meteo marine and weather models and NOAA tide predictions.</StateMessage></div>;
  if (live && !view.ocean.bundle) return <div className="coast plain"><StateMessage title="Forecast data unavailable" action={<button className="btn" onClick={view.ocean.reload}>Try again</button>}>{view.ocean.error ?? 'The providers could not be reached.'}</StateMessage></div>;

  const weekBlock = (
    <section className="band" aria-labelledby="week-h">
      <header className="sec-h"><h2 id="week-h">The week ahead</h2><p>Best daylight hour for each spot · provisional ratings · offshore height</p></header>
      {week.days.length ? <Week spots={spotOptions} cells={week.cells} days={week.days} best={week.best} p={p} onPick={open} /> : <p className="note">No forecast days available.</p>}
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

  return (
    <div className="coast">
      <section className="home-hero" aria-label={`${spot.name} now`}>
        <figure className="shot hero-shot" key={spot.id}><Shot spotId={spot.id} map={HERO} sizes="100vw" eager /></figure>
        <div className="hero-in">
          <header className="hello">
            <p className="date">{longDate(now)}</p>
            <h1>{name ? <>Hello, {name}.</> : 'Hello.'}</h1>
            <p className="hello-sub">
              Here’s your surf outlook.{' '}
              {soonest ? <>Best window ahead: <button onClick={() => open(soonest.s.id, soonest.h.timestamp)}><b>{weekdayPT(soonest.h.timestamp)} {hourLabel(soonest.h.timestamp)}</b> at {soonest.s.name}</button>.</> : 'No rated daylight hours in the forecast yet.'}
              {!name && <> <a href="/personal" onClick={(e) => { e.preventDefault(); go('personal'); }}>Add your name</a></>}
            </p>
          </header>
          {current && (
            <dl className="now-card" aria-label={`${spot.name} right now`}>
              <div><dt><Icon name="waves" size={16} />Offshore</dt><dd>{ht(current.heightFt, p)} {p.heightUnit}{current.forecast.primary ? <small> · {Math.round(current.forecast.primary.period)} s</small> : null}</dd></div>
              <div><dt><Icon name="wind" size={16} />Wind</dt><dd>{compass(current.forecast.wind.direction)} {windVal(current.forecast.wind.speed, p)} {p.windUnit}</dd></div>
              <div><dt><Icon name="tide" size={16} />Tide</dt><dd>{ht(current.forecast.tide.height, p)} {p.heightUnit}<small> {current.forecast.tide.trend?.toLowerCase()}</small></dd></div>
              {Number.isFinite(current.forecast.waterTempF ?? NaN) && <div><dt><Icon name="thermo" size={16} />Water</dt><dd>{Math.round(current.forecast.waterTempF!)}°F</dd></div>}
            </dl>
          )}
          <div className="hero-body">
            <p className="kicker">{favs.includes(spot.id) ? 'Saved spot' : 'Selected spot'} · {spot.region}</p>
            <h2>{spot.name}</h2>
            {current ? <Bulletin h={current} series={series} spot={spot} p={p} /> : <p className="bulletin">No forecast record for this hour.</p>}
            <p className="meta">{live ? 'Model forecast' : 'Demonstration week, not live'} · {current ? `${weekdayPT(current.timestamp)} ${timeLabelPT(current.timestamp)}` : ''} · rating provisional{live ? ' · offshore height is not surf height' : ''}</p>
            <div className="actions">
              <button className="cta" onClick={() => go('forecast')}>Open full forecast{arrow}</button>
              <button className="ghost" onClick={() => go('explore')}>Open map</button>
            </div>
          </div>
        </div>
      </section>

      <section className="band favs-band" aria-labelledby="favs-h">
        <header className="sec-h"><h2 id="favs-h">{mine.length ? 'Your favorite spots' : 'Spots'}</h2>{mine.length ? <a href="/home/spots" onClick={(e) => { e.preventDefault(); go('home', 'spots'); }}>All saved spots</a> : <p>Star a spot to keep it here</p>}</header>
        <ul className="fav-cards">{listed.map((s, k) => (
          <FavCard key={s.id} s={s} i={k} p={p} active={s.id === spot.id} fav={favs.includes(s.id)}
            h={hourlySeries(s, view.mapRecords, now).find((x) => Date.parse(x.timestamp) >= nowH)}
            onFeature={() => { setSpot(s.id); scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); }}
            onStar={() => data.favorite(s.id)} onOpen={() => open(s.id)} />
        ))}</ul>
      </section>

      {facts && <section className="band glance" aria-label={`${spot.name} ${facts.label.toLowerCase()} at a glance`}><header className="sec-h"><h2>{facts.label}’s highlights</h2><p>{spot.name}</p></header><Almanac facts={facts} p={p} onBest={(t) => { view.selectTime(t); go('forecast'); }} /></section>}

      {windows.length > 0 && (
        <section className="band" aria-labelledby="win-h">
          <header className="sec-h"><h2 id="win-h">Upcoming surf windows</h2><p>Best rated daylight hours, next five days · {mine.length ? 'your spots' : 'all spots'} · offshore height</p></header>
          <Windows items={windows} p={p} onPick={open} />
        </section>
      )}

      <section className="band" aria-labelledby="next-h">
        <header className="sec-h"><h2 id="next-h">Next 24 hours</h2><p>{spot.name} · offshore height ({p.heightUnit}) · wind ({p.windUnit}) · shaded hours are dark</p></header>
        <Next24 hours={next} spot={spot} p={p} onPick={(t) => { view.selectTime(t); go('forecast'); }} />
      </section>

      {weekBlock}

      <section className="band" aria-labelledby="for-h">
        <header className="sec-h"><h2 id="for-h">For you</h2><p>From your Personal profile and quiver</p></header>
        <ul className="for-you">
          <li><button onClick={() => go('quiver', 'match')}><b>Board for now</b><span>{board ? `${board.board.name} · ${Math.round(board.score)}/100 · demonstration estimate` : 'Waiting on a breaking-wave estimate; live spots have offshore height only'}</span>{arrow}</button></li>
          <li><button onClick={() => go('forecast', 'wave-scale')}><b>Wave Scale</b><span>See a wave face next to a surfer in 3D (illustrative)</span>{arrow}</button></li>
          <li><button onClick={() => go('personal', 'preferences')}><b>Your preferences</b><span>{p.skill} · {p.minWave}–{p.maxWave} ft faces · {p.style.toLowerCase()}</span>{arrow}</button></li>
          <li><button onClick={() => go('personal', 'journal')}><b>Surf journal</b><span>{data.state.sessions.length ? `${data.state.sessions.length} sessions logged` : 'Log a session to sharpen recommendations'}</span>{arrow}</button></li>
        </ul>
      </section>

      <footer className="close">
        <p>Forecasts from Open-Meteo marine and weather models; tides from NOAA CO-OPS (San Francisco, regional). Ratings are provisional and uncalibrated. Heights are offshore significant wave height, not breaking-wave height. Photographs from Wikimedia Commons contributors, credited on each image. No live cameras are shown.</p>
      </footer>
    </div>
  );
}

import {useEffect, useRef, type CSSProperties, type ReactNode} from 'react';
import type {SurfSpot, UserProfile} from '../../models/index';
import {evidenceSpots} from '../../ocean/spots';
import {windRelationship} from '../../recommendation/sqi';
import {SpotPhoto} from '../../ui/common';
import {Media} from '../../ui/Media';
import {SPOT_PHOTOS} from '../../ui/photos';
import {Icon} from '../../ui/Icon';
import {windInk} from './charts';
import {compass, ht, windVal} from './helpers';
import {hourLabel, type HourSample} from './model';
import {timeLabelPT, weekdayPT, dayNumPT} from './format';
import {faceEstimateView} from './estimate';
import {Condition, conditionWord} from './Condition';

/* T-027 cinematic Forecast: hero, annotated "Today at", scroll-lit sentence, parallax band.
 * Every number comes from the selected hour and keeps its label; nothing here is invented.
 * Motion: CSS scroll-driven animations where supported, else an IntersectionObserver adds `.in`; reduced motion shows final states (forecast.css). */

type Extremum = {timestamp: string; type: string; height: {value: number | null}};
const facingOf = (spot: SurfSpot) => evidenceSpots.find((e) => e.id === spot.id)?.orientation ?? null;
const scrollDriven = () => typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()');
/** The spot's own photograph through <Media> (credit, and the AI caption when an illustration replaces it). Spots without their own photo keep
 * SpotPhoto, whose credit says 'Generic photo, not this spot'. */
function Shot({spotId, index, className, eager}: {spotId: string; index: number; className: string; eager?: boolean}) {
  const own = SPOT_PHOTOS[spotId];
  return own ? <Media id={own[index % own.length]} className={className} eager={eager} /> : <SpotPhoto spotId={spotId} index={index} className={className} />;
}
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fallback for browsers without scroll-driven animations: reveal `.rv` children once they enter the viewport. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || scrollDriven() || reduced() || typeof IntersectionObserver === 'undefined') return;
    root.classList.add('io');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -12% 0px'});
    root.querySelectorAll('.rv').forEach((el) => io.observe(el));
    return () => { io.disconnect(); root.classList.remove('io'); };
  }, []);
  return ref;
}

/** The selected hour's headline height, always with its honest label. */
export function headline(h: HourSample, p: UserProfile) {
  const est = faceEstimateView(h.forecast, p), u = p.heightUnit;
  if (est?.state === 'range') return {big: est.text.replace(` ${u}`, ''), unit: u, label: `Est. ${est.text} at the break · model estimate, not measured`, short: `Est. ${est.text} at the break (model estimate, not measured)`};
  if (h.heightFt !== null && Number.isFinite(h.heightFt)) { const v = ht(h.heightFt, p); return {big: v, unit: u, label: `${v} ${u} offshore · not surf size`, short: `${v} ${u} offshore, not surf size`}; }
  return {big: null, unit: u, label: 'No wave height for this hour', short: null};
}

export function CineHero({spot, h, p, isNow, meta, fav, onFav}: {spot: SurfSpot; h: HourSample; p: UserProfile; isNow: boolean; meta: string; fav: boolean; onFav: () => void}) {
  const hd = headline(h, p);
  return (
    <header className="fc-head fc-cine" data-shot="hero">
      <Shot spotId={spot.id} index={1} className="cine-shot" eager />
      {hd.big && <p className="cine-big" aria-hidden="true" style={{'--len': hd.big.length} as CSSProperties}><span key={hd.big}>{hd.big}</span><small>{hd.unit}</small></p>}
      <div className="cine-in">
        <p className="cine-when">{weekdayPT(h.timestamp)} {dayNumPT(h.timestamp)} · {timeLabelPT(h.timestamp)}{isNow ? ' · now' : ''}</p>
        <h1>{spot.name}<button className="fc-fav" aria-pressed={fav} aria-label={fav ? `Remove ${spot.name} from favourites` : `Save ${spot.name}`} onClick={onFav}><Icon name="star" size={26} /></button></h1>
        <p className="cine-h"><Condition category={h.rating.category} chip /><span className="cine-lab" key={h.timestamp}>{hd.label}</span></p>
        <p className="fc-sub">{meta}</p>
      </div>
    </header>
  );
}

const pt = (deg: number, r: number) => [160 + r * Math.sin((deg * Math.PI) / 180), 160 - r * Math.cos((deg * Math.PI) / 180)];

/** Plan view of the spot: shoreline from the surveyed shore normal, the primary swell and the wind as arrows from their directions. Not to scale. */
function SpotPlan({h, facing}: {h: HourSample; facing: number | null}) {
  const f = h.forecast, sw = f.primary && Number.isFinite(f.primary.direction) ? f.primary.direction : null, wd = Number.isFinite(f.wind.direction) ? f.wind.direction : null;
  return (
    <svg className="plan" viewBox="0 0 320 320" role="img" aria-label={`Plan view, not to scale: ${facing === null ? 'shore orientation unknown' : `beach faces ${compass(facing)}`}${sw === null ? '' : `, swell from ${compass(sw)}`}${wd === null ? '' : `, wind from ${compass(wd)}`}.`}>
      <defs><clipPath id="plan-clip"><circle cx="160" cy="160" r="150" /></clipPath></defs>
      <circle cx="160" cy="160" r="150" className="plan-ring" />
      {facing !== null && <g clipPath="url(#plan-clip)" transform={`rotate(${facing} 160 160)`}>
        <rect x="0" y="176" width="320" height="160" className="plan-land" />
        <path d="M0 176 Q 80 170 160 176 T 320 176" className="plan-shore" />
      </g>}
      {[0, 90, 180, 270].map((d) => { const [x1, y1] = pt(d, 150), [x2, y2] = pt(d, 140), [tx, ty] = pt(d, 128); return <g key={d}><line x1={x1} y1={y1} x2={x2} y2={y2} className="plan-tick" /><text x={tx} y={ty + 4} className="plan-n">{'NESW'[d / 90]}</text></g>; })}
      {sw !== null && <g transform={`rotate(${sw} 160 160)`} className="plan-swell">
        {[44, 70, 96].map((y) => <path key={y} d={`M124 ${y} Q 160 ${y - 8} 196 ${y}`} />)}
        <line x1="160" y1="30" x2="160" y2="136" /><path d="M152 124 L160 138 L168 124" />
      </g>}
      {wd !== null && <g transform={`rotate(${wd} 160 160)`} className="plan-wind" style={{color: windInk(f.wind.speed)}}>
        <line x1="160" y1="40" x2="160" y2="138" strokeDasharray="5 5" /><path d="M153 127 L160 140 L167 127" />
      </g>}
      <circle cx="160" cy="160" r="6" className="plan-spot" />
    </svg>
  );
}

function Callout({k, v, s, cls}: {k: string; v: ReactNode; s: ReactNode; cls: string}) {
  return <div className={`anno-c rv ${cls}`}><span className="k">{k}</span><span className="v">{v}</span><span className="s">{s}</span></div>;
}

export function TodayAt({spot, h, p, extrema, isToday}: {spot: SurfSpot; h: HourSample; p: UserProfile; extrema: Extremum[]; isToday: boolean}) {
  const ref = useReveal<HTMLElement>();
  const f = h.forecast, u = p.heightUnit, rel = windRelationship(spot, f), facing = facingOf(spot);
  const next = extrema.find((e) => Date.parse(e.timestamp) > Date.parse(h.timestamp) && e.height.value !== null);
  const trend = f.tide.trend === 'Rising' || f.tide.trend === 'Falling' ? f.tide.trend : null;
  const hasSwell = !!f.primary && Number.isFinite(f.primary.height);
  return (
    <section ref={ref} id="fc-today" className="fc-anno" data-shot="anno" aria-labelledby="fc-today-h">
      <h2 id="fc-today-h" className="anno-h rv">{isToday ? 'Today' : `${weekdayPT(h.timestamp)} ${dayNumPT(h.timestamp)}`} at {spot.name}</h2>
      <p className="anno-sub rv">{hourLabel(h.timestamp)} · the selected hour · plan view, not to scale</p>
      <div className="anno-grid">
        <Callout cls="c-sw" k="Swell · offshore model" v={hasSwell ? <>{ht(f.primary!.height, p)}<small> {u}</small> {Math.round(f.primary!.period)}<small> s</small></> : '—'}
          s={hasSwell ? <>from {compass(f.primary!.direction)} {Math.round(f.primary!.direction)}°{f.secondary ? ` · 2nd ${ht(f.secondary.height, p)} ${u} ${Math.round(f.secondary.period)} s ${compass(f.secondary.direction)}` : ''}</> : 'Not in this record'} />
        <Callout cls="c-wi" k="Wind" v={Number.isFinite(f.wind.speed) ? <>{windVal(f.wind.speed, p)}<small> {p.windUnit}</small></> : '—'}
          s={Number.isFinite(f.wind.direction) ? <>from {compass(f.wind.direction)} · {rel === 'Unknown' ? 'shore relation unknown' : rel.toLowerCase()}{f.wind.gusts ? ` · gust ${windVal(f.wind.gusts, p)}` : ''}</> : 'Not in this record'} />
        <div className="anno-vis rv"><SpotPlan h={h} facing={facing} /></div>
        <Callout cls="c-ti" k="Tide · San Francisco, MLLW" v={Number.isFinite(f.tide.height) ? <>{f.tide.height < 0 ? '-' : '+'}{ht(Math.abs(f.tide.height), p)}<small> {u}</small></> : '—'}
          s={<>{trend ?? 'Trend unknown'}{next ? ` · ${next.type.toLowerCase()} ${ht(next.height.value, p)} ${u} at ${timeLabelPT(next.timestamp)}` : ''}</>} />
        <Callout cls="c-wa" k="Water · sea surface model" v={f.waterTempF ? <>{Math.round(f.waterTempF)}<small> °F</small></> : '—'}
          s={f.waterTempF ? `${((f.waterTempF - 32) / 1.8).toFixed(1)} °C` : 'Not in this record'} />
      </div>
    </section>
  );
}

/** One sentence from the selected hour, lit word by word as it scrolls through. Clauses without data are left out, never filled in. */
export function litSentence(spot: SurfSpot, h: HourSample, p: UserProfile, series: HourSample[], isNow: boolean, isToday: boolean) {
  const f = h.forecast, hd = headline(h, p), rel = windRelationship(spot, f), bits: string[] = [];
  if (hd.short) bits.push(hd.short);
  if (f.primary && Number.isFinite(f.primary.period) && Number.isFinite(f.primary.direction)) bits.push(`a ${Math.round(f.primary.period)}‑second ${compass(f.primary.direction)} swell`);
  if (f.tide.trend === 'Rising' || f.tide.trend === 'Falling') bits.push(`a ${f.tide.trend.toLowerCase()} tide`);
  if (Number.isFinite(f.wind.speed) && Number.isFinite(f.wind.direction)) {
    const i = series.indexOf(h), turn = rel === 'Unknown' ? undefined : series.slice(i + 1).find((x) => x.date === h.date && windRelationship(spot, x.forecast) !== rel && windRelationship(spot, x.forecast) !== 'Unknown');
    bits.push(`${windVal(f.wind.speed, p)} ${p.windUnit} ${rel === 'Unknown' ? '' : `${rel.toLowerCase()} `}${compass(f.wind.direction)} wind${turn ? `, turning ${windRelationship(spot, turn.forecast).toLowerCase()} by ${hourLabel(turn.timestamp)}` : ''}`);
  }
  const when = isNow ? 'right now' : isToday ? `today at ${hourLabel(h.timestamp)}` : `on ${weekdayPT(h.timestamp)} at ${hourLabel(h.timestamp)}`;
  const head = `${conditionWord(h.rating.category)} at ${spot.name} ${when}`;
  // Numbers stay on one line with their units, so a word-by-word reveal never splits '8.9 mph'.
  const glue = (t: string) => t.replace(/(\d) (ft|m|mph|kts|km\/h|AM|PM)\b/g, '$1\u00a0$2');
  if (!bits.length) return `${head}.`;
  const [first, ...rest] = bits;
  return glue(`${head}: ${first}${rest.length ? `, with ${rest.length > 1 ? `${rest.slice(0, -1).join(', ')} and ${rest[rest.length - 1]}` : rest[0]}` : ''}.`);
}

export function LitLine({text}: {text: string}) {
  const ref = useRef<HTMLDivElement>(null);
  const words = text.split(' ');
  useEffect(() => {
    const root = ref.current;
    if (!root || scrollDriven() || reduced() || typeof IntersectionObserver === 'undefined') return;
    root.classList.add('io');
    const spans = Array.from(root.querySelectorAll<HTMLElement>('.w'));
    // Progress through the pinned stretch; the scroll listener only runs while the block is on screen.
    let raf = 0;
    const paint = () => { raf = 0; const r = root.getBoundingClientRect(), prog = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight) / 0.9)); spans.forEach((s, i) => s.classList.toggle('on', i < prog * spans.length)); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { addEventListener('scroll', onScroll, {passive: true}); paint(); } else removeEventListener('scroll', onScroll); });
    io.observe(root);
    return () => { io.disconnect(); removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); root.classList.remove('io'); };
  }, [text]);
  return (
    <div ref={ref} className="fc-lit" data-shot="lit">
      <p className="lit" style={{'--n': words.length} as CSSProperties}>{words.map((w, i) => <span key={i} className="w" style={{'--i': i} as CSSProperties}>{w} </span>)}</p>
    </div>
  );
}

/** Full-bleed photograph that drifts slower than the page, with one line of display type. */
export function Band({spotId, index, children, shot}: {spotId: string; index: number; children: ReactNode; shot: string}) {
  return (
    <section className="cine-band" data-shot={shot}>
      <Shot spotId={spotId} index={index} className="band-shot" />
      <h2 className="band-h">{children}</h2>
    </section>
  );
}

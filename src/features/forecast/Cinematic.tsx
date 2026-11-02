import {useEffect, useRef, type CSSProperties, type ReactNode} from 'react';
import type {SurfSpot, UserProfile} from '../../models/index';
import {evidenceSpots} from '../../ocean/spots';
import {windRelationship} from '../../recommendation/sqi';
import {SpotPhoto} from '../../ui/common';
import {Media} from '../../ui/Media';
import {SeaState} from './SeaState';
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
  const f = h.forecast, est = faceEstimateView(f, p), u = p.heightUnit;
  if (est?.state === 'range') { const [n, ...unit] = est.text.split(' '); return {big: n, unit: unit.join(' '), label: `Est. ${est.text} at the break · model estimate, not measured`, short: `Est. ${est.text} at the break (model estimate, not measured)`}; }
  // Demonstration records carry an illustrative face height; it is never presented as offshore Hs.
  if (f.availability.face && Number.isFinite(f.face)) { const v = ht(f.face, p); return {big: v, unit: u, label: `${v} ${u} demonstration face · not live data`, short: `${v} ${u} demonstration face, not live data`}; }
  if (Number.isFinite(f.offshore)) { const v = ht(f.offshore, p); return {big: v, unit: u, label: `${v} ${u} offshore · not surf size`, short: `${v} ${u} offshore, not surf size`}; }
  return {big: null, unit: u, label: 'No wave height for this hour', short: null};
}

export function CineHero({spot, h, p, isNow, meta, fav, onFav, onScale}: {spot: SurfSpot; h: HourSample; p: UserProfile; isNow: boolean; meta: string; fav: boolean; onFav: () => void; onScale: () => void}) {
  const hd = headline(h, p);
  return (
    <header className="fc-head fc-cine" data-shot="hero">
      {/* T-038: the backdrop is this hour's swell and wind, drawn from the data (no AI imagery on condition pages). */}
      <SeaState f={h.forecast} className="cine-shot" caption="full" />
      {hd.big &&<p className="cine-big" aria-hidden="true" style={{'--len': hd.big.length} as CSSProperties}><span key={hd.big}>{hd.big}</span><small>{hd.unit}</small></p>}
      <div className="cine-in">
        <p className="cine-when">{weekdayPT(h.timestamp)} {dayNumPT(h.timestamp)} · {timeLabelPT(h.timestamp)}{isNow ? ' · now' : ''}</p>
        <h1>{spot.name}<button className="fc-fav" aria-pressed={fav} aria-label={fav ? `Remove ${spot.name} from favourites` : `Save ${spot.name}`} onClick={onFav}><Icon name="star" size={26} /></button></h1>
        <p className="cine-h"><Condition category={h.rating.category} chip /><span className="cine-lab" key={h.timestamp}>{hd.label}</span></p>
        <AnswerRow spot={spot} h={h} p={p} onScale={onScale} />
        <p className="fc-sub">{meta}</p>
      </div>
    </header>
  );
}

/** Wind and tide for the selected hour, in the hero so the first screen answers "how is it". Each value keeps its unit and relation; missing values say so. */
function AnswerRow({spot, h, p, onScale}: {spot: SurfSpot; h: HourSample; p: UserProfile; onScale: () => void}) {
  const f = h.forecast, rel = windRelationship(spot, f), trend = f.tide.trend === 'Rising' || f.tide.trend === 'Falling' ? f.tide.trend.toLowerCase() : null;
  const windOk = Number.isFinite(f.wind.speed), tideOk = Number.isFinite(f.tide.height);
  return (
    <ul className="cine-facts" aria-label="Wind and tide for this hour">
      <li><span>Wind</span><b>{windOk ? `${windVal(f.wind.speed, p)} ${p.windUnit}` : '—'}</b>
        <em>{windOk && Number.isFinite(f.wind.direction) ? `${compass(f.wind.direction)} · ${rel === 'Unknown' ? 'shore relation unknown' : rel.toLowerCase()}` : 'not in this record'}</em></li>
      <li><span>Tide</span><b>{tideOk ? `${f.tide.height < 0 ? '-' : '+'}${ht(Math.abs(f.tide.height), p)} ${p.heightUnit}` : '—'}</b><em>{tideOk ? (trend ?? 'trend unknown') : 'not in this record'}</em></li>
      <li className="cine-scale"><button type="button" onClick={onScale}>Wave scale<Icon name="forecast" size={14} /></button></li>
    </ul>
  );
}

/** The spot's own photograph with its credit (or, for spots without one, a generic photo labelled as such). Real photography, never the AI hero. */
export function SpotShot({spotId}: {spotId: string}) {
  return <Shot spotId={spotId} index={0} className="spot-shot" />;
}

/** One short paragraph from the selected hour (replaces the full-screen lit sentence). Clauses without data are left out by litSentence. */
export function Summary({text}: {text: string}) {
  return <p className="fc-summary">{text}</p>;
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
  const next = extrema.find((e) => Date.parse(e.timestamp) > Date.parse(h.timestamp));
  const trend = f.tide.trend === 'Rising' || f.tide.trend === 'Falling' ? f.tide.trend : null;
  const pr = f.primary && Number.isFinite(f.primary.height) ? f.primary : null, se = f.secondary && Number.isFinite(f.secondary.height) ? f.secondary : null;
  const fin = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
  const swellBits = (s: NonNullable<typeof pr>) => [fin(s.period) ? `${Math.round(s.period)} s` : null, fin(s.direction) ? compass(s.direction) : null].filter(Boolean).join(' ');
  return (
    <section ref={ref} id="fc-today" className="fc-anno" data-shot="anno" aria-labelledby="fc-today-h">
      <h2 id="fc-today-h" className="anno-h rv">{isToday ? 'Today' : `${weekdayPT(h.timestamp)} ${dayNumPT(h.timestamp)}`} at {spot.name}</h2>
      <p className="anno-sub rv">{hourLabel(h.timestamp)} · the selected hour · plan view, not to scale</p>
      <div className="anno-grid">
        <Callout cls="c-sw" k="Swell · offshore model" v={pr ? <>{ht(pr.height, p)}<small> {u}</small> {fin(pr.period) ? <>{Math.round(pr.period)}<small> s</small></> : <small>period —</small>}</> : '—'}
          s={pr ? <>{fin(pr.direction) ? `from ${compass(pr.direction)} ${Math.round(pr.direction)}°` : 'direction not in record'}{se ? ` · 2nd ${ht(se.height, p)} ${u} ${swellBits(se)}`.trimEnd() : ''}</> : 'Not in this record'} />
        <Callout cls="c-wi" k="Wind" v={Number.isFinite(f.wind.speed) ? <>{windVal(f.wind.speed, p)}<small> {p.windUnit}</small></> : '—'}
          s={Number.isFinite(f.wind.direction) ? <>from {compass(f.wind.direction)} · {rel === 'Unknown' ? 'shore relation unknown' : rel.toLowerCase()}{fin(f.wind.gusts) ? ` · gust ${windVal(f.wind.gusts, p)}` : ''}</> : 'Not in this record'} />
        <div className="anno-vis rv"><SpotPlan h={h} facing={facing} /></div>
        <Callout cls="c-ti" k="Tide · San Francisco, MLLW" v={Number.isFinite(f.tide.height) ? <>{f.tide.height < 0 ? '-' : '+'}{ht(Math.abs(f.tide.height), p)}<small> {u}</small></> : '—'}
          s={<>{trend ?? 'Trend unknown'}{next ? ` · ${next.type.toLowerCase()} ${next.height.value === null ? '(height not in record)' : `${ht(next.height.value, p)} ${u}`} at ${timeLabelPT(next.timestamp)}` : ''}</>} />
        <Callout cls="c-wa" k="Water · sea surface model" v={fin(f.waterTempF) ? <>{Math.round(f.waterTempF)}<small> °F</small></> : '—'}
          s={fin(f.waterTempF) ? `${((f.waterTempF - 32) / 1.8).toFixed(1)} °C` : 'Not in this record'} />
      </div>
    </section>
  );
}

/** One sentence from the selected hour, shown as the summary paragraph. Clauses without data are left out, never filled in. */
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
  // Numbers stay on one line with their units.
  const glue = (t: string) => t.replace(/(\d) (ft|m|mph|kts|km\/h|AM|PM)\b/g, '$1\u00a0$2');
  if (!bits.length) return `${head}.`;
  const [first, ...rest] = bits;
  return glue(`${head}: ${first}${rest.length ? `, with ${rest.length > 1 ? `${rest.slice(0, -1).join(', ')} and ${rest[rest.length - 1]}` : rest[0]}` : ''}.`);
}

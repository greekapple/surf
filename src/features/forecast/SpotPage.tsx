import {useMemo, useRef, type CSSProperties, type ReactNode} from 'react';
import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import type {ObservationSet, TidePrediction} from '../../ocean/types';
import {windRelationship} from '../../recommendation/sqi';
import {scoreBoard} from '../../recommendation/board';
import {DirArrow, Icon} from '../../ui/Icon';
import {rankBoards, recommended} from '../quiver/fit';
import {isDark} from './trustApi';
import {SCALE_BANDS, selectScaleBand} from '../../services/waveScale';
import {dayRange} from '../../services/spotHour';
import {dayText} from '../../services/weekCell';
import {pacificDate} from '../../ocean/time';
import {explainRating, type FactorExplanation} from '../../ratings/explain';
import {evidenceSpots} from '../../ocean/spots';
import {BAND_COLOR, bandOf, hourLabel, type HourSample} from './model';
import {compass, ht, monotonePath, windVal, type Day} from './helpers';
import {conditionWord} from './Condition';
import {timeLabelPT, weekdayPT, dayNumPT} from './format';
import {hourFreshness} from '../../services/freshness';
import {StaleTag} from '../../ui/StaleTag';
import {headlineSurf, headlineText, type HeadlineSurf} from '../../services/headlineSurf';
import {formatHeight, userHeight} from '../../services/heightMath';
import type {OceanBundle} from '../../ocean/types';

/* T-045 spot page v3: Surfline's anatomy, each fact once. Conditions grid → Board Match line → 7-day strip → graph/table → nearshore + buoy → sources. */

export const relClass = (rel: string) => (/^offshore/i.test(rel) ? 'off' : /cross/i.test(rel) ? 'cross' : /onshore/i.test(rel) ? 'on' : 'unk');
const relWord = (rel: string) => (rel === 'Unknown' ? 'shore relation unknown' : rel.toLowerCase());
const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** The surf headline for one hour, with the display strings. */
export function surfOf(spot: SurfSpot, f: Forecast, p: UserProfile, bundle: OceanBundle | null | undefined, now: number) {
  const h = headlineSurf(spot.id, f, {bundle, nowMs: now});
  return {h, t: headlineText(h, p)};
}

export type CardKey = 'rating' | 'wind' | 'tide' | 'swell';
function Card({k, title, aside, children, className = '', open, onToggle}: {k: string; title: string; aside?: ReactNode; children: ReactNode; className?: string; open?: boolean; onToggle?: () => void}) {
  return (
    <section className={`sp-card ${className}${onToggle ? ' can-open' : ''}`} data-card={k} data-open={open || undefined} aria-label={title}>
      <header><h2>{title}</h2>{aside}
        {onToggle && <button className="sp-open" aria-expanded={!!open} aria-controls="sp-detail" aria-label={`${open ? 'Hide' : 'Show'} ${title.toLowerCase()} detail`} onClick={onToggle}><Icon name="chevron" size={14} /></button>}
      </header>
      {children}
    </section>
  );
}

/** The spot's surveyed shore normal (degrees the beach faces), or null when not surveyed. */
export const facingOf = (spotId: string) => evidenceSpots.find((e) => e.id === spotId)?.orientation ?? null;

/** Mini wind compass: the arrow points where the wind blows; the beach facing (when surveyed) is the dashed line, offshore side shaded. */
function WindDial({from, facing, cls}: {from: number; facing: number | null; cls: string}) {
  return (
    <svg className="sp-mini" viewBox="-30 -30 60 60" aria-hidden="true">
      <circle r={26} fill="none" stroke="var(--line-2)" />
      {facing !== null && <g transform={`rotate(${facing})`}><path d="M0 0 L-26 0 A26 26 0 0 1 26 0Z" transform="rotate(180)" fill="color-mix(in srgb, var(--good) 12%, transparent)" /><line x1={-26} x2={26} y1={0} y2={0} stroke="var(--muted)" strokeDasharray="3 2" transform="rotate(90)" /></g>}
      <text y={-17} fontSize={8} textAnchor="middle" fill="var(--dim)">N</text>
      <g transform={`rotate(${from + 180})`} className={`sp-rel-ink ${cls}`}><line x1={0} y1={18} x2={0} y2={-14} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" /><path d="M-6 -9 L0 -19 L6 -9" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></g>
    </svg>
  );
}

/** Mini swell rose: one arrow per partition, travelling toward the centre from where it comes; width and length by energy (H² × T). */
function SwellRose({swells, facing}: {swells: {height: number; period: number; direction: number}[]; facing: number | null}) {
  const e = swells.map((s) => s.height * s.height * s.period), max = Math.max(...e, 1e-6);
  return (
    <svg className="sp-mini" viewBox="-30 -30 60 60" aria-hidden="true">
      <circle r={26} fill="none" stroke="var(--line-2)" />
      {facing !== null && <line x1={0} y1={0} x2={0} y2={-26} transform={`rotate(${facing})`} stroke="var(--muted)" strokeDasharray="3 2" />}
      <text y={-17} fontSize={8} textAnchor="middle" fill="var(--dim)">N</text>
      {swells.map((s, i) => { const r = e[i] / max, len = 10 + 14 * Math.sqrt(r); return (
        <g key={i} transform={`rotate(${s.direction})`} stroke={i === 0 ? 'var(--sw1)' : 'var(--sw2)'} fill={i === 0 ? 'var(--sw1)' : 'var(--sw2)'}>
          <line x1={0} y1={-26} x2={0} y2={-26 + len} strokeWidth={1.5 + 3.5 * Math.sqrt(r)} strokeLinecap="round" />
          <path d={`M-${3 + 2 * r} ${-26 + len} L0 ${-26 + len + 6} L${3 + 2 * r} ${-26 + len}Z`} stroke="none" />
        </g>
      ); })}
    </svg>
  );
}

/** T-067: each reason is a condition dot plus a word (good, fair, poor, unknown), not a check mark. */
const MARK: Record<FactorExplanation['effect'], {m: string; c: string}> = {'+': {m: 'good', c: 'g'}, '~': {m: 'fair', c: 'm'}, '-': {m: 'poor', c: 'b'}, '?': {m: 'unknown', c: 'u'}};

/** 5-segment rating bar (Surfline): segments filled by score, coloured by the rating band. */
function RatingBar({score, category}: {score: number | null; category: string}) {
  const n = score === null ? 0 : Math.max(1, Math.min(5, Math.ceil(score / 20)));
  return <span className="sp-bar" aria-hidden="true">{Array.from({length: 5}, (_, i) => <i key={i} style={{background: i < n ? BAND_COLOR[bandOf(category)] : undefined}} />)}</span>;
}

/** Short names for the rating's factors (the full name and reason stay in the tooltip). */
const shortFactor = (n: string) => (/organi[sz]ation/i.test(n) ? 'Swell quality' : /wave potential|swell size|wave size|size/i.test(n) ? 'Swell size' : /wind/i.test(n) ? 'Wind' : /tide/i.test(n) ? 'Tide' : /period/i.test(n) ? 'Period' : /window|direction|exposure/i.test(n) ? 'Swell window' : n);

/** Wetsuit by water temperature (°F): a common surf-shop guide, labelled as such. */
const wetsuit = (f: number) => (f >= 72 ? 'Boardshorts or a top' : f >= 65 ? '2 mm spring suit' : f >= 62 ? '3/2 mm full suit' : f >= 58 ? '4/3 mm full suit' : f >= 52 ? '4/3 mm + booties' : f >= 48 ? '5/4 mm hooded + booties' : '6/5 mm hooded, booties, gloves');

export function ConditionsGrid({spot, h, p, dayHours, extrema, bundle, now, scale, observe, observeEntry, breaker, open, onToggle}: {spot: SurfSpot; h: HourSample; p: UserProfile; dayHours: HourSample[]; extrema: TidePrediction[]; bundle: OceanBundle | null | undefined; now: number; scale?: ReactNode; observe?: ReactNode; observeEntry?: ReactNode; breaker?: string | null; open: CardKey | null; onToggle: (k: CardKey) => void}) {
  const f = h.forecast, r = h.rating, u = p.heightUnit, {h: hs, t} = surfOf(spot, f, p, bundle, now);
  const rel = f.availability.wind && fin(f.wind.speed) ? windRelationship(spot, f) : 'Unknown';
  // The rating explains itself (T-049 explainRating): scored factors as ticks on the card; context items (nearshore, tide) in the detail.
  const ex = ratingWhy(spot, h, p);
  const scored = ex.items.filter((x) => x.inScore).slice(0, 4);
  const facing = facingOf(spot.id);
  const swells = [f.primary, f.secondary, f.tertiary].filter((s): s is NonNullable<typeof s> => !!s && fin(s.height) && s.height > 0.05);
  const tideOk = f.availability.tide !== false && fin(f.tide.height);
  const water = fin(f.waterTempF) ? f.waterTempF : null;
  return (
    <div className="sp-grid">
      <Card k="surf" title="Surf" aside={observeEntry}>
        {/* Offshore Hs keeps one decimal, like every other offshore value on the page (the chart, the table). */}
        <p className="v sp-v" aria-label={t.label}>{hs.kind === 'offshore' ? <>{ht(hs.ft, p)}<small>{u}</small></> : t.value === '—' ? '—' : <>{t.value.replace(/ (ft|m)( ≈ Hawaiian)?$/, '')}<small>{t.value.match(/ (ft|m)( ≈ Hawaiian)?$/)?.[0]}</small></>}</p>
        <p className="sp-s">{hs.kind === 'estimate' ? <>{t.words ? <b className="sp-words">{t.words[0].toUpperCase() + t.words.slice(1)}</b> : null} <span title={hs.wordsNote}>surf height</span></> : t.detail}</p>
        {breaker && <p className="sp-brk">est. breaker type: <b>{breaker}</b></p>}
        {hs.kind === 'estimate' ? <p className="sp-f" title={hs.methodLabel}>{hs.saved ? `${hs.saved.reason === 'saved' ? 'saved copy' : 'stale data'} · retrieved ${hs.saved.retrievedAt && Number.isFinite(Date.parse(hs.saved.retrievedAt)) ? timeLabelPT(hs.saved.retrievedAt) : 'at an unknown time'} · not current` : 'model estimate'}<span className="sr-only"> {hs.methodLabel.replace(/^Model estimate /, '')}</span></p> : hs.kind === 'demonstration' ? <p className="sp-f">demonstration week, not live</p> : null}
        {observe}
      </Card>
      {scale && <Card k="scale" title="Wave scale">{scale}</Card>}
      <Card k="rating" title="Rating" open={open === 'rating'} onToggle={() => onToggle('rating')}>
        <p className={`v sp-v sp-rate${r.score === null ? ' unr' : ''}`} style={{'--c': BAND_COLOR[bandOf(r.category)]} as CSSProperties}>{(r as {dark?: boolean}).dark ? 'Not rated' : conditionWord(r.category)}</p>
        <RatingBar score={r.score} category={r.category} />
        {scored.length ? <ul className="sp-why" aria-label="Why">{/* T-108: with no surf estimate there is no "swell size" to rate: the engine's wave-potential factor is OFFSHORE swell energy, so it is named that, and the list says plainly that size has no estimate here. */}
          {hs.kind !== 'estimate' && <li className="sp-why-none" title="No surf-size estimate for this spot, so surf size is not part of the call"><i aria-hidden="true" />Swell size: no estimate</li>}
          {scored.map((x) => <li key={x.factor} className={MARK[x.effect].c} title={`${x.factor}: ${x.reason}`}><i aria-hidden="true" />{hs.kind !== 'estimate' && shortFactor(x.factor) === 'Swell size' ? 'Offshore swell energy' : shortFactor(x.factor)} <span className="w">{MARK[x.effect].m}</span></li>)}</ul>
          : <p className="sp-s">{r.explanation}</p>}
        <p className="sp-f">provisional · {r.reliability.category.toLowerCase()} reliability</p>
      </Card>
      <Card k="wind" title="Wind" open={open === 'wind'} onToggle={() => onToggle('wind')}>
        {f.availability.wind !== false && fin(f.wind.speed) ? <>
          <p className="v sp-v">{windVal(f.wind.speed, p)}<small>{p.windUnit}</small><StaleTag s={hourFreshness(f, now).wind} />{fin(f.wind.direction) && <span className="sp-dir"><DirArrow from={f.wind.direction} size={16} /> {compass(f.wind.direction)}</span>}</p>
          <p className="sp-s"><span className={`sp-rel ${relClass(rel)}`}>{relWord(rel)}</span>{fin(f.wind.gusts) && <> · gusts {windVal(f.wind.gusts, p)} {p.windUnit}</>}</p>
          {fin(f.wind.direction) && <WindDial from={f.wind.direction} facing={facing} cls={relClass(rel)} />}
        </> : <p className="sp-s">Wind not in this record.</p>}
      </Card>
      <Card k="tide" title="Tide" open={open === 'tide'} onToggle={() => onToggle('tide')}>
        {tideOk ? <>
          <p className="v sp-v">{f.tide.height < 0 ? '−' : ''}{ht(Math.abs(f.tide.height), p)}<small>{u}</small><StaleTag s={hourFreshness(f, now).tide} /><span className="sp-trend">{f.tide.trend === 'Rising' ? '▲ rising' : f.tide.trend === 'Falling' ? '▼ falling' : ''}</span></p>
          <TideMini hours={dayHours} at={h.timestamp} extrema={f.tide.extrema?.length ? f.tide.extrema.map((e) => ({timestamp: e.timestamp, v: e.height, type: e.type})) : extrema.filter((e) => e.height.value !== null).map((e) => ({timestamp: e.timestamp, v: e.height.value!, type: e.type}))} p={p} />
          <p className="sp-f">NOAA station prediction, not at the beach</p>
        </> : <p className="sp-s">No tide station near this spot.</p>}
      </Card>
      <Card k="swell" title="Swell" open={open === 'swell'} onToggle={() => onToggle('swell')}>
        {swells.length ? <ul className="sp-swells">{swells.map((s, i) => (
          <li key={i}><b>{ht(s.height, p)}<small>{u}</small></b><span>{Math.round(s.period)}<small>s</small></span><span className="sp-dir"><DirArrow from={s.direction} size={13} color={i === 0 ? 'var(--sw1)' : 'var(--sw2)'} /> {compass(s.direction)}<span className="sp-deg"> {Math.round(s.direction)}°</span></span></li>
        ))}</ul> : <p className="sp-s">No swell partitions in this record.</p>}
        {swells.length > 0 && <SwellRose swells={swells} facing={facing} />}
        <p className="sp-f">Offshore model partitions</p>
      </Card>
      <Card k="water" title="Water">
        {water !== null ? <>
          <p className="v sp-v">{Math.round(water)}<small>°F</small></p>
          <p className="sp-s"><b>{wetsuit(water)}</b></p>
          <p className="sp-f">Wetsuit: common surf-shop guide</p>
        </> : <p className="sp-s">Water temperature not in this record.</p>}
      </Card>
    </div>
  );
}

/** Today's tide as a small curve: the selected hour marked, highs and lows labelled with time. */
function TideMini({hours, at, extrema, p}: {hours: HourSample[]; at: string; extrema: {timestamp: string; v: number; type: string}[]; p: UserProfile}) {
  const pts = hours.filter((h) => fin(h.forecast.tide.height));
  if (pts.length < 4) return null;
  const W = 260, H = 64, t0 = Date.parse(pts[0].timestamp), span = Date.parse(pts[pts.length - 1].timestamp) - t0 || 1;
  const vs = pts.map((h) => h.forecast.tide.height), lo = Math.min(...vs) - 0.4, hi = Math.max(...vs) + 0.4;
  const X = (ms: number) => ((ms - t0) / span) * W, Y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 22);
  const line = monotonePath(pts.map((h) => [X(Date.parse(h.timestamp)), Y(h.forecast.tide.height)]));
  const k = pts.find((h) => h.timestamp === at), ex = extrema.filter((e) => { const m = Date.parse(e.timestamp); return m >= t0 && m <= t0 + span; });
  return (
    <svg className="sp-tide" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tide today: ${ex.map((e) => `${e.type.toLowerCase()} ${ht(e.v, p)} ${p.heightUnit} at ${timeLabelPT(e.timestamp)}`).join(', ') || 'no highs or lows listed'}`}>
      <path d={`${line} L${W},${H - 14} L0,${H - 14}Z`} fill="var(--tide)" fillOpacity={0.12} /><path d={line} fill="none" stroke="var(--tide)" strokeWidth={1.6} />
      {ex.map((e) => { const x = X(Date.parse(e.timestamp)); return <text key={e.timestamp} x={Math.min(W - 22, Math.max(22, x))} y={H - 2} fontSize={10} textAnchor="middle" fill="var(--muted)">{timeLabelPT(e.timestamp).replace(':00', '').replace(' ', '')} {e.type === 'High' ? 'H' : 'L'}</text>; })}
      {k && <circle cx={X(Date.parse(k.timestamp))} cy={Y(k.forecast.tide.height)} r={3.5} fill="var(--text)" />}
    </svg>
  );
}

/** Board Match in one line (Surfline's "Ride an all-rounder"): the best board from the user's quiver for this hour, or why there is none. */
/** The best eligible board in the quiver for this hour (Board Match), or null. */
export function bestBoard(boards: import('../../models/index').Surfboard[], f: Forecast, p: UserProfile, hs: HeadlineSurf) {
  const range: [number, number] | null = hs.kind === 'estimate' ? [hs.loFt, hs.hiFt] : null;
  return boards.map((b) => scoreBoard(b, f, p, range)).filter((m) => m.eligible).sort((a, b) => b.score - a.score)[0] ?? null;
}
export const feetInches = (inches: number) => `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;

/** T-065: the board for these waves, from size + period (wave shape is unknown). No row at all when nothing can be recommended. */
export function BoardLine({boards, choice, f, p, hs, onOpen}: {boards: import('../../models/index').Surfboard[]; choice: import('../quiver/fit').BoardChoice; f: Forecast; p: UserProfile; hs: HeadlineSurf; onOpen: () => void; onQuiver?: () => void}) {
  const est: [number, number] | null = hs.kind === 'estimate' ? [hs.loFt, hs.hiFt] : null;
  const period = f.primary && Number.isFinite(f.primary.period) ? f.primary.period : null;
  const top = useMemo(() => (choice.pick ? choice.ranked.find((r) => r.board === choice.pick) ?? null : null), [choice]); // T-108: the one board pick, not a second ranking
  if (!top || top.size.state === 'none') return null;
  return (
    <section className="sp-board" aria-label="Board Match">
      <p>Ride your <b>{top.board.name}</b> ({feetInches(top.board.length)} {top.board.type.toLowerCase()}): it suits {top.size.board[0]}–{top.size.board[1]} {p.heightUnit === 'm' ? 'ft' : 'ft'}{period !== null ? `, ${Math.round(period)} s ${top.period?.fit === 'ok' ? 'period suits it' : 'period, ' + (top.period?.note ?? '')}` : ''}. <span className="fine">Wave shape unknown.</span></p>
      <button className="sp-link" onClick={onOpen}>Board Match</button>
    </section>
  );
}

const median = (v: number[]) => { const a = [...v].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const BLOCKS = [{label: 'AM', hour: 7}, {label: 'Midday', hour: 12}, {label: 'PM', hour: 17}] as const;
/** 7-day strip (Surfline): day, surf range, AM/midday/PM rating segments, three wind arrows, best day star. */
export function DayStrip({days, series, spot, p, bundle, now, cur, best, onPick}: {days: Day[]; series: HourSample[]; spot: SurfSpot; p: UserProfile; bundle: OceanBundle | null | undefined; now: number; cur: number; best: number; onPick: (k: number) => void}) {
  const today = weekdayPT(new Date(now).toISOString());
  // Drag across the strip with a mouse to scrub days; every card follows the selected hour live.
  const scrub = useRef(false);
  let selNote: string | null = null;
  const strip = (
    <nav className="sp-days days" aria-label="Forecast days" data-scrub={scrub.current || undefined}
      onPointerDown={(e) => { if (e.pointerType === 'mouse' && e.button === 0) scrub.current = true; }}
      onPointerMove={(e) => { if (!scrub.current || !(e.buttons & 1)) { scrub.current = false; return; } const k = Number((document.elementFromPoint(e.clientX, e.clientY)?.closest('.sp-day') as HTMLElement | null)?.dataset.k); if (Number.isFinite(k) && k !== cur) onPick(k); }}
      onPointerUp={() => { scrub.current = false; }} onPointerLeave={() => { scrub.current = false; }}>
      {days.map((d, k) => {
        if (d.end - d.start < 11) return null;
        const hrs = series.slice(d.start, d.end + 1), day = hrs.filter((x) => x.hour >= 6 && x.hour <= 19);
        // One engine for every surface (T-055): the day's range comes from dayRange over its daylight hours, the same headline estimate as the
        // SURF card. The demonstration week (no estimate, no offshore) keeps its typical face height, labelled demo.
        const dr = dayRange(spot, hrs.map((x) => x.forecast), pacificDate(d.t), now, p, {bundle});
        const demo = dr.kind === 'none' ? day.map((x) => surfOf(spot, x.forecast, p, bundle, now).h).filter((x): x is Extract<HeadlineSurf, {kind: 'demonstration'}> => x.kind === 'demonstration') : [];
        // T-057: the card's main number is the estimate at ONE hour (best daylight hour, else the median one), via spotHour; the full envelope is "range over daylight" below.
        const ty = dr.typical, env = dr.kind !== 'none' && dr.loFt !== null && dr.hiFt !== null ? [dr.loFt, dr.hiFt] : null;
        const range = ty ? [ty.loFt, ty.hiFt] : demo.length ? [median(demo.map((x) => x.ft)), median(demo.map((x) => x.ft))] : null;
        const kind = dr.kind === 'estimate' ? 'est.' : dr.kind === 'offshore' ? 'offshore' : demo.length ? 'demo' : '';
        // T-112: the main number is the SAME text the week grid shows (dayText: the midday hour's headline value, in the person's unit and scale); the demo week keeps its own median.
        const dt = dayText(ty), lo = range ? ht(range[0], p, 0) : null, hi = range ? ht(range[1], p, 0) : null, mainNum = dt ? dt.numbers : lo === hi ? (lo ?? '—') : `${lo}–${hi}`, unitSuffix = dt ? dt.full.slice(dt.numbers.length).trim() : p.heightUnit;
        const envText = env && dr.label ? `${dr.label.replace(/^Est\. /, '').replace(/ offshore$/, '')}${dr.kind === 'offshore' ? ` ${p.heightUnit}` : ''}` : null;
        const blocks = BLOCKS.map((b) => ({...b, h: hrs.find((x) => x.hour === b.hour)}));
        if (k === cur && env) selNote = `Range over daylight: ${envText} (${kind === 'est.' ? 'estimated' : kind}, ${dr.hours} daylight hours)`;
        const name = weekdayPT(d.t) === today && k === 0 ? 'Today' : `${weekdayPT(d.t)} ${dayNumPT(d.t)}`;
        return (
          <button key={d.key} className="sp-day day" data-k={k} aria-pressed={k === cur} onClick={() => onPick(k)}
            aria-label={`${name}: ${range ? `typically ${mainNum.replace('–', ' to ')} ${unitSuffix} ${kind === 'est.' ? 'estimated' : kind}${ty ? `, ${ty.aria}` : ''}${envText ? `; range over daylight ${envText.replace('–', ' to ')}` : ''}` : 'no height'}; ${blocks.map((b) => `${b.label} ${b.h ? conditionWord(b.h.rating.category) : 'no rating'}`).join(', ')}${k === best ? '; best day' : ''}`}>
            <span className="sd-t">{name}{k === best && <span className="sd-star" role="img" aria-label="Best day of the week" title="Best day of the week: the highest average rating over its 6 AM–7 PM hours. The call's window above is the best stretch within one day."><Icon name="star" size={12} /></span>}</span>
            <span className="sd-h">{range ? <>{mainNum}<small>{unitSuffix}</small></> : '—'}</span>
            <span className="sd-k" title={ty ? ty.aria : undefined}>{kind}{ty ? ` · ${ty.short}` : ''}</span>
            <span className="sd-w" aria-hidden="true">{blocks.map((b) => b.h && fin(b.h.forecast.wind.direction) ? <i key={b.label} className={`sp-rel-ink ${relClass(windRelationship(spot, b.h.forecast))}`}><DirArrow from={b.h.forecast.wind.direction} size={12} /></i> : <i key={b.label} />)}</span>
            <span className="sd-q" aria-hidden="true">{blocks.map((b) => { const dark = !!b.h && isDark(spot.id, b.h.timestamp); return <i key={b.label} className={dark ? 'dark' : undefined} title={dark ? `${b.label}: dark, no rating` : undefined} style={{background: dark ? 'var(--ch-night-strong, #2b3a46)' : b.h ? BAND_COLOR[bandOf(b.h.rating.category)] : 'var(--none)'}} />; })}</span>
          </button>
        );
      })}
    </nav>
  );
  return <>{strip}{selNote && <p className="sp-dayrange">{selNote}</p>}</>;
}

/** Magicseaweed-style 3-hour table for the selected day: wind cells coloured by shore relation. */
export function HourTable({hours, spot, p, bundle, now, selected, onSelect}: {hours: HourSample[]; spot: SurfSpot; p: UserProfile; bundle: OceanBundle | null | undefined; now: number; selected: string | null; onSelect: (t: string) => void}) {
  const rows = hours.filter((x) => x.hour % 3 === 0);
  const u = p.heightUnit;
  return (
    <div className="tscroll" role="region" tabIndex={0} aria-label="3-hour forecast table (scrolls sideways)">
      <table className="sp-table">
        <thead><tr><th>Time</th><th>Surf</th><th>Rating</th><th>Primary swell</th><th>Secondary</th><th>Wind</th><th>Tide</th></tr></thead>
        <tbody>{rows.map((x) => {
          const f = x.forecast, {h: hs, t} = surfOf(spot, f, p, bundle, now), rel = fin(f.wind.speed) ? windRelationship(spot, f) : 'Unknown';
          return (
            <tr key={x.timestamp} aria-current={x.timestamp === selected ? 'true' : undefined}>
              <th scope="row"><button onClick={() => onSelect(x.timestamp)}>{hourLabel(x.timestamp)}</button></th>
              <td className="st-surf"><b>{t.value}</b><small>{hs.kind === 'estimate' ? 'est.' : hs.kind === 'offshore' ? 'offshore' : hs.kind === 'demonstration' ? 'demo' : ''}</small></td>
              <td><span className="st-q" style={{background: BAND_COLOR[bandOf(x.rating.category)]}} />{conditionWord(x.rating.category)}</td>
              <td>{f.primary && fin(f.primary.height) ? <>{ht(f.primary.height, p)} {u} · {Math.round(f.primary.period)} s <DirArrow from={f.primary.direction} size={12} /></> : '—'}</td>
              <td>{f.secondary && fin(f.secondary.height) ? <>{ht(f.secondary.height, p)} {u} · {Math.round(f.secondary.period)} s <DirArrow from={f.secondary.direction} size={12} /></> : '—'}</td>
              <td className={`st-wind ${relClass(rel)}`}>{fin(f.wind.speed) ? <>{fin(f.wind.direction) && <DirArrow from={f.wind.direction} size={12} />} {windVal(f.wind.speed, p)} {p.windUnit}<small>{fin(f.wind.gusts) ? `gust ${windVal(f.wind.gusts, p)} · ` : ''}{relWord(rel)}</small><StaleTag s={hourFreshness(f, now).wind} /></> : '—'}</td>
              <td>{fin(f.tide.height) ? <>{`${f.tide.height < 0 ? '−' : ''}${ht(Math.abs(f.tide.height), p)} ${u}`}<StaleTag s={hourFreshness(f, now).tide} /></> : '—'}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/** Nearest buoy, observed now vs the forecast for the same hour (different points, so this is context, not validation). */
export function BuoyNow({buoy, series, p, now}: {buoy: ObservationSet | null | undefined; series: HourSample[]; p: UserProfile; now: number}) {
  if (!buoy) return <p>No buoy observation was returned for this load.</p>;
  const v = buoy.values, hs = v['Offshore significant height'], tp = v['Dominant wave period'], dir = v['Mean wave direction'], wt = Object.entries(v).find(([k]) => /water temp/i.test(k))?.[1];
  const at = hs?.source.validAt, near = at ? series.reduce<HourSample | null>((b, x) => (Math.abs(Date.parse(x.timestamp) - Date.parse(at)) < (b ? Math.abs(Date.parse(b.timestamp) - Date.parse(at)) : Infinity) ? x : b), null) : null;
  const gap = near && at ? Math.abs(Date.parse(near.timestamp) - Date.parse(at)) : Infinity;
  const fc = gap <= 5400000 ? near : null, age = at ? now - Date.parse(at) : Infinity;
  const row = (label: string, obs: ReactNode, model: ReactNode) => <tr><th scope="row">{label}</th><td>{obs}</td><td>{model}</td></tr>;
  return (
    <>
      <p className="fine">NDBC {buoy.station} · {buoy.location}{at ? ` · observed ${weekdayPT(at)} ${timeLabelPT(at)}` : ''}{buoy.delivery === 'saved' || age > 6 * 3600000 ? <b> · saved snapshot, not current</b> : ''}</p>
      <table className="sp-buoy"><thead><tr><th /><th>Buoy (observed)</th><th>Forecast, this spot</th></tr></thead><tbody>
        {row('Wave height', hs?.value != null ? `${ht(hs.value, p)} ${p.heightUnit}` : '—', fc && fin(fc.forecast.offshore) ? `${ht(fc.forecast.offshore, p)} ${p.heightUnit} offshore` : 'no hour within 90 min')}
        {row('Period', tp?.value != null ? `${Math.round(tp.value)} s` : '—', fc?.forecast.primary && fin(fc.forecast.primary.period) ? `${Math.round(fc.forecast.primary.period)} s primary` : '—')}
        {row('Direction', dir?.value != null ? `${compass(dir.value)} ${Math.round(dir.value)}°` : '—', fc?.forecast.primary && fin(fc.forecast.primary.direction) ? `${compass(fc.forecast.primary.direction)} ${Math.round(fc.forecast.primary.direction)}°` : '—')}
        {wt && row('Water', wt.value != null ? `${Math.round(wt.value)}°F` : '—', fc && fin(fc.forecast.waterTempF) ? `${Math.round(fc.forecast.waterTempF)}°F` : '—')}
      </tbody></table>
      <p className="fine">The buoy is about 18 NM offshore and the forecast is at this spot's model point: context, not a validation.</p>
    </>
  );
}

/** Wave scale panel (T-048): the hour's face estimate, a surfer at the user's height and their best board, drawn to one scale.
 *  Drawn from data only (no imagery). Without a face estimate the wave is not drawn: offshore height is not surf size. */
export function ScalePanel({hs, p, board, onOpen}: {hs: HeadlineSurf; p: UserProfile; board: import('../../models/index').Surfboard | null; onOpen: () => void}) {
  const me = userHeight(p), personFt = me.feet; // the surfer's own height (Personal › Surf preferences), else the labelled 5'10" default
  const est = hs.kind === 'estimate' ? hs : null, boardFt = board ? board.length / 12 : 0;
  const top = Math.max(est ? est.hiFt * 1.08 : 0, personFt * 1.15, boardFt * 1.1, 7);
  const m = p.heightUnit === 'm', step = m ? (top * 0.3048 > 5 ? 2 : 1) : top > 14 ? 4 : 2, base = 150, H = 138, y = (ft: number) => base - (ft / top) * H;
  const ticks: number[] = []; for (let v = step; (m ? v / 0.3048 : v) <= top; v += step) ticks.push(v);
  const yy = (u: number) => y(m ? u / 0.3048 : u);
  const ph = (personFt / top) * H, px = 118, pw = ph * 0.3;
  const label = est ? `Estimated surf height ${ht(est.loFt, p, 0)} to ${ht(est.hiFt, p, 0)} ${p.heightUnit} beside a surfer ${formatHeight(me.inches, p.heightUnit)} tall${board ? ` and a ${feetInches(board.length)} board` : ''}` : 'No surf estimate this hour; surfer and board only';
  // T-098 (Codex P2): the caption describes THIS card's drawing: the estimate's range (outer = high bound, inner = low bound) beside the
  // person's own height (userHeight), not the 3D view's single face and fixed 5'9" surfer. Offshore-only hours say there is no breaking-wave estimate.
  const scaleLine = est ? "The estimate's range, drawn to scale beside you"
    : hs.kind === 'offshore' ? `No breaking-wave estimate · ${ht(hs.ft, p)} ${p.heightUnit} offshore swell, not surf size` : 'No breaking-wave estimate for this hour';
  const chart = (
      <svg viewBox="0 0 220 168" role="img" aria-hidden="true">
        {ticks.map((t) => <g key={t}><line x1={22} x2={214} y1={yy(t)} y2={yy(t)} stroke="var(--line)" strokeWidth={1} /><text x={18} y={yy(t) + 4} fontSize={10} textAnchor="end" fill="var(--dim)">{t}</text></g>)}
        <line x1={22} x2={214} y1={base} y2={base} stroke="var(--line-2)" strokeWidth={1.2} />
        {est && <g>
          {/* A wave face drawn to scale: the outer shape reaches the high bound, the darker inner one the low bound. */}
          {[est.hiFt, est.loFt].map((ft, i) => { const t = y(ft), h = base - t, x0 = 24, x1 = 104; return (
            <path key={i} d={`M${x0} ${base} C ${x0 + 30} ${base - h * 0.08} ${x0 + 44} ${t + h * 0.18} ${x0 + 58} ${t + h * 0.02} C ${x0 + 66} ${t - h * 0.04} ${x1 - 2} ${t + h * 0.08} ${x1 - 6} ${t + h * 0.3} C ${x1 - 14} ${t + h * 0.18} ${x0 + 66} ${t + h * 0.2} ${x0 + 62} ${t + h * 0.45} C ${x0 + 60} ${t + h * 0.7} ${x1 - 6} ${base - 6} ${x1 + 8} ${base} Z`}
              fill={i === 0 ? 'color-mix(in srgb, var(--hs-hi) 26%, transparent)' : 'color-mix(in srgb, var(--hs-hi) 55%, transparent)'} stroke={i === 0 ? 'var(--hs-hi)' : 'none'} strokeWidth={1.3} />
          ); })}
        </g>}
        {/* surfer silhouette, to scale */}
        <g transform={`translate(${px} ${base - ph}) scale(${ph / 100})`} fill="var(--text)" opacity={0.85}>
          <circle cx={15} cy={7} r={6.4} />
          <path d="M9 15 h12 q5 1 5.5 6 l1.8 27 q.2 2.4-1.8 2.4 h-.6 q-1.2 0-1.4-1.6 l-2.2-21 v31 l-.6 41 h-5.2 l-1.2-38 h-1 l-1.2 38 h-5.2 l-.6-41 v-31 l-2.2 21 q-.2 1.6-1.4 1.6 h-.6 q-2 0-1.8-2.4 l1.8-27 q.5-5 5.5-6z" />
        </g>
        {board && <rect x={px + pw + 18} y={y(boardFt)} width={11} height={(boardFt / top) * H} rx={5.5} fill="var(--s3, #e8ecef)" stroke="var(--muted)" strokeWidth={1} />}
        <text x={66} y={164} fontSize={10.5} textAnchor="middle" fill="var(--muted)">{est ? 'est. surf height' : 'no surf estimate'}</text>
        <text x={px + pw / 2} y={164} fontSize={10.5} textAnchor="middle" fill="var(--muted)">you</text>
        {board && <text x={px + pw + 23.5} y={164} fontSize={10.5} textAnchor="middle" fill="var(--muted)">board</text>}
        <text x={22} y={10} fontSize={10} fill="var(--dim)">{p.heightUnit}</text>
      </svg>);
  const mine = `${board ? `Your ${board.name}, ${feetInches(board.length)}` : 'No board in your quiver'} · you ${formatHeight(me.inches, p.heightUnit)}${me.isDefault ? ' (default)' : ''}`;
  return (
    <button className="sp-scalep" onClick={onOpen} aria-label={`Wave scale: ${label}. ${scaleLine}. Open the full wave scale`}>
      {chart}
      <span className="sp-scalep-c"><span className="sp-scale-at">{scaleLine}</span><span>{mine}</span><span className="sp-link-t">Full wave scale</span></span>
    </button>
  );
}

/** explainRating for one hour, with the wind relation and tide this page already shows. */
export function ratingWhy(spot: SurfSpot, h: HourSample, p: UserProfile) {
  const f = h.forecast, windOk = f.availability.wind !== false && fin(f.wind.speed);
  const tideOk = f.availability.tide !== false && fin(f.tide.height);
  return explainRating(h.rating, {
    spotId: spot.id,
    wind: windOk ? {mph: f.wind.speed, relation: windRelationship(spot, f)} : null,
    tide: tideOk ? {trend: f.tide.trend === 'Rising' ? 'rising' : f.tide.trend === 'Falling' ? 'falling' : 'unknown', heightLabel: `${ht(f.tide.height, p)} ${p.heightUnit}`} : null,
  });
}

/** 24-hour wind trace on a compass: each hour of the day at its direction (where the wind comes from) and speed, coloured by shore relation. */
function WindTrace({hours, spot, p, at, onSelect}: {hours: HourSample[]; spot: SurfSpot; p: UserProfile; at: string; onSelect: (t: string) => void}) {
  const pts = hours.filter((x) => fin(x.forecast.wind.speed) && fin(x.forecast.wind.direction));
  if (pts.length < 2) return <p className="sp-s">Not enough wind records for this day.</p>;
  const R = 110, max = Math.max(10, ...pts.map((x) => x.forecast.wind.speed)), ring = max > 20 ? 10 : 5, facing = facingOf(spot.id);
  const xy = (x: HourSample) => { const r = (x.forecast.wind.speed / max) * R, a = (x.forecast.wind.direction * Math.PI) / 180; return [Math.sin(a) * r, -Math.cos(a) * r] as const; };
  const line = pts.map((x, i) => `${i ? 'L' : 'M'}${xy(x)[0].toFixed(1)},${xy(x)[1].toFixed(1)}`).join('');
  return (
    <div className="sp-trace">
      <svg viewBox="-140 -140 280 280" role="img" aria-label={`Wind through ${weekdayPT(pts[0].timestamp)}: ${pts.filter((x) => x.hour % 6 === 0).map((x) => `${hourLabel(x.timestamp)} ${windVal(x.forecast.wind.speed, p)} ${p.windUnit} from ${compass(x.forecast.wind.direction)}`).join(', ')}`}>
        {Array.from({length: Math.floor(max / ring)}, (_, i) => (i + 1) * ring).map((v) => <g key={v}><circle r={(v / max) * R} fill="none" stroke="var(--line)" /><text x={3} y={-(v / max) * R - 2} fontSize={9} fill="var(--dim)">{String(windVal(v, p)).replace(/\.0$/, '')}</text></g>)}
        {['N', 'E', 'S', 'W'].map((d, i) => <text key={d} x={[0, 128, 0, -128][i]} y={[-124, 4, 132, 4][i]} fontSize={11} textAnchor="middle" fill="var(--muted)">{d}</text>)}
        {facing !== null && <line x1={0} y1={0} x2={0} y2={-R} transform={`rotate(${facing})`} stroke="var(--muted)" strokeDasharray="4 3" />}
        <path d={line} fill="none" stroke="var(--line-2)" strokeWidth={1.5} />
        {pts.map((x) => { const [cx, cy] = xy(x), sel = x.timestamp === at; return (
          <g key={x.timestamp} className={`sp-rel-ink ${relClass(windRelationship(spot, x.forecast))}`} onClick={() => onSelect(x.timestamp)} style={{cursor: 'pointer'}}>
            <circle cx={cx} cy={cy} r={sel ? 6 : 3.5} fill="currentColor" stroke={sel ? 'var(--text)' : 'none'} strokeWidth={2} />
            {x.hour % 6 === 0 && <text x={cx + 7} y={cy + 3} fontSize={9.5} fill="var(--muted)">{hourLabel(x.timestamp)}</text>}
          </g>
        ); })}
      </svg>
      <ul className="sp-trace-k"><li><i className="sp-rel-ink off" />offshore</li><li><i className="sp-rel-ink cross" />cross-shore</li><li><i className="sp-rel-ink on" />onshore</li><li><i className="sp-rel-ink unk" />unknown</li>{facing !== null && <li><i className="dash" />beach facing</li>}</ul>
      <p className="sp-f">Dots sit where the wind comes from, further out when stronger (rings in {p.windUnit}). Tap a dot to select that hour.</p>
    </div>
  );
}

/** The expanded detail under the grid for the card that was tapped. */
export function CardDetail({k, spot, h, p, dayHours, onSelect, onClose, Tide, Polar}: {
  k: CardKey; spot: SurfSpot; h: HourSample; p: UserProfile; dayHours: HourSample[]; onSelect: (t: string) => void; onClose: () => void;
  Tide: ReactNode; Polar: ReactNode;
}) {
  const ex = k === 'rating' ? ratingWhy(spot, h, p) : null;
  const title = {rating: 'Why this rating', wind: `Wind through ${weekdayPT(h.timestamp)}`, tide: `Tide through ${weekdayPT(h.timestamp)}`, swell: `Swell direction and period, ${weekdayPT(h.timestamp)}`}[k];
  return (
    <section className="card sp-detail" id="sp-detail" aria-label={title}>
      <div className="card-h"><h2>{title}</h2><button className="btn" onClick={onClose}>Close</button></div>
      {k === 'rating' && ex && <>
        <ul className="sp-explain">{ex.items.filter((x) => x.inScore).map((x) => <li key={x.factor} className={MARK[x.effect].c}><i aria-hidden="true" /><span><strong>{x.factor} <span className="w">{MARK[x.effect].m}</span></strong>{x.reason}</span></li>)}</ul>
        {ex.items.some((x) => !x.inScore) && <><p className="sp-explain-h">Context, not part of the score</p>
          <ul className="sp-explain ctx">{ex.items.filter((x) => !x.inScore).map((x) => <li key={x.factor} className={MARK[x.effect].c}><i aria-hidden="true" /><span><strong>{x.factor} <span className="w">{MARK[x.effect].m}</span></strong>{x.reason}</span></li>)}</ul></>}
        <p className="sp-explain-h">Reliability: {ex.reliability.category.toLowerCase()}</p>
        <ul className="sp-explain ctx">{ex.reliability.reasons.map((r) => <li key={r} className="u"><b aria-hidden="true">·</b><span>{r}</span></li>)}</ul>
      </>}
      {k === 'wind' && <WindTrace hours={dayHours} spot={spot} p={p} at={h.timestamp} onSelect={onSelect} />}
      {k === 'tide' && <>{Tide}<p className="sp-f">NOAA station prediction, not measured at the beach · sunrise/sunset approximate · tap the curve to select an hour</p></>}
      {k === 'swell' && <>{Polar}<p className="sp-f">Each dot is one hour's partition: direction around the ring, period by ring, size by height. Offshore model, not surf size.</p></>}
    </section>
  );
}

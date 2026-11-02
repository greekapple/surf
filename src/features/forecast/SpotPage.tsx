import {useMemo, type CSSProperties, type ReactNode} from 'react';
import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import type {ObservationSet, TidePrediction} from '../../ocean/types';
import {windRelationship} from '../../recommendation/sqi';
import {scoreBoard} from '../../recommendation/board';
import {DirArrow, Icon} from '../../ui/Icon';
import {BAND_COLOR, bandOf, hourLabel, type HourSample} from './model';
import {compass, ht, monotonePath, windVal, type Day} from './helpers';
import {conditionWord} from './Condition';
import {timeLabelPT, weekdayPT, dayNumPT} from './format';
import {headlineSurf, headlineText, type HeadlineSurf} from './surfHeadline';
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

function Card({k, title, aside, children, className = ''}: {k: string; title: string; aside?: ReactNode; children: ReactNode; className?: string}) {
  return (
    <section className={`sp-card ${className}`} data-card={k} aria-label={title}>
      <header><h2>{title}</h2>{aside}</header>
      {children}
    </section>
  );
}

/** 5-segment rating bar (Surfline): segments filled by score, coloured by the rating band. */
function RatingBar({score, category}: {score: number | null; category: string}) {
  const n = score === null ? 0 : Math.max(1, Math.min(5, Math.ceil(score / 20)));
  return <span className="sp-bar" aria-hidden="true">{Array.from({length: 5}, (_, i) => <i key={i} style={{background: i < n ? BAND_COLOR[bandOf(category)] : undefined}} />)}</span>;
}

/** Short names for the rating's factors (the full name and reason stay in the tooltip). */
const shortFactor = (n: string) => (/organi[sz]ation/i.test(n) ? 'Swell quality' : /wave potential|swell size|wave size|size/i.test(n) ? 'Swell size' : /wind/i.test(n) ? 'Wind' : /tide/i.test(n) ? 'Tide' : /period/i.test(n) ? 'Period' : /window|direction|exposure/i.test(n) ? 'Swell window' : n);

/** Wetsuit by water temperature (°F): a common surf-shop guide, labelled as such. */
const wetsuit = (f: number) => (f >= 72 ? 'Boardshorts or a top' : f >= 65 ? '2 mm spring suit' : f >= 62 ? '3/2 mm full suit' : f >= 58 ? '4/3 mm full suit' : f >= 52 ? '4/3 mm + booties' : f >= 48 ? '5/4 mm hooded + booties' : '6/5 mm hooded, booties, gloves');

export function ConditionsGrid({spot, h, p, dayHours, extrema, bundle, now, onScale}: {spot: SurfSpot; h: HourSample; p: UserProfile; dayHours: HourSample[]; extrema: TidePrediction[]; bundle: OceanBundle | null | undefined; now: number; onScale: () => void}) {
  const f = h.forecast, r = h.rating, u = p.heightUnit, {h: hs, t} = surfOf(spot, f, p, bundle, now);
  const rel = f.availability.wind && fin(f.wind.speed) ? windRelationship(spot, f) : 'Unknown';
  // One-line "why": the rating's own factors as ticks (good / mixed / against).
  const why = r.factors.filter((x) => x.score !== null).slice(0, 4).map((x) => ({name: shortFactor(x.name), full: x.name, mark: x.score! >= 70 ? '✓' : x.score! >= 40 ? '~' : '✗', cls: x.score! >= 70 ? 'g' : x.score! >= 40 ? 'm' : 'b', reason: x.reason}));
  const swells = [f.primary, f.secondary, f.tertiary].filter((s): s is NonNullable<typeof s> => !!s && fin(s.height) && s.height > 0.05);
  const tideOk = f.availability.tide !== false && fin(f.tide.height);
  const water = fin(f.waterTempF) ? f.waterTempF : null;
  return (
    <div className="sp-grid">
      <Card k="surf" title="Surf" aside={<span className={`sp-tag ${t.tag === 'model estimate' ? 'est' : ''}`}>{t.tag === 'none' ? 'no value' : t.tag}</span>}>
        {/* Offshore Hs keeps one decimal, like every other offshore value on the page (the chart, the table). */}
        <p className="v sp-v" aria-label={t.label}>{hs.kind === 'offshore' ? <>{ht(hs.ft, p)}<small>{u}</small></> : t.value === '—' ? '—' : <>{t.value.replace(/ (ft|m)( ≈ Hawaiian)?$/, '')}<small>{t.value.match(/ (ft|m)( ≈ Hawaiian)?$/)?.[0]}</small></>}</p>
        <p className="sp-s">{hs.kind === 'estimate' ? <>{t.words ? <b className="sp-words">{t.words[0].toUpperCase() + t.words.slice(1)}</b> : null} <span title={hs.wordsNote}>at the break</span></> : t.detail}</p>
        {hs.kind !== 'offshore' && fin(f.offshore) && <p className="sp-f">Offshore {ht(f.offshore, p)} {u} · not surf size</p>}
        {hs.kind === 'estimate' && <p className="sp-f">{hs.methodLabel}</p>}
        <button className="sp-scale" onClick={onScale}>Wave scale →</button>
      </Card>
      <Card k="rating" title="Rating" aside={<span className="sp-tag">provisional</span>}>
        <p className="v sp-v sp-rate" style={{'--c': BAND_COLOR[bandOf(r.category)]} as CSSProperties}>{conditionWord(r.category)}</p>
        <RatingBar score={r.score} category={r.category} />
        {why.length ? <ul className="sp-why" aria-label="Why">{why.map((x) => <li key={x.full} className={x.cls} title={`${x.full}: ${x.reason}`}><b aria-hidden="true">{x.mark}</b>{x.name}</li>)}</ul>
          : <p className="sp-s">{r.explanation}</p>}
        <p className="sp-f">{r.reliability.category.toLowerCase()} reliability</p>
      </Card>
      <Card k="wind" title="Wind">
        {f.availability.wind !== false && fin(f.wind.speed) ? <>
          <p className="v sp-v">{windVal(f.wind.speed, p)}<small>{p.windUnit}</small>{fin(f.wind.direction) && <span className="sp-dir"><DirArrow from={f.wind.direction} size={16} /> {compass(f.wind.direction)}</span>}</p>
          <p className="sp-s"><span className={`sp-rel ${relClass(rel)}`}>{relWord(rel)}</span>{fin(f.wind.gusts) && <> · gusts {windVal(f.wind.gusts, p)} {p.windUnit}</>}</p>
        </> : <p className="sp-s">Wind not in this record.</p>}
      </Card>
      <Card k="tide" title="Tide">
        {tideOk ? <>
          <p className="v sp-v">{f.tide.height < 0 ? '−' : ''}{ht(Math.abs(f.tide.height), p)}<small>{u}</small><span className="sp-trend">{f.tide.trend === 'Rising' ? '▲ rising' : f.tide.trend === 'Falling' ? '▼ falling' : ''}</span></p>
          <TideMini hours={dayHours} at={h.timestamp} extrema={f.tide.extrema?.length ? f.tide.extrema.map((e) => ({timestamp: e.timestamp, v: e.height, type: e.type})) : extrema.filter((e) => e.height.value !== null).map((e) => ({timestamp: e.timestamp, v: e.height.value!, type: e.type}))} p={p} />
          <p className="sp-f">NOAA station prediction, not at the beach</p>
        </> : <p className="sp-s">No tide station near this spot.</p>}
      </Card>
      <Card k="swell" title="Swell">
        {swells.length ? <ul className="sp-swells">{swells.map((s, i) => (
          <li key={i}><b>{ht(s.height, p)}<small>{u}</small></b><span>{Math.round(s.period)}<small>s</small></span><span className="sp-dir"><DirArrow from={s.direction} size={13} color={i === 0 ? 'var(--sw1)' : 'var(--sw2)'} /> {compass(s.direction)}<span className="sp-deg"> {Math.round(s.direction)}°</span></span></li>
        ))}</ul> : <p className="sp-s">No swell partitions in this record.</p>}
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
export function BoardLine({boards, f, p, hs, onOpen, onQuiver}: {boards: import('../../models/index').Surfboard[]; f: Forecast; p: UserProfile; hs: HeadlineSurf; onOpen: () => void; onQuiver: () => void}) {
  const range: [number, number] | null = hs.kind === 'estimate' ? [hs.loFt, hs.hiFt] : null;
  const best = useMemo(() => boards.map((b) => scoreBoard(b, f, p, range)).filter((m) => m.eligible).sort((a, b) => b.score - a.score)[0], [boards, f, p, range?.[0], range?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = !boards.length ? <>Add your boards to get a pick for these waves.</>
    : hs.kind === 'offshore' || hs.kind === 'none' ? <>No board pick: only offshore height is available here, which is not surf size.</>
    : best ? <>Ride your <b>{best.board.name}</b> ({best.board.type.toLowerCase()}){range ? <> for an estimated {ht(range[0], p, 0)}–{ht(range[1], p, 0)} {p.heightUnit}</> : null}. <span className="fine">Board Match {Math.round(best.score)}/100 · provisional</span></>
    : <>None of your boards suits this size; Board Match explains why.</>;
  return (
    <section className="sp-board" aria-label="Board Match">
      <Icon name="quiver" size={18} />
      <p>{text}</p>
      <button className="btn" onClick={boards.length ? onOpen : onQuiver}>{boards.length ? 'Board Match' : 'Add a board'}<Icon name="chevron" size={14} style={{transform: 'rotate(-90deg)'}} /></button>
    </section>
  );
}

const median = (v: number[]) => { const a = [...v].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const BLOCKS = [{label: 'AM', hour: 7}, {label: 'Midday', hour: 12}, {label: 'PM', hour: 17}] as const;
/** 7-day strip (Surfline): day, surf range, AM/midday/PM rating segments, three wind arrows, best day star. */
export function DayStrip({days, series, spot, p, bundle, now, cur, best, onPick}: {days: Day[]; series: HourSample[]; spot: SurfSpot; p: UserProfile; bundle: OceanBundle | null | undefined; now: number; cur: number; best: number; onPick: (k: number) => void}) {
  const today = weekdayPT(new Date(now).toISOString());
  return (
    <nav className="sp-days days" aria-label="Forecast days">
      {days.map((d, k) => {
        if (d.end - d.start < 11) return null;
        const hrs = series.slice(d.start, d.end + 1), day = hrs.filter((x) => x.hour >= 6 && x.hour <= 19);
        const heads = day.map((x) => surfOf(spot, x.forecast, p, bundle, now).h);
        const est = heads.filter((x): x is Extract<HeadlineSurf, {kind: 'estimate'}> => x.kind === 'estimate');
        const off = heads.filter((x): x is Extract<HeadlineSurf, {kind: 'offshore' | 'demonstration'}> => x.kind === 'offshore' || x.kind === 'demonstration');
        // Typical daylight size: the median of the hourly estimate bounds (6 AM–7 PM), so one odd hour doesn't stretch the day.
        const range = est.length ? [median(est.map((x) => x.loFt)), median(est.map((x) => x.hiFt))] : off.length ? [median(off.map((x) => x.ft)), median(off.map((x) => x.ft))] : null;
        const kind = est.length ? 'est.' : off.some((x) => x.kind === 'offshore') ? 'offshore' : off.length ? 'demo' : '';
        const lo = range ? ht(range[0], p, 0) : null, hi = range ? ht(range[1], p, 0) : null;
        const blocks = BLOCKS.map((b) => ({...b, h: hrs.find((x) => x.hour === b.hour)}));
        const name = weekdayPT(d.t) === today && k === 0 ? 'Today' : `${weekdayPT(d.t)} ${dayNumPT(d.t)}`;
        return (
          <button key={d.key} className="sp-day day" aria-pressed={k === cur} onClick={() => onPick(k)}
            aria-label={`${name}: ${range ? `typically ${lo === hi ? lo : `${lo} to ${hi}`} ${p.heightUnit} ${kind === 'est.' ? 'estimated' : kind}` : 'no height'}; ${blocks.map((b) => `${b.label} ${b.h ? conditionWord(b.h.rating.category) : 'no rating'}`).join(', ')}${k === best ? '; best day' : ''}`}>
            <span className="sd-t">{name}{k === best && <Icon name="star" size={12} />}</span>
            <span className="sd-h">{range ? <>{lo === hi ? lo : `${lo}–${hi}`}<small>{p.heightUnit}</small></> : '—'}</span>
            <span className="sd-k">{kind}</span>
            <span className="sd-w" aria-hidden="true">{blocks.map((b) => b.h && fin(b.h.forecast.wind.direction) ? <i key={b.label} className={`sp-rel-ink ${relClass(windRelationship(spot, b.h.forecast))}`}><DirArrow from={b.h.forecast.wind.direction} size={12} /></i> : <i key={b.label} />)}</span>
            <span className="sd-q" aria-hidden="true">{blocks.map((b) => <i key={b.label} style={{background: b.h ? BAND_COLOR[bandOf(b.h.rating.category)] : 'var(--none)'}} />)}</span>
          </button>
        );
      })}
    </nav>
  );
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
              <td className={`st-wind ${relClass(rel)}`}>{fin(f.wind.speed) ? <>{fin(f.wind.direction) && <DirArrow from={f.wind.direction} size={12} />} {windVal(f.wind.speed, p)} {p.windUnit}<small>{fin(f.wind.gusts) ? `gust ${windVal(f.wind.gusts, p)} · ` : ''}{relWord(rel)}</small></> : '—'}</td>
              <td>{fin(f.tide.height) ? `${f.tide.height < 0 ? '−' : ''}${ht(Math.abs(f.tide.height), p)} ${u}` : '—'}</td>
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

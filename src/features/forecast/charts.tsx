import {useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import type {SurfSpot, UserProfile} from '../../models/index';
import type {TidePrediction} from '../../ocean/types';
import {BAND_COLOR, bandOf, hourLabel, titleCase, type HourSample} from './model';
import {groupDays, ht, monotonePath, spotLatLon, sunTimes, windColor, windVal, compass, type Day} from './helpers';
import {timeLabelPT, weekdayPT, dayNumPT, localHour} from './format';
import {Condition} from '../../ui/Condition';

/** Wind-speed colour for marks on the current ground: the pastel Windy-like ramp is mixed toward black in the light theme (--wind-darken). */
/** Wind ramp darkened by --wind-darken. Browsers without color-mix (Safari < 16.2) get the plain ramp colour so arrows still draw. */
const hasColorMix = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('color', 'color-mix(in srgb, red, black 10%)');
export const windInk = (mph: number) => (hasColorMix ? `color-mix(in srgb, ${windColor(mph)}, black var(--wind-darken))` : windColor(mph));

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animate a numeric range toward `target` (interruptible: a new target restarts from the current value). */
function useAnimatedRange(target: [number, number]) {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current, start = performance.now(), dur = reduced() ? 0 : 420;
    let raf = 0;
    const step = (now: number) => {
      const t = dur ? Math.min(1, (now - start) / dur) : 1, e = 1 - Math.pow(1 - t, 3);
      const next: [number, number] = [from[0] + (target[0] - from[0]) * e, from[1] + (target[1] - from[1]) * e];
      cur.current = next; setV(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target[0], target[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export type ChartTab = 'surf' | 'swell' | 'wind' | 'tide';
export interface TimelineProps {
  series: HourSample[]; spot: SurfSpot; p: UserProfile; selectedTime: string | null; onSelect: (t: string) => void;
  onHover?: (t: string | null) => void; now: number; dayIndex: number | null; extrema: TidePrediction[]; height?: number;
  /** Which series the chart plots. */
  tab?: ChartTab;
  /** Zoom to a window of hours around the selected hour. */
  hourWindow?: boolean;
}
const niceStep = (range: number) => [0.5, 1, 2, 5, 10, 20].find((s) => range / s <= 5) ?? 20;
const signed = (v: number, p: UserProfile) => `${v < 0 ? '-' : '+'}${ht(Math.abs(v), p)}`;
const TIP_W = 212;
/** The forecast spine: one series per tab (surf, swell, wind, tide) plus the rating ribbon and night on one time axis. */
export function Timeline({series, spot, p, selectedTime, onSelect, onHover, now, dayIndex, extrema, height = 300, tab = 'surf', hourWindow = false}: TimelineProps) {
  const body = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  const [hover, setHover] = useState<{i: number; x: number; y: number} | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    if (body.current) ro.observe(body.current);
    return () => ro.disconnect();
  }, []);
  const days = useMemo(() => groupDays(series), [series]);
  const n = series.length;
  const sel = Math.max(0, series.findIndex((h) => h.timestamp === selectedTime));
  const target: [number, number] = hourWindow ? [Math.max(-0.5, sel - 6.5), Math.max(-0.5, sel - 6.5) + 13]
    : dayIndex !== null && days[dayIndex] ? [days[dayIndex].start - 0.5, days[dayIndex].end + 0.5] : [0, Math.max(1, n - 1)];
  const [a, b] = useAnimatedRange(target);
  const G = 44, PAD = 14, inner = W - G - PAD, pxh = inner / (b - a);
  const X = (i: number) => G + (i - a) * pxh;
  const PT = 30, PB = height - 62, RB = height - 36;
  const tides = series.map((h) => (Number.isFinite(h.forecast.tide.height) ? h.forecast.tide.height : 0));
  const hasTide = series.some((h) => Number.isFinite(h.forecast.tide.height)); // spots far from the SF station have none
  const tLo = Math.min(...tides), tHi = Math.max(...tides);
  const hsMax = Math.max(1, ...series.map((h) => Math.max(h.heightFt ?? 0, h.forecast.primary?.height ?? 0))) * 1.12;
  const wMax = Math.max(10, ...series.map((h) => Math.max(h.forecast.wind.speed || 0, h.forecast.wind.gusts || 0))) * 1.12;
  const [lo, hi] = tab === 'wind' ? [0, wMax] : tab === 'tide' ? [tLo - (tHi - tLo || 1) * 0.15, tHi + (tHi - tLo || 1) * 0.2] : [0, hsMax];
  const Y = (v: number) => PB - ((v - lo) / (hi - lo || 1)) * (PB - PT);
  const step = niceStep(hi - lo), t0y = Math.ceil(lo / step) * step;
  const ticks: number[] = []; for (let v = t0y; v <= hi + 1e-6; v += step) ticks.push(Math.round(v * 100) / 100);
  const unit = tab === 'wind' ? p.windUnit : p.heightUnit;
  const tickText = (v: number) => (tab === 'wind' ? windVal(v, p) : ht(v, p, step < 1 || p.heightUnit === 'm' ? 1 : 0));
  const val = (h: HourSample) => (tab === 'wind' ? h.forecast.wind.speed || 0 : tab === 'tide' ? (Number.isFinite(h.forecast.tide.height) ? h.forecast.tide.height : 0) : tab === 'swell' ? h.forecast.primary?.height ?? 0 : h.heightFt ?? 0);
  const t0 = n ? Date.parse(series[0].timestamp) : 0, XT = (ms: number) => X((ms - t0) / 3600000);
  const TYs = (v: number) => PB - 8 - ((v - tLo) / (tHi - tLo || 1)) * (PB - PT) * 0.26; // dashed tide under the surf curve
  const i0 = Math.max(0, Math.floor(a) - 1), i1 = Math.min(n - 1, Math.ceil(b) + 1);
  const vis = series.slice(i0, i1 + 1);
  const line = (f: (h: HourSample) => number) => monotonePath(vis.map((h, k) => [X(i0 + k), Y(f(h))]));
  const mainPath = line(val);
  /** Day peaks of the primary swell, labelled with period (only where the day is wide enough to read). */
  const peaks = tab !== 'swell' ? [] : days.flatMap((d) => {
    let best = -1;
    for (let i = d.start; i <= d.end; i++) { const pr = series[i]?.forecast.primary; if (pr && Number.isFinite(pr.period) && (best < 0 || pr.height > series[best].forecast.primary!.height)) best = i; }
    if (best < 0 || (d.end - d.start + 1) * pxh < 70) return [];
    const x = X(best);
    return x > G + 12 && x < W - PAD - 12 ? [{h: series[best], i: best}] : [];
  }).filter((pk, k, all) => k === 0 || (pk.i - all[k - 1].i) * pxh > 40);
  const [lat, lon] = spotLatLon(spot);
  const nowI = series.findIndex((h) => Date.parse(h.timestamp) >= Math.floor(now / 3600000) * 3600000);

  const idxAt = (clientX: number) => {
    const r = body.current!.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.round(a + (clientX - r.left - G) / pxh)));
  };
  const hoverAt = (e: PointerEvent, i: number) => { const r = body.current!.getBoundingClientRect(); setHover({i, x: e.clientX - r.left, y: e.clientY - r.top}); };
  const hoverI = hover?.i ?? null;
  useEffect(() => { onHover?.(hoverI === null ? null : series[hoverI]?.timestamp ?? null); }, [hoverI]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onHover?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const drag = useRef(false);
  const onDown = (e: PointerEvent) => { drag.current = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); const i = idxAt(e.clientX); onSelect(series[i].timestamp); hoverAt(e, i); };
  const onMove = (e: PointerEvent) => { const i = idxAt(e.clientX); if (drag.current) onSelect(series[i].timestamp); if (drag.current || e.pointerType === 'mouse') hoverAt(e, i); };
  const onUp = (e: PointerEvent) => { drag.current = false; if (e.pointerType !== 'mouse') setTimeout(() => setHover(null), 1400); };
  const onKey = (e: KeyboardEvent) => {
    const stepK: Record<string, number> = {ArrowRight: 1, ArrowLeft: -1, PageDown: 24, PageUp: -24};
    let i = sel;
    if (e.key in stepK) i = sel + stepK[e.key]; else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n - 1; else return;
    e.preventDefault();
    setHover(null);
    onSelect(series[Math.max(0, Math.min(n - 1, i))].timestamp);
  };
  if (!n) return null;
  const tipH = hover ? series[hover.i] : null;
  const selH = series[sel];
  const stepH = [1, 2, 3, 6, 12, 24].find((s) => s * pxh >= 46) ?? 24;
  const every = Math.max(1, Math.ceil(20 / pxh));
  const u = p.heightUnit;
  const tipLeft = hover ? (hover.x + 18 + TIP_W > W ? hover.x - 18 - TIP_W : hover.x + 18) : 0;
  const tipTop = hover ? Math.max(6, Math.min(height - 176, hover.y - 70)) : 0;
  const wc = windInk;

  return (
    <div className="tl-body" ref={body} role="slider" tabIndex={0} aria-label="Forecast time. Arrow keys move one hour, Page Up and Page Down one day."
      aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={sel}
      aria-valuetext={selH ? `${weekdayPT(selH.timestamp)} ${hourLabel(selH.timestamp)}, offshore ${ht(selH.heightFt, p)} ${u}, ${titleCase(selH.rating.category)}` : ''}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => (drag.current = false)} onPointerLeave={() => !drag.current && setHover(null)} onKeyDown={onKey}>
      <svg viewBox={`0 0 ${W} ${height}`} style={{height}} aria-hidden="true" className="tl-svg">
        <defs>
          <linearGradient id="gHs" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--hs-hi)" stopOpacity="0.5" /><stop offset="1" stopColor="var(--hs)" stopOpacity="0.03" /></linearGradient>
          <linearGradient id="gSw" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--sw1)" stopOpacity="0.28" /><stop offset="1" stopColor="var(--sw1)" stopOpacity="0.02" /></linearGradient>
          <linearGradient id="gWd" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity="0.4" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0.03" /></linearGradient>
          <linearGradient id="gTd" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--tide)" stopOpacity="0.38" /><stop offset="1" stopColor="var(--tide)" stopOpacity="0.03" /></linearGradient>
          <clipPath id="tlclip"><rect x={G} y={0} width={inner} height={height} /></clipPath>
        </defs>
        <g key={`ax${tab}`} className="tl-fade">
          {ticks.map((v) => <g key={v}><line className="tl-grid" x1={G} x2={W - PAD} y1={Y(v)} y2={Y(v)} /><text className="tl-ax" x={G - 8} y={Y(v) + 4} textAnchor="end">{tab === 'tide' && v > 0 ? '+' : ''}{tickText(v)}{v === ticks[ticks.length - 1] ? ` ${unit}` : ''}</text></g>)}
        </g>
        <g clipPath="url(#tlclip)">
          {days.map((d: Day, k) => {
            const {rise, set} = sunTimes(d.t, lat, lon);
            const prev = sunTimes(new Date(Date.parse(d.t) - 86400000).toISOString(), lat, lon).set;
            return <g key={d.key}>
              <rect x={XT(prev)} y={PT - 8} width={Math.max(0, XT(rise) - XT(prev))} height={RB - PT + 8} fill="var(--ch-night)" />
              {k === days.length - 1 && <rect x={XT(set)} y={PT - 8} width={inner} height={RB - PT + 8} fill="var(--ch-night)" />}
              <line className="tl-day" x1={X(d.start - 0.5)} x2={X(d.start - 0.5)} y1={0} y2={RB + 8} />
              {(d.end - d.start + 1) * pxh > 64 && X(d.end + 0.5) - Math.max(X(d.start - 0.5), G) > 70 &&
                <text className="tl-dlab" x={Math.max(X(d.start - 0.5), G) + 6} y={14}>{weekdayPT(d.t)} {dayNumPT(d.t)}</text>}
            </g>;
          })}
          <g key={tab} className="tl-fade">
            {tab === 'surf' && <>
              <path d={`${mainPath} L${X(i1)},${PB} L${X(i0)},${PB}Z`} fill="url(#gHs)" />
              <path d={mainPath} fill="none" stroke="var(--hs-hi)" strokeWidth={2} strokeLinejoin="round" />
              {hasTide && <path d={monotonePath(vis.map((h, k) => [X(i0 + k), TYs(h.forecast.tide.height)]))} fill="none" stroke="var(--tide)" strokeWidth={1.4} strokeDasharray="5 4" />}
            </>}
            {tab === 'swell' && <>
              <path d={`${mainPath} L${X(i1)},${PB} L${X(i0)},${PB}Z`} fill="url(#gSw)" />
              <path d={mainPath} fill="none" stroke="var(--sw1)" strokeWidth={2} strokeLinejoin="round" />
              {vis.some((h) => h.forecast.secondary) && <path d={line((h) => h.forecast.secondary?.height ?? 0)} fill="none" stroke="var(--sw2)" strokeWidth={1.5} strokeDasharray="5 4" />}
              {peaks.map(({h, i}) => <g key={`pk${h.timestamp}`}><circle cx={X(i)} cy={Y(h.forecast.primary!.height)} r={3} fill="var(--sw1)" />
                <text className="tl-pk" x={X(i)} y={Y(h.forecast.primary!.height) - 9} textAnchor="middle">{Math.round(h.forecast.primary!.period)}s</text></g>)}
            </>}
            {tab === 'wind' && <>
              <path d={`${mainPath} L${X(i1)},${PB} L${X(i0)},${PB}Z`} fill="url(#gWd)" />
              <path d={line((h) => h.forecast.wind.gusts ?? h.forecast.wind.speed ?? 0)} fill="none" stroke="var(--muted)" strokeWidth={1.2} strokeDasharray="3 4" />
              <path d={mainPath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
              {vis.map((h, k) => {
                const i = i0 + k, w = h.forecast.wind;
                if (i % every || !Number.isFinite(w.direction)) return null;
                const c = wc(w.speed), len = 5 + Math.min(5, w.speed / 3);
                return <g key={`w${h.timestamp}`} transform={`translate(${X(i)},${PB + 15}) rotate(${(w.direction + 180) % 360})`}>
                  <line y1={len} y2={-len} stroke={c} strokeWidth={1.6} strokeLinecap="round" /><path d={`M-3.5,${-len + 4.5} L0,${-len} L3.5,${-len + 4.5}`} fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </g>;
              })}
            </>}
            {tab === 'tide' && (hasTide ? <>
              <path d={`${mainPath} L${X(i1)},${PB} L${X(i0)},${PB}Z`} fill="url(#gTd)" />
              <path d={mainPath} fill="none" stroke="var(--tide)" strokeWidth={2} strokeLinejoin="round" />
              {pxh > 4 && extrema.map((e) => {
                const x = XT(Date.parse(e.timestamp)), v = e.height.value;
                if (x < G || x > W || v === null) return null;
                return <g key={e.timestamp}><circle cx={x} cy={Y(v)} r={3} fill="var(--tide)" />
                  {pxh > 9 && <text className="tl-pk" x={x} y={Y(v) + (e.type === 'High' ? -9 : 17)} textAnchor="middle">{timeLabelPT(e.timestamp).replace(' ', '').toLowerCase()}</text>}</g>;
              })}
            </> : <text className="tl-ax" x={G + inner / 2} y={(PT + PB) / 2} textAnchor="middle">No tide station near this spot yet</text>)}
          </g>
          {vis.map((h, k) => <rect key={h.timestamp} x={X(i0 + k) - pxh / 2} y={RB} width={pxh + 0.5} height={5} rx={pxh > 8 ? 1 : 0} fill={BAND_COLOR[bandOf(h.rating.category)]} />)}
          {nowI >= 0 && <line x1={X(nowI)} x2={X(nowI)} y1={PT - 8} y2={RB + 2} stroke="var(--warn)" strokeWidth={1.2} strokeDasharray="2 3" />}
          {vis.map((h, k) => (localHour(h.timestamp) % stepH ? null : <text key={`t${h.timestamp}`} className="tl-ax tl-dim" x={X(i0 + k)} y={height - 8} textAnchor="middle">{hourLabel(h.timestamp)}</text>))}
          {hover && hover.i !== sel && <g><line x1={X(hover.i)} x2={X(hover.i)} y1={PT - 8} y2={RB + 2} stroke="var(--ch-hover)" />
            <circle cx={X(hover.i)} cy={Y(val(series[hover.i]))} r={3.5} fill="var(--bg)" stroke="var(--ch-ink)" strokeWidth={1.75} /></g>}
        </g>
        <text className="tl-row" x={0} y={RB + 5}>Rating</text>
        <g className="sel-g" style={{transform: `translateX(${X(sel)}px)`}}>
          <line y1={PT - 8} y2={RB + 2} stroke="var(--ch-ink)" strokeWidth={1.5} />
          <circle cy={Y(val(selH))} r={5} fill="var(--bg)" stroke={tab === 'wind' ? 'var(--accent)' : tab === 'tide' ? 'var(--tide)' : tab === 'swell' ? 'var(--sw1)' : 'var(--hs-hi)'} strokeWidth={2.5} />
        </g>
      </svg>
      {tipH && hover && (
        <div className="tl-tip" style={{transform: `translate3d(${tipLeft}px, ${tipTop}px, 0)`, width: TIP_W}}>
          <b>{weekdayPT(tipH.timestamp)} {hourLabel(tipH.timestamp)}<small>{hover.i === sel ? 'selected' : 'preview'}</small></b>
          <span className={tab === 'surf' ? 'on' : ''}><i style={{background: 'var(--hs-hi)'}} />Offshore<em>{ht(tipH.heightFt, p)} {u}</em></span>
          <span className={tab === 'swell' ? 'on' : ''}><i style={{background: 'var(--sw1)'}} />Swell<em>{tipH.forecast.primary ? `${ht(tipH.forecast.primary.height, p)} ${u} @ ${Math.round(tipH.forecast.primary.period)}s ${compass(tipH.forecast.primary.direction)}` : '—'}</em></span>
          <span className={tab === 'wind' ? 'on' : ''}><i style={{background: wc(tipH.forecast.wind.speed)}} />Wind<em>{windVal(tipH.forecast.wind.speed, p)} {p.windUnit} {compass(tipH.forecast.wind.direction)}</em></span>
          <span className={tab === 'tide' ? 'on' : ''}><i style={{background: 'var(--tide)'}} />Tide<em>{Number.isFinite(tipH.forecast.tide.height) ? `${signed(tipH.forecast.tide.height, p)} ${u}${tipH.forecast.tide.trend ? ` ${tipH.forecast.tide.trend.toLowerCase()}` : ''}` : '—'}</em></span>
          <span className="tl-tip-r"><Condition category={tipH.rating.category} chip />{tipH.rating.score !== null && <small>{Math.round(tipH.rating.score)}</small>}</span>
        </div>
      )}
    </div>
  );
}

const SCALE: [string, number, number][] = [['Poor', 0, 25], ['Weak', 25, 40], ['Surfable', 40, 55], ['Not Bad', 55, 65], ['Solid', 65, 75], ['Good', 75, 85], ['Firing', 85, 95], ['Epic', 95, 100]];
const HALF: Record<string, number> = {HIGH: 4, MODERATE: 8, LIMITED: 14, INSUFFICIENT: 22};
/** Rating on the real category thresholds. Band width = reliability tier (a cue, not a measured range). */
export function QualityBand({score, reliability}: {score: number | null; reliability: string}) {
  const X = (v: number) => 4 + (v / 100) * 292, half = HALF[reliability] ?? 22;
  return (
    <svg className="qband" viewBox="0 0 300 40" aria-hidden="true">
      {SCALE.map(([n, a, b]) => <rect key={n} x={X(a) + 0.5} y={12} width={X(b) - X(a) - 1} height={8} rx={2} fill={BAND_COLOR[a >= 65 ? 'good' : a >= 40 ? 'fair' : 'poor']} fillOpacity={a >= 40 ? 0.55 : 0.9} />)}
      {[['Poor', 0, 'start'], ['Surfable', 40, 'start'], ['Solid', 65, 'start'], ['Epic', 100, 'end']].map(([t, v, anchor]) => <text key={t as string} x={X(v as number)} y={37} fontSize={11} fill="var(--dim)" textAnchor={anchor as 'start' | 'end'}>{t}</text>)}
      {score !== null && <>
        <rect x={X(Math.max(0, score - half))} y={8} width={X(Math.min(100, score + half)) - X(Math.max(0, score - half))} height={16} rx={4} fill="var(--ch-band-fill)" stroke="var(--ch-band-line)" strokeDasharray="3 2" />
        <g className="mk" style={{transform: `translateX(${X(score)}px)`}}><line y1={5} y2={27} stroke="var(--ch-ink)" strokeWidth={2.5} strokeLinecap="round" /></g>
      </>}
    </svg>
  );
}

/** Compass dial; arrows sit on the side the swell or wind comes FROM and point inward. */
export function Dial({arms, facing}: {arms: ({from: number; color: string; w: number} | null)[]; facing: number | null}) {
  const pt = (deg: number, r: number) => [Math.sin((deg * Math.PI) / 180) * r, -Math.cos((deg * Math.PI) / 180) * r];
  let wedge = '';
  if (facing !== null) { const [x1, y1] = pt(facing - 55, 40), [x2, y2] = pt(facing + 55, 40); wedge = `M0,0 L${x1},${y1} A40,40 0 0 1 ${x2},${y2}Z`; }
  return (
    <svg className="dial" viewBox="-58 -56 116 112" aria-hidden="true">
      <circle r={40} fill="none" stroke="var(--ch-ring)" strokeWidth={0.8} />
      {Array.from({length: 24}, (_, k) => { const [x1, y1] = pt(k * 15, 40), [x2, y2] = pt(k * 15, k % 6 === 0 ? 34 : 37); return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ch-ring)" strokeWidth={0.8} />; })}
      {['N', 'E', 'S', 'W'].map((l, k) => { const [x, y] = pt(k * 90, 49); return <text key={l} x={x} y={y + 4} fontSize={11} fill="var(--dim)" textAnchor="middle">{l}</text>; })}
      {wedge && <path d={wedge} fill="var(--ch-wedge)" />}
      {arms.map((a, k) => a && (
        <g key={k} className="arm" style={{transform: `rotate(${a.from}deg)`}}>
          <line x1={0} y1={-38} x2={0} y2={-6} stroke={a.color} strokeWidth={Math.min(a.w, 4)} strokeLinecap="round" />
          <path d="M-6,-14 L0,-5 L6,-14" fill="none" stroke={a.color} strokeWidth={Math.min(a.w, 4)} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      <circle r={1.8} fill="var(--ch-ink)" />
    </svg>
  );
}

/** Sparkline stretched to its tile; strokes and the marker dot use non-scaling strokes so nothing distorts. */
export function Spark({values, index, color}: {values: number[]; index: number; color: string}) {
  if (!values.length || values.some((v) => !Number.isFinite(v))) return null;
  const lo = Math.min(...values), hi = Math.max(...values), pad = (hi - lo || 1) * 0.15, n = values.length;
  const X = (i: number) => 2 + (i / Math.max(1, n - 1)) * 116, Yv = (v: number) => 48 - ((v - (lo - pad)) / (hi - lo + 2 * pad || 1)) * 42;
  const d = monotonePath(values.map((v, i) => [X(i), Yv(v)]));
  const ns = {vectorEffect: 'non-scaling-stroke' as const};
  return (
    <svg className="spark" viewBox="0 0 120 56" preserveAspectRatio="none" aria-hidden="true">
      <line x1={2} x2={118} y1={54} y2={54} stroke="var(--ch-grid)" {...ns} />
      <path d={`${d} L${X(n - 1)},54 L${X(0)},54Z`} fill={color} fillOpacity={0.14} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} {...ns} />
      <line x1={X(index)} x2={X(index)} y1={4} y2={54} stroke="var(--ch-hover)" {...ns} />
      <line x1={X(index)} x2={X(index)} y1={Yv(values[index])} y2={Yv(values[index])} stroke="var(--ch-ink)" strokeWidth={7} strokeLinecap="round" {...ns} />
    </svg>
  );
}

/** Direction (where swell comes from) × period (radius) for every hour of the selected day. */
export function PolarSwell({hours, selected, facing, onSelect}: {hours: HourSample[]; selected: string | null; facing: number | null; onSelect: (t: string) => void}) {
  const R = (p: number) => (Math.min(20, p) / 20) * 108;
  const pos = (deg: number, p: number) => [Math.sin((deg * Math.PI) / 180) * R(p), -Math.cos((deg * Math.PI) / 180) * R(p)];
  return (
    <svg viewBox="-130 -130 260 260" style={{width: '100%', height: 240}} role="img" aria-label="Swell direction and period for the selected day">
      {facing !== null && (() => { const [x1, y1] = pos(facing - 55, 22.5), [x2, y2] = pos(facing + 55, 22.5); return <path d={`M0,0 L${x1},${y1} A112,112 0 0 1 ${x2},${y2}Z`} fill="var(--ch-wedge)" />; })()}
      {[5, 10, 15, 20].map((p) => <g key={p}><circle r={R(p)} fill="none" stroke={p === 20 ? 'var(--ch-ring)' : 'var(--ch-div)'} strokeWidth={0.8} /><text x={4} y={-R(p) + 12} fontSize={11} fill="var(--dim)">{p}s</text></g>)}
      {['N', 'E', 'S', 'W'].map((l, k) => { const [x, y] = pos(k * 90, 23.5); return <text key={l} x={x} y={y + 4} fontSize={11} fill="var(--muted)" textAnchor="middle">{l}</text>; })}
      {hours.flatMap((h) => {
        const isSel = h.timestamp === selected;
        return ([[h.forecast.secondary, 'var(--sw2)'], [h.forecast.primary, 'var(--sw1)']] as const).map(([s, c], k) => {
          if (!s || !Number.isFinite(s.height)) return null;
          const [x, y] = pos(s.direction, s.period);
          return <circle key={`${h.timestamp}${k}`} cx={x} cy={y} r={(isSel ? 3 : 1.6) + s.height * (isSel ? 1.1 : 0.7)} fill={c} fillOpacity={isSel ? 1 : 0.3}
            stroke={isSel ? 'var(--bg)' : 'none'} strokeWidth={1.5} style={{cursor: 'pointer'}} onClick={() => onSelect(h.timestamp)} />;
        });
      })}
      {facing === null && <text y={126} fontSize={11} fill="var(--dim)" textAnchor="middle">Beach orientation not documented</text>}
    </svg>
  );
}

export function TideDay({hours, selected, extrema, spot, p, onSelect}: {hours: HourSample[]; selected: string | null; extrema: TidePrediction[]; spot: SurfSpot; p: UserProfile; onSelect: (t: string) => void}) {
  if (!hours.length) return null;
  if (!hours.some((h) => Number.isFinite(h.forecast.tide.height))) return <p className="fine">No tide station near this spot yet. The San Francisco station is only used for spots near the Bay.</p>;
  const vals = hours.map((h) => h.forecast.tide.height), lo = Math.min(...vals) - 0.6, hi = Math.max(...vals) + 0.6;
  const t0 = Date.parse(hours[0].timestamp), span = Date.parse(hours[hours.length - 1].timestamp) - t0 || 1;
  const X = (ms: number) => 8 + ((ms - t0) / span) * 344, Yv = (v: number) => 150 - ((v - lo) / (hi - lo)) * 126;
  const pts = hours.map((h) => [X(Date.parse(h.timestamp)), Yv(h.forecast.tide.height)] as [number, number]);
  const [lat, lon] = spotLatLon(spot), {rise, set} = sunTimes(hours[0].timestamp, lat, lon);
  const k = hours.findIndex((h) => h.timestamp === selected);
  return (
    <svg viewBox="0 0 360 172" style={{width: '100%', height: 190, cursor: 'pointer'}} role="img" aria-label="Tide for the selected day"
      onClick={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); const ms = t0 + ((((e.clientX - r.left) / r.width) * 360 - 8) / 344) * span; const best = hours.reduce((b, h) => (Math.abs(Date.parse(h.timestamp) - ms) < Math.abs(Date.parse(b.timestamp) - ms) ? h : b)); onSelect(best.timestamp); }}>
      <rect x={8} y={10} width={Math.max(0, X(rise) - 8)} height={146} fill="var(--ch-night)" /><rect x={X(set)} y={10} width={Math.max(0, 352 - X(set))} height={146} fill="var(--ch-night)" />
      <path d={`${monotonePath(pts)} L352,156 L8,156Z`} fill="var(--tide)" fillOpacity={0.1} /><path d={monotonePath(pts)} fill="none" stroke="var(--tide)" strokeWidth={1.75} strokeLinejoin="round" />
      {extrema.filter((e) => Date.parse(e.timestamp) >= t0 && Date.parse(e.timestamp) <= t0 + span && e.height.value !== null).map((e) => {
        const x = X(Date.parse(e.timestamp)), y = Yv(e.height.value!);
        return <g key={e.timestamp}><circle cx={x} cy={y} r={3} fill="var(--tide)" /><text x={x} y={e.type === 'High' ? y - 9 : y + 17} fontSize={11} fill="var(--text)" textAnchor="middle" style={{fontVariantNumeric: 'tabular-nums'}}>{ht(e.height.value, p)} · {timeLabelPT(e.timestamp)}</text></g>;
      })}
      {k >= 0 && <g><line x1={pts[k][0]} x2={pts[k][0]} y1={10} y2={156} stroke="var(--ch-ink)" strokeWidth={1} /><circle cx={pts[k][0]} cy={pts[k][1]} r={4} fill="var(--ch-ink)" /></g>}
      <text x={X(rise)} y={169} fontSize={11} fill="var(--dim)" textAnchor="middle">↑ {timeLabelPT(rise)}</text><text x={X(set)} y={169} fontSize={11} fill="var(--dim)" textAnchor="middle">↓ {timeLabelPT(set)}</text>
    </svg>
  );
}

export {groupDays};

import {noTideCurveText} from './tideNote';
import {partitionKind} from '../../services/swellParts';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {SurfSpot, UserProfile} from '../../models/index';
import type {TidePrediction} from '../../ocean/types';
import {BAND_COLOR, bandOf, hourLabel, type HourSample} from './model';
import {groupDays, ht, monotonePath, spotLatLon, sunTimes, windColor, windVal, type Day} from './helpers';
import {timeLabelPT, weekdayPT, dayNumPT, localHour} from './format';
import {conditionWord} from '../../ui/Condition';
import type {SurfBandPoint} from './trustApi';
import {estimateBand, hasEstimateBand} from './trustRules';
import {surfReadout} from './chartReadout';
import {type Certainty} from '../../services/certainty';

/** certainty (2026-11-06): how strongly the surf band is drawn per hour (a mask; our own choice of steps, matching the day cards' fade). */
const SURE_OPACITY: Record<Certainty, number> = {high: 1, medium: 0.82, low: 0.5, 'too-far': 0.32};

/** Wind-speed colour for marks on the current ground: the pastel Windy-like ramp is mixed toward black in the light theme (--wind-darken). */
/** Wind ramp darkened by --wind-darken. Browsers without color-mix (Safari < 16.2) get the plain ramp colour so arrows still draw. */
const hasColorMix = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('color', 'color-mix(in srgb, red, black 10%)');
export const windInk = (mph: number) => (hasColorMix ? `color-mix(in srgb, ${windColor(mph)}, black var(--wind-darken))` : windColor(mph));

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animate a numeric range toward `target` (interruptible: a new target restarts from the current value). */
export function useAnimatedRange(target: [number, number]) {
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
  /** T-065: the surf estimate per hour (same engine as the SURF card); the surf tab plots it, offshore Hs is a thin secondary line. */
  band?: SurfBandPoint[];
  /** Stacked forecast (2026-11-08): this chart's name drawn inside it, which shared axes it carries, and a selection line / night shading that run edge to edge so stacked charts read as one. */
  title?: string; showDays?: boolean; showHours?: boolean; showRibbon?: boolean; stacked?: boolean;
  /** forecast-charts (2026-11-12): the hours on screen, [first, last] as fractional indices, shared by the four panels (ForecastCharts animates it); the panel draws, the
   *  shared slider around the panels handles the pointer and the keys, and `hoverIndex` is the hour under the pointer (a preview line on every panel). */
  view: [number, number]; hoverIndex?: number | null;
  /** extra px above the plot (room for the panel's own key when it takes two lines on a phone) */ padTop?: number;
}
/** The plot's left gutter and right pad (px): every panel shares them, so one x maps to the same hour on all four. */
export const CH_G = 44, CH_PAD = 14;
/** The hour as the slider announces it, with the same kind words the readout shows (chartReadout.ts): "Thu 11 AM, surf estimate 13 to 16 ft (model estimate · low confidence), Solid";
 *  an hour with no estimate is "offshore 7.3 ft (offshore · not surf size), …". Ranges are whole feet, or metres to one decimal. */
export function hourValueText(h: HourSample, pt: SurfBandPoint | undefined, p: UserProfile): string {
  const u = p.heightUnit, d = u === 'm' ? 1 : 0, b = estimateBand(pt), rs = surfReadout(h.heightFt, pt, (ft) => `${ht(ft, p)} ${u}`, (lo, hi) => `${ht(lo, p, d)}–${ht(hi, p, d)} ${u}`);
  const kind = rs.v === 'too far out' ? `too far out to call; ${rs.kind.replace(/^to call; the model says [^·]+· /, '')}` : rs.kind;
  return `${weekdayPT(h.timestamp)} ${hourLabel(h.timestamp)}, ${b?.flat ? `surf estimate Flat (${kind})` : b ? `surf estimate ${ht(b.lo, p, d)} to ${ht(b.hi, p, d)} ${u} (${kind})` : `offshore ${ht(h.heightFt, p)} ${u} (${kind})`}, ${conditionWord(h.rating.category)}`;
}
const niceStep = (range: number) => [0.5, 1, 2, 5, 10, 20].find((s) => range / s <= 5) ?? 20;
/** The forecast spine: one series per tab (surf, swell, wind, tide) plus the rating ribbon and night on one time axis. */
/** T-119: the swell components drawn on the Swell tab, each its own colour. */
const SWELLS = [{k: 'primary', cls: 'sw1'}, {k: 'secondary', cls: 'sw2'}, {k: 'tertiary', cls: 'sw3'}] as const;

export function Timeline({series, spot, p, selectedTime, now, extrema, height = 300, tab = 'surf', band, title, showDays = true, showHours = true, showRibbon = true, stacked = false, view, hoverIndex = null, padTop = 0}: TimelineProps) {
  const body = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    if (body.current) ro.observe(body.current);
    return () => ro.disconnect();
  }, []);
  const days = useMemo(() => groupDays(series), [series]);
  const n = series.length;
  const sel = Math.max(0, series.findIndex((h) => h.timestamp === selectedTime));
  const [a, b] = view;
  const G = CH_G, PAD = CH_PAD, inner = W - G - PAD, pxh = inner / (b - a);
  const X = (i: number) => G + (i - a) * pxh;
  const tides = series.map((h) => (Number.isFinite(h.forecast.tide.height) ? h.forecast.tide.height : 0));
  const hasTide = series.some((h) => Number.isFinite(h.forecast.tide.height)); // spots far from the SF station have none
  const noTide = tab === 'tide' && !hasTide; // audit A3: no axis, no point at a made-up 0 ft, just the message
  const tLo = Math.min(...tides), tHi = Math.max(...tides);
  const bandAt = useMemo(() => new Map((band ?? []).map((b) => [b.t, b])), [band]);
  const surfBand = tab === 'surf' && hasEstimateBand(bandAt.values());
  /** The hour's surf-estimate band, or undefined: offshore and demonstration points are not surf estimates (CONTRACTS.md), so they never become bars. */
  const bAt = (h: HourSample) => estimateBand(bandAt.get(h.timestamp));
  // T-119: the Swell tab scales to the swells alone (the surf band's top squashed them into the bottom third).
  const hsMax = Math.max(1, ...series.map((h) => tab === 'swell' ? Math.max(h.forecast.primary?.height ?? 0, h.forecast.secondary?.height ?? 0, h.forecast.tertiary?.height ?? 0)
    : Math.max(h.heightFt ?? 0, h.forecast.primary?.height ?? 0, bAt(h)?.hi ?? 0))) * 1.12;
  const wMax = Math.max(10, ...series.map((h) => Math.max(h.forecast.wind.speed || 0, h.forecast.wind.gusts || 0))) * 1.12;
  const [lo, hi] = tab === 'wind' ? [0, wMax] : tab === 'tide' ? [tLo - (tHi - tLo || 1) * 0.15, tHi + (tHi - tLo || 1) * 0.2] : [0, hsMax];
  const Y = (v: number) => PB - ((v - lo) / (hi - lo || 1)) * (PB - PT);
  const step = niceStep(hi - lo), t0y = Math.ceil(lo / step) * step;
  const ticks: number[] = []; for (let v = t0y; v <= hi + 1e-6; v += step) ticks.push(Math.round(v * 100) / 100);
  const unit = tab === 'wind' ? p.windUnit : p.heightUnit;
  const tickText = (v: number) => (tab === 'wind' ? String(Math.round(Number(windVal(v, p)))) : ht(v, p, step < 1 || p.heightUnit === 'm' ? 1 : 0));
  // phone pass 6: the top tick carries the unit ('30 ft') when it fits the 44 px gutter; otherwise ('40 mph') the unit joins the title, which then has a row
  // of its own (under the day names when they show), so it is never clipped. PT is set from it, after the ticks (Y reads PT only when it is called).
  const topTick = ticks.length ? `${tab === 'tide' && ticks[ticks.length - 1] > 0 ? '+' : ''}${tickText(ticks[ticks.length - 1])} ${unit}` : '';
  const unitInTitle = !!title && topTick.length * 6.6 > G - 10;
  const PT = (showDays ? 30 : 12) + (title && (!showDays || unitInTitle) ? 12 : 0) + padTop, RB = showRibbon ? (showHours ? height - 36 : height - 12) : (showHours ? height - 24 : height - 2), PB = RB - (showRibbon || tab === 'wind' ? 26 : 8);
  const top = stacked ? 0 : PT - 8, bottom = stacked ? (showHours ? height - 20 : height) : RB; // night shading / day lines / selection span the whole chart when stacked
  const val = (h: HourSample) => (tab === 'wind' ? h.forecast.wind.speed || 0 : tab === 'tide' ? (Number.isFinite(h.forecast.tide.height) ? h.forecast.tide.height : 0) : tab === 'swell' ? h.forecast.primary?.height ?? 0
    : surfBand && bAt(h) ? (bAt(h)!.lo + bAt(h)!.hi) / 2 : h.heightFt ?? 0);
  // j3 (2026-11-12): an hour with no surf estimate (e.g. the forecast's last hour, past the nearshore run) is announced and shown as offshore Hs, so its
  // marker sits on the offshore line in that line's grey; it used to fall to 0 ft, a flat reading the data never gave.
  const onEst = (h: HourSample | undefined) => !!h && surfBand && !!bAt(h);
  const t0 = n ? Date.parse(series[0].timestamp) : 0, XT = (ms: number) => X((ms - t0) / 3600000);
  const i0 = Math.max(0, Math.floor(a) - 1), i1 = Math.min(n - 1, Math.ceil(b) + 1);
  const vis = series.slice(i0, i1 + 1);
  const line = (f: (h: HourSample) => number) => monotonePath(vis.map((h, k) => [X(i0 + k), Y(f(h))]));
  // T-109: runs of consecutive hours that have a surf estimate, as [x, lo, hi]; the band and median are drawn per run so a gap is never bridged.
  const estRuns: [number, number, number][][] = [];
  vis.forEach((h, k) => { const b = bAt(h), ok = b && b.lo !== null && b.hi !== null; if (!ok) { if (estRuns.length && estRuns[estRuns.length - 1].length) estRuns.push([]); return; }
    if (!estRuns.length) estRuns.push([]); estRuns[estRuns.length - 1].push([X(i0 + k), b!.lo!, b!.hi!]); });
  for (let r = estRuns.length - 1; r >= 0; r--) if (!estRuns[r].length) estRuns.splice(r, 1);
  // certainty (2026-11-06): runs of hours where the wave models disagree, as [x, wideLo, wideHi]: drawn as a dashed outline around the band (the range widened over the models).
  const wideRuns: [number, number, number][][] = []; let wr: [number, number, number][] = [];
  vis.forEach((h, k) => { const w = bAt(h)?.wide; if (w) wr.push([X(i0 + k), w.loFt, w.hiFt]); else if (wr.length) { wideRuns.push(wr); wr = []; } }); if (wr.length) wideRuns.push(wr);
  // The first visible hour past the forecast horizon ("too far out"); lead only grows with time, so every later hour is past it too.
  const farK = vis.findIndex((h) => bandAt.get(h.timestamp)?.certainty === 'too-far'), farX = farK >= 0 ? Math.max(G, X(i0 + farK) - pxh / 2) : null;
  const mainPath = line(val);
  // Mid-transition the window can sit past the series (vis empty); an area must never start without a moveto (D-05).
  const areaD = mainPath ? `${mainPath} L${X(i1)},${PB} L${X(i0)},${PB}Z` : undefined;
  const [lat, lon] = spotLatLon(spot);
  const nowI = series.findIndex((h) => Date.parse(h.timestamp) >= Math.floor(now / 3600000) * 3600000);

  if (!n) return null;
  const selH = series[sel], hover = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n ? {i: hoverIndex} : null;
  const stepH = [1, 2, 3, 6, 12, 24].find((s) => s * pxh >= 46) ?? 24;
  const every = Math.max(1, Math.ceil(20 / pxh));
  const wc = windInk;

  return (
    <div className="tl-panel" ref={body}>
      <svg viewBox={`0 0 ${W} ${height}`} style={{height}} aria-hidden="true" className="tl-svg">
        <defs>
          <linearGradient id="gHs" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--hs-hi)" stopOpacity="0.5" /><stop offset="1" stopColor="var(--hs)" stopOpacity="0.03" /></linearGradient>
          <linearGradient id="gRate" gradientUnits="userSpaceOnUse" x1={X(i0)} x2={X(Math.max(i0 + 1, i1))} y1="0" y2="0">
            {vis.map((h, k) => <stop key={h.timestamp} offset={vis.length > 1 ? k / (vis.length - 1) : 0} stopColor={BAND_COLOR[bandOf(h.rating.category)]} />)}
          </linearGradient>
          <linearGradient id="gSw" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--sw1)" stopOpacity="0.28" /><stop offset="1" stopColor="var(--sw1)" stopOpacity="0.02" /></linearGradient>
          <linearGradient id="gWd" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity="0.4" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0.03" /></linearGradient>
          <linearGradient id="gTd" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--tide)" stopOpacity="0.38" /><stop offset="1" stopColor="var(--tide)" stopOpacity="0.03" /></linearGradient>
          <clipPath id="tlclip"><rect x={G} y={0} width={inner} height={height} /></clipPath>
          <linearGradient id="gSure" gradientUnits="userSpaceOnUse" x1={X(i0)} x2={X(Math.max(i0 + 1, i1))} y1="0" y2="0">
            {vis.map((h, k) => { const c = bandAt.get(h.timestamp)?.certainty; return <stop key={h.timestamp} offset={vis.length > 1 ? k / (vis.length - 1) : 0} stopColor="#fff" stopOpacity={c ? SURE_OPACITY[c] : 1} />; })}
          </linearGradient>
          <mask id="mSure" maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={height}><rect x={0} y={0} width={W} height={height} fill="url(#gSure)" /></mask>
          <pattern id="pFar" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1={0} y1={0} x2={0} y2={6} className="tl-far-line" /></pattern>
        </defs>
        <g key={`ax${tab}`} className="tl-fade">
          {!noTide && ticks.map((v) => <g key={v}><line className="tl-grid" x1={G} x2={W - PAD} y1={Y(v)} y2={Y(v)} /><text className="tl-ax" x={G - 8} y={Y(v) + 4} textAnchor="end">{tab === 'tide' && v > 0 ? '+' : ''}{tickText(v)}{v === ticks[ticks.length - 1] && !unitInTitle ? ` ${unit}` : ''}</text></g>)}
        </g>
        <g clipPath="url(#tlclip)">
          {days.map((d: Day, k) => {
            const {rise, set} = sunTimes(d.t, lat, lon);
            const prev = sunTimes(new Date(Date.parse(d.t) - 86400000).toISOString(), lat, lon).set;
            return <g key={d.key}>
              <rect x={XT(prev)} y={top} width={Math.max(0, XT(rise) - XT(prev))} height={bottom - top} fill="var(--ch-night)" />
              {k === days.length - 1 && <rect x={XT(set)} y={top} width={inner} height={bottom - top} fill="var(--ch-night)" />}
              <line className="tl-day" x1={X(d.start - 0.5)} x2={X(d.start - 0.5)} y1={0} y2={stacked ? bottom : RB + 8} />
            </g>;
          })}
          <g key={tab} className="tl-fade">
            {tab === 'surf' && surfBand && <>
              {/* T-109: one continuous band from the low to the high of the surf estimate, with its median as a line (not a bar per hour);
                  hours without an estimate break the band, never bridged. The offshore Hs stays a thin muted line. Tide is only on the Tide tab. */}
              {/* T-119 (Surfline-style undulating lines): each run's top and bottom are monotone cubic curves (no overshoot) through every third hour
                  plus the run's ends, so whole-foot steps in the hourly estimate read as one smooth swell of size; a soft fill between; the bottom edge is
                  colored by the hour's rating. */}
              {farX !== null && <g className="tl-far">
                <rect x={farX} y={PT - 8} width={Math.max(0, W - farX)} height={PB - PT + 8} fill="url(#pFar)" />
                {W - PAD - farX > 96 && <text className="tl-far-t" x={farX + 6} y={PT + 6}>too far out to call</text>}
              </g>}
              {wideRuns.map((r0) => { const run = r0.filter((_, k) => k % 3 === 0 || k === r0.length - 1); return run.length > 1 && <g key={`w${run[0][0]}`} className="tl-wide"><path d={monotonePath(run.map(([x, , hi]): [number, number] => [x, Y(hi)]))} /><path d={monotonePath(run.map(([x, lo]): [number, number] => [x, Y(lo)]))} /></g>; })}
              <g mask="url(#mSure)">
              {estRuns.map((run) => { const pts = run.filter((_, k) => k % 3 === 0 || k === run.length - 1);
                return <g key={`r${run[0][0]}`}>
                  <path className="tl-band" d={`${monotonePath(pts.map(([x, , hi]): [number, number] => [x, Y(hi)]))} L${monotonePath(pts.map(([x, lo]): [number, number] => [x, Y(lo)]).reverse()).slice(1)} Z`} />
                  <path className="tl-top" d={monotonePath(pts.map(([x, , hi]): [number, number] => [x, Y(hi)]))} />
                  <path className="tl-median" d={monotonePath(pts.map(([x, lo, hi]): [number, number] => [x, Y((lo + hi) / 2)]))} />
                  <path className="tl-bot" d={monotonePath(pts.map(([x, lo]): [number, number] => [x, Y(lo)]))} stroke="url(#gRate)" />
                </g>; })}
              </g>
              <path d={line((h) => h.heightFt ?? 0)} fill="none" stroke="var(--muted)" strokeWidth={1.2} strokeLinejoin="round" opacity={0.8} />
            </>}
            {tab === 'surf' && !surfBand && <>
              {/* T-108: with no surf estimate the only height drawn is the OFFSHORE Hs, in the Offshore Hs line style (the thin muted line the estimate view uses for it), never the blue "Surf estimate" area. */}
              <path d={mainPath} fill="none" stroke="var(--muted)" strokeWidth={1.4} strokeLinejoin="round" opacity={0.9} />
            </>}
            {tab === 'swell' && <>
              {/* T-119 (Surfline-style): one smooth line per swell component (primary, secondary, third), distinct colors; every 6 h (12 h when the
                  hours are tight, as on a phone) a direction arrow on the line (pointing where the swell travels) and, on the primary, its period. */}
              <path d={areaD} fill="url(#gSw)" />
              {SWELLS.map(({k, cls}) => {
                const comp = (h: HourSample) => { const c = h.forecast[k] ?? null; return partitionKind(c, k === 'primary') === 'noise' ? null : c; }; // audit A13: model noise is not drawn as swell
                if (!vis.some((h) => comp(h))) return null;
                const runs: [number, number][][] = []; let cur: [number, number][] = [];
                vis.forEach((h, j) => { const c = comp(h); if (c && Number.isFinite(c.height)) cur.push([X(i0 + j), Y(c.height)]); else if (cur.length) { runs.push(cur); cur = []; } }); if (cur.length) runs.push(cur);
                const every = pxh * 6 < 34 ? 12 : 6, labelEvery = [6, 12, 24].find((s) => pxh * s >= 30) ?? 24;
                return <g key={k} className={`tl-sw ${cls}`}>
                  {runs.map((r) => <path key={r[0][0]} d={monotonePath(r.filter((_, j) => j % 2 === 0 || j === r.length - 1))} />)}
                  {vis.map((h, j) => { const c = comp(h); if (!c || !Number.isFinite(c.height) || localHour(h.timestamp) % every) return null;
                    const x = X(i0 + j), y = Y(c.height);
                    return <g key={h.timestamp}>
                      <g transform={`translate(${x} ${y}) rotate(${(c.direction + 180) % 360})`}><path className="tl-sw-dir" d="M0 -5 L3.6 4 L0 2.2 L-3.6 4Z" /></g>
                      {k === 'primary' && localHour(h.timestamp) % labelEvery === 0 && <text className="tl-pk" x={x} y={y - 9} textAnchor="middle">{Math.round(c.period)}s{partitionKind(c, true) === 'chop' ? ' chop' : ''}</text>}
                    </g>; })}
                </g>; })}
            </>}
            {tab === 'wind' && <>
              <path d={areaD} fill="url(#gWd)" />
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
              <path d={areaD} fill="url(#gTd)" />
              <path d={mainPath} fill="none" stroke="var(--tide)" strokeWidth={2} strokeLinejoin="round" />
              {pxh > 4 && (() => { let lastLab = -Infinity; return extrema.map((e) => {
                const x = XT(Date.parse(e.timestamp)), v = e.height.value;
                if (x < G || x > W || v === null) return null;
                const lab = pxh > 9 && x - lastLab >= 40; if (lab) lastLab = x;   // phone pass 6: a time label never within 40 px of the last one drawn
                return <g key={e.timestamp}><circle cx={x} cy={Y(v)} r={3} fill="var(--tide)" />
                  {lab && <text className="tl-pk" x={x} y={Y(v) + (e.type === 'High' ? -9 : 17)} textAnchor="middle">{timeLabelPT(e.timestamp).replace(' ', '').toLowerCase()}</text>}</g>;
              }); })()}
            </> : <foreignObject x={G} y={PT} width={inner} height={Math.max(0, PB - PT)}><p className="tl-none">{noTideCurveText(spot.id)}</p></foreignObject>)}
          </g>
          {showRibbon && vis.map((h, k) => <rect key={h.timestamp} x={X(i0 + k) - pxh / 2} y={RB} width={Math.max(0, pxh + 0.5)} height={5} rx={pxh > 8 ? 1 : 0} fill={BAND_COLOR[bandOf(h.rating.category)]} />)}
          {nowI >= 0 && <line x1={X(nowI)} x2={X(nowI)} y1={stacked ? 0 : PT - 8} y2={stacked ? bottom : RB + 2} stroke="var(--warn)" strokeWidth={1.2} strokeDasharray="2 3" />}
          {showHours && stepH < 24 && vis.map((h, k) => (localHour(h.timestamp) % stepH ? null : <text key={`t${h.timestamp}`} className="tl-ax tl-dim" x={X(i0 + k)} y={height - 8} textAnchor="middle">{W < 520 ? hourLabel(h.timestamp).replace(':00', '').replace(/ ?AM$/, 'a').replace(/ ?PM$/, 'p') : hourLabel(h.timestamp)}</text>))}
          {hover && hover.i !== sel && <g><line x1={X(hover.i)} x2={X(hover.i)} y1={PT - 8} y2={RB + 2} stroke="var(--ch-hover)" />
            {!noTide && <circle cx={X(hover.i)} cy={Y(val(series[hover.i]))} r={3.5} fill="var(--bg)" stroke="var(--ch-ink)" strokeWidth={1.75} />}</g>}
        </g>
        {showRibbon && <text className="tl-row" x={0} y={RB + 5}>Rating</text>}
        {!noTide && <g className="sel-g" style={{transform: `translateX(${X(sel)}px)`}}>
          <line y1={stacked ? 0 : PT - 8} y2={stacked ? bottom : RB + 2} stroke="var(--ch-ink)" strokeWidth={1.5} />
          <circle cy={Y(val(selH))} r={5} fill="var(--bg)" stroke={tab === 'wind' ? 'var(--accent)' : tab === 'tide' ? 'var(--tide)' : tab === 'swell' ? 'var(--sw1)' : onEst(selH) ? 'var(--hs-hi)' : 'var(--muted)'} strokeWidth={2.5} />
        </g>}
        {/* phone pass 6: the day names and the panel title are drawn over the cursor (with a halo), so the cursor never cuts them; the title sits in the
            left gutter on the day row, never in the plot */}
        {showDays && <g clipPath="url(#tlclip)">{days.map((d: Day) => { const room = X(d.end + 0.5) - Math.max(X(d.start - 0.5), G); // T-109: phones get the short day name instead of none
          return room > 70 ? <text key={d.key} className="tl-dlab" x={Math.max(X(d.start - 0.5), G) + 6} y={14}>{weekdayPT(d.t)} {dayNumPT(d.t)}</text>
            : room > 30 ? <text key={d.key} className="tl-dlab" x={Math.max(X(d.start - 0.5), G) + 4} y={14}>{weekdayPT(d.t)}</text> : null; })}</g>}
        {title && <text className="tl-title" x={0} y={showDays ? (unitInTitle ? 31 : 14) : 13}>{title}{unitInTitle && <tspan className="tl-unit"> · {unit}</tspan>}</text>}
      </svg>
    </div>
  );
}

const SCALE: [string, number, number][] = [['Poor', 0, 25], ['Weak', 25, 40], ['Surfable', 40, 55], ['Not bad', 55, 65], ['Solid', 65, 75], ['Good', 75, 85], ['Firing', 85, 95], ['Epic', 95, 100]];
const HALF: Record<string, number> = {HIGH: 4, MODERATE: 8, LIMITED: 14, INSUFFICIENT: 22};
/** Rating on the real category thresholds. Band width = reliability tier (a cue, not a measured range). */
export function QualityBand({score, reliability}: {score: number | null; reliability: string}) {
  const X = (v: number) => 4 + (v / 100) * 292, half = HALF[reliability] ?? 22;
  return (
    <svg className="qband" viewBox="0 0 300 40" aria-hidden="true">
      {SCALE.map(([n, a, b]) => <rect key={n} x={X(a) + 0.5} y={12} width={Math.max(0, X(b) - X(a) - 1)} height={8} rx={2} fill={BAND_COLOR[a >= 65 ? 'good' : a >= 40 ? 'fair' : 'poor']} fillOpacity={a >= 40 ? 0.55 : 0.9} />)}
      {[['Poor', 0, 'start'], ['Surfable', 40, 'start'], ['Solid', 65, 'start'], ['Epic', 100, 'end']].map(([t, v, anchor]) => <text key={t as string} x={X(v as number)} y={37} fontSize={11} fill="var(--dim)" textAnchor={anchor as 'start' | 'end'}>{t}</text>)}
      {score !== null && <>
        <rect x={X(Math.max(0, score - half))} y={8} width={Math.max(0, X(Math.min(100, score + half)) - X(Math.max(0, score - half)))} height={16} rx={4} fill="var(--ch-band-fill)" stroke="var(--ch-band-line)" strokeDasharray="3 2" />
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
          if (!s || partitionKind(s, k === 1) === 'noise') return null;
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
  if (!hours.some((h) => Number.isFinite(h.forecast.tide.height))) return <p className="fine">{noTideCurveText(spot.id)}</p>;
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

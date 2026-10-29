import {useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import type {SurfSpot, UserProfile} from '../../models/index';
import type {TidePrediction} from '../../ocean/types';
import {BAND_COLOR, bandOf, hourLabel, titleCase, type HourSample} from './model';
import {groupDays, ht, monotonePath, spotLatLon, sunTimes, windColor, windVal, compass, type Day} from './helpers';
import {timeLabelPT, weekdayPT, dayNumPT, localHour} from './format';

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

export interface TimelineProps {
  series: HourSample[]; spot: SurfSpot; p: UserProfile; selectedTime: string | null; onSelect: (t: string) => void;
  now: number; dayIndex: number | null; extrema: TidePrediction[]; height?: number;
}
/** The forecast spine: wave height, swells, rating ribbon, wind, tide and night on one axis. */
export function Timeline({series, spot, p, selectedTime, onSelect, now, dayIndex, extrema, height = 300}: TimelineProps) {
  const body = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  const [hover, setHover] = useState<{i: number; x: number} | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    if (body.current) ro.observe(body.current);
    return () => ro.disconnect();
  }, []);
  const days = useMemo(() => groupDays(series), [series]);
  const n = series.length;
  const target: [number, number] = dayIndex !== null && days[dayIndex] ? [days[dayIndex].start - 0.5, days[dayIndex].end + 0.5] : [0, Math.max(1, n - 1)];
  const [a, b] = useAnimatedRange(target);
  const G = 38, PAD = 10, inner = W - G - PAD, pxh = inner / (b - a);
  const X = (i: number) => G + (i - a) * pxh;
  const max = Math.max(1, ...series.map((h) => Math.max(h.heightFt ?? 0, h.forecast.primary?.height ?? 0))) * 1.12;
  const Y = (v: number) => 168 - (v / max) * 142;
  const tides = series.map((h) => (Number.isFinite(h.forecast.tide.height) ? h.forecast.tide.height : 0));
  const tLo = Math.min(...tides), tHi = Math.max(...tides);
  const TY = (v: number) => height - 26 - ((v - tLo) / (tHi - tLo || 1)) * 34;
  const t0 = n ? Date.parse(series[0].timestamp) : 0, XT = (ms: number) => X((ms - t0) / 3600000);
  const sel = Math.max(0, series.findIndex((h) => h.timestamp === selectedTime));
  const i0 = Math.max(0, Math.floor(a) - 1), i1 = Math.min(n - 1, Math.ceil(b) + 1);
  const vis = series.slice(i0, i1 + 1);
  const [lat, lon] = spotLatLon(spot);
  const nowI = series.findIndex((h) => Date.parse(h.timestamp) >= Math.floor(now / 3600000) * 3600000);

  const idxAt = (clientX: number) => {
    const r = body.current!.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.round(a + (clientX - r.left - G) / pxh)));
  };
  const drag = useRef(false);
  const onDown = (e: PointerEvent) => { drag.current = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); const i = idxAt(e.clientX); onSelect(series[i].timestamp); setHover({i, x: e.clientX}); };
  const onMove = (e: PointerEvent) => { const i = idxAt(e.clientX); if (drag.current) onSelect(series[i].timestamp); if (drag.current || e.pointerType === 'mouse') setHover({i, x: e.clientX}); };
  const onUp = (e: PointerEvent) => { drag.current = false; if (e.pointerType !== 'mouse') setTimeout(() => setHover(null), 1400); };
  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = {ArrowRight: 1, ArrowLeft: -1, PageDown: 24, PageUp: -24};
    let i = sel;
    if (e.key in step) i = sel + step[e.key]; else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n - 1; else return;
    e.preventDefault();
    onSelect(series[Math.max(0, Math.min(n - 1, i))].timestamp);
  };
  if (!n) return null;
  const tipH = hover ? series[hover.i] : null;
  const selH = series[sel];
  const stepH = [1, 2, 3, 6, 12, 24].find((s) => s * pxh >= 46) ?? 24;
  const every = Math.max(1, Math.ceil(20 / pxh));
  const u = p.heightUnit;

  return (
    <div className="tl-body" ref={body} role="slider" tabIndex={0} aria-label="Forecast time. Arrow keys move one hour, Page Up and Page Down one day."
      aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={sel}
      aria-valuetext={selH ? `${weekdayPT(selH.timestamp)} ${hourLabel(selH.timestamp)}, offshore ${ht(selH.heightFt, p)} ${u}, ${titleCase(selH.rating.category)}` : ''}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => (drag.current = false)} onPointerLeave={() => !drag.current && setHover(null)} onKeyDown={onKey}>
      <svg viewBox={`0 0 ${W} ${height}`} style={{height}} aria-hidden="true">
        <defs>
          <linearGradient id="gHs" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--hs-hi)" stopOpacity="0.55" /><stop offset="1" stopColor="var(--hs)" stopOpacity="0.05" /></linearGradient>
          <clipPath id="tlclip"><rect x={G} y={0} width={inner} height={height} /></clipPath>
        </defs>
        <g clipPath="url(#tlclip)">
          {days.map((d: Day, k) => {
            const {rise, set} = sunTimes(d.t, lat, lon);
            const prev = sunTimes(new Date(Date.parse(d.t) - 86400000).toISOString(), lat, lon).set;
            return <g key={d.key}>
              <rect x={XT(prev)} y={18} width={Math.max(0, XT(rise) - XT(prev))} height={height - 34} fill="var(--ch-night)" />
              {k === days.length - 1 && <rect x={XT(set)} y={18} width={inner} height={height - 34} fill="var(--ch-night)" />}
              <line x1={X(d.start - 0.5)} x2={X(d.start - 0.5)} y1={0} y2={height - 14} stroke="var(--ch-div)" />
              {(d.end - d.start + 1) * pxh > 64 && X(d.end + 0.5) - Math.max(X(d.start - 0.5), G) > 70 &&
                <text x={Math.max(X(d.start - 0.5), G) + 6} y={12} fontSize={11} fontWeight={600} fill="var(--text)">{weekdayPT(d.t)} {dayNumPT(d.t)}</text>}
            </g>;
          })}
          <path d={`${monotonePath(vis.map((h, k) => [X(i0 + k), Y(h.heightFt ?? 0)]))} L${X(i1)},168 L${X(i0)},168Z`} fill="url(#gHs)" />
          <path d={monotonePath(vis.map((h, k) => [X(i0 + k), Y(h.heightFt ?? 0)]))} fill="none" stroke="var(--hs-hi)" strokeWidth={2} />
          <path d={monotonePath(vis.map((h, k) => [X(i0 + k), Y(h.forecast.primary?.height ?? 0)]))} fill="none" stroke="var(--sw1)" strokeWidth={1.4} opacity={0.9} />
          {vis.some((h) => h.forecast.secondary) && <path d={monotonePath(vis.map((h, k) => [X(i0 + k), Y(h.forecast.secondary?.height ?? 0)]))} fill="none" stroke="var(--sw2)" strokeWidth={1.3} strokeDasharray="4 3" />}
          {vis.map((h, k) => <rect key={h.timestamp} x={X(i0 + k) - pxh / 2} y={176} width={pxh + 0.5} height={9} fill={BAND_COLOR[bandOf(h.rating.category)]} />)}
          {vis.map((h, k) => {
            const i = i0 + k, w = h.forecast.wind;
            if (i % every || !Number.isFinite(w.direction)) return null;
            const c = windInk(w.speed), len = 7 + Math.min(10, w.speed / 1.4);
            return <g key={`w${h.timestamp}`} transform={`translate(${X(i)},212) rotate(${(w.direction + 180) % 360})`}>
              <line y1={len} y2={-len} stroke={c} strokeWidth={2} strokeLinecap="round" /><path d={`M-4,${-len + 5} L0,${-len} L4,${-len + 5}`} fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" />
            </g>;
          })}
          {every * pxh >= 30 && vis.map((h, k) => ((i0 + k) % every ? null : <text key={`ws${h.timestamp}`} x={X(i0 + k)} y={236} fontSize={9.5} fill="var(--muted)" textAnchor="middle">{windVal(h.forecast.wind.speed, p)}</text>))}
          <path d={`${monotonePath(vis.map((h, k) => [X(i0 + k), TY(h.forecast.tide.height)]))} L${X(i1)},${height - 22} L${X(i0)},${height - 22}Z`} fill="var(--tide)" fillOpacity={0.14} />
          <path d={monotonePath(vis.map((h, k) => [X(i0 + k), TY(h.forecast.tide.height)]))} fill="none" stroke="var(--tide)" strokeWidth={1.5} />
          {pxh > 4 && extrema.map((e) => {
            const x = XT(Date.parse(e.timestamp)), v = e.height.value;
            if (x < G || x > W || v === null) return null;
            return <g key={e.timestamp}><circle cx={x} cy={TY(v)} r={2.4} fill="var(--tide)" />
              {pxh > 9 && <text x={x + 4} y={TY(v) + (e.type === 'High' ? 12 : -5)} fontSize={9.5} fill="var(--muted)">{timeLabelPT(e.timestamp).replace(' ', '').toLowerCase()}</text>}</g>;
          })}
          {nowI >= 0 && <line x1={X(nowI)} x2={X(nowI)} y1={18} y2={height - 16} stroke="var(--warn)" strokeWidth={1.2} strokeDasharray="2 3" />}
          {vis.map((h, k) => (localHour(h.timestamp) % stepH ? null : <text key={`t${h.timestamp}`} x={X(i0 + k)} y={height - 2} fontSize={9.5} fill="var(--dim)" textAnchor="middle">{hourLabel(h.timestamp)}</text>))}
          {hover && hover.i !== sel && <line x1={X(hover.i)} x2={X(hover.i)} y1={16} y2={height - 14} stroke="var(--ch-hover)" strokeDasharray="3 3" />}
        </g>
        {Array.from({length: Math.floor(max / (max > 8 ? 2 : 1)) + 1}, (_, k) => k * (max > 8 ? 2 : 1)).map((v) =>
          <g key={v}><text x={G - 6} y={Y(v) + 3} fontSize={9.5} fill="var(--dim)" textAnchor="end">{ht(v, p, u === 'm' ? 1 : 0)}</text><line x1={G} x2={W - PAD} y1={Y(v)} y2={Y(v)} stroke="var(--ch-grid)" /></g>)}
        <text x={0} y={184} fontSize={8.5} fill="var(--dim)">Rating</text>
        <text x={0} y={214} fontSize={9} fill="var(--dim)">Wind</text>
        <text x={0} y={height - 34} fontSize={9} fill="var(--dim)">Tide</text>
        <g className="sel-g" style={{transform: `translateX(${X(sel)}px)`}}>
          <line y1={16} y2={height - 14} stroke="var(--ch-ink)" strokeWidth={1.4} />
          <circle cy={Y(selH?.heightFt ?? 0)} r={5} fill="var(--bg)" stroke="var(--hs-hi)" strokeWidth={2.5} />
          <circle cy={TY(selH?.forecast.tide.height ?? 0)} r={3.6} fill="var(--ch-ink)" />
        </g>
      </svg>
      {tipH && hover && (
        <div className="tl-tip" style={{left: Math.min(W - 186, Math.max(0, hover.x - body.current!.getBoundingClientRect().left + 14))}}>
          <b>{weekdayPT(tipH.timestamp)} {hourLabel(tipH.timestamp)} · {hover.i === sel ? 'selected' : 'preview'}</b>
          <span>Offshore Hs <em>{ht(tipH.heightFt, p)} {u}</em></span>
          <span>Primary <em>{tipH.forecast.primary ? `${ht(tipH.forecast.primary.height, p)} ${u} ${Math.round(tipH.forecast.primary.period)}s ${compass(tipH.forecast.primary.direction)}` : '—'}</em></span>
          <span>Secondary <em>{tipH.forecast.secondary ? `${ht(tipH.forecast.secondary.height, p)} ${u} ${Math.round(tipH.forecast.secondary.period)}s` : '—'}</em></span>
          <span>Wind <em>{windVal(tipH.forecast.wind.speed, p)} {p.windUnit} {compass(tipH.forecast.wind.direction)}</em></span>
          <span>Tide <em>{ht(tipH.forecast.tide.height, p)} {u}</em></span>
          <span>Rating <em style={{color: BAND_COLOR[bandOf(tipH.rating.category)]}}>{titleCase(tipH.rating.category)} {tipH.rating.score ?? ''}</em></span>
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
      {[['Poor', 0, 'start'], ['Surfable', 40, 'start'], ['Solid', 65, 'start'], ['Epic', 100, 'end']].map(([t, v, anchor]) => <text key={t as string} x={X(v as number)} y={36} fontSize={9} fill="var(--dim)" textAnchor={anchor as 'start' | 'end'}>{t}</text>)}
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
    <svg className="dial" viewBox="-50 -50 100 100" aria-hidden="true">
      <circle r={40} fill="none" stroke="var(--ch-ring)" />
      {['N', 'E', 'S', 'W'].map((l, k) => { const [x, y] = pt(k * 90, 47); return <text key={l} x={x} y={y + 3.5} fontSize={9} fill="var(--dim)" textAnchor="middle">{l}</text>; })}
      {wedge && <path d={wedge} fill="var(--ch-wedge)" />}
      {arms.map((a, k) => a && (
        <g key={k} className="arm" style={{transform: `rotate(${a.from}deg)`}}>
          <line x1={0} y1={-38} x2={0} y2={-6} stroke={a.color} strokeWidth={a.w} strokeLinecap="round" />
          <path d="M-6,-14 L0,-5 L6,-14" fill="none" stroke={a.color} strokeWidth={a.w} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  );
}

export function Spark({values, index, color}: {values: number[]; index: number; color: string}) {
  if (!values.length) return null;
  const lo = Math.min(...values) - 0.3, hi = Math.max(...values) + 0.3, n = values.length;
  const X = (i: number) => 4 + (i / Math.max(1, n - 1)) * 112, Yv = (v: number) => 50 - ((v - lo) / (hi - lo || 1)) * 40;
  const d = monotonePath(values.map((v, i) => [X(i), Yv(v)]));
  return (
    <svg className="spark" viewBox="0 0 120 56" aria-hidden="true">
      <path d={`${d} L116,54 L4,54Z`} fill={color} fillOpacity={0.16} /><path d={d} fill="none" stroke={color} strokeWidth={1.6} />
      <line x1={X(index)} x2={X(index)} y1={4} y2={54} stroke="var(--ch-hover)" /><circle cx={X(index)} cy={Yv(values[index])} r={3.6} fill="var(--ch-ink)" />
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
      {[5, 10, 15, 20].map((p) => <g key={p}><circle r={R(p)} fill="none" stroke={p === 20 ? 'var(--ch-ring)' : 'var(--ch-grid)'} /><text x={3} y={-R(p) + 10} fontSize={8.5} fill="var(--dim)">{p}s</text></g>)}
      {['N', 'E', 'S', 'W'].map((l, k) => { const [x, y] = pos(k * 90, 23.5); return <text key={l} x={x} y={y + 3} fontSize={10} fill="var(--muted)" textAnchor="middle">{l}</text>; })}
      {hours.flatMap((h) => {
        const isSel = h.timestamp === selected;
        return ([[h.forecast.secondary, 'var(--sw2)'], [h.forecast.primary, 'var(--sw1)']] as const).map(([s, c], k) => {
          if (!s || !Number.isFinite(s.height)) return null;
          const [x, y] = pos(s.direction, s.period);
          return <circle key={`${h.timestamp}${k}`} cx={x} cy={y} r={(isSel ? 3 : 1.6) + s.height * (isSel ? 1.1 : 0.7)} fill={c} fillOpacity={isSel ? 1 : 0.35}
            stroke={isSel ? 'var(--bg)' : 'none'} strokeWidth={1.5} style={{cursor: 'pointer'}} onClick={() => onSelect(h.timestamp)} />;
        });
      })}
      {facing === null && <text y={124} fontSize={9.5} fill="var(--dim)" textAnchor="middle">Beach orientation not documented</text>}
    </svg>
  );
}

export function TideDay({hours, selected, extrema, spot, p, onSelect}: {hours: HourSample[]; selected: string | null; extrema: TidePrediction[]; spot: SurfSpot; p: UserProfile; onSelect: (t: string) => void}) {
  if (!hours.length) return null;
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
      <path d={`${monotonePath(pts)} L352,156 L8,156Z`} fill="var(--tide)" fillOpacity={0.16} /><path d={monotonePath(pts)} fill="none" stroke="var(--tide)" strokeWidth={2} />
      {extrema.filter((e) => Date.parse(e.timestamp) >= t0 && Date.parse(e.timestamp) <= t0 + span && e.height.value !== null).map((e) => {
        const x = X(Date.parse(e.timestamp)), y = Yv(e.height.value!);
        return <g key={e.timestamp}><circle cx={x} cy={y} r={3.5} fill="var(--tide)" /><text x={x} y={e.type === 'High' ? y - 9 : y + 17} fontSize={10} fill="var(--text)" textAnchor="middle">{ht(e.height.value, p)} · {timeLabelPT(e.timestamp)}</text></g>;
      })}
      {k >= 0 && <g><line x1={pts[k][0]} x2={pts[k][0]} y1={10} y2={156} stroke="var(--ch-ink)" strokeWidth={1.2} /><circle cx={pts[k][0]} cy={pts[k][1]} r={4.5} fill="var(--ch-ink)" /></g>}
      <text x={X(rise)} y={169} fontSize={9} fill="var(--dim)" textAnchor="middle">↑ {timeLabelPT(rise)}</text><text x={X(set)} y={169} fontSize={9} fill="var(--dim)" textAnchor="middle">↓ {timeLabelPT(set)}</text>
    </svg>
  );
}

export {groupDays};

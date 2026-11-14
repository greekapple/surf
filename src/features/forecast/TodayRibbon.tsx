import {useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import type {SurfSpot, UserProfile} from '../../models/index';
import type {Daylight} from '../../services/daylight';
import type {CallWindow} from '../../services/call';
import type {SurfBandPoint} from '../../services/surfSeries';
import {windRelationship} from '../../recommendation/sqi';
import {timeLabelPT, localHour} from './format';
import {relClass} from './SpotPage';
import {staleText, staleWord, type Stale} from '../../services/freshness';

/** Signature A (phone pass, spec docs/specs/2026-11-10-phone-pass.md; critique "Today ribbon"): one compact strip for the selected day that answers "when",
 *  along one hour axis: the daylight band (night shaded, first light to last light clear), the surf (the same estimate band as the Surf graph), the wind
 *  arrows coloured by their relation to THIS beach, and the tide curve, with the call's best window bracketed in the accent. Every value is one the page
 *  already shows (the call, daylightFor, surfBandSeries, the hour records); each track keeps its kind in the left gutter. Tap an hour to select it. */
export interface RibbonHour {timestamp: string; forecast: {wind: {speed: number; direction: number}; tide: {height: number}; availability?: {tide?: boolean}}}
const MIN_HOUR_W = 22, gutFor = (w: number) => (w >= 600 ? 104 : 64), H = {surf: 36, wind: 26, tide: 28}, PAD = 6;
const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function TodayRibbon({spot, hours, band, daylight, win, today = false, selected, p, tideLabel, tideStale = null, onSelect}: {
  spot: SurfSpot; hours: RibbonHour[]; band: SurfBandPoint[]; daylight: Daylight; /** the day's window (windowOnDay: independent of the selected hour, with its own verdict) */ win: CallWindow | null; /** the day is today: a window that already ended is not returned, so 'none LEFT today' */ today?: boolean; selected: string | null; p: UserProfile;
  /** the Tide card's own source words, shortened (e.g. "NOAA Point Reyes, 9 km"); null with no tide */ tideLabel: string | null; /** tide-label: the day's tide is a saved or stale copy (services/freshness.ts tideStaleOf): the row says "NOAA · saved" */ tideStale?: Stale | null; onSelect: (t: string) => void;
}) {
  // the hours fill the card's width (at least 22 px each: below that the strip scrolls sideways)
  const box = useRef<HTMLDivElement>(null), [cw, setCw] = useState(0);
  useLayoutEffect(() => { const el = box.current; if (!el || typeof ResizeObserver !== 'function') return; const ro = new ResizeObserver(() => setCw(el.clientWidth)); ro.observe(el); setCw(el.clientWidth); return () => ro.disconnect(); }, []);
  // a strip that scrolls opens on the selected hour (else first light), not on midnight
  const firstKey = hours[0]?.timestamp ?? '';
  useLayoutEffect(() => {
    const el = box.current; if (!el || el.scrollWidth <= el.clientWidth + 1 || !hours.length) return;
    const n0 = hours.length, hw = Math.max(MIN_HOUR_W, (el.clientWidth - gutFor(el.clientWidth) - 2) / n0), t00 = Date.parse(hours[0].timestamp), st = (Date.parse(hours[n0 - 1].timestamp) - t00) / Math.max(1, n0 - 1) || 3600000;
    const tEnd = Date.parse(hours[n0 - 1].timestamp), wS = win && Date.parse(win.end) > t00 && Date.parse(win.start) <= tEnd ? Math.max(t00, Date.parse(win.start)) : null;
    const selAt = selected && hours.some((h) => h.timestamp === selected) ? Date.parse(selected) : Date.parse(daylight.firstLight), at = wS !== null ? Math.min(wS, selAt) : selAt;   // the window's start in view when it comes first
    el.scrollLeft = Math.max(0, ((at - t00) / st) * hw - 2 * hw);
  }, [firstKey, selected, cw, win?.start]); // eslint-disable-line react-hooks/exhaustive-deps
  // the caption (window, the four daylight times, the tide source) always shows, even on a day too short to draw
  const caption = <p className="rb-k">{win ? <b className="rb-best">{win.verdict ?? 'Window'} · {win.label}</b> : <span>{today ? 'No window left today' : 'No window this day'}</span>}<span> · first light {timeLabelPT(daylight.firstLight)} · sunrise {timeLabelPT(daylight.sunrise)} · sunset {timeLabelPT(daylight.sunset)} · last light {timeLabelPT(daylight.lastLight)}</span>{tideLabel ? <span className="rb-src"> · tide: {tideLabel}</span> : null}</p>;
  if (hours.length < 6) return <section className="rb" aria-label="Today">{caption}</section>;
  const GUT = gutFor(cw), n = hours.length, HOUR_W = Math.max(MIN_HOUR_W, cw ? (cw - GUT - 2) / n : MIN_HOUR_W), W = n * HOUR_W, t0 = Date.parse(hours[0].timestamp), step = (Date.parse(hours[n - 1].timestamp) - t0) / Math.max(1, n - 1) || 3600000;
  const X = (iso: string | number) => ((typeof iso === 'string' ? Date.parse(iso) : iso) - t0) / step * HOUR_W + HOUR_W / 2;
  const byT = new Map(band.map((b) => [b.t, b]));
  const pts = hours.map((h) => byT.get(h.timestamp) ?? null);
  // the surf track: the estimate band (lo..hi) where the hour has one; an offshore-only hour is a thin dashed line (never filled as surf)
  const est = pts.some((b) => b?.kind === 'estimate'), off = !est && pts.some((b) => b?.kind === 'offshore'), demo = !est && !off && pts.some((b) => b?.kind === 'demonstration');
  const top = Math.max(1, ...pts.map((b) => (b && fin(b.hi) && (b.kind === 'estimate' || (off && b.kind === 'offshore')) ? b.hi : 0)));   // scaled by the kind drawn, never by an undrawn offshore or demo height
  const HEAD = 8;   // headroom above the day's highest surf (the band never touches the top of its track)
  const Ys = (ft: number) => PAD + H.surf - (ft / top) * (H.surf - 2 - HEAD);
  const runs: [number, number, number][][] = []; let cur: [number, number, number][] = [];
  pts.forEach((b, i) => { if (b && b.kind === 'estimate' && fin(b.lo) && fin(b.hi)) cur.push([X(hours[i].timestamp), b.lo, b.hi]); else if (cur.length) { runs.push(cur); cur = []; } }); if (cur.length) runs.push(cur);
  const area = (r: [number, number, number][]) => `M${r.map(([x, , hi]) => `${x.toFixed(1)},${Ys(hi).toFixed(1)}`).join('L')}L${[...r].reverse().map(([x, lo]) => `${x.toFixed(1)},${Ys(lo).toFixed(1)}`).join('L')}Z`;
  const offLine = off ? pts.map((b, i) => (b && fin(b.hi) ? `${X(hours[i].timestamp).toFixed(1)},${Ys(b.hi).toFixed(1)}` : null)).filter(Boolean).join('L') : '';
  // the tide curve (the hour records' tide heights, as the Tide card's mini curve)
  const tides = hours.map((h) => (h.forecast.availability?.tide !== false && fin(h.forecast.tide.height) ? h.forecast.tide.height : null));
  const tv = tides.filter(fin), tLo = tv.length ? Math.min(...tv) : 0, tHi = tv.length ? Math.max(...tv) : 1, yT0 = PAD + H.surf + H.wind + 6;
  const Yt = (v: number) => yT0 + H.tide - 2 - ((v - tLo) / Math.max(0.1, tHi - tLo)) * (H.tide - 4);
  const tidePath = tideLabel && tv.length > 3 ? tides.map((v, i) => (v === null ? null : `${X(hours[i].timestamp).toFixed(1)},${Yt(v).toFixed(1)}`)).filter(Boolean).join('L') : '';
  const yW = PAD + H.surf + 4 + H.wind / 2, total = yT0 + H.tide + 16;
  // daylight: night before first light and after last light shaded; civil twilight lighter
  const dl = {fl: X(daylight.firstLight), sr: X(daylight.sunrise), ss: X(daylight.sunset), ll: X(daylight.lastLight)};
  const clampX = (x: number) => Math.max(0, Math.min(W, x));
  // the call's window, bracketed where it falls inside this day
  const wIn = win && Date.parse(win.end) > t0 && Date.parse(win.start) < t0 + (n - 1) * step + step ? {x0: clampX(X(win.start) - HOUR_W / 2), x1: clampX(X(win.end) + HOUR_W / 2)} : null;
  const sel = selected ? hours.findIndex((h) => h.timestamp === selected) : -1;
  // the ribbon draws SHAPES only (when it is bigger, when the wind turns, when the tide is low); the numbers stay on the cards, in the person's scale
  const ticks = hours.map((h, i) => ({i, hr: localHour(h.timestamp)})).filter((x) => x.hr % 3 === 0);
  const label = (hr: number) => (hr === 0 ? '12a' : hr === 12 ? '12p' : hr < 12 ? `${hr}a` : `${hr - 12}p`);
  const aria = `Today ribbon: ${win ? `${win.verdict ?? 'window'} ${win.label}; ` : today ? 'no window left today; ' : 'no window this day; '}first light ${timeLabelPT(daylight.firstLight)}, sunrise ${timeLabelPT(daylight.sunrise)}, sunset ${timeLabelPT(daylight.sunset)}, last light ${timeLabelPT(daylight.lastLight)}; ${est ? 'surf estimate band (model estimate, its shape through the day)' : off ? 'offshore height only, not surf size' : demo ? 'demonstration data, not drawn' : 'no surf height'}; wind arrows coloured offshore, cross or onshore for this beach; ${tidePath ? `tide curve (${tideLabel}${tideStale ? `; ${staleWord(tideStale) === 'saved' ? 'saved copy' : 'stale copy'}` : ''})` : 'no tide'}. Tap an hour on the ribbon to select it.`;
  return (
    <section className="rb" aria-label={aria}>
      <div ref={box} className="rb-scroll" tabIndex={0} role="group" aria-label="Hours of the day (scrolls sideways)">
        <div className="rb-in" style={{'--rb-w': `${W + GUT}px`, '--rb-gut': `${GUT}px`} as CSSProperties}>
          <div className="rb-gut" aria-hidden="true">
            <span style={{top: PAD, height: H.surf}}>{est ? 'Surf est.' : off ? 'Offshore' : demo ? 'Demo' : 'Surf'}<small>{est ? 'model, shape' : off ? 'not surf' : demo ? 'not live' : 'no height'}</small></span>
            <span style={{top: PAD + H.surf + 4, height: H.wind}}>Wind<small>vs. this beach</small></span>
            <span style={{top: yT0, height: H.tide}}>Tide{tideLabel ? <small title={tideStale ? `${tideLabel}. ${staleText(tideStale)}` : tideLabel}>NOAA{tideStale ? ` · ${staleWord(tideStale)}` : ''}</small> : <small>none</small>}</span>
          </div>
          <svg className="rb-svg" width={W} height={total} viewBox={`0 0 ${W} ${total}`} aria-hidden="true">
            {/* night and twilight */}
            <rect className="rb-night" x={0} y={0} width={clampX(dl.fl)} height={total - 14} />
            <rect className="rb-twi" x={clampX(dl.fl)} y={0} width={Math.max(0, clampX(dl.sr) - clampX(dl.fl))} height={total - 14} />
            <rect className="rb-twi" x={clampX(dl.ss)} y={0} width={Math.max(0, clampX(dl.ll) - clampX(dl.ss))} height={total - 14} />
            <rect className="rb-night" x={clampX(dl.ll)} y={0} width={Math.max(0, W - clampX(dl.ll))} height={total - 14} />
            {wIn && <g className="rb-win"><rect x={wIn.x0} y={1} width={Math.max(4, wIn.x1 - wIn.x0)} height={total - 16} rx={6} /><path d={`M${wIn.x0 + 6},1 H${wIn.x0} V${total - 15} H${wIn.x0 + 6} M${wIn.x1 - 6},1 H${wIn.x1} V${total - 15} H${wIn.x1 - 6}`} /></g>}
            {runs.map((r, k) => <path key={k} className="rb-surf" d={area(r)} />)}
            {offLine && <path className="rb-off" d={`M${offLine}`} />}
            {hours.map((h, i) => {
              const w = h.forecast.wind; if (i % 2 || !fin(w.direction) || !fin(w.speed)) return null;
              const cls = relClass(windRelationship(spot, h.forecast as never)), x = X(h.timestamp), len = Math.min(8, 4 + w.speed / 4);
              return <g key={h.timestamp} className={`rb-wind sp-rel-ink ${cls}`} transform={`translate(${x.toFixed(1)},${yW}) rotate(${(w.direction + 180) % 360})`}><line y1={len} y2={-len} /><path d={`M-3,${-len + 3} L0,${-len} L3,${-len + 3}`} /></g>;
            })}
            {tidePath && <path className="rb-tide" d={`M${tidePath}`} />}
            {sel >= 0 && <line className="rb-cur" x1={X(hours[sel].timestamp)} x2={X(hours[sel].timestamp)} y1={0} y2={total - 14} />}
            {ticks.map(({i, hr}) => <text key={i} className="rb-t" x={X(hours[i].timestamp)} y={total - 3} textAnchor="middle">{label(hr)}</text>)}
          </svg>
          {/* each hour is a button over its column (the selected hour drives the whole page) */}
          {/* pointer taps only: keyboard and screen readers pick an hour in the graph or the hour table, as before (adjacent 22 px buttons would be one tab stop each) */}
          <div className="rb-hit" style={{left: GUT, width: W}} aria-hidden="true">
            {hours.map((h, i) => <i key={h.timestamp} className={i === sel ? 'on' : undefined} style={{left: i * HOUR_W, width: HOUR_W}} onClick={() => onSelect(h.timestamp)} />)}
          </div>
        </div>
      </div>
      {caption}
    </section>
  );
}

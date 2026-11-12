import {useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode} from 'react';
import type {SurfSpot, UserProfile} from '../../models/index';
import type {TidePrediction} from '../../ocean/types';
import type {SurfBandPoint} from './trustApi';
import {CH_G, CH_PAD, Timeline, hourValueText, useAnimatedRange, windInk, type ChartTab} from './charts';
import {compass, ht, type Day} from './helpers';
import {hourLabel, type HourSample} from './model';
import {dayNumPT, weekdayPT} from './format';
import {Condition} from '../../ui/Condition';
import {surfReadout} from './chartReadout';
import {partitionKind} from '../../services/swellParts';
import {hourFreshness} from '../../services/freshness';
import {StaleTag} from '../../ui/StaleTag';
import {BAND_COLOR} from './model';
import {windWhole} from '../../utils/units';

/** forecast-charts (user, 2026-11-12: "the dragging across the four different data points is weird because it goes off the screen"): the week's Surf, Swell, Wind and Tide
 *  panels as ONE instrument that fits the screen. One slider spans all four panels, so one vertical cursor marks the selected hour on every panel; a tap or a drag along
 *  the x axis sets it (the page still scrolls vertically: touch-action pan-y), and one compact readout row above says the hour's values with their kind
 *  (surf estimate, offshore height that is not surf size, the NWS zone forecast, demonstration). No floating tooltip: nothing leaves the screen. A day button zooms into that
 *  day's 24 hours (still the full width); the "7 days" button, the browser's Back or Escape return to the week. Keys: arrows one hour, Page Up/Down one day, Home/End,
 *  Enter or Space zoom in and out. The selected hour is the page's own (graph, table, Today ribbon and cards stay in step). */
const PANELS: [ChartTab, string][] = [['surf', 'Surf'], ['swell', 'Swell'], ['wind', 'Wind'], ['tide', 'Tide']];
/** Heights by need (px), shorter on phones so the four panels and the readout fit one screen (the screen budget). */
export const CHART_H: Record<ChartTab, number> = {surf: 190, swell: 122, wind: 112, tide: 118}, CHART_H_PHONE: Record<ChartTab, number> = {surf: 150, swell: 98, wind: 94, tide: 104};

const signed = (v: number, p: UserProfile) => `${v < 0 ? '-' : '+'}${ht(Math.abs(v), p)}`;

export function ForecastCharts({series, days, curDay, spot, p, band, extrema, now, selectedTime, onSelect, onZoomDay, narrow, hasEstimates, table, dayHoursLabel}: {
  series: HourSample[]; days: Day[]; curDay: number; spot: SurfSpot; p: UserProfile; band: SurfBandPoint[]; extrema: TidePrediction[]; now: number; selectedTime: string | null;
  onSelect: (t: string) => void; /** select an hour on day k (its best daylight hour) before zooming into it */ onZoomDay: (k: number) => void; narrow: boolean; hasEstimates: boolean;
  /** the 3-hour table (the Table view) */ table: ReactNode; /** "every 3 hours · wind colored by shore relation" under the Table view */ dayHoursLabel: string;
}) {
  const [mode, setMode] = useState<'week' | 'day' | 'table'>(() => (new URLSearchParams(location.search).get('view') === 'table' ? 'table' : 'week'));
  const n = series.length, sel = Math.max(0, series.findIndex((h) => h.timestamp === selectedTime)), selH = series[sel];
  const zoomDay = mode === 'day' && days[curDay] ? curDay : null;
  const [a, b] = useAnimatedRange(zoomDay !== null ? [days[zoomDay].start - 0.5, days[zoomDay].end + 0.5] : [0, Math.max(1, n - 1)]);
  const bandAt = useMemo(() => new Map(band.map((x) => [x.t, x])), [band]);
  const box = useRef<HTMLDivElement>(null), [W, setW] = useState(900), [hover, setHover] = useState<number | null>(null), drag = useRef(false), pushed = useRef(false);
  useEffect(() => { const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width))); if (box.current) ro.observe(box.current); return () => ro.disconnect(); }, [mode === 'table']); // eslint-disable-line react-hooks/exhaustive-deps

  // the view in the URL (?view=day / ?view=table); zooming into a day is a history entry, so the browser's Back returns to the week
  const setUrl = (m: 'week' | 'day' | 'table', push: boolean) => { const u = new URL(location.href); if (m === 'week') u.searchParams.delete('view'); else u.searchParams.set('view', m); if (push) history.pushState(history.state, '', u); else history.replaceState(history.state, '', u); };
  useEffect(() => { const on = () => { const v = new URLSearchParams(location.search).get('view'); pushed.current = false; setMode(v === 'day' ? 'day' : v === 'table' ? 'table' : 'week'); }; addEventListener('popstate', on); return () => removeEventListener('popstate', on); }, []);
  const pick = (m: 'week' | 'day' | 'table') => {
    if (m === mode) return;
    if (m === 'week' && mode === 'day' && pushed.current) { history.back(); return; }   // undo our own entry, so Back is not left pointing at the zoom
    const push = m === 'day' && mode === 'week'; pushed.current = push; setUrl(m, push); setMode(m);
  };
  const zoomInto = (k: number) => { if (k !== curDay) onZoomDay(k); pick('day'); };

  const pxh = (W - CH_G - CH_PAD) / (b - a), X = (i: number) => CH_G + (i - a) * pxh;
  const idxAt = (clientX: number) => { const r = box.current!.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.round(a + (clientX - r.left - CH_G) / pxh))); };
  const onDown = (e: PointerEvent) => { drag.current = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); const i = idxAt(e.clientX); onSelect(series[i].timestamp); setHover(null); };
  const onMove = (e: PointerEvent) => { const i = idxAt(e.clientX); if (drag.current) onSelect(series[i].timestamp); else if (e.pointerType === 'mouse') setHover(i); };
  const onUp = () => { drag.current = false; };
  const onKey = (e: KeyboardEvent) => {
    const stepK: Record<string, number> = {ArrowRight: 1, ArrowLeft: -1, PageDown: 24, PageUp: -24};
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(mode === 'day' ? 'week' : 'day'); return; }
    if (e.key === 'Escape' && mode === 'day') { e.preventDefault(); pick('week'); return; }
    let i = sel;
    if (e.key in stepK) i = sel + stepK[e.key]; else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n - 1; else return;
    e.preventDefault(); setHover(null);
    i = Math.max(0, Math.min(n - 1, i));   // zoomed, the day follows the hour into the next or previous day
    onSelect(series[i].timestamp);
  };
  if (!n || !selH) return null;

  const rh = hover !== null && series[hover] ? series[hover] : selH, rs = surfReadout(rh.heightFt, bandAt.get(rh.timestamp), (ft) => `${ht(ft, p)} ${p.heightUnit}`, (lo, hi) => `${ht(lo, p, p.heightUnit === 'm' ? 1 : 0)}–${ht(hi, p, p.heightUnit === 'm' ? 1 : 0)} ${p.heightUnit}`), u = p.heightUnit, w = rh.forecast.wind, pr = rh.forecast.primary, td = rh.forecast.tide, pk = pr ? partitionKind(pr, true) : null, fr = hourFreshness(rh.forecast, now);
  const H = narrow ? CHART_H_PHONE : CHART_H;
  const dayWord = (d: Day, room: number) => (room > 64 ? `${weekdayPT(d.t)} ${dayNumPT(d.t)}` : room > 34 ? weekdayPT(d.t) : weekdayPT(d.t).slice(0, 1));
  return <section className="card sp-chart" aria-label="Forecast detail">
    <div className="sp-chart-h">
      <div className="seg" role="radiogroup" aria-label="Detail view">
        <button role="radio" aria-checked={mode === 'week'} onClick={() => pick('week')}>7 days</button>
        <button role="radio" aria-checked={mode === 'day'} onClick={() => pick('day')}>{weekdayPT(selH.timestamp)} {dayNumPT(selH.timestamp)}</button>
        <button role="radio" aria-checked={mode === 'table'} onClick={() => pick('table')}>Table</button>
      </div>
      {mode === 'table' && <span className="fine">{dayHoursLabel}</span>}
    </div>
    {mode === 'table' ? table : <>
      {/* one compact readout for the hour under the cursor (the hovered hour, marked as a preview, while a mouse is over the panels) */}
      <p className="fc-read" aria-live="off">
        <b className="fc-when">{weekdayPT(rh.timestamp)} {hourLabel(rh.timestamp)}{rh !== selH && <small> preview</small>}</b>
        <span title={rs.could}><i className="fc-k">Surf</i> <em>{rs.v}</em> <small>{rs.kind}</small>{rs.could && <small className="sr-only"> ({rs.could})</small>}</span>
        <span><i className="fc-k">Primary swell</i> <em>{pk === 'swell' || pk === 'chop' ? `${ht(pr!.height, p)} ${u} · ${Math.round(pr!.period)} s${pk === 'chop' ? ' chop' : ''}` : '—'}</em>{(pk === 'swell' || pk === 'chop') && <small> from {compass(pr!.direction)}</small>}</span>
        <span><i className="fc-k">Wind</i> <em>{Number.isFinite(w.speed) ? windWhole(w.speed, p) : '—'}</em>{Number.isFinite(w.direction) && <small> from {compass(w.direction)}</small>}<StaleTag s={fr.wind} /></span>
        <span><i className="fc-k">Tide</i> <em>{Number.isFinite(td.height) ? `${signed(td.height, p)} ${u}` : '—'}</em>{Number.isFinite(td.height) && <small> MLLW{td.trend ? `, ${td.trend.toLowerCase()}` : ''}</small>}{Number.isFinite(td.height) && <StaleTag s={fr.tide} />}</span>
        <span className="fc-rate"><Condition category={rh.rating.category} chip />{rh.rating.dark && <small> after dark</small>}</span>
      </p>
      {/* the days: in the week a button per day zooms into it; zoomed, the way back and the neighbouring days */}
      <div className="fc-days" style={{paddingLeft: CH_G, paddingRight: CH_PAD}}>
        {zoomDay === null ? days.map((d, k) => { const x0 = Math.max(X(d.start - 0.5), CH_G), x1 = Math.min(X(d.end + 0.5), W - CH_PAD);
          return x1 - x0 >= 24 ? <button key={d.key} type="button" className={`fc-day${k === curDay ? ' on' : ''}`} style={{left: x0, width: x1 - x0}} onClick={() => zoomInto(k)} aria-label={`${weekdayPT(d.t)} ${dayNumPT(d.t)}: show this day's 24 hours`}>{dayWord(d, x1 - x0)}</button> : null; })
          : <div className="fc-zoom">
            <button type="button" className="btn fc-back" onClick={() => pick('week')} aria-label="Back to the 7 days">‹ 7 days</button>
            <b>{weekdayPT(days[zoomDay].t)} {dayNumPT(days[zoomDay].t)} · 24 hours</b>
            <span className="fc-nav">
              <button type="button" className="btn" disabled={zoomDay === 0} onClick={() => onZoomDay(zoomDay - 1)} aria-label="Previous day">‹</button>
              <button type="button" className="btn" disabled={zoomDay === days.length - 1} onClick={() => onZoomDay(zoomDay + 1)} aria-label="Next day">›</button>
            </span>
          </div>}
      </div>
      <div className="tl-body sp-stack" ref={box} role="slider" tabIndex={0}
        aria-label="Forecast time. Arrow keys move one hour, Page Up and Page Down one day; Enter or Space shows the selected day's 24 hours or the 7 days again."
        aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={sel} aria-valuetext={hourValueText(selH, bandAt.get(selH.timestamp), p)}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => !drag.current && setHover(null)} onKeyDown={onKey}>
        {PANELS.map(([tab, label]) => <section key={tab} className="sp-series" aria-label={`${label} chart`}>
          <Timeline series={series} spot={spot} p={p} selectedTime={selectedTime} onSelect={onSelect} now={now} dayIndex={null} tab={tab} band={band} extrema={extrema} height={H[tab]} title={label}
            showDays={false} showRibbon={tab === 'surf'} showHours={tab === 'tide'} stacked view={[a, b]} hoverIndex={hover} padTop={narrow && tab === 'surf' ? 16 : 0} />
          <PanelKey tab={tab} p={p} hasEstimates={hasEstimates} band={band} series={series} />
        </section>)}
      </div>
      {/* the rating strip's colours (the readout's chip names the hour's own rating) */}
      <p className="fc-key fc-rkey"><span><i style={{background: BAND_COLOR.good}} />rating good+</span><span><i style={{background: BAND_COLOR.fair}} />fair</span><span><i style={{background: BAND_COLOR.poor}} />poor</span><span className="fk-t">ratings provisional</span></p>
    </>}
  </section>;
}

/** The panel's own key, small, at its top right: replaces the legend list. Every kind the panel draws is named. */
function PanelKey({tab, p, hasEstimates, band, series}: {tab: ChartTab; p: UserProfile; hasEstimates: boolean; band: SurfBandPoint[]; series: HourSample[]}) {
  if (tab === 'surf') return <p className="fc-key">{hasEstimates ? <><span><i className="fk-band" />surf est. (model)</span><span><i className="fk-off" />offshore Hs</span><span className="fk-t">fainter = less sure</span>{band.some((b) => b.wide) && <span><i className="fk-wide" />models differ</span>}{band.some((b) => b.certainty === 'too-far') && <span><i className="fk-far" />too far out</span>}</> : <><span><i className="fk-off" />offshore Hs · not surf size</span>{band.some((b) => b.certainty === 'too-far') && <span className="fk-t">later hours: too far out</span>}</>}</p>;
  if (tab === 'swell') return <p className="fc-key"><span><i style={{background: 'var(--sw1)'}} />primary</span><span><i style={{background: 'var(--sw2)'}} />2nd</span>{series.some((h) => h.forecast.tertiary) && <span><i style={{background: 'var(--sw3)'}} />3rd</span>}<span className="fk-t">s = period · ▲ travels</span></p>;
  if (tab === 'wind') return <p className="fc-key"><span><i style={{background: 'var(--accent)'}} />speed</span><span><i className="fk-gust" />gusts</span><span><i style={{width: 30, background: `linear-gradient(90deg,${[0, 6, 10, 14, 18, 24].map(windInk).join(',')})`}} />Arrows 0 to {windWhole(24, p).replace(' ', '+ ')}</span></p>;
  return <p className="fc-key"><span><i style={{background: 'var(--tide)'}} />predicted, {p.heightUnit} above MLLW</span></p>;
}

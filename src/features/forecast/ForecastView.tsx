import {useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {StateMessage} from '../../ui/common';
import {Icon} from '../../ui/Icon';
import {PolarSwell, TideDay, Timeline, windInk, type ChartTab} from './charts';
import {bestDaylight, groupDays} from './helpers';
import {timeLabelPT, weekdayPT, dayNumPT} from './format';
import {Skeleton} from '../../ui/Skeleton';
import {NearshoreCard} from './Nearshore';
import {BuoyContext} from './BuoyContext';
import {BoardLine, BuoyNow, CardDetail, ConditionsGrid, DayStrip, HourTable, ScalePanel, bestBoard, facingOf, surfOf, type CardKey} from './SpotPage';
import {SpotBand} from './SpotBand';
import './forecast.css';

function Sources() {
  const {view, live} = useSwello();
  const o = view.ocean;
  if (!live) return <p>Demonstration week (Oct 16–22): illustrative profiles, not live data and never mixed with retrieved forecasts.</p>;
  return (
    <div style={{display: 'grid', gap: 10}}>
      <p className="fine">Model forecasts: Open-Meteo Marine &amp; Weather. Tide predictions: NOAA CO-OPS 9414290 (San Francisco, regional, MLLW). Ratings: SURF provisional engine, uncalibrated. Times are Pacific.</p>
      <div className="tscroll" role="region" tabIndex={0} aria-label="Data source status (scrolls sideways)"><table className="cmp"><thead><tr><th>Source</th><th>State</th><th>Detail</th></tr></thead><tbody>
        {o.statuses.map((s) => <tr key={s.id}><td>{s.provider}</td><td><span className={`chip ${s.state === 'connected' ? 'off' : s.state === 'partial' ? 'demo' : 'on'}`}>{s.state}</span></td><td className="fine">{s.message}</td></tr>)}
      </tbody></table></div>
    </div>
  );
}

const CHART_TABS: [ChartTab, string][] = [['surf', 'Surf'], ['swell', 'Swell'], ['wind', 'Wind'], ['tide', 'Tide']];

export function ForecastView({go}: ViewProps) {
  const {view, data, now, spot, series, selected, live} = useSwello();
  const p = data.state.profile;
  const days = useMemo(() => groupDays(series), [series]);
  const [range, setRange] = useState<'week' | 'day'>('week');
  const [mode, setMode] = useState<'graph' | 'table'>(() => (new URLSearchParams(location.search).get('view') === 'table' ? 'table' : 'graph'));
  const extrema = view.ocean.bundle?.extrema ?? [];
  const selIdx = selected ? series.indexOf(selected) : -1;
  const curDay = selIdx >= 0 ? days.findIndex((d) => selIdx >= d.start && selIdx <= d.end) : -1;
  const [tab, setTab] = useState<ChartTab>(() => { const c = new URLSearchParams(location.search).get('chart'); return CHART_TABS.some(([id]) => id === c) ? (c as ChartTab) : 'surf'; });
  const setParam = (k: string, v: string | null) => { const u = new URL(location.href); if (v === null) u.searchParams.delete(k); else u.searchParams.set(k, v); history.replaceState(history.state, '', u); };
  const pickTab = (t: ChartTab) => { setTab(t); setParam('chart', t === 'surf' ? null : t); };
  const pickMode = (m: 'graph' | 'table') => { setMode(m); setParam('view', m === 'graph' ? null : m); };
  const onTabKey = (e: ReactKeyboardEvent) => {
    const k = CHART_TABS.findIndex(([id]) => id === tab), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = CHART_TABS[(k + d + CHART_TABS.length) % CHART_TABS.length][0];
    pickTab(next); requestAnimationFrame(() => document.getElementById(`ctab-${next}`)?.focus());
  };
  const fav = data.state.favorites.includes(spot.id);
  const [openCard, setOpenCard] = useState<CardKey | null>(null);
  const toggleCard = (k: CardKey) => setOpenCard((o) => (o === k ? null : k));
  // Phones: the shell's spot switcher already names the spot, so the h1 is for screen readers only (the name shows once).
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 860px)').matches);
  useEffect(() => { const mq = matchMedia('(max-width: 860px)'), on = () => setNarrow(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);
  const bestK = useMemo(() => {
    let best = -1, bs = -1;
    days.forEach((d, k) => {
      if (d.end - d.start < 11) return;
      const sc = series.slice(d.start, d.end + 1).filter((h) => h.hour >= 6 && h.hour <= 19).map((h) => h.rating.score).filter((v): v is number => v !== null);
      if (!sc.length) return;
      const avg = sc.reduce((x, y) => x + y, 0) / sc.length;
      if (avg > bs) { bs = avg; best = k; }
    });
    return best;
  }, [days, series]);
  const pickDay = (k: number) => {
    const d = days[k];
    const best = bestDaylight(series, spot, Date.parse(series[d.start].timestamp), Date.parse(series[d.end].timestamp) + 1);
    view.selectTime((best ?? series[d.start]).timestamp);
  };
  const nowIdx = series.findIndex((h) => Date.parse(h.timestamp) >= Math.floor(now / 3600000) * 3600000);
  const toNow = () => { if (nowIdx >= 0) view.selectTime(series[nowIdx].timestamp); };

  if (live && view.ocean.loading && !view.ocean.bundle) return <Skeleton label="Loading forecast…" />;
  if (live && !view.ocean.bundle) return <StateMessage title="Forecast data unavailable" action={<button className="btn" onClick={view.ocean.reload}>Try again</button>}>{view.ocean.error ?? 'The providers could not be reached.'} Nothing is filled in from other spots or older data.</StateMessage>;
  if (!selected) return <StateMessage title={`No record for ${spot.name} at this hour`} action={<button className="btn" onClick={toNow}>Go to now</button>}>Values are never borrowed from other hours or spots.</StateMessage>;

  const isNow = selIdx === nowIdx;
  const dayHours = curDay >= 0 ? series.slice(days[curDay].start, days[curDay].end + 1) : [];
  const bundle = view.ocean.bundle;
  const hs = surfOf(spot, selected.forecast, p, bundle, now).h;
  const boards = data.state.boards;
  // The scale shows the Board Match pick when there is one, else the user's favourite (or first) board, labelled as theirs, not as a pick.
  const scaleBoard = bestBoard(boards, selected.forecast, p, hs)?.board ?? boards.find((b) => b.favorite) ?? boards[0] ?? null;
  const meta = [spot.region, `${spot.type.toLowerCase()} break`, live ? 'heights are model estimates · ratings provisional' : 'demonstration week · not live'];
  return (
    <div className="sp">
      <SpotBand spotId={spot.id}>
        <div className="sp-head">
          <div className="sp-title">
            <h1>{spot.name}</h1>
            <button className="fc-fav" aria-pressed={fav} aria-label={fav ? `Remove ${spot.name} from favourites` : `Save ${spot.name}`} onClick={() => data.favorite(spot.id)}><Icon name="star" size={20} /></button>
            <p>{meta.join(' · ')}</p>
          </div>
          <div className="sp-when">
            <span className="sp-time" data-sp="time">{weekdayPT(selected.timestamp)} {dayNumPT(selected.timestamp)}, {timeLabelPT(selected.timestamp)}{isNow ? ' · now' : ''}</span>
            {!isNow && <button className="btn" onClick={toNow}>Now</button>}
            <button className="btn sp-map" onClick={() => go('explore')}><Icon name="explore" size={16} />Map</button>
          </div>
        </div>
      </SpotBand>

      <ConditionsGrid spot={spot} h={selected} p={p} dayHours={dayHours} extrema={extrema} bundle={bundle} now={now} open={openCard} onToggle={toggleCard} scale={<ScalePanel hs={hs} p={p} board={scaleBoard} onOpen={() => go('forecast', 'wave-scale')} />} />
      {openCard && <CardDetail k={openCard} spot={spot} h={selected} p={p} dayHours={dayHours} onSelect={view.selectTime} onClose={() => setOpenCard(null)}
        Tide={<TideDay hours={dayHours} selected={view.selectedTime} extrema={extrema} spot={spot} p={p} onSelect={view.selectTime} />}
        Polar={<PolarSwell hours={dayHours} selected={view.selectedTime} facing={facingOf(spot.id)} onSelect={view.selectTime} />} />}
      <BoardLine boards={data.state.boards} f={selected.forecast} p={p} hs={hs} onOpen={() => go('quiver', 'match')} onQuiver={() => go('quiver')} />
      <DayStrip days={days} series={series} spot={spot} p={p} bundle={bundle} now={now} cur={curDay} best={bestK} onPick={pickDay} />

      <section className="card sp-chart" aria-label="Forecast detail">
        <div className="sp-chart-h">
          <div className="seg" role="radiogroup" aria-label="Detail view">
            <button role="radio" aria-checked={mode === 'graph'} onClick={() => pickMode('graph')}>Graph</button>
            <button role="radio" aria-checked={mode === 'table'} onClick={() => pickMode('table')}>Table</button>
          </div>
          {mode === 'graph' ? <>
            <div className="ctabs" role="tablist" aria-label="Chart series" onKeyDown={onTabKey}>
              {CHART_TABS.map(([id, label]) => <button key={id} id={`ctab-${id}`} role="tab" aria-selected={tab === id} aria-controls="ctab-panel" tabIndex={tab === id ? 0 : -1} onClick={() => pickTab(id)}>{label}</button>)}
            </div>
            <div className="seg" role="radiogroup" aria-label="Range">
              <button role="radio" aria-checked={range === 'week'} onClick={() => setRange('week')}>7 days</button>
              <button role="radio" aria-checked={range === 'day'} onClick={() => setRange('day')}>{weekdayPT(selected.timestamp)}</button>
            </div>
          </> : <span className="fine">{weekdayPT(selected.timestamp)} {dayNumPT(selected.timestamp)} · every 3 hours · wind coloured by shore relation</span>}
        </div>
        {mode === 'graph' ? <>
          <div id="ctab-panel" role="tabpanel" aria-labelledby={`ctab-${tab}`}>
            <Timeline series={series} spot={spot} p={p} selectedTime={view.selectedTime} onSelect={view.selectTime} now={now} dayIndex={range === 'day' ? Math.max(0, curDay) : null} tab={tab} extrema={extrema} height={matchMedia('(max-width: 860px)').matches ? 240 : 280} />
          </div>
          <ul className="legend" aria-hidden="true">
            {tab === 'surf' && <><li><i style={{background: 'var(--hs-hi)', height: 8}} />Offshore Hs (not surf size)</li><li><i style={{background: 'var(--tide)', height: 0, borderTop: '2px dashed var(--tide)'}} />Tide</li></>}
            {tab === 'swell' && <><li><i style={{background: 'var(--sw1)'}} />Primary swell</li><li><i style={{background: 'var(--sw2)'}} />Secondary</li></>}
            {tab === 'wind' && <><li><i style={{background: 'var(--accent)'}} />Wind speed</li><li><i style={{background: 'var(--muted)'}} />Gusts</li><li><i style={{width: 44, background: `linear-gradient(90deg,${[0, 6, 10, 14, 18, 24].map(windInk).join(',')})`}} />Arrows 0 to 24+ mph</li></>}
            {tab === 'tide' && <li><i style={{background: 'var(--tide)'}} />Predicted tide, MLLW</li>}
            <li><i style={{background: 'var(--good)'}} />Rating good+</li><li><i style={{background: 'var(--fair)'}} />fair</li><li><i style={{background: 'var(--poor)'}} />poor</li>
          </ul>
        </> : <HourTable hours={dayHours} spot={spot} p={p} bundle={bundle} now={now} selected={view.selectedTime} onSelect={view.selectTime} />}
      </section>

      <div className="sp-two">
        <section className="card" aria-label="Nearshore model"><NearshoreCard spot={spot} p={p} selectedTime={selected.timestamp} now={now} series={series} /></section>
        <section className="card" aria-label="Buoy now vs forecast"><div className="card-h"><h2>Buoy now vs forecast</h2></div><BuoyNow buoy={bundle?.buoy} series={series} p={p} now={now} /><BuoyContext buoys={bundle?.buoys} series={series} p={p} now={now} /></section>
      </div>

      <details className="card sp-src"><summary><h2>Sources &amp; reliability</h2><span>{selected.rating.reliability.category.toLowerCase()} reliability · show details</span></summary><Sources /></details>
    </div>
  );
}

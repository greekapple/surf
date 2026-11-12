import {nearSfBuoy} from '../../ocean/buoys';
import {SimilarSession} from './SimilarSession';
import {shareCardFor} from '../../services/shareCard';
import {ShareWindow} from './ShareWindow';
import {slugFor} from '../../app/routes';
import {dateIn} from '../../ocean/time';
import {timeZoneOf, differsFromViewer, zoneAbbr} from '../../ocean/spotZone';
import {Fragment, useEffect, useMemo, useState} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {StateMessage} from '../../ui/common';
import {Icon} from '../../ui/Icon';
import {PolarSwell, TideDay, Timeline, windInk, type ChartTab} from './charts';
import {bestDaylight, groupDays, spotLatLon} from './helpers';
import {timeLabelPT, weekdayPT, dayNumPT} from './format';
import {Skeleton} from '../../ui/Skeleton';
import {NearshoreCard} from './Nearshore';
import {BuoyContext} from './BuoyContext';
import {boardPickFor} from '../quiver/fit';
import {BoardLine, BuoyNow, CardDetail, ConditionsGrid, DayStrip, HourTable, ScalePanel, facingOf, surfOf, type CardKey} from './SpotPage';
import {SpotBand} from './SpotBand';
import {camsFor} from '../../data/cams';
import {LiveCamPanel} from './LiveCam';
import {HdontapLinks} from './HdontapLinks';
import {WaterQuality} from './WaterQuality';
import {glyphFor} from '../../services/waveGlyph';
import {userHeight} from '../../services/heightMath';
import {ObserveEntry, ObservePanel, ObservedLine, sawWords} from './Observe';
import {CallBar, FeltRight, NwsBanner} from './Trust';
import {TodayRibbon} from './TodayRibbon';
import {extremaForOwnStation} from '../../ocean/stationTide';
import {tideStationFor, SF_STATION, hourlyTideStationIds} from '../../ocean/tideStations';
import {tideCurveWords} from '../../ocean/stationTide';
import {CALL_WINDOW_DAYS} from '../../services/call';
import {HORIZON_HOURS} from '../../services/certainty';
import {callFor, daylightFor, surfBandSeries, windowOnDay} from './trustApi';
import {BREAKER_WORD, breakerType} from '../../services/breaker';
import {outsideFacingForHour} from '../../services/headlineSurf';
import './forecast.css';
import {windWhole} from '../../utils/units';

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
/** Stacked chart heights by need (px, including the shared axes the chart carries): Surf has the day labels and rating strip, Tide the hour labels. */
const STACK_H: Record<ChartTab, number> = {surf: 250, swell: 170, wind: 140, tide: 130}, STACK_H_PHONE: Record<ChartTab, number> = {surf: 210, swell: 140, wind: 120, tide: 115};

export function ForecastView({go}: ViewProps) {
  const {view, data, now, spot, series, selected, live, shareNote} = useSwello();
  const p = data.state.profile;
  const days = useMemo(() => groupDays(series), [series]);
  const [range, setRange] = useState<'week' | 'day'>('week');
  const [mode, setMode] = useState<'graph' | 'table'>(() => (new URLSearchParams(location.search).get('view') === 'table' ? 'table' : 'graph'));
  // A2: the highs and lows of the spot's OWN tide station (the curve, the chart, the timeline and the table all read the same station)
  const [tla, tlo] = spotLatLon(spot), extrema = extremaForOwnStation(view.ocean.bundle, tideStationFor({id: spot.id, latitude: tla, longitude: tlo})?.station.id, SF_STATION);
  const selIdx = selected ? series.indexOf(selected) : -1;
  const curDay = selIdx >= 0 ? days.findIndex((d) => selIdx >= d.start && selIdx <= d.end) : -1;
  const setParam = (k: string, v: string | null) => { const u = new URL(location.href); if (v === null) u.searchParams.delete(k); else u.searchParams.set(k, v); history.replaceState(history.state, '', u); };
  const pickMode = (m: 'graph' | 'table') => { setMode(m); setParam('view', m === 'graph' ? null : m); };
  const fav = data.state.favorites.includes(spot.id);
  const [openCard, setOpenCard] = useState<CardKey | null>(null);
  const [observing, setObserving] = useState(false), [saved, setSaved] = useState('');
  const toggleCard = (k: CardKey) => setOpenCard((o) => (o === k ? null : k));
  // Phones: the shell's spot switcher already names the spot, so the h1 is for screen readers only (the name shows once).
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 860px)').matches);
  useEffect(() => { const mq = matchMedia('(max-width: 860px)'), on = () => setNarrow(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);
  const nowHour = Math.floor(now / 3600000); // the star is recomputed on the hour, not on every clock tick
  const bestK = useMemo(() => {
    let best = -1, bs = -1;
    const nowMs = nowHour * 3600000, today = dateIn(timeZoneOf(spot), new Date(nowMs).toISOString());
    days.forEach((d, k) => {
      if (d.end - d.start < 11) return;
      // A4: only days inside the call's own window horizon (CALL_WINDOW_DAYS) and before the certainty horizon (beyond it the app calls nothing)
      const dayKey = dateIn(timeZoneOf(spot), series[d.start].timestamp);
      if (Date.parse(dayKey + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z') >= CALL_WINDOW_DAYS * 86400000 || (Date.parse(series[d.start].timestamp) - nowMs) / 3600000 >= HORIZON_HOURS) return;
      const sc = series.slice(d.start, d.end + 1).filter((h) => h.hour >= 6 && h.hour <= 19 && !h.rating.dark).map((h) => h.rating.score).filter((v): v is number => v !== null);
      if (!sc.length) return;
      // A4: the star goes only to a day the call would also name a window for (the same skill-aware rule): never a "best day" beside "no window in this forecast"
      if (!windowOnDay(spot, dateIn(timeZoneOf(spot), series[d.start].timestamp), p, {records: series.map((h) => h.forecast), bundle: view.ocean.bundle, nowMs})) return;
      const avg = sc.reduce((x, y) => x + y, 0) / sc.length;
      if (avg > bs) { bs = avg; best = k; }
    });
    return best;
  }, [days, series, spot, p, view.ocean.bundle, nowHour]);
  const pickDay = (k: number) => {
    const d = days[k];
    const best = bestDaylight(series, spot, Date.parse(series[d.start].timestamp), Date.parse(series[d.end].timestamp) + 1);
    view.selectTime((best ?? series[d.start]).timestamp);
  };
  // 1A: a spot whose clock differs from the viewer's says which clock its times are on ("4:00 AM EST"); in the viewer's own zone there is no tag
  const spotZoneTag = (ts: string) => { const z = timeZoneOf(spot); return differsFromViewer(z, ts) ? ` ${zoneAbbr(z, ts)}` : ''; };
  const nowIdx = series.findIndex((h) => Date.parse(h.timestamp) >= Math.floor(now / 3600000) * 3600000);
  const toNow = () => { if (nowIdx >= 0) view.selectTime(series[nowIdx].timestamp); };

  if (live && !view.ocean.error && (view.ocean.loading && !view.ocean.bundle || !view.ocean.isSpotLoaded(view.selected))) return <Skeleton label="Loading forecast…" />;   // subset loading: a spot not asked for yet shows a loading state, never a number
  if (live && !view.ocean.bundle) return <StateMessage title="Forecast data unavailable" action={<button className="btn" onClick={view.ocean.reload}>Try again</button>}>{view.ocean.error ?? 'The providers could not be reached.'} Nothing is filled in from other spots or older data.</StateMessage>;
  if (!selected) return <StateMessage title={`No record for ${spot.name} at this hour`} action={<button className="btn" onClick={toNow}>Go to now</button>}>Values are never borrowed from other hours or spots.</StateMessage>;

  const isNow = selIdx === nowIdx;
  const dayHours = curDay >= 0 ? series.slice(days[curDay].start, days[curDay].end + 1) : [];
  const bundle = view.ocean.bundle;
  const hs = surfOf(spot, selected.forecast, p, bundle, now).h;
  const boards = data.state.boards;
  // The scale shows the Board Match pick when there is one, else the user's favourite (or first) board, labelled as theirs, not as a pick.
  // T-108: THE board pick (fit.ts boardPickFor, shared with Home, Board Match and Personal) draws on the scale and in the Board Match line; no pick (nothing suits): the favourite, else the first board, labelled as theirs.
  const choice = boardPickFor(boards, spot, selected.forecast, now, p, {bundle});
  const scaleBoard = choice.pick ?? boards.find((b) => b.favorite) ?? boards[0] ?? null;
  const cams = camsFor(spot.id), me = userHeight(p);
  // T-111: the band's drawn wave (used only when the spot has no cam and no photo) is this hour's headline, the same as the Surf card.
  const glyph = glyphFor(hs, me.feet, selected.forecast.primary?.period, breakerType(spot, selected.forecast).type);
  // T-065: one answer (the call), daylight for the selected day, and the graph's surf band, all from the T-064 logic.
  const records = series.map((h) => h.forecast);
  const call = callFor(spot, selected.forecast, p, {records, bundle, nowMs: now});
  const daylight = daylightFor(spot.id, dateIn(timeZoneOf(spot), selected.timestamp));
  const band = surfBandSeries(spot, records, {bundle, nowMs: now});
  const env = {records: view.mapRecords, bundle, profile: p, nowMs: now};
  // share-card (user, 2026-11-11): the header's Share is for NOW: the current hour's call and its window (or the next one); with no window, the current hour, saying so
  const nowRec = nowIdx >= 0 ? series[nowIdx].forecast : null, nowCall = nowRec ? (isNow ? call : callFor(spot, nowRec, p, {records, bundle, nowMs: now})) : null;
  const nowCard = nowCall ? shareCardFor(spot, nowCall, records, p, now, slugFor(spot.id), location.origin, bundle, {fallbackNow: true}) : null;
  // T-108: the subtitle follows what the spot actually has: surf estimates, or only offshore heights.
  const hasEstimates = band.some((b) => b.kind === 'estimate'), hasOfficial = band.some((b) => b.official);
  const meta = [spot.region, ...(spot.type ? [`${spot.type.toLowerCase()} break`] : []), !live ? 'demonstration week · not live' : hasEstimates ? 'heights are model estimates · ratings provisional' : hasOfficial ? 'surf height is the NWS forecast, not ours · ratings provisional' : 'offshore heights only · not surf size · ratings provisional'];
  return (
    <div className="sp">
      <SpotBand spotId={spot.id} glyph={glyph} personIn={me.inches} unit={p.heightUnit}>
        <div className="sp-head">
          <div className="sp-title">
            {/* phone pass 1: on a phone the name is the spot selector (the separate picker row is gone): it opens the spot search */}
            <h1><button type="button" className="sp-h1b" aria-label={`${spot.name}: change spot`} onClick={() => dispatchEvent(new Event('swello:open-search'))}>{spot.name}<Icon name="chevron" size={18} className="sp-h1c" /></button></h1>
            <button className="fc-fav" aria-pressed={fav} aria-label={fav ? `Remove ${spot.name} from favorites` : `Save ${spot.name}`} onClick={() => data.favorite(spot.id)}><Icon name="star" size={20} /></button>
            <p><span className="sp-meta-a">{meta.slice(0, -1).join(' · ')}</span><span className="sp-meta-b">{meta.length > 1 ? ' · ' : ''}{meta[meta.length - 1]}</span></p>
          </div>
          <div className="sp-when">
            <span className="sp-time" data-sp="time">{weekdayPT(selected.timestamp)} {dayNumPT(selected.timestamp)}, {timeLabelPT(selected.timestamp)}{spotZoneTag(selected.timestamp)}{isNow ? ' · now' : ''}</span>
            {!isNow && <button className="btn" onClick={toNow}>Now</button>}
            <button className="btn sp-map" onClick={() => go('explore')}><Icon name="explore" size={16} />Map</button>
            <ShareWindow card={nowCard} className="sp-share" />
          </div>
        </div>
      </SpotBand>
      {shareNote && <p className="sp-sharenote" role="status">{shareNote}</p>}
      <NwsBanner spotId={spot.id} />
      <CallBar call={call} share={shareCardFor(spot, call, records, p, now, slugFor(spot.id), location.origin, bundle)} />
      {/* signature A (phone pass): the Today ribbon replaces the four daylight times: daylight band, surf shape, wind to the beach, tide and the call's window on one hour axis */}
      <TodayRibbon spot={spot} hours={dayHours} band={band} daylight={daylight} win={windowOnDay(spot, dateIn(timeZoneOf(spot), selected.timestamp), p, {records, bundle, nowMs: now}, Math.min(now, Date.parse(selected.timestamp)))} today={dateIn(timeZoneOf(spot), selected.timestamp) === dateIn(timeZoneOf(spot), new Date(now).toISOString())} selected={view.selectedTime} p={p} onSelect={view.selectTime}
        tideLabel={(() => { const [la, lo] = spotLatLon(spot), st = tideStationFor({id: spot.id, latitude: la, longitude: lo}); if (!st || selected.forecast.availability.tide === false || !Number.isFinite(selected.forecast.tide.height)) return null;   // as the Tide card: only with its station, in its own words
          return st.station.id === SF_STATION ? `NOAA CO-OPS prediction at San Francisco (${SF_STATION}), a regional reference, ${st.distanceKm} km from this spot, not at the beach` : tideCurveWords({kind: hourlyTideStationIds.includes(st.station.id) ? 'hourly' : 'interpolated', stationName: st.station.name, stationId: st.station.id, distanceKm: st.distanceKm}) + (st.fallback ? ` · ${st.fallbackLabel ?? 'inlet or bay-side station'}` : ''); })()} />
      <SimilarSession spot={spot} forecast={selected.forecast} profile={p} bundle={bundle} nowMs={now} />
      {/* water quality: the agency's own words and date for the spot's rule-checked station (distance and name; 19 by hand); nothing without one. */}
      <WaterQuality spotId={spot.id} />
      {/* T-111: the verified public cams for this spot (T-063/T-080), as links to their owners' pages. Audit F14 / A16: a link has no live status, so it is a "Camera", never "Live". (Showing a camera in the page is the Camera panel below, under the amended camera rule in src/data/cams.ts.) */}
      {cams.length > 0 && <section className="sp-cams" aria-labelledby="sp-cams-h">
        <h2 id="sp-cams-h">Cams</h2>
        <ul>{cams.map((c) => <li key={c.url}>
          <a className="sp-cam" href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`Camera by ${c.owner}, opens their site in a new tab. Shows ${c.view}`}>
            <b>Camera · {c.owner}</b><span>{c.view}</span><small>{c.operator && c.operator !== c.owner ? `Run by ${c.operator} · ` : ''}checked {c.verified} · opens their site ↗</small>
          </a></li>)}</ul>
      </section>}

      {/* bayarea-cams-wire: the usable-now cameras (display; a still or a click-to-load YouTube player, with its credit and an honest live status; never analysed). Only spots with a camera row get the panel. */}
      <LiveCamPanel spotId={spot.id} zone={timeZoneOf(spot)} />
      {/* hdontap-embeds: HDOnTap cameras as links (their player cannot be framed by our site); the embeds are wired but switched off. */}
      <HdontapLinks spotId={spot.id} exclude={cams.map((c) => c.url)} />

      <ConditionsGrid spot={spot} h={selected} p={p} dayHours={dayHours} extrema={extrema} bundle={bundle} now={now} open={openCard} onToggle={toggleCard} observe={<><ObservedLine spotId={spot.id} nowMs={now} />{hs.kind !== 'official' && <FeltRight spotId={spot.id} at={selected.timestamp} env={env} nowMs={now} />}</>} breaker={call.breaker.type !== 'unknown' ? BREAKER_WORD[call.breaker.type] : null} observeEntry={<ObserveEntry onOpen={() => setObserving(true)} />} scale={<ScalePanel hs={hs} p={p} board={scaleBoard} outsideNote={outsideFacingForHour(spot.id, selected.forecast)} onOpen={() => go('forecast', 'wave-scale')} />} />
      {observing && <ObservePanel key={spot.id} spotName={spot.name} spotId={spot.id} p={p} env={env} onDone={(o) => { setObserving(false); setSaved(o ? `Saved: you saw ~${sawWords(o.word)}` : ''); }} />}
      <p className="sr-only" role="status" aria-live="polite">{saved}</p>
      {openCard && <CardDetail k={openCard} spot={spot} h={selected} p={p} dayHours={dayHours} onSelect={view.selectTime} onClose={() => setOpenCard(null)}
        Tide={<TideDay hours={dayHours} selected={view.selectedTime} extrema={extrema} spot={spot} p={p} onSelect={view.selectTime} />}
        Polar={<PolarSwell hours={dayHours} selected={view.selectedTime} facing={facingOf(spot.id)} onSelect={view.selectTime} />} />}
      {/* lead triage (design re-critique): no board suggestion under a Skip (or after dark with no window ahead): 'Ride your …' there reads as advice to paddle out */}
      {!(call.verdict === 'Skip' || (call.verdict === 'Dark' && !call.nextWindow)) && <BoardLine boards={data.state.boards} choice={choice} f={selected.forecast} p={p} hs={hs} onOpen={() => go('quiver', 'match')} onQuiver={() => go('quiver')} />}
      <DayStrip days={days} series={series} spot={spot} p={p} bundle={bundle} now={now} cur={curDay} best={bestK} onPick={pickDay} />

      <section className="card sp-chart" aria-label="Forecast detail">
        <div className="sp-chart-h">
          <div className="seg" role="radiogroup" aria-label="Detail view">
            <button role="radio" aria-checked={mode === 'graph'} onClick={() => pickMode('graph')}>Graph</button>
            <button role="radio" aria-checked={mode === 'table'} onClick={() => pickMode('table')}>Table</button>
          </div>
          {mode === 'graph' ? <>
            <div className="seg" role="radiogroup" aria-label="Range">
              <button role="radio" aria-checked={range === 'week'} onClick={() => setRange('week')}>7 days</button>
              <button role="radio" aria-checked={range === 'day'} onClick={() => setRange('day')}>{weekdayPT(selected.timestamp)}</button>
            </div>
          </> : <span className="fine">{weekdayPT(selected.timestamp)} {dayNumPT(selected.timestamp)} · every 3 hours · wind colored by shore relation</span>}
        </div>
        {mode === 'graph' ? <>
          {/* user, 2026-11-08: the four series stacked, tidied (docs/specs/2026-11-08-stacked-charts-tidy.md): day labels once on top, hours once at the bottom,
              one rating strip under Surf, heights by need, flush so the selected-hour line runs through all four */}
          <div className="sp-stack">
          {CHART_TABS.map(([tab, label]) => (
            <section key={tab} className="sp-series" aria-label={`${label} chart`}>
              <Timeline series={series} spot={spot} p={p} selectedTime={view.selectedTime} onSelect={view.selectTime} now={now} dayIndex={range === 'day' ? Math.max(0, curDay) : null} tab={tab} band={band} extrema={extrema} height={(narrow ? STACK_H_PHONE : STACK_H)[tab]} title={label} showDays={tab === 'surf'} showRibbon={tab === 'surf'} showHours={tab === 'tide'} stacked />
            </section>
          ))}
          </div>
          <ul className="legend" aria-hidden="true">
          {CHART_TABS.map(([tab]) => <Fragment key={tab}>
            {tab === 'surf' && <>{hasEstimates && <><li><i style={{background: 'var(--hs-hi)', opacity: 0.45, height: 8}} />Surf estimate (range)</li><li><i style={{background: 'var(--hs-hi)', height: 0, borderTop: '2px solid var(--hs-hi)'}} />Middle of the range</li><li><i className="lg-sure" />Fainter: less certain</li>{band.some((b) => b.wide) && <li><i className="lg-wide" />Could be (models differ)</li>}{band.some((b) => b.certainty === 'too-far') && <li><i className="lg-far" />Too far out to call</li>}</>}<li><i style={{background: 'var(--muted)', height: 0, borderTop: '1.5px solid var(--muted)'}} />{hasEstimates ? 'Offshore Hs' : 'Offshore Hs · not surf size'}</li></>}
            {tab === 'swell' && <><li><i style={{background: 'var(--sw1)'}} />Primary swell · period in s</li><li><i style={{background: 'var(--sw2)'}} />Secondary</li>{series.some((h) => h.forecast.tertiary) && <li><i style={{background: 'var(--sw3)'}} />Third swell</li>}<li>▲ arrows show where each swell travels</li></>}
            {tab === 'wind' && <><li><i style={{background: 'var(--accent)'}} />Wind speed</li><li><i style={{background: 'var(--muted)'}} />Gusts</li><li><i style={{width: 44, background: `linear-gradient(90deg,${[0, 6, 10, 14, 18, 24].map(windInk).join(',')})`}} />Arrows 0 to {windWhole(24, p).replace(' ', '+ ')}</li></>}
            {tab === 'tide' && <li><i style={{background: 'var(--tide)'}} />Predicted tide, MLLW</li>}
            {tab === 'surf' && <><li><i style={{background: 'var(--good)'}} />Rating good+</li><li><i style={{background: 'var(--fair)'}} />fair</li><li><i style={{background: 'var(--poor)'}} />poor</li></>}
          </Fragment>)}
          </ul>
        </> : <HourTable hours={dayHours} spot={spot} p={p} bundle={bundle} now={now} selected={view.selectedTime} onSelect={view.selectTime} />}
      </section>

      <details className="card sp-src"><summary><h2>Sources &amp; data</h2><span>nearshore model, buoys, offshore heights and sources · {selected.rating.reliability.category.toLowerCase()} reliability</span></summary>
        <div className="sp-two">
          <section aria-label="Nearshore model"><NearshoreCard spot={spot} p={p} selectedTime={selected.timestamp} now={now} series={series} /></section>
          <section aria-label="Buoy now vs forecast"><div className="card-h"><h2>Buoy now vs forecast</h2></div>{nearSfBuoy(spotLatLon(spot)[0], spotLatLon(spot)[1]) && <BuoyNow buoy={bundle?.buoy} series={series} p={p} now={now} />}<BuoyContext buoys={bundle?.buoys} series={series} p={p} now={now} lat={spotLatLon(spot)[0]} lon={spotLatLon(spot)[1]} tz={timeZoneOf(spot)} /></section>
        </div>
        <Sources />
      </details>
    </div>
  );
}

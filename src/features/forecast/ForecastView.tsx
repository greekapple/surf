import {useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import {evidenceSpots} from '../../ocean/spots';
import {coastalCoverage} from '../../ocean/coastal';
import {formatWaveHeight, nearshoreView} from '../../utils/waveHeight';
import {rateForecast} from '../../ratings/adapters';
import {windRelationship} from '../../recommendation/sqi';
import {CameraPanel, SpotPhoto, StateMessage} from '../../ui/common';
import {DirArrow, Icon} from '../../ui/Icon';
import {Dial, PolarSwell, Spark, TideDay, Timeline, windInk, type ChartTab} from './charts';
import {bestDaylight, compass, groupDays, ht, windVal} from './helpers';
import {BAND_COLOR, bandOf, hourLabel, hourlySeries, titleCase, trendOf, type HourSample} from './model';
import {timeLabelPT, weekdayPT, dayNumPT} from './format';
import {MiniScale} from '../scale/MiniScale';
import {Skeleton} from '../../ui/Skeleton';
import {Condition, conditionWord} from './Condition';
import './forecast.css';

const facingOf = (spot: SurfSpot) => evidenceSpots.find((e) => e.id === spot.id)?.orientation ?? null;
const relChip = (r: string) => ({Offshore: 'off', Onshore: 'on'} as Record<string, string>)[r] ?? '';

function Readout({h, p, series, isNow, preview, spot}: {h: HourSample; p: UserProfile; series: HourSample[]; isNow: boolean; preview: boolean; spot: SurfSpot}) {
  const f = h.forecast, r = h.rating, u = p.heightUnit, tr = trendOf(series, series.indexOf(h)), rel = windRelationship(spot, f);
  return (
    <div className="readout" aria-live="polite">
      <p className="ro-time"><span>{weekdayPT(h.timestamp)} {dayNumPT(h.timestamp)}, {timeLabelPT(h.timestamp)}{isNow ? ' · now' : ''}{preview ? ' · preview' : ''}</span><span>{tr === 'unknown' ? '' : `${titleCase(tr)} over 6 h`}</span></p>
      <div className="ro-c" aria-label={`Rating ${titleCase(r.category)}, score ${r.score ?? 'none'}, provisional, reliability ${r.reliability.category.toLowerCase()}`}>
        <span className="k">Rating</span>
        <span className="v tick" key={h.timestamp}><Condition category={r.category} chip /></span>
        <span className="s">{r.score === null ? 'No score: inputs missing' : `Score ${Math.round(r.score)} · ${r.reliability.category.toLowerCase()} reliability`}</span>
      </div>
      <div className="ro-c">
        <span className="k" title="Significant wave height from the offshore model. It is not the size of breaking surf; no calibrated surf-height estimate exists for this break.">Offshore</span>
        <p className="num swap" key={h.timestamp}>{ht(h.heightFt, p)}<small>{u}</small></p>
        <span className="s">{f.availability.face && Number.isFinite(f.face) ? 'Demonstration face' : 'Model Hs, not surf size'}</span>
      </div>
      <div className="minis">
        <div><span className="k">Swell</span><span className="v tick" key={h.timestamp}>{f.primary && Number.isFinite(f.primary.height) ? `${ht(f.primary.height, p)} ${u} @ ${Math.round(f.primary.period)}s` : '—'}</span>
          <span className="s">{f.primary && Number.isFinite(f.primary.height) ? <><DirArrow from={f.primary.direction} size={13} color="var(--sw2)" />{compass(f.primary.direction)} ({Math.round(f.primary.direction)}°)</> : ''}</span></div>
        <div><span className="k">Wind</span><span className="v tick" key={h.timestamp}>{Number.isFinite(f.wind.direction) ? `${windVal(f.wind.speed, p)} ${p.windUnit}` : '—'}</span>
          <span className="s">{Number.isFinite(f.wind.direction) ? <><DirArrow from={f.wind.direction} size={13} color={windInk(f.wind.speed)} />{compass(f.wind.direction)}{rel === 'Unknown' ? '' : ` (${rel.toLowerCase()})`}</> : ''}</span></div>
        <div><span className="k">Tide</span><span className="v tick" key={h.timestamp}>{Number.isFinite(f.tide.height) ? `${f.tide.height < 0 ? '-' : '+'}${ht(Math.abs(f.tide.height), p)} ${u}` : '—'}</span>
          <span className="s">{f.tide.trend === 'Rising' || f.tide.trend === 'Falling' ? f.tide.trend : ''}</span></div>
        <div><span className="k">Water</span><span className="v tick" key={h.timestamp}>{f.waterTempF ? `${Math.round(f.waterTempF)}°F` : '—'}</span><span className="s" /></div>
      </div>
    </div>
  );
}

function Tiles({h, p, spot, series, extrema}: {h: HourSample; p: UserProfile; spot: SurfSpot; series: HourSample[]; extrema: {timestamp: string; type: string; height: {value: number | null}}[]}) {
  const f = h.forecast, u = p.heightUnit, i = series.indexOf(h), rel = windRelationship(spot, f);
  const a = Math.max(0, i - 12), b = Math.min(series.length, i + 13);
  const next = extrema.find((e) => Date.parse(e.timestamp) > Date.parse(h.timestamp));
  return (
    <div className="tiles">
      <div className="tile"><p className="k">Swell</p>
        <Dial facing={facingOf(spot)} arms={[f.secondary ? {from: f.secondary.direction, color: 'var(--sw2)', w: 2 + Math.min(4, f.secondary.height)} : null, f.primary ? {from: f.primary.direction, color: 'var(--sw1)', w: 2 + Math.min(5, f.primary.height)} : null]} />
        <p className="v">{f.primary ? <>{ht(f.primary.height, p)}<small> {u} · </small>{Math.round(f.primary.period)}<small> s</small></> : 'Unavailable'}</p>
        <p className="s">{f.primary ? `${compass(f.primary.direction)} ${Math.round(f.primary.direction)}°` : ''}{f.secondary ? ` · 2nd ${ht(f.secondary.height, p)} ${u} ${Math.round(f.secondary.period)} s` : ''}</p></div>
      <div className="tile"><p className="k">Wind</p>
        <Dial facing={facingOf(spot)} arms={[Number.isFinite(f.wind.direction) ? {from: f.wind.direction, color: windInk(f.wind.speed), w: 3.5} : null]} />
        <p className="v">{windVal(f.wind.speed, p)}<small> {p.windUnit} · gust {windVal(f.wind.gusts ?? null, p)}</small></p>
        <p className="s">{compass(f.wind.direction)} · <span className={`chip ${relChip(rel)}`}>{rel === 'Unknown' ? 'Shore relation unknown' : rel}</span></p></div>
      <div className="tile"><p className="k">Tide · regional</p>
        <Spark values={series.slice(a, b).map((x) => x.forecast.tide.height)} index={i - a} color="var(--tide)" />
        <p className="v">{ht(f.tide.height, p)}<small> {u} {f.tide.trend === 'Rising' ? '↑' : f.tide.trend === 'Falling' ? '↓' : ''}</small></p>
        <p className="s">{next && next.height.value !== null ? `${next.type} ${ht(next.height.value, p)} ${u} at ${timeLabelPT(next.timestamp)}` : 'SF 9414290 · MLLW'}</p></div>
      <div className="tile"><p className="k">Water</p>
        <Spark values={series.map((x) => x.forecast.waterTempF ?? 0)} index={i} color="var(--sw2)" />
        <p className="v">{f.waterTempF ? <>{f.waterTempF.toFixed(1)}<small> °F · {((f.waterTempF - 32) / 1.8).toFixed(1)} °C</small></> : 'Unavailable'}</p>
        <p className="s">Sea surface · model · 7 days</p></div>
    </div>
  );
}

function Sources() {
  const {view, live, now} = useSwello();
  const o = view.ocean;
  if (!live) return <p>Demonstration week (Oct 16–22): illustrative profiles, not live data and never mixed with retrieved forecasts.</p>;
  return (
    <div style={{display: 'grid', gap: 10}}>
      <p className="fine">Model forecasts: Open-Meteo Marine &amp; Weather. Tide predictions: NOAA CO-OPS 9414290 (San Francisco, regional, MLLW). Ratings: SURF provisional engine, uncalibrated. Times are Pacific.</p>
      <div className="tscroll" role="region" tabIndex={0} aria-label="Data source status (scrolls sideways)"><table className="cmp"><thead><tr><th>Source</th><th>State</th><th>Detail</th></tr></thead><tbody>
        {o.statuses.map((s) => <tr key={s.id}><td>{s.provider}</td><td><span className={`chip ${s.state === 'connected' ? 'off' : s.state === 'partial' ? 'demo' : 'on'}`}>{s.state}</span></td><td className="fine">{s.message}</td></tr>)}
      </tbody></table></div>
      {o.bundle?.buoy && (
        <div><p><b>Observation</b> · NOAA NDBC 46026 buoy {o.bundle.buoy.delivery === 'saved' ? <span className="chip demo">saved historical, not live</span> : <span className="chip off">observed</span>}</p>
          <ul className="fine" style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '2px 14px'}}>{Object.entries(o.bundle.buoy.values).slice(0, 5).map(([k, m]) => <li key={k}>{k} {typeof m.value === 'number' ? +m.value.toFixed(1) : m.value ?? '—'} {m.unit} · observed {weekdayPT(m.source.validAt)} {dayNumPT(m.source.validAt)} {timeLabelPT(m.source.validAt)}</li>)}</ul>
          {(() => { const ages = Object.values(o.bundle.buoy.values).map((m) => now - Date.parse(m.source.validAt)).filter(Number.isFinite), youngest = Math.min(...ages); return ages.length && youngest > 6 * 3600000 ? <p className="fine"><b>Saved snapshot, {youngest >= 86400000 ? `${Math.floor(youngest / 86400000)} days old` : `${Math.floor(youngest / 3600000)} h old`}.</b> Not current conditions.</p> : null; })()}
        </div>
      )}
    </div>
  );
}

function Nearshore({spot, p, selectedTime, now, series}: {spot: SurfSpot; p: UserProfile; selectedTime: string; now: number; series: HourSample[]}) {
  const {view, live} = useSwello();
  const cov = spot.id === 'spot-2' ? coastalCoverage['spot-2'] : null;
  const model = cov ? cov.candidate.split(',')[0] : '', mop = model.split(' ').pop();
  const head = <div className="card-h"><h2>Nearshore model</h2><span>{cov ? `${model} · Ocean Beach only` : 'Ocean Beach only'}</span></div>;
  if (!cov) return <>{head}<p>No nearshore model for this spot.</p></>;
  const where = `Transect ${mop} · ${cov.latitude.toFixed(3)}, ${cov.longitude.toFixed(3)} · ${cov.depthM} m depth · shore normal ${cov.shoreNormal}°`;
  if (!live) return <>{head}<p>The nearshore model needs retrieved data; none is loaded in demonstration mode.</p><p className="fine">{where}</p></>;
  const recs = view.ocean.bundle?.nearshore ?? [], v = nearshoreView(recs, Date.parse(selectedTime), now);
  const when = (iso: string) => `${weekdayPT(iso)} ${dayNumPT(iso)} ${timeLabelPT(iso)} PT`;
  const seriesHour = (iso: string) => series.reduce<{t: string; d: number} | null>((b, h) => { const d = Math.abs(Date.parse(h.timestamp) - Date.parse(iso)); return d <= 1800000 && (!b || d < b.d) ? {t: h.timestamp, d} : b; }, null)?.t;
  const rec = v.state === 'exact' || v.state === 'latest' ? v.record : null;
  const target = rec ? seriesHour(rec.timestamp) : v.state === 'outside-window' && v.latest ? seriesHour(v.latest.timestamp) : undefined;
  const jump = target && target !== selectedTime ? <p><button className="btn" onClick={() => view.selectTime(target)}>Go to latest nowcast hour</button></p> : null;
  if (!rec) {
    const msg = v.state === 'no-data' ? 'No CDIP nowcast data was returned for this load.'
      : v.state === 'before-first' ? `The selected hour is earlier than the first nowcast record (${when(v.first.timestamp)}); no values are shown.`
      : v.state === 'gap' ? 'No CDIP nowcast record within 30 min of the selected hour; nothing is interpolated.'
      : `The selected hour is outside the nowcast window (now ±24 h); nothing is extrapolated.`;
    return <>{head}<p>{msg}</p>{jump}<p className="fine">{where}</p></>;
  }
  const hs = formatWaveHeight({kind: 'nearshore', valueFt: rec.height.value}, p, 'technical'), tp = rec.period.value, dp = rec.direction.value;
  return (
    <>{head}
      {v.state === 'latest' && <p><span className="chip demo">Latest nowcast</span> Valid {when(rec.timestamp)} ({v.hoursBefore} h before the selected hour). Not the selected hour's value.</p>}
      <div className="minis" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(110px, auto))', justifyContent: 'start'}} role="group" aria-label="Nearshore model values">
        <div><span className="k">Hs · {cov.depthM} m depth</span><span className="v">{rec.height.value === null ? '—' : <>{hs.text.replace(` ${p.heightUnit}`, '')}<small>{p.heightUnit}</small></>}</span></div>
        <div><span className="k">Tp (peak period)</span><span className="v">{tp === null ? '—' : <>{Math.round(tp * 10) / 10}<small>s</small></>}</span></div>
        <div><span className="k">Direction (from)</span><span className="v">{dp === null ? '—' : <><DirArrow from={dp} color="var(--sw1)" />{Math.round(dp)}<small>° {compass(dp)}</small></>}</span></div>
      </div>
      <p className="fine">Valid {when(rec.timestamp)}{v.state === 'exact' ? ' (nearest record to the selected hour)' : ''} · {where}. Modeled Hs at depth, not surf height.</p>
      {jump}
    </>
  );
}


const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};

/** The six nearest spots at the selected hour: height and condition, each opens that spot. */
function Nearby({spot, at, p, now, onOpen}: {spot: SurfSpot; at: string; p: UserProfile; now: number; onOpen: (id: string) => void}) {
  const {spotOptions, view} = useSwello();
  const items = useMemo(() => {
    const from = evidenceSpots.find((e) => e.id === spot.id);
    if (!from) return [];
    return evidenceSpots.filter((e) => e.id !== spot.id)
      .map((e) => ({e, d: km([from.latitude, from.longitude], [e.latitude, e.longitude])}))
      .sort((a, b) => a.d - b.d).slice(0, 6)
      .map(({e, d}) => {
        const s = spotOptions.find((o) => o.id === e.id);
        const ser = s ? hourlySeries(s, view.mapRecords, now) : [];
        return {id: e.id, name: e.name, d, h: ser.find((x) => x.timestamp === at) ?? ser.find((x) => Date.parse(x.timestamp) >= Math.floor(now / 3600000) * 3600000)};
      });
  }, [spot.id, spotOptions, view.mapRecords, now, at]);
  if (!items.length) return null;
  return (
    <nav className="fc-near" aria-label="Nearby spots">
      <ul>{items.map((n) => (
        <li key={n.id}><button onClick={() => onOpen(n.id)} aria-label={`${n.name}, ${Math.round(n.d)} km away${n.h ? `, ${ht(n.h.heightFt, p)} ${p.heightUnit}, ${conditionWord(n.h.rating.category)}` : ', no record'}. Open forecast.`}>
          <span className="nm">{n.name}</span>
          <span className="vl">{n.h ? <><b className="tick" key={n.h.timestamp}>{ht(n.h.heightFt, p)}</b> {p.heightUnit} <Condition category={n.h.rating.category} /></> : <span className="fine">No record</span>}</span>
          <span className="fine">{Math.round(n.d)} km</span>
        </button></li>
      ))}</ul>
    </nav>
  );
}

const PARTS: [string, string][] = [['fc-now', 'Overview'], ['fc-swell', 'Swell'], ['fc-wind', 'Wind & tide'], ['fc-scale', 'Wave scale'], ['fc-sources', 'Sources']];
/** Sticky in-page navigation: jumps to each part of the forecast and highlights the one in view. */
function JumpBar() {
  const [active, setActive] = useState('fc-now');
  useEffect(() => {
    const els = PARTS.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((entries) => { const v = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActive(v.target.id); }, {rootMargin: '-140px 0px -55% 0px'});
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  return <nav className="fc-jump" aria-label="On this page">{PARTS.map(([id, label]) => <button key={id} aria-current={active === id ? 'true' : undefined} onClick={() => jump(id)}>{label}</button>)}</nav>;
}

const CHART_TABS: [ChartTab, string][] = [['surf', 'Surf'], ['swell', 'Swell'], ['wind', 'Wind'], ['tide', 'Tide']];

/** Wave scale preview: a photograph with the size gauge, or the side elevation. The 3D page is one click away. */
function WaveCard({forecast, go, spotId}: {forecast: Forecast; go: ViewProps['go']; spotId: string}) {
  const {prefs, setPrefs, data} = useSwello();
  const [mode, setMode] = useState<'ride' | 'paddle' | 'side'>(prefs.scaleMode);
  const ft = prefs.scaleFt, m = data.state.profile.heightUnit === 'm';
  const pick = (x: 'ride' | 'paddle' | 'side') => { setMode(x); if (x !== 'side') setPrefs({scaleMode: x}); };
  return (
    <section className="card fc-scale wc" id="fc-scale" aria-label="Wave scale">
      <div className="wc-h"><h2>Wave scale (3D)</h2><button className="btn" onClick={() => go('forecast', 'wave-scale')}>Open in 3D</button></div>
      <div className="wc-stage">
        {mode === 'side' ? <MiniScale forecast={forecast} /> : <>
          <SpotPhoto spotId={`generic-${spotId}`} index={2} className="wc-photo" />
          <div className="wc-gauge">
            <output className="wc-big" htmlFor="wc-ft">{m ? (ft * 0.3048).toFixed(1) : ft}<small> {m ? 'm' : 'ft'}</small></output>
            <input id="wc-ft" type="range" min={2} max={20} step={0.5} value={ft} aria-label="Illustrative wave face height" onChange={(e) => setPrefs({scaleFt: Number(e.target.value)})} />
          </div>
        </>}
      </div>
      <div className="seg wc-seg" role="radiogroup" aria-label="Preview view">
        {([['ride', 'Riding'], ['paddle', 'Paddling'], ['side', 'Side']] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={mode === k} onClick={() => pick(k)}>{l}</button>)}
      </div>
    </section>
  );
}

export function ForecastView({section, go}: ViewProps) {
  const {view, data, now, spot, series, selected, live, setSpot} = useSwello();
  const p = data.state.profile;
  const days = useMemo(() => groupDays(series), [series]);
  const [dayIndex, setDayIndex] = useState<number | null>(() => (matchMedia('(max-width: 860px)').matches ? 0 : null));
  const extrema = view.ocean.bundle?.extrema ?? [];
  const selIdx = selected ? series.indexOf(selected) : -1;
  const curDay = selIdx >= 0 ? days.findIndex((d) => selIdx >= d.start && selIdx <= d.end) : -1;
  useEffect(() => { if (dayIndex !== null && curDay >= 0 && curDay !== dayIndex) setDayIndex(curDay); }, [curDay]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hourMode, setHourMode] = useState(false);
  const [tab, setTab] = useState<ChartTab>(() => { const c = new URLSearchParams(location.search).get('chart'); return CHART_TABS.some(([id]) => id === c) ? (c as ChartTab) : 'surf'; });
  const pickTab = (t: ChartTab) => {
    setTab(t);
    const u = new URL(location.href); if (t === 'surf') u.searchParams.delete('chart'); else u.searchParams.set('chart', t);
    history.replaceState(history.state, '', u);
  };
  const onTabKey = (e: ReactKeyboardEvent) => {
    const k = CHART_TABS.findIndex(([id]) => id === tab), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = CHART_TABS[(k + d + CHART_TABS.length) % CHART_TABS.length][0];
    pickTab(next); requestAnimationFrame(() => document.getElementById(`ctab-${next}`)?.focus());
  };
  const fav = data.state.favorites.includes(spot.id);
  const [hoverT, setHoverT] = useState<string | null>(null);
  useEffect(() => setHoverT(null), [view.selectedTime]);

  const bestK = useMemo(() => {
    let best = -1, bs = -1;
    days.forEach((d, k) => {
      if (d.end - d.start < 11) return;
      const sc = series.slice(d.start, d.end + 1).map((h) => h.rating.score).filter((v): v is number => v !== null);
      if (!sc.length) return;
      const avg = sc.reduce((x, y) => x + y, 0) / sc.length;
      if (avg > bs) { bs = avg; best = k; }
    });
    return best;
  }, [days, series]);
  const pickDay = (k: number) => {
    const d = days[k];
    const best = bestDaylight(series, spot, Date.parse(series[d.start].timestamp), Date.parse(series[d.end].timestamp) + 1);
    setDayIndex(k); setHourMode(false);
    view.selectTime((best ?? series[d.start]).timestamp);
  };
  const toNow = () => { const i = series.findIndex((h) => Date.parse(h.timestamp) >= Math.floor(now / 3600000) * 3600000); if (i >= 0) view.selectTime(series[i].timestamp); };

  if (live && view.ocean.loading && !view.ocean.bundle) return <Skeleton label="Loading forecast…" />;
  if (live && !view.ocean.bundle) return <StateMessage title="Forecast data unavailable" action={<button className="btn" onClick={view.ocean.reload}>Try again</button>}>{view.ocean.error ?? 'The providers could not be reached.'} Nothing is filled in from other spots or older data.</StateMessage>;
  if (!selected) return <StateMessage title={`No record for ${spot.name} at this hour`} action={<button className="btn" onClick={toNow}>Go to now</button>}>Values are never borrowed from other hours or spots.</StateMessage>;

  const isNow = selIdx === series.findIndex((h) => Date.parse(h.timestamp) >= Math.floor(now / 3600000) * 3600000);
  const shown = (hoverT && series.find((h) => h.timestamp === hoverT)) || selected;
  const shownNow = series.indexOf(shown) === series.findIndex((h) => Date.parse(h.timestamp) >= Math.floor(now / 3600000) * 3600000);
  const dayHours = curDay >= 0 ? series.slice(days[curDay].start, days[curDay].end + 1) : [];
  const dayRange = (d: {start: number; end: number}) => {
    const hs = series.slice(d.start, d.end + 1).map((h) => h.heightFt).filter((v): v is number => v !== null && Number.isFinite(v));
    if (!hs.length) return '—';
    const dg = p.heightUnit === 'm' ? 1 : 0, lo = ht(Math.min(...hs), p, dg), hi = ht(Math.max(...hs), p, dg);
    return `${lo === hi ? lo : `${lo}–${hi}`} ${p.heightUnit}`;
  };
  const metaBits = [spot.region, `${spot.type.toLowerCase()} break`, live ? 'Model forecast, ratings provisional' : 'Demonstration week, not live'];
  return (
    <div className="fc">
      <header className="fc-head fc-hero">
        <SpotPhoto spotId={spot.id} index={1} className="fc-hero-shot" />
        <div className="fc-hero-in">
          <div>
            <h1>{spot.name}<button className="fc-fav" aria-pressed={fav} aria-label={fav ? `Remove ${spot.name} from favourites` : `Save ${spot.name}`} onClick={() => data.favorite(spot.id)}><Icon name="star" size={26} /></button></h1>
            <p className="fc-sub">{metaBits.join(' · ')}</p>
          </div>
          <div className="fc-hero-act">
            <div className="seg" role="radiogroup" aria-label="Range">
              <button role="radio" aria-checked={dayIndex === null && !hourMode} onClick={() => { setHourMode(false); setDayIndex(null); }}>7 Days</button>
              <button role="radio" aria-checked={dayIndex !== null && !hourMode} onClick={() => { setHourMode(false); setDayIndex(Math.max(0, curDay)); }}>Day</button>
              <button role="radio" aria-checked={hourMode} onClick={() => setHourMode(true)}>Hour</button>
            </div>
            <button className="btn" onClick={toNow}>Now</button>
            <button className="btn" onClick={() => go('explore')}><Icon name="explore" size={16} />Map</button>
          </div>
        </div>
      </header>
      <div className="fc-body">
      <section className="fc-strip" aria-label="Selected hour">
        <Readout h={shown} p={p} series={series} isNow={shownNow} preview={shown !== selected} spot={spot} />
        <div className="days" role="group" aria-label="Forecast day">
          {days.map((d, k) => d.end - d.start < 11 ? null : (
            <button key={d.key} className="day" aria-pressed={k === curDay} onClick={() => pickDay(k)}>
              <span className="t"><span>{weekdayPT(d.t)} {dayNumPT(d.t)}</span>{k === bestK && <span className="best" title="Best day of the week" aria-label="Best day"><Icon name="star" size={13} /></span>}</span>
              <span className="dh">{dayRange(d)}</span>
              <span className="q">{Array.from({length: 8}, (_, j) => series[d.start + Math.floor(((j + 0.5) * (d.end - d.start + 1)) / 8)]).map((h, j) => <i key={j} style={{background: BAND_COLOR[bandOf(h.rating.category)]}} />)}</span>
            </button>
          ))}
        </div>
      </section>

      <div id="fc-now" className="fc-grid fc-part">
        <section className="card fc-tl" aria-label="Forecast timeline">
          <div className="fc-tl-h">
            <div className="ctabs" role="tablist" aria-label="Chart series" onKeyDown={onTabKey}>
              {CHART_TABS.map(([id, label]) => <button key={id} id={`ctab-${id}`} role="tab" aria-selected={tab === id} aria-controls="ctab-panel" tabIndex={tab === id ? 0 : -1} onClick={() => pickTab(id)}>{label}</button>)}
            </div>
            <span className="fine">{hourMode ? 'Hour' : dayIndex === null ? '7 days' : weekdayPT(selected.timestamp)} · hover or drag, arrow keys step</span>
          </div>
          <div id="ctab-panel" role="tabpanel" aria-labelledby={`ctab-${tab}`}>
            <Timeline series={series} spot={spot} p={p} selectedTime={view.selectedTime} onSelect={view.selectTime} onHover={setHoverT} now={now} dayIndex={dayIndex} hourWindow={hourMode} tab={tab} extrema={extrema} height={matchMedia('(max-width: 860px)').matches ? 280 : 330} />
          </div>
          <ul className="legend" aria-hidden="true">
            {tab === 'surf' && <><li><i style={{background: 'var(--hs-hi)', height: 8}} />Offshore Hs</li><li><i style={{background: 'var(--tide)', height: 0, borderTop: '2px dashed var(--tide)'}} />Tide</li></>}
            {tab === 'swell' && <><li><i style={{background: 'var(--sw1)'}} />Primary swell</li><li><i style={{background: 'var(--sw2)'}} />Secondary</li></>}
            {tab === 'wind' && <><li><i style={{background: 'var(--accent)'}} />Wind speed</li><li><i style={{background: 'var(--muted)'}} />Gusts</li><li><i style={{width: 44, background: `linear-gradient(90deg,${[0, 6, 10, 14, 18, 24].map(windInk).join(',')})`}} />Arrows 0 to 24+ mph</li></>}
            {tab === 'tide' && <li><i style={{background: 'var(--tide)'}} />Predicted tide, MLLW</li>}
            <li><i style={{background: 'var(--good)'}} />Rating good+</li><li><i style={{background: 'var(--fair)'}} />fair</li><li><i style={{background: 'var(--poor)'}} />poor</li>
          </ul>
        </section>
        <WaveCard forecast={selected.forecast} go={go} spotId={spot.id} />
        <section className="card fc-hours"><div className="card-h"><h2>Next hours</h2><span>swell · wind</span></div>
          <ol className="hours">{series.slice(selIdx, selIdx + 10).map((h, k) => (
            <li key={h.timestamp}><button aria-current={k === 0} onClick={() => view.selectTime(h.timestamp)}>
              <span className="t">{hourLabel(h.timestamp)}</span><Condition category={h.rating.category} compact />
              <span>{ht(h.heightFt, p)} {p.heightUnit}</span><span>{h.forecast.primary ? <><DirArrow from={h.forecast.primary.direction} size={13} />{Math.round(h.forecast.primary.period)}s</> : '—'}</span>
              <span>{Number.isFinite(h.forecast.wind.direction) ? <><DirArrow from={h.forecast.wind.direction} size={13} color={windInk(h.forecast.wind.speed)} />{windVal(h.forecast.wind.speed, p)}</> : '—'}</span>
            </button></li>
          ))}</ol></section>
        <section className="card fc-inst" aria-label="Instruments"><div className="card-h"><h2>Conditions</h2><span>{weekdayPT(selected.timestamp)} {hourLabel(selected.timestamp)}</span></div><Tiles h={selected} p={p} spot={spot} series={series} extrema={extrema} /></section>
      </div>

      <Nearby spot={spot} at={selected.timestamp} p={p} now={now} onOpen={setSpot} />
      <JumpBar />

      <div id="fc-swell" className="fc-grid fc-part">
        <h2 className="fc-part-h">Swell</h2>
        <section className="card fc-wide" aria-label="Nearshore model"><Nearshore spot={spot} p={p} selectedTime={selected.timestamp} now={now} series={series} /></section>
        <section className="card fc-half"><div className="card-h"><h2>Direction &amp; period</h2><span>{weekdayPT(selected.timestamp)}</span></div>
          <PolarSwell hours={dayHours} selected={view.selectedTime} facing={facingOf(spot)} onSelect={view.selectTime} />
          <p className="fine"><i style={{display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--sw1)', marginRight: 4}} />primary · <i style={{display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--sw2)', marginRight: 4}} />secondary · ring = period (s) · size = height</p></section>
        <section className="card fc-half"><div className="card-h"><h2>Swell components</h2><span>{weekdayPT(selected.timestamp)}</span></div>
          <div className="tscroll" role="region" tabIndex={0} aria-label="Swell components by hour (scrolls sideways)"><table className="cmp"><thead><tr><th>Hour</th><th>Primary</th><th>Secondary</th><th>Offshore Hs</th></tr></thead><tbody>
            {dayHours.filter((_, j) => j % 2 === 0).map((h) => <tr key={h.timestamp} className={h.timestamp === view.selectedTime ? 'sel' : ''}><td><button onClick={() => view.selectTime(h.timestamp)}>{hourLabel(h.timestamp)}</button></td>
              <td>{h.forecast.primary ? `${ht(h.forecast.primary.height, p)} ${p.heightUnit} · ${Math.round(h.forecast.primary.period)} s · ${compass(h.forecast.primary.direction)}` : '—'}</td>
              <td>{h.forecast.secondary ? `${ht(h.forecast.secondary.height, p)} ${p.heightUnit} · ${Math.round(h.forecast.secondary.period)} s · ${compass(h.forecast.secondary.direction)}` : '—'}</td>
              <td>{ht(h.heightFt, p)} {p.heightUnit}</td></tr>)}
          </tbody></table></div></section>
      </div>

      <div id="fc-wind" className="fc-grid fc-part">
        <h2 className="fc-part-h">Wind &amp; tide</h2>
        <section className="card fc-half"><div className="card-h"><h2>Tide</h2><span>SF 9414290 · regional · MLLW</span></div>
          <TideDay hours={dayHours} selected={view.selectedTime} extrema={extrema} spot={spot} p={p} onSelect={view.selectTime} /><p className="fine">Predictions, not observations · sunrise/sunset approximate</p></section>
        <section className="card fc-half"><div className="card-h"><h2>Wind through the day</h2><span>{weekdayPT(selected.timestamp)}</span></div>
          <ol className="hours wind-hours">{dayHours.filter((_, j) => j % 2 === 0).map((h) => (
            <li key={h.timestamp}><button aria-current={h.timestamp === view.selectedTime} onClick={() => view.selectTime(h.timestamp)}>
              <span className="t">{hourLabel(h.timestamp)}</span><span className="qdot" style={{background: windInk(h.forecast.wind.speed)}} />
              <span>{windVal(h.forecast.wind.speed, p)} {p.windUnit}</span><span>gust {windVal(h.forecast.wind.gusts ?? null, p)}</span>
              <span>{Number.isFinite(h.forecast.wind.direction) ? <><DirArrow from={h.forecast.wind.direction} size={13} color={windInk(h.forecast.wind.speed)} />{compass(h.forecast.wind.direction)}</> : '—'}</span>
            </button></li>
          ))}</ol></section>
      </div>

      <div id="fc-sources" className="fc-grid fc-part">
        <details className="card fc-src"><summary><h2>Sources &amp; reliability</h2><span>{selected.rating.reliability.category.toLowerCase()} reliability · show details</span></summary><Sources /></details>
        <div className="fc-cam"><CameraPanel spotName={spot.name} /></div>
      </div>
      </div>
    </div>
  );
}

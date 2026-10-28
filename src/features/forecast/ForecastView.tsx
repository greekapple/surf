import {useEffect, useMemo, useState} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import type {SurfSpot, UserProfile} from '../../models/index';
import {evidenceSpots} from '../../ocean/spots';
import {rateForecast} from '../../ratings/adapters';
import {windRelationship} from '../../recommendation/sqi';
import {CameraPanel, SpotPhoto, StateMessage} from '../../ui/common';
import {DirArrow, Icon} from '../../ui/Icon';
import {Dial, PolarSwell, QualityBand, Spark, TideDay, Timeline} from './charts';
import {bestDaylight, compass, groupDays, ht, windColor, windVal} from './helpers';
import {BAND_COLOR, bandOf, hourLabel, titleCase, trendOf, type HourSample} from './model';
import {timeLabelPT, weekdayPT, dayNumPT} from './format';
import {MiniScale} from '../scale/MiniScale';

const facingOf = (spot: SurfSpot) => evidenceSpots.find((e) => e.id === spot.id)?.orientation ?? null;
const relChip = (r: string) => ({Offshore: 'off', Onshore: 'on'} as Record<string, string>)[r] ?? '';

function Readout({h, p, series, isNow}: {h: HourSample; p: UserProfile; series: HourSample[]; isNow: boolean}) {
  const f = h.forecast, r = h.rating, u = p.heightUnit, tr = trendOf(series, series.indexOf(h));
  return (
    <div className="readout" aria-live="polite">
      <div>
        <p className="ro-time"><span>{weekdayPT(h.timestamp)} {dayNumPT(h.timestamp)}, {timeLabelPT(h.timestamp)}{isNow ? ' · now' : ''}</span><span>{tr === 'unknown' ? '' : `${titleCase(tr)} over 6 h`}</span></p>
        <p className="num swap" key={h.timestamp}>{ht(h.heightFt, p)}<small>{u}</small></p>
        <p className="hs-label">{f.availability.face && Number.isFinite(f.face) ? 'Demonstration breaking-wave face' : 'Offshore Hs · not surf height'}<span className="chip ill" title="Significant wave height from the offshore model. It is not the size of breaking surf; no calibrated surf-height estimate exists for this break.">model</span></p>
      </div>
      <div aria-label={`Rating ${titleCase(r.category)}, score ${r.score ?? 'none'}, provisional, reliability ${r.reliability.category.toLowerCase()}`}>
        <p className="qcat"><i style={{background: BAND_COLOR[bandOf(r.category)]}} />{r.category === 'UNRATED' ? 'Unrated' : titleCase(r.category)}<small>provisional</small></p>
        <QualityBand score={r.score} reliability={r.reliability.category} />
        <p className="fine">{r.score === null ? 'No score: inputs missing' : `Score ${Math.round(r.score)} · reliability ${r.reliability.category.toLowerCase()} · band width shows reliability tier, not a measured range`}</p>
      </div>
      <div className="minis">
        <div><span className="k">Swell</span><span className="v">{f.primary && Number.isFinite(f.primary.height) ? <><DirArrow from={f.primary.direction} color="#f2f8fc" />{ht(f.primary.height, p)}<small>{u} {Math.round(f.primary.period)}s</small></> : '—'}</span></div>
        <div><span className="k">Wind</span><span className="v">{Number.isFinite(f.wind.direction) ? <><DirArrow from={f.wind.direction} color={windColor(f.wind.speed)} />{windVal(f.wind.speed, p)}<small>{p.windUnit}</small></> : '—'}</span></div>
        <div><span className="k">Tide</span><span className="v">{ht(f.tide.height, p)}<small>{u} {f.tide.trend === 'Rising' ? '↑' : f.tide.trend === 'Falling' ? '↓' : ''}</small></span></div>
        <div><span className="k">Water</span><span className="v">{f.waterTempF ? <>{f.waterTempF.toFixed(1)}<small>°F</small></> : '—'}</span></div>
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
        <Dial facing={facingOf(spot)} arms={[f.secondary ? {from: f.secondary.direction, color: '#6fb2e3', w: 2 + Math.min(4, f.secondary.height)} : null, f.primary ? {from: f.primary.direction, color: '#f2f8fc', w: 2 + Math.min(5, f.primary.height)} : null]} />
        <p className="v">{f.primary ? <>{ht(f.primary.height, p)}<small> {u} · </small>{Math.round(f.primary.period)}<small> s</small></> : 'Unavailable'}</p>
        <p className="s">{f.primary ? `${compass(f.primary.direction)} ${Math.round(f.primary.direction)}°` : ''}{f.secondary ? ` · 2nd ${ht(f.secondary.height, p)} ${u} ${Math.round(f.secondary.period)} s` : ''}</p></div>
      <div className="tile"><p className="k">Wind</p>
        <Dial facing={facingOf(spot)} arms={[Number.isFinite(f.wind.direction) ? {from: f.wind.direction, color: windColor(f.wind.speed), w: 3.5} : null]} />
        <p className="v">{windVal(f.wind.speed, p)}<small> {p.windUnit} · gust {windVal(f.wind.gusts ?? null, p)}</small></p>
        <p className="s">{compass(f.wind.direction)} · <span className={`chip ${relChip(rel)}`}>{rel === 'Unknown' ? 'Shore relation unknown' : rel}</span></p></div>
      <div className="tile"><p className="k">Tide · regional</p>
        <Spark values={series.slice(a, b).map((x) => x.forecast.tide.height)} index={i - a} color="#9db5c8" />
        <p className="v">{ht(f.tide.height, p)}<small> {u} {f.tide.trend === 'Rising' ? '↑' : f.tide.trend === 'Falling' ? '↓' : ''}</small></p>
        <p className="s">{next && next.height.value !== null ? `${next.type} ${ht(next.height.value, p)} ${u} at ${timeLabelPT(next.timestamp)}` : 'SF 9414290 · MLLW'}</p></div>
      <div className="tile"><p className="k">Water</p>
        <Spark values={series.map((x) => x.forecast.waterTempF ?? 0)} index={i} color="#6fb2e3" />
        <p className="v">{f.waterTempF ? <>{f.waterTempF.toFixed(1)}<small> °F · {((f.waterTempF - 32) / 1.8).toFixed(1)} °C</small></> : 'Unavailable'}</p>
        <p className="s">Sea surface · model · 7 days</p></div>
    </div>
  );
}

function Sources() {
  const {view, live} = useSwello();
  const o = view.ocean;
  if (!live) return <p>Demonstration week (Oct 16–22): illustrative profiles, not live data and never mixed with retrieved forecasts.</p>;
  return (
    <div style={{display: 'grid', gap: 10}}>
      <p className="fine">Model forecasts: Open-Meteo Marine &amp; Weather. Tide predictions: NOAA CO-OPS 9414290 (San Francisco, regional, MLLW). Ratings: SURF provisional engine, uncalibrated. Times are Pacific.</p>
      <table className="cmp"><thead><tr><th>Source</th><th>State</th><th>Detail</th></tr></thead><tbody>
        {o.statuses.map((s) => <tr key={s.id}><td>{s.provider}</td><td><span className={`chip ${s.state === 'connected' ? 'off' : s.state === 'partial' ? 'demo' : 'on'}`}>{s.state}</span></td><td className="fine">{s.message}</td></tr>)}
      </tbody></table>
      {o.bundle?.buoy && (
        <div><p><b>Observation</b> · NOAA NDBC 46026 buoy {o.bundle.buoy.delivery === 'saved' ? <span className="chip demo">saved historical, not live</span> : <span className="chip off">observed</span>}</p>
          <p className="fine">{Object.entries(o.bundle.buoy.values).slice(0, 5).map(([k, m]) => `${k} ${m.value ?? '—'} ${m.unit}`).join(' · ')}{Object.values(o.bundle.buoy.values)[0] ? ` · valid ${timeLabelPT(Object.values(o.bundle.buoy.values)[0].source.validAt)}` : ''}</p></div>
      )}
    </div>
  );
}

function Compare({onPick}: {onPick: (id: string) => void}) {
  const {view, spotOptions, data, now, spot} = useSwello();
  const p = data.state.profile, t = view.selectedTime;
  return (
    <table className="cmp"><thead><tr><th>Spot</th><th>Rating</th><th>Offshore Hs</th><th>Primary swell</th><th>Wind</th><th>Best daylight (24 h)</th><th /></tr></thead><tbody>
      {spotOptions.map((s) => {
        const recs = view.mapRecords.filter((r) => r.spotId === s.id);
        const f = recs.find((r) => r.timestamp === t);
        const rating = f ? rateForecast(s, f, now) : null;
        const series = recs.map((r) => ({forecast: r, timestamp: r.timestamp, date: '', hour: 0, heightFt: r.offshore, rating: rateForecast(s, r, now)}));
        const start = Math.floor(now / 3600000) * 3600000, best = bestDaylight(series as HourSample[], s, start, start + 86400000);
        return (
          <tr key={s.id} className={s.id === spot.id ? 'sel' : ''}>
            <td><b>{s.name}</b></td>
            <td>{rating ? <><span className="qdot" style={{background: BAND_COLOR[bandOf(rating.category)]}} /> {titleCase(rating.category)} {rating.score ?? ''}</> : '—'}</td>
            <td>{f ? `${ht(f.offshore, p)} ${p.heightUnit}` : '—'}</td>
            <td>{f?.primary ? `${ht(f.primary.height, p)} ${p.heightUnit} · ${Math.round(f.primary.period)} s ${compass(f.primary.direction)}` : '—'}</td>
            <td>{f ? `${windVal(f.wind.speed, p)} ${p.windUnit} ${compass(f.wind.direction)}` : '—'}</td>
            <td>{best ? `${weekdayPT(best.timestamp)} ${hourLabel(best.timestamp)} · ${titleCase(best.rating.category)}` : '—'}</td>
            <td><button onClick={() => onPick(s.id)}>Open</button></td>
          </tr>
        );
      })}
    </tbody></table>
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
  const fav = data.state.favorites.includes(spot.id);

  const pickDay = (k: number) => {
    const d = days[k];
    const best = bestDaylight(series, spot, Date.parse(series[d.start].timestamp), Date.parse(series[d.end].timestamp) + 1);
    setDayIndex(k);
    view.selectTime((best ?? series[d.start]).timestamp);
  };
  const toNow = () => { const i = series.findIndex((h) => Date.parse(h.timestamp) >= Math.floor(now / 3600000) * 3600000); if (i >= 0) view.selectTime(series[i].timestamp); };

  if (live && view.ocean.loading && !view.ocean.bundle) return <StateMessage title="Retrieving forecasts…">Requesting Open-Meteo marine and weather models and NOAA tide predictions.</StateMessage>;
  if (live && !view.ocean.bundle) return <StateMessage title="Forecast data unavailable" action={<button className="btn" onClick={view.ocean.reload}>Try again</button>}>{view.ocean.error ?? 'The providers could not be reached.'} Nothing is filled in from other spots or older data.</StateMessage>;
  if (!selected) return <StateMessage title={`No record for ${spot.name} at this hour`} action={<button className="btn" onClick={toNow}>Go to now</button>}>Values are never borrowed from other hours or spots.</StateMessage>;

  const isNow = selIdx === series.findIndex((h) => Date.parse(h.timestamp) >= Math.floor(now / 3600000) * 3600000);
  const dayHours = curDay >= 0 ? series.slice(days[curDay].start, days[curDay].end + 1) : [];
  const show = (s: string) => section === '' || section === s;

  return (
    <div className="grid">
      <SpotPhoto spotId={spot.id} className="span-12" height={150}>
        <div style={{display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap'}}>
          <div style={{flex: 1, minWidth: 200}}>
            <h1 style={{fontSize: 26}}>{spot.name}</h1>
            <p className="fine" style={{color: 'rgb(255 255 255 / 0.8)'}}>{spot.region} · {spot.type.toLowerCase()} break · {live ? 'live model data' : 'demonstration week'}</p>
          </div>
          <button className="btn" aria-pressed={fav} onClick={() => data.favorite(spot.id)}><Icon name="star" size={16} style={{fill: fav ? 'currentColor' : 'none'}} />{fav ? 'Saved' : 'Save spot'}</button>
          <button className="btn" onClick={() => go('explore')}><Icon name="explore" size={16} />Map</button>
        </div>
      </SpotPhoto>

      <section className="card span-12" aria-label="Forecast timeline">
        <Readout h={selected} p={p} series={series} isNow={isNow} />
        <div className="tl-head">
          <div className="days" role="group" aria-label="Forecast day">
            {days.map((d, k) => d.end - d.start < 11 ? null : (
              <button key={d.key} className="day" aria-pressed={k === curDay} onClick={() => pickDay(k)}>
                <span className="t">{weekdayPT(d.t)} {dayNumPT(d.t)}<span>{ht(d.max, p)} Hs</span></span>
                <span className="q">{series.slice(d.start, d.end + 1).filter((_, j) => j % 3 === 0).map((h) => <i key={h.timestamp} style={{background: BAND_COLOR[bandOf(h.rating.category)]}} />)}</span>
              </button>
            ))}
          </div>
          <div className="seg" role="radiogroup" aria-label="Range">
            <button role="radio" aria-checked={dayIndex === null} onClick={() => setDayIndex(null)}>7 days</button>
            <button role="radio" aria-checked={dayIndex !== null} onClick={() => setDayIndex(Math.max(0, curDay))}>Day</button>
          </div>
          <button className="btn" onClick={toNow}>Now</button>
        </div>
        <Timeline series={series} spot={spot} p={p} selectedTime={view.selectedTime} onSelect={view.selectTime} now={now} dayIndex={dayIndex} extrema={extrema} height={matchMedia('(max-width: 860px)').matches ? 280 : 300} />
        <ul className="legend" style={{marginTop: 6}} aria-hidden="true">
          <li><i style={{background: 'var(--hs)', height: 8}} />Offshore Hs</li><li><i style={{background: 'var(--sw1)'}} />Primary swell</li><li><i style={{background: 'var(--sw2)'}} />Secondary</li>
          <li><i style={{background: 'var(--good)'}} />Rating good+</li><li><i style={{background: 'var(--fair)'}} />fair</li><li><i style={{background: 'var(--poor)'}} />poor</li>
          <li><i style={{width: 44, background: 'linear-gradient(90deg,#6080d6,#76a0ec,#96c878,#d6d260,#eca848,#e66048)'}} />Wind 0 → 24+ mph</li>
        </ul>
      </section>

      {(show('wind-tides') || section === '') && <section className="card span-8" aria-label="Instruments"><Tiles h={selected} p={p} spot={spot} series={series} extrema={extrema} /></section>}
      {section === '' && <section className="card span-4"><div className="card-h"><h2>Wave scale</h2><button className="btn" onClick={() => go('scale')}>3D viewer</button></div><MiniScale forecast={selected.forecast} /></section>}
      {show('swell') && <section className={`card ${section === 'swell' ? 'span-6' : 'span-4'}`}><div className="card-h"><h2>Swell direction &amp; period</h2><span>selected day</span></div>
        <PolarSwell hours={dayHours} selected={view.selectedTime} facing={facingOf(spot)} onSelect={view.selectTime} />
        <p className="fine">White primary · blue secondary · ring = period (s) · size = height</p></section>}
      {section === 'swell' && <section className="card span-6"><div className="card-h"><h2>Swell components</h2><span>{weekdayPT(selected.timestamp)}</span></div>
        <table className="cmp"><thead><tr><th>Hour</th><th>Primary</th><th>Secondary</th><th>Offshore Hs</th></tr></thead><tbody>
          {dayHours.filter((_, j) => j % 2 === 0).map((h) => <tr key={h.timestamp} className={h.timestamp === view.selectedTime ? 'sel' : ''}><td><button onClick={() => view.selectTime(h.timestamp)}>{hourLabel(h.timestamp)}</button></td>
            <td>{h.forecast.primary ? `${ht(h.forecast.primary.height, p)} ${p.heightUnit} · ${Math.round(h.forecast.primary.period)} s · ${compass(h.forecast.primary.direction)}` : '—'}</td>
            <td>{h.forecast.secondary ? `${ht(h.forecast.secondary.height, p)} ${p.heightUnit} · ${Math.round(h.forecast.secondary.period)} s · ${compass(h.forecast.secondary.direction)}` : '—'}</td>
            <td>{ht(h.heightFt, p)} {p.heightUnit}</td></tr>)}
        </tbody></table></section>}
      {show('wind-tides') && <section className={`card ${section === '' ? 'span-4' : 'span-4'}`}><div className="card-h"><h2>Tide</h2><span>SF 9414290 · regional · MLLW</span></div>
        <TideDay hours={dayHours} selected={view.selectedTime} extrema={extrema} spot={spot} p={p} onSelect={view.selectTime} /><p className="fine">Predictions, not observations · sunrise/sunset approximate</p></section>}
      {section === '' && <section className="card span-4"><div className="card-h"><h2>Next hours</h2></div>
        <ol className="hours">{series.slice(selIdx, selIdx + 10).map((h, k) => (
          <li key={h.timestamp}><button aria-current={k === 0} onClick={() => view.selectTime(h.timestamp)}>
            <span className="t">{hourLabel(h.timestamp)}</span><span className="qdot" style={{background: BAND_COLOR[bandOf(h.rating.category)]}} />
            <span>{ht(h.heightFt, p)} {p.heightUnit}</span><span>{h.forecast.primary ? <><DirArrow from={h.forecast.primary.direction} size={13} />{Math.round(h.forecast.primary.period)}s</> : '—'}</span>
            <span>{Number.isFinite(h.forecast.wind.direction) ? <><DirArrow from={h.forecast.wind.direction} size={13} color={windColor(h.forecast.wind.speed)} />{windVal(h.forecast.wind.speed, p)}</> : '—'}</span>
          </button></li>
        ))}</ol></section>}
      {show('compare') && <section className="card span-12"><div className="card-h"><h2>Compare spots</h2><span>at {weekdayPT(selected.timestamp)} {hourLabel(selected.timestamp)}</span></div><Compare onPick={(id) => { setSpot(id); go('forecast'); }} /></section>}
      {section === '' && <section className="card span-8"><div className="card-h"><h2>Sources &amp; reliability</h2><span>{selected.rating.reliability.category.toLowerCase()} reliability</span></div><Sources /></section>}
      {section === '' && <div className="span-4"><CameraPanel spotName={spot.name} /></div>}
    </div>
  );
}

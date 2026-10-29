import {useEffect, useMemo, useState} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import type {SurfSpot, UserProfile} from '../../models/index';
import {evidenceSpots} from '../../ocean/spots';
import {coastalCoverage} from '../../ocean/coastal';
import {formatWaveHeight, nearshoreView} from '../../utils/waveHeight';
import {rateForecast} from '../../ratings/adapters';
import {windRelationship} from '../../recommendation/sqi';
import {CameraPanel, SpotPhoto, StateMessage} from '../../ui/common';
import {DirArrow, Icon} from '../../ui/Icon';
import {Dial, PolarSwell, QualityBand, Spark, TideDay, Timeline, windInk} from './charts';
import {bestDaylight, compass, groupDays, ht, windVal} from './helpers';
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
        <div><span className="k">Swell</span><span className="v">{f.primary && Number.isFinite(f.primary.height) ? <><DirArrow from={f.primary.direction} color="var(--sw1)" />{ht(f.primary.height, p)}<small>{u} {Math.round(f.primary.period)}s</small></> : '—'}</span></div>
        <div><span className="k">Wind</span><span className="v">{Number.isFinite(f.wind.direction) ? <><DirArrow from={f.wind.direction} color={windInk(f.wind.speed)} />{windVal(f.wind.speed, p)}<small>{p.windUnit}</small></> : '—'}</span></div>
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
      <p className="hs-label">Nearshore model Hs at {cov.depthM} m depth ({model}), not surf height<span className="chip ill">model</span></p>
      <p className="fine">Valid {when(rec.timestamp)}{v.state === 'exact' ? ' (nearest record to the selected hour)' : ''} · {where}. QC-filtered nowcast, modeled at depth: not the size of breaking surf, no local conversion.</p>
      {jump}
    </>
  );
}

function Compare({onPick}: {onPick: (id: string) => void}) {
  const {view, spotOptions, data, now, spot} = useSwello();
  const p = data.state.profile, t = view.selectedTime;
  return (
    <div className="tscroll" role="region" tabIndex={0} aria-label="Spot comparison (scrolls sideways)"><table className="cmp"><thead><tr><th>Spot</th><th>Rating (provisional)</th><th>Offshore Hs</th><th>Primary swell</th><th>Wind</th><th>Best daylight (24 h)</th><th /></tr></thead><tbody>
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
    </tbody></table></div>
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
            <p className="fine" style={{color: 'rgb(255 255 255 / 0.85)'}}>{spot.region} · {spot.type.toLowerCase()} break · {live ? 'live model data' : 'demonstration week'}</p>
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
          <li><i style={{width: 44, background: `linear-gradient(90deg,${[0, 6, 10, 14, 18, 24].map(windInk).join(',')})`}} />Wind 0 → 24+ mph</li>
        </ul>
      </section>

      {(show('wind-tides') || section === '') && <section className="card span-8" aria-label="Instruments"><Tiles h={selected} p={p} spot={spot} series={series} extrema={extrema} /></section>}
      {section === '' && <section className="card span-4"><div className="card-h"><h2>Wave scale</h2><button className="btn" onClick={() => go('forecast', 'wave-scale')}>3D viewer</button></div><MiniScale forecast={selected.forecast} /></section>}
      {show('swell') && <section className="card span-12" aria-label="Nearshore model"><Nearshore spot={spot} p={p} selectedTime={selected.timestamp} now={now} series={series} /></section>}
      {show('swell') && <section className={`card ${section === 'swell' ? 'span-6' : 'span-4'}`}><div className="card-h"><h2>Swell direction &amp; period</h2><span>selected day</span></div>
        <PolarSwell hours={dayHours} selected={view.selectedTime} facing={facingOf(spot)} onSelect={view.selectTime} />
        <p className="fine"><i style={{display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--sw1)', marginRight: 4}} />primary · <i style={{display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--sw2)', marginRight: 4}} />secondary · ring = period (s) · size = height</p></section>}
      {section === 'swell' && <section className="card span-6"><div className="card-h"><h2>Swell components</h2><span>{weekdayPT(selected.timestamp)}</span></div>
        <div className="tscroll" role="region" tabIndex={0} aria-label="Swell components by hour (scrolls sideways)"><table className="cmp"><thead><tr><th>Hour</th><th>Primary</th><th>Secondary</th><th>Offshore Hs</th></tr></thead><tbody>
          {dayHours.filter((_, j) => j % 2 === 0).map((h) => <tr key={h.timestamp} className={h.timestamp === view.selectedTime ? 'sel' : ''}><td><button onClick={() => view.selectTime(h.timestamp)}>{hourLabel(h.timestamp)}</button></td>
            <td>{h.forecast.primary ? `${ht(h.forecast.primary.height, p)} ${p.heightUnit} · ${Math.round(h.forecast.primary.period)} s · ${compass(h.forecast.primary.direction)}` : '—'}</td>
            <td>{h.forecast.secondary ? `${ht(h.forecast.secondary.height, p)} ${p.heightUnit} · ${Math.round(h.forecast.secondary.period)} s · ${compass(h.forecast.secondary.direction)}` : '—'}</td>
            <td>{ht(h.heightFt, p)} {p.heightUnit}</td></tr>)}
        </tbody></table></div></section>}
      {show('wind-tides') && <section className={`card ${section === '' ? 'span-4' : 'span-4'}`}><div className="card-h"><h2>Tide</h2><span>SF 9414290 · regional · MLLW</span></div>
        <TideDay hours={dayHours} selected={view.selectedTime} extrema={extrema} spot={spot} p={p} onSelect={view.selectTime} /><p className="fine">Predictions, not observations · sunrise/sunset approximate</p></section>}
      {section === '' && <section className="card span-4"><div className="card-h"><h2>Next hours</h2></div>
        <ol className="hours">{series.slice(selIdx, selIdx + 10).map((h, k) => (
          <li key={h.timestamp}><button aria-current={k === 0} onClick={() => view.selectTime(h.timestamp)}>
            <span className="t">{hourLabel(h.timestamp)}</span><span className="qdot" style={{background: BAND_COLOR[bandOf(h.rating.category)]}} />
            <span>{ht(h.heightFt, p)} {p.heightUnit}</span><span>{h.forecast.primary ? <><DirArrow from={h.forecast.primary.direction} size={13} />{Math.round(h.forecast.primary.period)}s</> : '—'}</span>
            <span>{Number.isFinite(h.forecast.wind.direction) ? <><DirArrow from={h.forecast.wind.direction} size={13} color={windInk(h.forecast.wind.speed)} />{windVal(h.forecast.wind.speed, p)}</> : '—'}</span>
          </button></li>
        ))}</ol></section>}
      {show('compare') && <section className="card span-12"><div className="card-h"><h2>Compare spots</h2><span>at {weekdayPT(selected.timestamp)} {hourLabel(selected.timestamp)}</span></div><Compare onPick={(id) => { setSpot(id); go('forecast'); }} /></section>}
      {section === '' && <section className="card span-8"><div className="card-h"><h2>Sources &amp; reliability</h2><span>{selected.rating.reliability.category.toLowerCase()} reliability</span></div><Sources /></section>}
      {section === '' && <div className="span-4"><CameraPanel spotName={spot.name} /></div>}
    </div>
  );
}

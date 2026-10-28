import {useMemo} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import type {SurfSpot} from '../../models/index';
import {scoreBoard} from '../../recommendation/board';
import {SpotPhoto, StateMessage} from '../../ui/common';
import {DirArrow, Icon} from '../../ui/Icon';
import {BAND_COLOR, bandOf, hourLabel, hourlySeries, titleCase, type HourSample} from '../forecast/model';
import {bestDaylight, compass, groupDays, ht, windColor, windVal} from '../forecast/helpers';
import {weekdayPT, dayNumPT, timeLabelPT} from '../forecast/format';

interface Window {spot: SurfSpot; h: HourSample}

export function HomeView({section, go}: ViewProps) {
  const {view, data, now, spot, spotOptions, series, selected, live, setSpot} = useSwello();
  const p = data.state.profile;
  const favs = spotOptions.filter((s) => data.state.favorites.includes(s.id));
  const cards = favs.length ? favs : spotOptions.slice(0, 3);
  const nowH = Math.floor(now / 3600000) * 3600000;

  // Best daylight hour per spot per day, across the whole forecast.
  const windows = useMemo(() => {
    const out: Window[] = [];
    for (const s of spotOptions) {
      const ser = hourlySeries(s, view.mapRecords, now);
      for (const d of groupDays(ser)) {
        const from = Math.max(nowH, Date.parse(ser[d.start].timestamp)), b = bestDaylight(ser, s, from, Date.parse(ser[d.end].timestamp) + 1);
        if (b) out.push({spot: s, h: b});
      }
    }
    return out.sort((a, b) => (b.h.rating.score ?? 0) - (a.h.rating.score ?? 0));
  }, [spotOptions, view.mapRecords, now, nowH]);

  const open = (spotId: string, t?: string) => { setSpot(spotId); if (t) view.selectTime(t); go('forecast'); };
  const current = series.find((h) => Date.parse(h.timestamp) >= nowH) ?? selected;

  if (live && view.ocean.loading && !view.ocean.bundle) return <StateMessage title="Retrieving forecasts…">Requesting Open-Meteo marine and weather models and NOAA tide predictions.</StateMessage>;
  if (live && !view.ocean.bundle) return <StateMessage title="Forecast data unavailable" action={<button className="btn" onClick={view.ocean.reload}>Try again</button>}>{view.ocean.error ?? 'The providers could not be reached.'}</StateMessage>;

  const windowList = (limit: number) => (
    <ul className="windows">{windows.slice(0, limit).map(({spot: s, h}) => (
      <li key={`${s.id}${h.timestamp}`}><button onClick={() => open(s.id, h.timestamp)}>
        <span><span className="qdot" style={{background: BAND_COLOR[bandOf(h.rating.category)]}} /> <b>{weekdayPT(h.timestamp)} {dayNumPT(h.timestamp)} · {hourLabel(h.timestamp)}</b> <small>{s.name}</small></span>
        <span>{titleCase(h.rating.category)} {h.rating.score !== null ? Math.round(h.rating.score) : ''}</span>
        <small>{ht(h.heightFt, p)} {p.heightUnit} Hs{h.forecast.primary ? ` · ${Math.round(h.forecast.primary.period)} s ${compass(h.forecast.primary.direction)}` : ''} · wind {windVal(h.forecast.wind.speed, p)} {p.windUnit} {compass(h.forecast.wind.direction)}</small>
        <small>provisional</small>
      </button></li>
    ))}</ul>
  );

  const spotCards = (
    <div className="spotcards">{cards.map((s, k) => {
      const ser = hourlySeries(s, view.mapRecords, now), h = ser.find((x) => Date.parse(x.timestamp) >= nowH);
      return (
        <button key={s.id} className="spotcard" onClick={() => open(s.id)} aria-label={`${s.name}: ${h ? titleCase(h.rating.category) : 'no record'}. Open forecast.`}>
          <SpotPhoto spotId={s.id} index={k} />
          <span className="b">
            <span style={{display: 'flex', justifyContent: 'space-between', gap: 8}}><b>{s.name}</b>{data.state.favorites.includes(s.id) && <Icon name="star" size={14} style={{fill: 'currentColor', color: 'var(--fair)'}} />}</span>
            {h ? <>
              <span><span className="qdot" style={{background: BAND_COLOR[bandOf(h.rating.category)]}} /> {titleCase(h.rating.category)} <span className="fine">provisional</span></span>
              <span className="num" style={{fontSize: 26}}>{ht(h.heightFt, p)}<small>{p.heightUnit} Hs</small></span>
              <span className="fine">{h.forecast.primary ? `${Math.round(h.forecast.primary.period)} s ${compass(h.forecast.primary.direction)} · ` : ''}wind {windVal(h.forecast.wind.speed, p)} {p.windUnit} {compass(h.forecast.wind.direction)}</span>
            </> : <span className="fine">No record for this hour</span>}
          </span>
        </button>
      );
    })}</div>
  );

  if (section === 'spots') return (
    <div className="grid"><section className="span-12">
      <div className="card-h"><h2>My spots</h2><span>{favs.length ? `${favs.length} saved` : 'No saved spots yet: showing all'}</span></div>
      {spotCards}
      {!favs.length && <p className="fine" style={{marginTop: 10}}>Save a spot with the star in the spot picker or on its forecast.</p>}
    </section></div>
  );
  if (section === 'windows') return (
    <div className="grid"><section className="card span-12">
      <div className="card-h"><h2>Best daylight windows</h2><span>highest provisional score per spot per day</span></div>
      {windows.length ? windowList(24) : <StateMessage title="No rated daylight hours ahead" />}
    </section></div>
  );

  const top = selected && selected.forecast.availability.face && Number.isFinite(selected.forecast.face)
    ? data.state.boards.map((b) => scoreBoard(b, selected.forecast, p)).sort((a, b) => b.score - a.score)[0] : null;

  return (
    <div className="grid">
      <SpotPhoto spotId={spot.id} className="span-12 hero">
        {current ? (
          <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 20}}>
            <div style={{flex: '1 1 260px'}}>
              <p className="fine" style={{color: 'rgb(255 255 255 / 0.8)'}}>{p.displayName ? `Hi ${p.displayName} · ` : ''}{weekdayPT(current.timestamp)} {timeLabelPT(current.timestamp)} · {live ? 'live model data' : 'demonstration week'}</p>
              <h1>{spot.name}</h1>
              <p style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 6}}><span className="qdot" style={{background: BAND_COLOR[bandOf(current.rating.category)]}} /><b>{titleCase(current.rating.category)}</b><span className="fine" style={{color: 'rgb(255 255 255 / 0.75)'}}>provisional · reliability {current.rating.reliability.category.toLowerCase()}</span></p>
            </div>
            <div style={{display: 'flex', gap: 24, flexWrap: 'wrap'}}>
              <div><p className="fine" style={{color: 'rgb(255 255 255 / 0.75)'}}>Offshore Hs</p><p className="num" style={{fontSize: 44}}>{ht(current.heightFt, p)}<small>{p.heightUnit}</small></p></div>
              <div><p className="fine" style={{color: 'rgb(255 255 255 / 0.75)'}}>Swell</p><p className="num" style={{fontSize: 26}}>{current.forecast.primary ? <>{Math.round(current.forecast.primary.period)}<small>s</small> <DirArrow from={current.forecast.primary.direction} size={18} /></> : '—'}</p></div>
              <div><p className="fine" style={{color: 'rgb(255 255 255 / 0.75)'}}>Wind</p><p className="num" style={{fontSize: 26}}>{windVal(current.forecast.wind.speed, p)}<small>{p.windUnit}</small> {Number.isFinite(current.forecast.wind.direction) && <DirArrow from={current.forecast.wind.direction} size={18} color={windColor(current.forecast.wind.speed)} />}</p></div>
            </div>
            <button className="btn primary" onClick={() => go('forecast')}>Full forecast<Icon name="arrow" size={16} /></button>
          </div>
        ) : <h1>{spot.name}</h1>}
      </SpotPhoto>

      <section className="card span-8" aria-label="Next 24 hours">
        <div className="card-h"><h2>Next 24 hours</h2><button className="btn" onClick={() => go('forecast')}>Timeline</button></div>
        <ol className="strip">
          {series.filter((h) => Date.parse(h.timestamp) >= nowH).slice(0, 24).filter((_, k) => k % 3 === 0).map((h) => (
            <li key={h.timestamp}><button onClick={() => { view.selectTime(h.timestamp); go('forecast'); }} aria-label={`${hourLabel(h.timestamp)}: ${titleCase(h.rating.category)}, ${ht(h.heightFt, p)} ${p.heightUnit} offshore, wind ${windVal(h.forecast.wind.speed, p)} ${p.windUnit}`}>
              <span className="t">{hourLabel(h.timestamp)}</span>
              <span className="qdot" style={{background: BAND_COLOR[bandOf(h.rating.category)], width: '100%', height: 4, borderRadius: 2}} />
              <span className="h">{ht(h.heightFt, p)}</span>
              <span className="w">{Number.isFinite(h.forecast.wind.direction) && <DirArrow from={h.forecast.wind.direction} size={12} color={windColor(h.forecast.wind.speed)} />}{windVal(h.forecast.wind.speed, p)}</span>
            </button></li>
          ))}
        </ol>
        <p className="fine" style={{marginTop: 6}}>Offshore Hs ({p.heightUnit}) and wind ({p.windUnit}). Hs is not surf height.</p>
      </section>

      <section className="card span-4" aria-label="Board for now">
        <div className="card-h"><h2>Board for now</h2><button className="btn" onClick={() => go('quiver', 'match')}>Board Match</button></div>
        {top ? <><p className="num" style={{fontSize: 22}}>{top.board.name}</p><p className="fine">{Math.round(top.score)}/100 · {top.factors[0]?.reason}</p><p style={{marginTop: 6}}><span className="chip demo">Demonstration estimate</span></p></>
          : <p className="fine">No breaking-wave estimate exists for live spots, so SWELLO does not pick a board from offshore height. {data.state.boards.length} boards in your quiver.</p>}
      </section>

      <section className="span-12" aria-label="My spots">
        <div className="card-h"><h2>{favs.length ? 'My spots' : 'Spots'}</h2><button className="btn" onClick={() => go('home', 'spots')}>All</button></div>
        {spotCards}
      </section>

      <section className="card span-8" aria-label="Best windows">
        <div className="card-h"><h2>Best daylight windows</h2><button className="btn" onClick={() => go('home', 'windows')}>More</button></div>
        {windows.length ? windowList(5) : <p className="fine">No rated daylight hours ahead.</p>}
      </section>
      <section className="card span-4" aria-label="Shortcuts">
        <div className="card-h"><h2>Go to</h2></div>
        <ul className="windows">
          {([['explore', '', 'Ocean map', 'Spots and model grids'], ['forecast', 'compare', 'Compare spots', 'Side by side at one hour'], ['scale', '', 'Wave Scale', 'See a wave next to a surfer'], ['personal', 'journal', 'Surf journal', `${data.state.sessions.length} sessions logged`]] as const).map(([a, s, t, d]) => (
            <li key={t}><button onClick={() => go(a, s)}><span><b>{t}</b></span><Icon name="arrow" size={16} /><small>{d}</small></button></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

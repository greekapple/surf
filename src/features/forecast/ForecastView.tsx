import {useMemo} from 'react';
import type {ForecastState} from '../../hooks/useForecast';
import type {DataStore} from '../../hooks/useAppData';
import {spots} from '../../data/demo';
import {evidenceSpots} from '../../ocean/spots';
import {rateForecast} from '../../ratings/adapters';
import {DirectionArrow} from '../../ui/Icon';
import {TimeRail} from './TimeRail';
import {
  bestUpcoming,
  dayLabel,
  fullTimeLabel,
  heroHeight,
  hourLabel,
  hourlySeries,
  reasons,
  signalStrength,
} from './model';
import './forecast.css';

export function ForecastView({
  view,
  data,
  now,
  onSelectSpot,
}: {
  view: ForecastState;
  data: DataStore;
  now: number;
  onSelectSpot: (id: string) => void;
}) {
  const p = data.state.profile;
  const mode = view.dataMode;
  const spot = view.spot;
  const options = mode === 'Retrieved' ? spots.filter(s => evidenceSpots.some(e => e.id === s.id)) : spots;
  const series = useMemo(() => hourlySeries(spot, view.mapRecords, now), [spot, view.mapRecords, now]);
  const loading = mode === 'Retrieved' && view.ocean.loading && !view.ocean.bundle;
  const failed = mode === 'Retrieved' && !view.ocean.loading && !view.ocean.bundle && !!view.ocean.error;
  const current = mode === 'Retrieved' ? (view.realRecord ? view.forecast : null) : view.forecast;
  const best = bestUpcoming(series, now);
  const hero = current ? heroHeight(current, p, mode) : null;
  const rating = current ? rateForecast(spot, current, now) : null;

  return (
    <article className="fc" aria-labelledby="fc-spot">
      <header className="fc-head">
        <div className="fc-place">
          <h1 id="fc-spot" className="fc-spot">
            {spot.name}
          </h1>
          <p className="fc-meta">
            {spot.region} · {spot.type.toLowerCase()} break
            {current && <> · {fullTimeLabel(current.timestamp)}</>}
          </p>
        </div>
        <label className="fc-switch">
          <span className="visually-hidden">Choose a spot</span>
          <select value={spot.id} onChange={e => onSelectSpot(e.target.value)}>
            {options.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loading && (
        <section className="fc-state" aria-live="polite">
          <h2>Retrieving forecasts</h2>
          <p>Requesting Open-Meteo marine and weather models and NOAA tide predictions for {spot.name}.</p>
        </section>
      )}

      {failed && (
        <section className="fc-state" role="alert">
          <h2>Forecast data could not be retrieved</h2>
          <p>{view.ocean.error}</p>
          <button className="btn" onClick={view.ocean.reload}>
            Try again
          </button>
        </section>
      )}

      {!loading && !failed && !current && (
        <section className="fc-state" role="status">
          <h2>No record for {spot.name} at this time</h2>
          <p>Pick another hour on the time rail. Values are never filled in from other spots or hours.</p>
        </section>
      )}

      {current && hero && rating && (
        <div className="fc-board">
          <section className="fc-hero" aria-label="Wave height">
            <p className="fc-number">
              {hero.approx && <span className="fc-approx">≈</span>}
              <span className="fc-digits">{hero.number}</span>
              <span className="fc-unit">{hero.unit}</span>
            </p>
            <p className="fc-quantity">{hero.label}</p>
            {hero.note && <p className="fc-note">{hero.note}</p>}
          </section>

          <section className="verdict" data-strength={signalStrength(rating)} aria-label="Surf rating">
            <div className="verdict-line">
              <span className="verdict-signal" aria-hidden="true" />
              <h2 className="verdict-category">{rating.category === 'UNRATED' ? 'Unrated' : rating.category}</h2>
              {rating.score !== null && (
                <span className="verdict-score">
                  {Math.round(rating.score)}
                  <small>/100</small>
                </span>
              )}
            </div>
            <p className="verdict-reliability">
              {rating.tier ?? 'Provisional'} · reliability {rating.reliability.category.toLowerCase()} · experimental
            </p>
            <p className="verdict-explain">{rating.explanation}</p>
            {best && best.timestamp !== current.timestamp && (
              <button className="verdict-best" onClick={() => view.selectTime(best.timestamp)}>
                Best in the next 24 h: {dayLabel(best.timestamp, now)} {hourLabel(best.timestamp)} ·{' '}
                {best.rating.category.toLowerCase()} {Math.round(best.rating.score ?? 0)}
              </button>
            )}
          </section>

          <section className="reasons" aria-label="Conditions">
            {reasons(spot, current, p, mode, now).map(r => (
              <div className="reason" key={r.id} data-available={r.available || undefined}>
                <h3 className="reason-label">{r.label}</h3>
                <p className="reason-value">
                  {r.direction !== null && (
                    <span className="reason-arrow" title={`Travelling toward ${(r.direction + 180) % 360}°`}>
                      <DirectionArrow fromDegrees={r.direction} />
                    </span>
                  )}
                  {r.value}
                </p>
                <p className="reason-detail">{r.detail}</p>
                <p className="tag" data-kind={r.provenance.kind}>
                  {r.provenance.text}
                </p>
              </div>
            ))}
          </section>
        </div>
      )}

      {mode === 'Retrieved' && view.ocean.bundle && (
        <details className="fc-sources">
          <summary>
            Data connections ·{' '}
            {view.ocean.statuses.filter(s => s.state === 'connected').length} connected
            {view.ocean.statuses.some(s => s.state !== 'connected') &&
              ` · ${view.ocean.statuses.filter(s => s.state !== 'connected').length} limited`}
          </summary>
          <ul>
            {view.ocean.statuses.map(s => (
              <li key={s.id} data-state={s.state}>
                <strong>{s.provider}</strong> <span>{s.state}</span> — {s.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="fc-rail-dock">
        <TimeRail
          series={series}
          selectedTime={view.selectedTime}
          onSelect={view.selectTime}
          now={now}
          heightLabel={mode === 'Demonstration' ? 'demonstration face height' : 'offshore Hs'}
        />
      </div>
    </article>
  );
}

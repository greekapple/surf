import {useMemo} from 'react';
import type {Go} from '../../app/routes';
import {useSwello} from '../../app/store';
import {SpotPicker} from '../../app/Nav';
import {BAND_COLOR, bandOf} from '../forecast/model';
import {spotStrip} from '../../services/spotStrip';

/** Saved-spot chips show the condition colour and labelled height (Surfline's favourites bar). The user approved this on 2026-10-30;
 *  set false to show names only. The Home body never shows forecast numbers either way. */
export const STRIP_CONDITIONS = true;

/** Saved spots under the top bar on Home and Forecast. A chip opens that spot's forecast; on Forecast, "All spots" switches to any spot. */
export function SpotStrip({go, onForecast}: {go: Go; onForecast: boolean}) {
  const {spotOptions, view, now, data, spot, setSpot} = useSwello();
  const items = useMemo(() => spotStrip(spotOptions, view.mapRecords, data.state.favorites, now, data.state.profile, {bundle: view.ocean.bundle}),
    [spotOptions, view.mapRecords, data.state.favorites, now, data.state.profile]);
  const open = (id: string) => { setSpot(id); go('forecast'); };
  return (
    <nav className="favbar" aria-label="Saved spots">
      <div className="favbar-row">
        {items.length === 0 && <p className="favbar-empty">No saved spots yet. Star a spot on its forecast to keep it here.</p>}
        {items.map((it) => (
          <button key={it.id} className="chip-spot" aria-current={onForecast && it.id === spot.id ? 'true' : undefined} onClick={() => open(it.id)}
            title={STRIP_CONDITIONS && it.validTime ? `${it.name}, ${it.region} · ${it.heightLabel}` : `${it.name}, ${it.region}`}>
            {STRIP_CONDITIONS && <i className="cdot" style={{background: BAND_COLOR[bandOf(it.category)]}} aria-hidden="true" />}
            <b>{it.name}</b>
            {STRIP_CONDITIONS && <small>{it.heightLabel}</small>}
          </button>
        ))}
      </div>
      <div className="favbar-end">
        {onForecast && <SpotPicker />}
        <a className="favbar-edit" href="/personal/spots" onClick={(e) => { e.preventDefault(); go('personal', 'spots'); }}>Edit</a>
      </div>
    </nav>
  );
}

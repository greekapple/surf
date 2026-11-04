import type {OceanBundle} from '../../ocean/types';
import type {UserProfile} from '../../models/index';
import type {PointValue} from '../../map/field';
import {DirArrow, Icon, type IconName} from '../../ui/Icon';
import {compass, ht, windColor, windVal} from '../forecast/helpers';
import {timeLabelPT, weekdayPT} from '../forecast/format';
import {evidenceSpots} from '../../ocean/spots';
import {nearestTideStations, SF_STATION} from '../../ocean/tideStations';
import type {PointData, Pt} from './PointCard';

/** T-117 (Windy): tapping the sea puts a small dark label at the point with the value under it, and expands into an hourly panel at the bottom.
 *  Honesty: the label's value and direction are the painted field's own (sampleField, so it equals the colour under the pin) and say what they are
 *  (offshore wave height, not surf size); a period taken from the point forecast says so; the panel names its model; tide names its NOAA station. */
const FT = 1 / 0.3048, MPH = 2.23694, TIDE_KM = 40, SPOT_KM = 60;
const kmBetween = (a: Pt, b: {latitude: number; longitude: number}) => Math.hypot((a.lat - b.latitude) * 111, (a.lon - b.longitude) * 111 * Math.cos((a.lat * Math.PI) / 180));

export {pointLine} from './pointLine';

export function PinLabel({layer, icon, line, periodFromPoint, expanded, onExpand, onClose}: {
  layer: string; icon: IconName; line: {main: string; note: string} | null; periodFromPoint: boolean; expanded: boolean; onExpand: () => void; onClose: () => void;
}) {
  return (
    <div className="xpl" role="group" aria-label={`${layer} at this point`}>
      <div className="xpl-h"><span>{layer}</span><Icon name={icon} size={14} /><button className="xpl-x" aria-label="Close point" onClick={onClose}><Icon name="close" size={13} /></button></div>
      <div className="xpl-v">
        <span title={line && periodFromPoint ? 'Height and direction: the map field under the pin. Period: the Open-Meteo point forecast' : undefined}><b>{line ? line.main : 'No value here'}</b>
          <small>{line ? line.note : 'land or enclosed water'}</small>{line && periodFromPoint && <span className="sr">Period from the point forecast.</span>}</span>
        <button className="xpl-more" aria-expanded={expanded} aria-controls="xpanel" aria-label={expanded ? 'Hide the hourly forecast' : 'Show the hourly forecast here'} onClick={onExpand}><Icon name="chevron" size={16} style={expanded ? {transform: 'rotate(180deg)'} : undefined} /></button>
      </div>
    </div>
  );
}

const hourCol = (t: number) => new Date(t * 1000).toISOString();
/** The bottom hourly panel (Windy's Waves & Tides table): 3-hour columns from the shared hour on, rows for wind, gusts, waves, swell 1 and 2, period, tide. */
export function ForecastPanel({pt, data, error, time, p, bundle, onClose, onOpenSpot}: {
  pt: Pt; data: PointData | null; error: string | null; time: string | null; p: UserProfile; bundle: OceanBundle | null | undefined; onClose: () => void; onOpenSpot: (id: string) => void;
}) {
  const near = evidenceSpots.map((e) => ({e, km: kmBetween(pt, e)})).sort((a, b) => a.km - b.km)[0];
  const spot = near && near.km <= SPOT_KM ? near : null;
  const st = nearestTideStations(pt.lat, pt.lon)[0], station = st && st.distanceKm <= TIDE_KM ? st : null;
  const turns = !station ? [] : (station.station.id === SF_STATION ? bundle?.extrema ?? [] : bundle?.stationTides?.[station.station.id]?.extrema ?? []);
  const t0 = time ? Date.parse(time) / 1000 : data?.time[0] ?? 0;
  const cols = data ? data.time.map((t, i) => ({t, i})).filter(({t}) => t >= t0 - 1800).filter((_, k) => k % 3 === 0).slice(0, 40) : [];
  const v = (arr: (number | null)[] | undefined, i: number) => (arr ? arr[i] ?? null : null);
  const h = (m: number | null) => (m === null ? '—' : ht(m * FT, p, 0));
  const wind = (ms: number | null) => (ms === null ? null : Number(windVal(ms * MPH, p)));
  const tideAt = (t: number) => turns.find((e) => { const x = Date.parse(e.timestamp) / 1000; return x >= t - 5400 && x < t + 5400 && e.height.value !== null; });
  return (
    <section className="xpanel" id="xpanel" aria-label="Hourly forecast at this point">
      <header className="xpanel-h">
        <div><h3>Point forecast</h3><p>{pt.lat.toFixed(2)}, {pt.lon.toFixed(2)} · not a surf spot · Open-Meteo marine and weather models</p></div>
        {spot && <button className="xpanel-go" onClick={() => onOpenSpot(spot.e.id)}>Open full forecast<small>{spot.e.name} · {Math.round(spot.km)} km</small></button>}
        <button className="xpanel-x" aria-label="Close the hourly forecast" onClick={onClose}><Icon name="close" size={16} /></button>
      </header>
      {error && <p className="xpt-err" role="alert">{error}</p>}
      {!data && !error && <div className="xpt-skel" aria-hidden="true"><i /><i /><i /></div>}
      {data && (
        <div className="xpanel-scroll" tabIndex={0} role="region" aria-label="Hourly table; scroll sideways for later hours">
          <table className="xpanel-t">
            <thead>
              <tr className="xp-day"><th scope="row">Day</th>{cols.map(({t}, k) => <th key={t} scope="col">{k === 0 || weekdayPT(hourCol(t)) !== weekdayPT(hourCol(cols[k - 1].t)) ? weekdayPT(hourCol(t)) : ''}</th>)}</tr>
              <tr><th scope="row">Time</th>{cols.map(({t}) => <th key={t} scope="col">{timeLabelPT(hourCol(t)).replace(':00', '').replace(' ', '').toLowerCase()}</th>)}</tr>
            </thead>
            <tbody>
              <tr><th scope="row">Wind <small>{p.windUnit}</small></th>{cols.map(({t, i}) => { const w = wind(v(data.windSpeed, i)), d = v(data.windDirection, i);
                return <td key={t} className="xp-wind" style={v(data.windSpeed, i) !== null ? {background: windColor(v(data.windSpeed, i)! * MPH)} : undefined}>{w === null ? '—' : <>{d !== null && <DirArrow from={d} size={11} />}{Math.round(w)}</>}</td>; })}</tr>
              <tr><th scope="row">Gusts <small>{p.windUnit}</small></th>{cols.map(({t, i}) => { const g = wind(v(data.windGust, i)); return <td key={t}>{g === null ? '—' : Math.round(g)}</td>; })}</tr>
              <tr><th scope="row">Waves <small>{p.heightUnit}</small></th>{cols.map(({t, i}) => { const d = v(data.waveDirection, i); return <td key={t}>{d !== null && <DirArrow from={d} size={11} />}{h(v(data.waveHeight, i))}</td>; })}</tr>
              <tr><th scope="row">Swell 1 <small>{p.heightUnit}</small></th>{cols.map(({t, i}) => { const d = v(data.swellDirection, i); return <td key={t}>{d !== null && <DirArrow from={d} size={11} />}{h(v(data.swellHeight, i))}</td>; })}</tr>
              <tr><th scope="row">Swell 2 <small>{p.heightUnit}</small></th>{cols.map(({t, i}) => { const d = v(data.swell2Direction, i); return <td key={t}>{d !== null && <DirArrow from={d} size={11} />}{h(v(data.swell2Height, i))}</td>; })}</tr>
              <tr><th scope="row">Period <small>s</small></th>{cols.map(({t, i}) => { const x = v(data.wavePeriod, i) ?? v(data.swellPeriod, i); return <td key={t}>{x === null ? '—' : Math.round(x)}</td>; })}</tr>
              <tr><th scope="row">Tide <small>{station ? `${station.station.name} (NOAA)` : 'no station ≤ 40 km'}</small></th>{cols.map(({t}) => { const e = tideAt(t);
                return <td key={t} className="xp-tide">{e ? <><b>{e.type === 'High' ? 'H' : 'L'}</b> {timeLabelPT(e.timestamp).replace(':00', '').replace(' ', '').toLowerCase()}</> : ''}</td>; })}</tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="xpanel-f">Offshore model values at this point, not surf size{station ? ` · tide: NOAA prediction at ${station.station.name}, ${station.distanceKm} km away, not at this point` : ''}</p>
    </section>
  );
}

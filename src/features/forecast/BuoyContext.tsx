import type {UserProfile} from '../../models/index';
import type {ObservationSet} from '../../ocean/types';
import {ht, compass} from './helpers';
import {timeLabelPT, weekdayPT} from './format';
import type {HourSample} from './model';
import {buoysNear} from '../../ocean/buoys';

const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Other buoys for the "now vs forecast" context (T-049): NDBC 46012 and 46214 and CDIP 029, each with its own observation time.
 *  Context only: a buoy is a different place from this spot's model point, so the comparison is never a validation. */
export function BuoyContext({buoys, series, p, now, lat, lon, tz}: {buoys: ObservationSet[] | undefined; series: HourSample[]; p: UserProfile; now: number; /** the spot: only buoys in its ocean basin are context */ lat: number; lon: number; /** the spot's time zone: the observation times are shown in it */ tz: string}) {
  const near = buoysNear(lat, lon);
  if (!near.length) return <p className="fine">No wave buoy near this spot is registered yet, so there is no buoy to compare with the forecast.</p>;
  return (
    <div className="sp-buoys" aria-label="More buoys, context">
      <h3 className="sp-buoys-h">More buoys <span>context, not validation</span></h3>
      <ul>
        {near.map((reg) => {
          const b = buoys?.find((x) => x.station === reg.id || x.station === reg.label);
          if (!b) return <li key={reg.id}><p className="sp-bu-h"><b>{reg.label}</b> {reg.place}{reg.note ? ` · ${reg.note}` : ''} · no observation returned for this load</p></li>;
          const v = b.values, hs = v['Offshore significant height'], tp = v['Dominant wave period'], dir = v['Mean wave direction'] ?? v['Peak wave direction'];
          const at = hs?.source.validAt ?? tp?.source.validAt ?? dir?.source.validAt;
          const near = at ? series.reduce<HourSample | null>((best, x) => (Math.abs(Date.parse(x.timestamp) - Date.parse(at)) < (best ? Math.abs(Date.parse(best.timestamp) - Date.parse(at)) : Infinity) ? x : best), null) : null;
          const fc = near && at && Math.abs(Date.parse(near.timestamp) - Date.parse(at)) <= 5400000 ? near.forecast : null;
          const old = at ? now - Date.parse(at) > 6 * 3600000 : true;
          return (
            <li key={b.station}>
              <p className="sp-bu-h"><b>{reg.label}</b> {b.location}{reg.note && reg.provider === 'CDIP' && reg.id !== '029p1' ? ` · ${reg.note}` : ''}{at ? <> · observed {weekdayPT(at, tz)} {timeLabelPT(at, tz)}</> : ' · no recent observation'}{(b.delivery === 'saved' || old) && at ? <b> · not current</b> : null}</p>
              <p className="sp-bu-v">
                <span>Observed: {hs?.value != null ? `${ht(hs.value, p)} ${p.heightUnit}` : '—'} · {tp?.value != null ? `${Math.round(tp.value)} s` : '—'} · {dir?.value != null ? `${compass(dir.value)} ${Math.round(dir.value)}°` : '—'}</span>
                <span>Forecast here, same hour: {fc && fin(fc.offshore) ? `${ht(fc.offshore, p)} ${p.heightUnit} offshore` : 'no hour within 90 min'}{fc?.primary && fin(fc.primary.period) ? ` · ${Math.round(fc.primary.period)} s` : ''}{fc?.primary && fin(fc.primary.direction) ? ` · ${compass(fc.primary.direction)} ${Math.round(fc.primary.direction)}°` : ''}</span>
              </p>
            </li>
          );
        })}
      </ul>
      <p className="fine">Each buoy is at a different place from this spot's forecast point, and observed and forecast times can differ: context, not a validation. {near.some((b) => b.id === '029p1') && near.some((b) => b.id === '46214') ? ' NDBC 46214 and CDIP 029 are the same buoy.' : ''}</p>
    </div>
  );
}

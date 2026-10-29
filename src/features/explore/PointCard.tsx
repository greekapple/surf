import {useEffect, useState} from 'react';
import type {UserProfile} from '../../models/index';
import {DirArrow, Icon} from '../../ui/Icon';
import {compass, ht, windVal} from '../forecast/helpers';
import {hourLabel} from '../forecast/model';
import {weekdayPT} from '../forecast/format';

export interface Pt {lat: number; lon: number}
/** Response of /api/point: hourly model series for 7 days, SI units. */
export interface PointData {time: number[]; waveHeight: (number | null)[]; swellHeight: (number | null)[]; swellPeriod: (number | null)[]; swellDirection: (number | null)[]; windSpeed: (number | null)[]; windDirection: (number | null)[]; retrievedAt: string}
type State = {key: string; data: PointData | null; error: string | null};
const keyOf = (pt: Pt | null) => (pt ? `${pt.lat},${pt.lon}` : '');
const FT = 1 / 0.3048, MPH = 2.23694;

/** Fetches the model point forecast for a tapped sea point; cancelled when the point changes. */
export function usePointForecast(pt: Pt | null) {
  const key = keyOf(pt);
  const [r, setR] = useState<State>({key: '', data: null, error: null});
  useEffect(() => {
    if (!pt) return;
    const c = new AbortController();
    fetch(`/api/point?lat=${pt.lat}&lon=${pt.lon}`, {signal: c.signal})
      .then(async (res) => { const body = await res.json().catch(() => null); if (!res.ok) throw new Error(body?.error ?? 'Point forecast unavailable'); return body as PointData; })
      .then((data) => setR({key, data, error: null}))
      .catch((e) => { if (!c.signal.aborted) setR({key, data: null, error: e.message || 'Point forecast unavailable'}); });
    return () => c.abort();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return r.key === key ? r : {key, data: null, error: null, loading: true as const};
}

function Spark({values, at}: {values: (number | null)[]; at: number}) {
  const W = 224, H = 36, nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return null;
  const lo = Math.min(...nums), hi = Math.max(...nums), span = hi - lo || 1;
  const x = (i: number) => (i / (values.length - 1)) * W, y = (v: number) => H - 3 - ((v - lo) / span) * (H - 6);
  let d = '';
  values.forEach((v, i) => { if (v !== null) d += `${d && values[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; });
  const cur = values[at];
  return (
    <svg className="xpt-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Wave height, next 7 days">
      <path d={d} fill="none" stroke="#5cb3ff" strokeWidth="1.5" strokeLinejoin="round" />
      {cur !== null && cur !== undefined && <circle cx={x(at)} cy={y(cur)} r="3.5" fill="#fff" stroke="#2f8ae0" strokeWidth="2" />}
    </svg>
  );
}

export function PointCard({pt, state, time, p, pinned, onPin, onClose}: {pt: Pt; state: ReturnType<typeof usePointForecast>; time: string | null; p: UserProfile; pinned: boolean; onPin: () => void; onClose: () => void}) {
  const data = state.data;
  // Nearest model hour to the shared timeline hour; no value if the data does not reach it.
  let at = -1;
  if (data && time) {
    const t = Date.parse(time) / 1000;
    at = data.time.reduce((best, v, i) => (Math.abs(v - t) < Math.abs(data.time[best] - t) ? i : best), 0);
    if (Math.abs(data.time[at] - t) > 5400) at = -1;
  }
  const at0 = Math.max(0, at);
  const num = (arr: (number | null)[], k: number) => (k >= 0 ? arr[k] : null);
  const hs = data ? num(data.waveHeight, at) : null, sw = data ? num(data.swellHeight, at) : null, per = data ? num(data.swellPeriod, at) : null, dir = data ? num(data.swellDirection, at) : null;
  const ws = data ? num(data.windSpeed, at) : null, wd = data ? num(data.windDirection, at) : null;
  const loading = !data && !state.error;
  return (
    <div className="xpt" role="dialog" aria-label={`Model point forecast at ${pt.lat}, ${pt.lon}`}>
      <div className="xpt-h">
        <p>Model point forecast at <span>{pt.lat}, {pt.lon}</span>, not a surf spot</p>
        <button aria-label="Close point forecast" onClick={onClose}><Icon name="close" size={16} /></button>
      </div>
      {loading && <div className="xpt-skel" aria-hidden="true"><i /><i /><i /></div>}
      {state.error && <p className="xpt-err" role="alert">{state.error}</p>}
      {data && <>
        <p className="xpt-t">{time ? `${weekdayPT(time)} ${hourLabel(time)}` : ''}</p>
        <dl className="xpt-kv">
          <dt>Waves</dt><dd className="big">{hs === null ? 'n/a' : <>{ht(hs * FT, p)}<small> {p.heightUnit}</small></>}</dd>
          <dt>Swell</dt><dd>{sw === null ? 'n/a' : <>{ht(sw * FT, p)} {p.heightUnit}{per !== null && ` · ${Math.round(per)} s`}{dir !== null && <> <DirArrow from={dir} size={12} /> {compass(dir)}</>}</>}</dd>
          <dt>Wind</dt><dd>{ws === null ? 'n/a' : <>{windVal(ws * MPH, p)} {p.windUnit}{wd !== null && <> <DirArrow from={wd} size={12} /> {compass(wd)}</>}</>}</dd>
        </dl>
        <Spark values={data.waveHeight} at={at0} />
        <p className="xpt-cap">Wave height, next 7 days · Open-Meteo marine model</p>
      </>}
      <button className="xpt-pin" aria-pressed={pinned} onClick={onPin}>{pinned ? 'Remove pin' : 'Pin this point'}</button>
    </div>
  );
}

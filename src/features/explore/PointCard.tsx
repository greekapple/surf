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
  const W = 248, H = 44, nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return null;
  const hi = Math.max(...nums, 0.1), pts = values.map((v, i) => ({v, i})).filter(({i}) => i % 3 === 0 || i === at);
  const bw = W / pts.length;
  return (
    <svg className="xpt-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Wave height, next 7 days" preserveAspectRatio="none">
      {pts.map(({v, i}) => v === null ? null : <rect key={i} x={(pts.findIndex((q) => q.i === i)) * bw + 0.5} width={Math.max(1, bw - 1.5)} y={H - Math.max(2, (v / hi) * (H - 2))} height={Math.max(2, (v / hi) * (H - 2))} rx="1" fill={i === at ? '#fff' : '#3b8ff0'} opacity={i === at ? 1 : 0.7} />)}
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
        <div><h3>Model point</h3><p>{pt.lat}, {pt.lon} · not a surf spot</p></div>
        <button aria-label="Close point forecast" onClick={onClose}><Icon name="close" size={16} /></button>
      </div>
      {loading && <div className="xpt-skel" aria-hidden="true"><i /><i /><i /></div>}
      {state.error && <p className="xpt-err" role="alert">{state.error}</p>}
      {data && <>
        <p className="xpt-t">{time ? `${weekdayPT(time)} ${hourLabel(time)}` : 'Conditions'}</p>
        <p className="xpt-big">{hs === null ? 'n/a' : <>{ht(hs * FT, p)}<small>{p.heightUnit} waves</small></>}</p>
        <dl className="xpt-stats">
          <div><Icon name="wind" size={18} /><dt>Wind</dt><dd>{ws === null ? 'n/a' : <><b>{windVal(ws * MPH, p)} {p.windUnit}</b><small>{wd !== null ? <><DirArrow from={wd} size={11} /> {compass(wd)}</> : 'Wind'}</small></>}</dd></div>
          <div><Icon name="waves" size={18} /><dt>Swell</dt><dd>{sw === null ? 'n/a' : <><b>{ht(sw * FT, p)} {p.heightUnit}{per !== null && ` · ${Math.round(per)} s`}</b><small>{dir !== null ? <><DirArrow from={dir} size={11} /> {compass(dir)}</> : 'Swell'}</small></>}</dd></div>
        </dl>
        <p className="xpt-t">7-day outlook</p>
        <Spark values={data.waveHeight} at={at0} />
        <p className="xpt-cap">Wave height · Open-Meteo marine model</p>
      </>}
      <button className="xpt-pin" aria-pressed={pinned} onClick={onPin}>{pinned ? 'Remove pin' : 'Pin this point'}</button>
    </div>
  );
}

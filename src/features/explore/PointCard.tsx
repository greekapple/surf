import {useEffect, useState} from 'react';

export interface Pt {lat: number; lon: number}
/** Response of /api/point: hourly model series for 7 days, SI units. */
export interface PointData {time: number[]; waveHeight: (number | null)[]; /** T-117 */ waveDirection?: (number | null)[]; wavePeriod?: (number | null)[]; swell2Height?: (number | null)[]; swell2Period?: (number | null)[]; swell2Direction?: (number | null)[]; windGust?: (number | null)[]; swellHeight: (number | null)[]; swellPeriod: (number | null)[]; swellDirection: (number | null)[]; windSpeed: (number | null)[]; windDirection: (number | null)[]; retrievedAt: string}
type State = {key: string; data: PointData | null; error: string | null};
const keyOf = (pt: Pt | null) => (pt ? `${pt.lat},${pt.lon}` : '');

/** T-117: the point panel (PointPanel.tsx) renders this data. Fetches the model point forecast for a tapped sea point (via the server proxy and its cache); cancelled when the point changes. */
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

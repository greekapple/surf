import type {UserProfile} from '../../models/index';
import type {SourceInfo} from '../../ocean/types';
import {pacificDateMs} from '../../ocean/time';
import {compass, windVal} from './helpers';
import {windOf} from '../../services/spotHour';
import type {SurfSpot} from '../../models/index';
import {timeLabelPT} from './format';
import type {HourSample} from './model';

import {useEffect, useState} from 'react';
import {stationLabel, type Exposure, type ShoreWindNow} from '../../ocean/shoreWind';
import {loadShoreWindNow} from '../../services/shoreWindNow';

const STALE_MS = 2 * 3600_000;
const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** What the station is, keyed off its exposure. Harbour and estuary gauges are never shown (sheltered water is not the wind at a break). */
const EXPOSURE_NOTE: Partial<Record<Exposure, string>> = {airfield: 'airport station, inland of the break', pier: 'pier station', cove: 'pier in the cove'};

/** Dev only: `?windNowFixture=asos|ndbc|stale|variable` builds a reading relative to now, so the line can be seen before the live feed exists. */
function devFixture(now: number): ShoreWindNow | null {
  if (!import.meta.env?.DEV || typeof location === 'undefined') return null;
  const k = new URLSearchParams(location.search).get('windNowFixture');
  if (k !== 'asos' && k !== 'ndbc' && k !== 'stale' && k !== 'variable') return null;
  const src = (url: string, at: string): SourceInfo => ({provider: 'dev fixture', kind: 'observation', validAt: at, retrievedAt: new Date(now).toISOString(), issuedAt: null, updatedAt: null, url, nativeUnit: 'mph', location: 'dev fixture'} as SourceInfo);
  const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
  return k === 'ndbc'
    ? {stationId: 'FIXTURE-NDBC', stationName: 'Fixture cove pier', kind: 'ndbc', exposure: 'cove', distanceKm: 1.4, observedAt: at(36), mph: 9, gustMph: null, dirDeg: 300, source: src('https://www.ndbc.noaa.gov/', at(36))}
    : {stationId: 'FIXTURE-ASOS', stationName: 'Fixture airport', kind: 'asos', exposure: 'airfield', distanceKm: 2.1, observedAt: at(k === 'stale' ? 190 : 22), mph: k === 'variable' ? 3 : 14, gustMph: k === 'variable' ? null : 19, dirDeg: k === 'variable' ? null : 268, source: src('https://api.weather.gov/', at(22))};
}

/** The hour of the shown day that contains the reading (within 45 min), for "forecast … for that hour". */
const hourAt = (hours: HourSample[], iso: string) => {
  const t = Date.parse(iso);
  let best: HourSample | null = null, d = 45 * 60_000;
  for (const x of hours) { const dd = Math.abs(Date.parse(x.timestamp) - t); if (dd <= d) { best = x; d = dd; } }
  return best;
};

/** Wind now: the latest reading at the spot's shore station beside the forecast for that hour. Context, not a check of the forecast: one
 *  station reading is not the wind at the break. Nothing when the spot has no station or the shown day is not today; no number when stale. */
/** Loads the spot's shore-station reading (null for a spot without a station; refreshed when the spot changes), then renders WindNowLine. */
export function WindNow({spot, hours, now, p}: {spot: SurfSpot; hours: HourSample[]; now: number; p: UserProfile}) {
  const [reading, setReading] = useState<ShoreWindNow | null>(null);
  useEffect(() => { let live = true; setReading(null); loadShoreWindNow(spot.id).then((r) => { if (live) setReading(r); }); return () => { live = false; }; }, [spot.id]);
  return <WindNowLine spot={spot} reading={reading} hours={hours} now={now} p={p} />;
}

export function WindNowLine({spot, reading, hours, now, p}: {spot: SurfSpot; reading: ShoreWindNow | null; hours: HourSample[]; now: number; p: UserProfile}) {
  const r = reading ?? devFixture(now);
  const note = r ? EXPOSURE_NOTE[r.exposure] : undefined;
  if (!r || !note || !hours.some((x) => x.date === pacificDateMs(now))) return null;
  const t = Date.parse(r.observedAt), where = `${stationLabel({id: r.stationId, kind: r.kind, name: r.stationName})}, ${r.distanceKm.toFixed(1)} km from the spot`;
  const stale = !Number.isFinite(t) || now - t > STALE_MS || t - now > 5 * 60_000;
  const src = r.source?.url ? <a href={r.source.url} target="_blank" rel="noreferrer">{where}</a> : where;
  if (stale || !fin(r.mph)) {
    return <p className="sp-wn sp-f" data-wind-now="none">{stale ? 'No reading in the last 2 h' : 'Latest reading has no wind speed'} · {src}</p>;
  }
  // whole numbers: a station reports whole knots or mph, and a decimal would read more precise than one reading is
  const whole = (mph: number) => { const v = windVal(mph, p); return v === '—' ? v : String(Math.round(Number(v))); };
  // under half a unit rounds to 0: say calm, not "0 mph, direction variable"
  const calm = whole(r.mph) === '0';
  // The forecast for the hour of the reading (not the hour picked on the card), named by that hour, rounded like the reading, with the card's stale/saved tag.
  const u = p.windUnit, hs = hourAt(hours, r.observedAt), wv = hs ? windOf(spot, hs.forecast, p, now) : null;
  const fc = hs && wv ? `forecast ${whole(wv.mph)} ${u} ${compass(wv.dirDeg)} for ${timeLabelPT(Date.parse(hs.timestamp))}${wv.stale ? (wv.stale.reason === 'saved' ? ' · saved copy' : ' · stale') : ''}` : null;
  // a gust no higher than the speed (after rounding), or with calm, says nothing
  const gust = !calm && fin(r.gustMph) && Number(whole(r.gustMph)) > Number(whole(r.mph)) ? whole(r.gustMph) : null;
  return (
    <div className="sp-wn" data-wind-now={r.kind}>
      <p className="sp-wn-m"><b>Measured</b> {calm ? 'calm' : <>{whole(r.mph)} {u}{fin(r.dirDeg) ? ` ${compass(r.dirDeg)}` : ', direction variable'}</>}{gust && <>, <span className="sp-nb">gust {gust}</span></>}{' '}<span className="sp-nb">at {timeLabelPT(t)}</span>{fc && <span className="sp-wn-fc"> · <span className="sp-nb">{fc}</span></span>}</p>
      <p className="sp-f">{src} · {note}</p>
    </div>
  );
}

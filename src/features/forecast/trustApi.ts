/** T-065 seam to the T-064 forecast-trust logic (engineering: src/services/{call,daylight,surfSeries,feltRight,nwsAlerts,boardPeriod}.ts).
 *  STUB until T-064 lands: same signatures. Daylight and the surf band use the real sun.ts and headlineSurf. The call is a simple stand-in from
 *  the existing rating and daylight, and says so in its basis. Replace this file with re-exports when the services are merged. */
import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import type {OceanBundle} from '../../ocean/types';
import {solarTimes} from '../../ocean/sun';
import {evidenceSpots} from '../../ocean/spots';
import {headlineSurf} from '../../services/headlineSurf';
import {rateForecast} from '../../ratings/adapters';
import {bandOf} from './model';

export type Verdict = 'Go' | 'Worth a look' | 'Skip' | 'Dark';
export interface CallWindow {start: string; end: string; label: string}
export interface Call {verdict: Verdict; window: CallWindow | null; nextWindow: CallWindow | null; why: string[]; basis: string}
export interface Daylight {firstLight: string; sunrise: string; sunset: string; lastLight: string}
export interface SurfBandPoint {t: string; lo: number | null; hi: number | null; kind: 'estimate' | 'demonstration' | 'offshore' | 'none'; offshoreFt: number | null}
export type Felt = 'low' | 'right' | 'high';
export interface NwsAlert {event: string; headline: string; onset: string | null; ends: string | null; expires: string | null; url: string; sender: string}
export type PeriodFit = {fit: 'short' | 'ok' | 'long'; note: string};
type Bundle = Pick<OceanBundle, 'nearshore' | 'mop'> | null | undefined;

const pacificDate = (ms: number) => new Date(ms).toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
const hourLabel = (ms: number) => new Date(ms).toLocaleTimeString('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric'}).replace(' ', ' ');
const where = (spotId: string) => { const e = evidenceSpots.find((x) => x.id === spotId); return e ? [e.latitude, e.longitude] : [37.76, -122.51]; };

export function daylightFor(spotId: string, dateKey: string): Daylight {
  const [lat, lon] = where(spotId), s = solarTimes(dateKey, lat, lon), c = solarTimes(dateKey, lat, lon, 96), iso = (ms: number) => new Date(ms).toISOString();
  return {firstLight: iso(c.rise), sunrise: iso(s.rise), sunset: iso(s.set), lastLight: iso(c.set)};
}
export function isDark(spotId: string, iso: string): boolean {
  const ms = Date.parse(iso), d = daylightFor(spotId, pacificDate(ms));
  return ms < Date.parse(d.firstLight) || ms > Date.parse(d.lastLight);
}

export function surfBandSeries(spot: SurfSpot, records: Forecast[], ctx: {bundle?: Bundle; nowMs: number}): SurfBandPoint[] {
  return records.filter((f) => f.spotId === spot.id).map((f) => {
    const h = headlineSurf(spot.id, f, {bundle: ctx.bundle, nowMs: ctx.nowMs}), off = Number.isFinite(f.offshore) ? f.offshore : null;
    return h.kind === 'estimate' ? {t: f.timestamp, lo: h.loFt, hi: h.hiFt, kind: 'estimate', offshoreFt: off}
      : h.kind === 'demonstration' ? {t: f.timestamp, lo: h.ft, hi: h.ft, kind: 'demonstration', offshoreFt: off}
      : {t: f.timestamp, lo: null, hi: null, kind: h.kind === 'offshore' ? 'offshore' : 'none', offshoreFt: off};
  });
}

export function callFor(spot: SurfSpot, hour: Forecast, _profile: UserProfile, ctx: {records: Forecast[]; bundle?: Bundle; nowMs: number}): Call {
  const day = (f: Forecast) => pacificDate(Date.parse(f.timestamp));
  const good = (f: Forecast) => !isDark(spot.id, f.timestamp) && bandOf(rateForecast(spot, f, ctx.nowMs).category) !== 'poor';
  const runs = (recs: Forecast[]) => { const out: Forecast[][] = []; let cur: Forecast[] = []; for (const f of recs) { if (good(f)) cur.push(f); else if (cur.length) { out.push(cur); cur = []; } } if (cur.length) out.push(cur); return out; };
  const win = (r: Forecast[]): CallWindow => ({start: r[0].timestamp, end: r[r.length - 1].timestamp, label: `${hourLabel(Date.parse(r[0].timestamp))}–${hourLabel(Date.parse(r[r.length - 1].timestamp) + 36e5)}`});
  const mine = ctx.records.filter((f) => f.spotId === spot.id && Date.parse(f.timestamp) >= Math.floor(ctx.nowMs / 36e5) * 36e5).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const today = runs(mine.filter((f) => day(f) === day(hour)))[0] ?? null;
  const later = runs(mine.filter((f) => day(f) !== day(hour) && Date.parse(f.timestamp) > Date.parse(hour.timestamp)))[0] ?? null;
  const r = rateForecast(spot, hour, ctx.nowMs), dark = isDark(spot.id, hour.timestamp), b = bandOf(r.category);
  const verdict: Verdict = dark ? 'Dark' : b === 'good' ? 'Go' : b === 'fair' ? 'Worth a look' : 'Skip';
  return {verdict, window: today ? win(today) : null, nextWindow: dark || !today ? (later ? win(later) : null) : null,
    why: [dark ? 'It is dark: no rating at night.' : r.explanation], basis: 'Stand-in from the provisional rating and daylight (T-064 call logic pending).'};
}

const FKEY = 'swello-t065-felt-stub';
export function logFeltRight(i: {spotId: string; at: string; felt: Felt}, _env?: unknown): {ok: true} | {ok: false; error: string} {
  try { const all = JSON.parse(localStorage.getItem(FKEY) ?? '[]'); all.unshift({...i, loggedAt: new Date().toISOString()}); localStorage.setItem(FKEY, JSON.stringify(all.slice(0, 500))); return {ok: true}; } catch { return {ok: false, error: 'This browser would not store it.'}; }
}
export function feltRightFor(spotId: string, nowMs: number): {felt: Felt; at: string} | null {
  try { const all: {spotId: string; at: string; felt: Felt}[] = JSON.parse(localStorage.getItem(FKEY) ?? '[]'); return all.find((x) => x.spotId === spotId && pacificDate(Date.parse(x.at)) === pacificDate(nowMs)) ?? null; } catch { return null; }
}
export async function alertsFor(_spotId: string, _signal?: AbortSignal): Promise<{status: 'ok'; alerts: NwsAlert[]; fetchedAt: string} | {status: 'unavailable'}> {
  return {status: 'ok', alerts: [], fetchedAt: new Date().toISOString()};
}
export function periodFit(_boardType: string, periodS: number): PeriodFit {
  return {fit: periodS < 9 ? 'short' : 'ok', note: periodS < 9 ? 'short-period, weaker waves' : 'period suits most boards'};
}

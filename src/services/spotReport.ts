import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import type {TidePrediction} from '../ocean/types.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {solarTimes} from '../ocean/sun.ts';
import {pacificDate, pacificHour} from '../ocean/time.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {windRelationship} from '../recommendation/sqi.ts';
import {compass, wind as windText} from '../utils/units.ts';
import {canPresentBreakingEstimate, formatWaveHeight} from '../utils/waveHeight.ts';
import {currentRecord, spotStrip} from './spotStrip.ts';

/** Data layer for a Surfline-style spot report (T-026). Pure; every value is labelled or null; nothing is invented. */
const TZ = 'America/Los_Angeles';
const clockFmt = new Intl.DateTimeFormat('en-US', {timeZone: TZ, hour: 'numeric', minute: '2-digit'});
const dayFmt = new Intl.DateTimeFormat('en-US', {timeZone: TZ, weekday: 'short', day: 'numeric'});
const clock = (ms: number) => clockFmt.format(new Date(ms));
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export interface HalfDay {category: string | null; hours: number; /** How the category was reached; a single hour is said to be a single hour. */ basis: string}
export interface SwellLine {label: 'Primary' | 'Secondary' | 'Wind sea'; heightFt: number; heightLabel: string; periodS: number | null; dirDeg: number | null; dirWord: string | null}
export interface DayReport {date: string; label: string; am: HalfDay; pm: HalfDay; heightRange: string | null; heightKind: 'estimate' | 'offshore' | 'none'; primarySwell: (SwellLine & {at: string}) | null}
export interface TideEvent {type: 'High' | 'Low'; time: string; localTime: string; heightLabel: string}
export interface Moment {iso: string; localTime: string}
export interface SpotReport {
  spotId: string; name: string;
  headline: {category: string; heightLabel: string; heightKind: 'estimate' | 'offshore' | 'none'; wind: {word: string; label: string; relation: string; gustLabel: string | null} | null; tide: {state: 'rising' | 'falling' | 'unknown'; heightLabel: string | null; note: string} | null};
  days: DayReport[];
  swells: SwellLine[];
  waterTemp: string | null;
  tides: {source: 'predictions' | 'hourly'; note: string; events: TideEvent[]} | null;
  light: {note: string; firstLight: Moment; sunrise: Moment; sunset: Moment; lastLight: Moment};
  validTime: string | null;
}

const moment = (ms: number): Moment => ({iso: new Date(ms).toISOString(), localTime: clock(ms)});
const windAdjective = (mph: number) => (mph < 5 ? 'Light' : mph < 12 ? 'Gentle' : mph < 19 ? 'Moderate' : mph < 26 ? 'Fresh' : 'Strong');

function swellLines(f: Forecast, p: UserProfile): SwellLine[] {
  const line = (label: SwellLine['label'], s: Forecast['primary'] | null | undefined): SwellLine | null => {
    if (!s || !finite(s.height) || s.height <= 0) return null;
    return {label, heightFt: s.height, heightLabel: formatWaveHeight({kind: 'swell', valueFt: s.height}, p, 'technical').text, periodS: finite(s.period) && s.period > 0 ? s.period : null,
      dirDeg: finite(s.direction) ? s.direction : null, dirWord: finite(s.direction) ? compass(s.direction) : null};
  };
  // Wind sea is never listed: the marine feed supplies only the combined height, not a wind-sea height, period or direction.
  return [line('Primary', f.primary), line('Secondary', f.secondary)].filter((x): x is SwellLine => !!x);
}

function halfDay(spot: SurfSpot, hours: Forecast[], now: number): HalfDay {
  if (!hours.length) return {category: null, hours: 0, basis: 'no forecast hours'};
  const rated = hours.map((f) => rateForecast(spot, f, now)).filter((r) => r.score !== null && r.score !== undefined).sort((a, b) => (a.score as number) - (b.score as number));
  const hourTxt = hours.length === 1 ? 'a single hour, not a half-day summary' : `median of ${hours.length} hours`;
  if (!rated.length) return {category: 'UNRATED', hours: hours.length, basis: `${hours.length === 1 ? 'a single hour' : `${hours.length} hours`}, none rated`};
  return {category: String(rated[Math.floor((rated.length - 1) / 2)].category), hours: hours.length, basis: rated.length === hours.length ? hourTxt : `${hourTxt}; ${hours.length - rated.length} unrated`};
}

function dayHeight(hours: Forecast[], p: UserProfile): {label: string | null; kind: DayReport['heightKind']} {
  const ests = hours.map((f) => f.evidence?.faceEstimate?.input).filter((e): e is NonNullable<typeof e> => !!e && canPresentBreakingEstimate(e));
  if (ests.length) {
    const lo = Math.min(...ests.map((e) => e.rangeFt![0])), hi = Math.max(...ests.map((e) => e.rangeFt![1]));
    return {label: `Est. ${formatWaveHeight({...ests[0], rangeFt: [lo, hi]}, p).text}`, kind: 'estimate'};
  }
  const off = hours.map((f) => f.offshore).filter((v) => finite(v) && v >= 0);
  if (!off.length) return {label: null, kind: 'none'};
  const a = formatWaveHeight({kind: 'offshore', valueFt: Math.min(...off)}, p, 'technical').text, b = formatWaveHeight({kind: 'offshore', valueFt: Math.max(...off)}, p, 'technical').text;
  return {label: a === b ? `${b} offshore` : `${a.replace(` ${p.heightUnit}`, '')}–${b} offshore`, kind: 'offshore'};
}

function tideEvents(extrema: TidePrediction[] | undefined, hours: Forecast[], todayKey: string, p: UserProfile): SpotReport['tides'] {
  const lab = (ft: number) => formatWaveHeight({kind: 'nearshore', valueFt: Math.abs(ft)}, p, 'technical').text.replace(/^/, ft < 0 ? '-' : '');
  const preds = (extrema ?? []).filter((e) => finite(e.height.value) && pacificDate(e.timestamp) === todayKey).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (preds.length) {
    return {source: 'predictions', note: 'NOAA tide predictions, regional reference station (San Francisco), MLLW.',
      events: preds.map((e) => ({type: e.type, time: e.timestamp, localTime: clock(Date.parse(e.timestamp)), heightLabel: lab(e.height.value as number)}))};
  }
  const t = hours.filter((f) => pacificDate(f.timestamp) === todayKey && finite(f.tide?.height)).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (t.length < 3) return null;
  const events: TideEvent[] = [];
  for (let i = 1; i < t.length - 1; i++) {
    const a = t[i - 1].tide.height, b = t[i].tide.height, c = t[i + 1].tide.height;
    const consecutive = Date.parse(t[i].timestamp) - Date.parse(t[i - 1].timestamp) === 3600000 && Date.parse(t[i + 1].timestamp) - Date.parse(t[i].timestamp) === 3600000;
    if (consecutive && b > a && b >= c) events.push({type: 'High', time: t[i].timestamp, localTime: clock(Date.parse(t[i].timestamp)), heightLabel: lab(b)});
    else if (consecutive && b < a && b <= c) events.push({type: 'Low', time: t[i].timestamp, localTime: clock(Date.parse(t[i].timestamp)), heightLabel: lab(b)});
  }
  return {source: 'hourly', note: 'Found in the hourly regional tide values: times are to the hour and heights are hourly values, not predicted extremes.', events};
}

/** `extrema` (NOAA high/low predictions) is optional; without it, highs and lows come from the hourly tide values and say so. */
export function spotReport(spot: SurfSpot, records: Forecast[], now: number, profile: UserProfile, extrema?: TidePrediction[]): SpotReport {
  const mine = records.filter((f) => f.spotId === spot.id && Number.isFinite(Date.parse(f.timestamp)));
  const cur = currentRecord(mine, spot.id, now);
  const [item] = spotStrip([spot], mine, [spot.id], now, profile);
  const ev = evidenceSpots.find((e) => e.id === spot.id), lat = ev?.latitude ?? 37.76, lon = ev?.longitude ?? -122.51;
  const todayKey = pacificDate(new Date(now).toISOString());

  let wind: SpotReport['headline']['wind'] = null, tide: SpotReport['headline']['tide'] = null;
  if (cur) {
    if (finite(cur.wind?.speed) && finite(cur.wind?.direction) && cur.availability?.wind !== false) {
      const rel = String(windRelationship(spot, cur)).toLowerCase();
      wind = {word: `${windAdjective(cur.wind.speed)} ${compass(cur.wind.direction)}`, label: `${windText(cur.wind.speed, profile)} ${compass(cur.wind.direction)}`, relation: rel,
        gustLabel: finite(cur.wind.gusts) ? `gusts ${windText(cur.wind.gusts as number, profile)}` : null};
    }
    const trend = cur.tide?.trend ?? cur.tide?.stage;
    if (finite(cur.tide?.height) || trend === 'Rising' || trend === 'Falling') {
      tide = {state: trend === 'Rising' ? 'rising' : trend === 'Falling' ? 'falling' : 'unknown',
        heightLabel: finite(cur.tide?.height) ? formatWaveHeight({kind: 'nearshore', valueFt: Math.abs(cur.tide.height)}, profile, 'technical').text.replace(/^/, cur.tide.height < 0 ? '-' : '') : null,
        note: 'Regional reference station (San Francisco), MLLW; not a local tide gauge.'};
    }
  }

  const days: DayReport[] = [];
  for (let i = 0; i < 7; i++) {
    const noon = new Date(`${todayKey}T12:00:00Z`).getTime() + i * 86400000, key = pacificDate(new Date(noon).toISOString());
    const hrs = mine.filter((f) => pacificDate(f.timestamp) === key);
    const part = (a: number, b: number) => hrs.filter((f) => { const h = pacificHour(f.timestamp); return h >= a && h <= b; });
    const h = dayHeight(part(6, 17), profile);
    const near = part(6, 17).concat(hrs).filter((f) => finite(f.primary?.height) && f.primary.height > 0)
      .sort((x, y) => Math.abs(pacificHour(x.timestamp) - 12) - Math.abs(pacificHour(y.timestamp) - 12))[0];
    const ps = near ? swellLines(near, profile).find((s) => s.label === 'Primary') : undefined;
    days.push({date: key, label: dayFmt.format(new Date(noon)), am: halfDay(spot, part(6, 11), now), pm: halfDay(spot, part(12, 17), now), heightRange: h.label, heightKind: h.kind,
      primarySwell: near && ps ? {...ps, at: near.timestamp} : null});
  }

  const sun = solarTimes(todayKey, lat, lon, 90.833), civil = solarTimes(todayKey, lat, lon, 96);
  const water = cur && finite(cur.waterTempF) ? `${(cur.waterTempF as number).toFixed(0)}°F sea surface (model)` : null;
  return {
    spotId: spot.id, name: spot.name,
    headline: {category: item?.category ?? 'UNRATED', heightLabel: item?.heightLabel ?? 'No forecast data', heightKind: item?.heightKind ?? 'none', wind, tide},
    days,
    swells: cur ? swellLines(cur, profile) : [],
    waterTemp: water,
    tides: tideEvents(extrema, mine, todayKey, profile),
    light: {note: 'Approximate, from solar position; first and last light are civil twilight.', firstLight: moment(civil.rise), sunrise: moment(sun.rise), sunset: moment(sun.set), lastLight: moment(civil.set)},
    validTime: cur?.timestamp ?? null,
  };
}

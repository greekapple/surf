import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import type {TidePrediction} from '../ocean/types.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {solarTimes} from '../ocean/sun.ts';
import {dateIn, hourIn, addDaysKey, fmtIn} from '../ocean/time.ts';
import {timeZoneOf} from '../ocean/spotZone.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {compass} from '../utils/units.ts';
import {formatWaveHeight} from '../utils/waveHeight.ts';
import {currentRecord, spotStrip} from './spotStrip.ts';
import {dayRange, tideOf, windOf, type HourContext} from './spotHour.ts';

/** Data layer for a Surfline-style spot report (T-026). Pure; every value is labelled or null; nothing is invented. */
const clock = (tz: string, ms: number) => fmtIn(tz, {hour: 'numeric', minute: '2-digit'}).format(new Date(ms));
/** The weekday and day of a date KEY (a calendar date in the spot's zone), zone-free: noon UTC of that date. */
const dayLabel = (key: string) => fmtIn('UTC', {weekday: 'short', day: 'numeric'}).format(new Date(`${key}T12:00:00Z`));
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

const moment = (tz: string, ms: number): Moment => ({iso: new Date(ms).toISOString(), localTime: clock(tz, ms)});

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

function tideEvents(extrema: TidePrediction[] | undefined, hours: Forecast[], todayKey: string, p: UserProfile, tz: string): SpotReport['tides'] {
  const lab = (ft: number) => formatWaveHeight({kind: 'nearshore', valueFt: Math.abs(ft)}, p, 'technical').text.replace(/^/, ft < 0 ? '-' : '');
  const preds = (extrema ?? []).filter((e) => finite(e.height.value) && dateIn(tz, e.timestamp) === todayKey).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (preds.length) {
    return {source: 'predictions', note: 'NOAA tide predictions, regional reference station (San Francisco), MLLW.',
      events: preds.map((e) => ({type: e.type, time: e.timestamp, localTime: clock(tz, Date.parse(e.timestamp)), heightLabel: lab(e.height.value as number)}))};
  }
  const t = hours.filter((f) => dateIn(tz, f.timestamp) === todayKey && finite(f.tide?.height)).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (t.length < 3) return null;
  const events: TideEvent[] = [];
  for (let i = 1; i < t.length - 1; i++) {
    const a = t[i - 1].tide.height, b = t[i].tide.height, c = t[i + 1].tide.height;
    const consecutive = Date.parse(t[i].timestamp) - Date.parse(t[i - 1].timestamp) === 3600000 && Date.parse(t[i + 1].timestamp) - Date.parse(t[i].timestamp) === 3600000;
    if (consecutive && b > a && b >= c) events.push({type: 'High', time: t[i].timestamp, localTime: clock(tz, Date.parse(t[i].timestamp)), heightLabel: lab(b)});
    else if (consecutive && b < a && b <= c) events.push({type: 'Low', time: t[i].timestamp, localTime: clock(tz, Date.parse(t[i].timestamp)), heightLabel: lab(b)});
  }
  return {source: 'hourly', note: 'Found in the hourly regional tide values: times are to the hour and heights are hourly values, not predicted extremes.', events};
}

/** `extrema` (NOAA high/low predictions) is optional; without it, highs and lows come from the hourly tide values and say so. */
export function spotReport(spot: SurfSpot, records: Forecast[], now: number, profile: UserProfile, extrema?: TidePrediction[], ctx: HourContext = {}): SpotReport {
  const mine = records.filter((f) => f.spotId === spot.id && Number.isFinite(Date.parse(f.timestamp)));
  const cur = currentRecord(mine, spot.id, now);
  const [item] = spotStrip([spot], mine, [spot.id], now, profile, ctx);
  const ev = evidenceSpots.find((e) => e.id === spot.id), lat = ev?.latitude ?? 37.76, lon = ev?.longitude ?? -122.51;
  const tz = timeZoneOf(spot), todayKey = dateIn(tz, new Date(now).toISOString());

  // Wind and tide come from the shared accessors, so Home and Forecast cannot disagree for the same hour (T-055).
  const w = cur ? windOf(spot, cur, profile, now) : null, td = cur ? tideOf(cur, profile, now) : null;
  const wind: SpotReport['headline']['wind'] = w ? {word: w.word, label: w.label, relation: w.relation, gustLabel: w.gustLabel} : null;
  const tide: SpotReport['headline']['tide'] = td ? {state: td.state, heightLabel: td.heightLabel, note: td.note} : null;

  const days: DayReport[] = [];
  for (let i = 0; i < 7; i++) {
    const key = addDaysKey(todayKey, i);
    const hrs = mine.filter((f) => dateIn(tz, f.timestamp) === key);
    const part = (a: number, b: number) => hrs.filter((f) => { const h = hourIn(tz, f.timestamp); return h >= a && h <= b; });
    const h = dayRange(spot, mine, key, now, profile, ctx);
    const near = part(6, 17).concat(hrs).filter((f) => finite(f.primary?.height) && f.primary.height > 0)
      .sort((x, y) => Math.abs(hourIn(tz, x.timestamp) - 12) - Math.abs(hourIn(tz, y.timestamp) - 12))[0];
    const ps = near ? swellLines(near, profile).find((s) => s.label === 'Primary') : undefined;
    days.push({date: key, label: dayLabel(key), am: halfDay(spot, part(6, 11), now), pm: halfDay(spot, part(12, 17), now), heightRange: h.label, heightKind: h.kind,
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
    tides: tideEvents(extrema, mine, todayKey, profile, tz),
    light: {note: 'Approximate, from solar position; first and last light are civil twilight.', firstLight: moment(tz, civil.rise), sunrise: moment(tz, sun.rise), sunset: moment(tz, sun.set), lastLight: moment(tz, civil.set)},
    validTime: cur?.timestamp ?? null,
  };
}

import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {pacificDate} from '../ocean/time.ts';
import {solarTimes} from '../ocean/sun.ts';
import {rateForecast} from '../ratings/adapters.ts';
import type {SurfRating} from '../ratings/types.ts';
import {windRelationship} from '../recommendation/sqi.ts';
import {compass, wind as windText} from '../utils/units.ts';
import {formatWaveHeight} from '../utils/waveHeight.ts';
import {headlineSurf, headlineText, type HeadlineSurf} from './headlineSurf.ts';

/** ONE source of truth for the numbers a spot shows at an hour (T-055): the forecast strip chip, the Surf card, Home, the map callout and the scale all read these,
 *  so the same spot and hour can never give two different surf ranges, winds, tides or ratings. Pure; nothing here invents a value. */
export interface HourContext {bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** THE hour rule: the first record at or after the top of the hour containing `atMs`. An earlier record is never used (no stale values). */
export function recordAt(records: Forecast[], spotId: string, atMs: number): Forecast | undefined {
  const from = Math.floor(atMs / 3600000) * 3600000;
  let best: Forecast | undefined, bt = Infinity;
  for (const f of records) {
    if (f.spotId !== spotId) continue;
    const t = Date.parse(f.timestamp);
    if (Number.isFinite(t) && t >= from && t < bt) { best = f; bt = t; }
  }
  return best;
}

const windAdjective = (mph: number) => (mph < 5 ? 'Light' : mph < 12 ? 'Gentle' : mph < 19 ? 'Moderate' : mph < 26 ? 'Fresh' : 'Strong');
export interface WindView {mph: number; dirDeg: number; word: string; label: string; relation: string; gustLabel: string | null}
/** The wind accessor: speed, direction and shore relation for one hour, in the user's units. Null when this hour has no usable wind. */
export function windOf(spot: SurfSpot, f: Forecast, p: UserProfile): WindView | null {
  if (!finite(f.wind?.speed) || !finite(f.wind?.direction) || f.availability?.wind === false) return null;
  return {mph: f.wind.speed, dirDeg: f.wind.direction, word: `${windAdjective(f.wind.speed)} ${compass(f.wind.direction)}`, label: `${windText(f.wind.speed, p)} ${compass(f.wind.direction)}`,
    relation: String(windRelationship(spot, f)).toLowerCase(), gustLabel: finite(f.wind.gusts) ? `gusts ${windText(f.wind.gusts as number, p)}` : null};
}
export interface TideView {state: 'rising' | 'falling' | 'unknown'; heightLabel: string | null; note: string}
/** The tide accessor: regional reference station level and trend for one hour. Null when this hour has neither. */
export function tideOf(f: Forecast, p: UserProfile): TideView | null {
  const trend = f.tide?.trend ?? f.tide?.stage;
  if (!finite(f.tide?.height) && trend !== 'Rising' && trend !== 'Falling') return null;
  return {state: trend === 'Rising' ? 'rising' : trend === 'Falling' ? 'falling' : 'unknown',
    heightLabel: finite(f.tide?.height) ? formatWaveHeight({kind: 'nearshore', valueFt: Math.abs(f.tide.height)}, p, 'technical').text.replace(/^/, f.tide.height < 0 ? '-' : '') : null,
    note: 'Regional reference station (San Francisco), MLLW; not a local tide gauge.'};
}

export interface SpotHour {
  spotId: string; validTime: string; demo: boolean; record: Forecast;
  surf: {headline: HeadlineSurf; value: string; label: string; words: string | null; tag: string; detail: string};
  rating: SurfRating; wind: WindView | null; tide: TideView | null;
}
/** Everything one surface needs for a spot at an hour. Undefined when the spot has no record for that hour. `nowMs` is the clock the rating and headline are judged at. */
export function spotHourOf(spot: SurfSpot, f: Forecast, nowMs: number, p: UserProfile, ctx: HourContext = {}): SpotHour {
  const headline = headlineSurf(spot.id, f, {bundle: ctx.bundle, nowMs}), t = headlineText(headline, p);
  return {spotId: spot.id, validTime: f.timestamp, demo: !f.evidence, record: f, surf: {headline, value: t.value, label: t.label, words: t.words, tag: t.tag, detail: t.detail},
    rating: rateForecast(spot, f, nowMs), wind: windOf(spot, f, p), tide: tideOf(f, p)};
}
export function spotHour(spot: SurfSpot, records: Forecast[], atMs: number, p: UserProfile, ctx: HourContext = {}): SpotHour | undefined {
  const f = recordAt(records, spot.id, atMs);
  return f ? spotHourOf(spot, f, atMs, p, ctx) : undefined;
}

/** The one hour a day card stands for (T-057): the best-rated daylight hour, or the median-size daylight hour when nothing is rated. Its numbers ARE spotHourOf at that hour. */
export interface DayTypical {atIso: string; how: 'best' | 'median'; hourLabel: string; short: string; loFt: number; hiFt: number; hour: SpotHour; aria: string}
export interface DayRange {kind: 'estimate' | 'offshore' | 'none'; loFt: number | null; hiFt: number | null; hours: number; label: string | null; basis: string; /** The day's representative hour; null when no daylight hour has a height of the day's kind. */ typical: DayTypical | null}
const hrFmt = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric'});
const hourWord = (iso: string) => hrFmt.format(new Date(iso)).replace(' ', '').toUpperCase().replace(/AM$/, ' AM').replace(/PM$/, ' PM');
const hourShort = (iso: string) => hrFmt.format(new Date(iso)).replace(/ (A|P)M$/, (_, c) => c.toLowerCase());
/** The day card's size: the envelope of the hourly headline over that Pacific date's DAYLIGHT hours (civil twilight), from the same engine as every other surface.
 *  Estimates win; otherwise labelled offshore heights; otherwise none. The label names the basis so nobody reads it as a single-hour value. */
export function dayRange(spot: SurfSpot, records: Forecast[], dateKey: string, nowMs: number, p: UserProfile, ctx: HourContext = {}): DayRange {
  const ev = evidenceSpots.find((e) => e.id === spot.id), civil = solarTimes(dateKey, ev?.latitude ?? 37.76, ev?.longitude ?? -122.51, 96);
  const hours = records.filter((f) => { const t = Date.parse(f.timestamp); return f.spotId === spot.id && pacificDate(f.timestamp) === dateKey && t >= civil.rise && t <= civil.set; });
  const heads = hours.map((f) => headlineSurf(spot.id, f, {bundle: ctx.bundle, nowMs}));
  const pickTypical = (kind: 'estimate' | 'offshore'): DayTypical | null => {
    const idx = hours.map((_, i) => i).filter((i) => heads[i].kind === kind);
    if (!idx.length) return null;
    const scored = idx.map((i) => ({i, s: rateForecast(spot, hours[i], nowMs).score})).filter((x): x is {i: number; s: number} => typeof x.s === 'number' && Number.isFinite(x.s));
    const mid = (i: number) => { const h = heads[i]; return h.kind === 'estimate' ? (h.loFt + h.hiFt) / 2 : h.kind === 'offshore' ? h.ft : 0; };
    let pick: number, how: 'best' | 'median';
    if (scored.length) { pick = scored.reduce((a, b) => (b.s > a.s ? b : a)).i; how = 'best'; }
    else { const by = [...idx].sort((a, b) => mid(a) - mid(b) || a - b); pick = by[(by.length - 1) >> 1]; how = 'median'; }
    const hour = spotHourOf(spot, hours[pick], nowMs, p, ctx), h = hour.surf.headline;
    const lo = h.kind === 'estimate' ? h.loFt : h.kind === 'offshore' ? h.ft : 0, hi = h.kind === 'estimate' ? h.hiFt : h.kind === 'offshore' ? h.ft : 0;
    const w = hourWord(hours[pick].timestamp);
    return {atIso: hours[pick].timestamp, how, hourLabel: w, short: `${how === 'best' ? 'best' : 'mid'} ${hourShort(hours[pick].timestamp)}`, loFt: lo, hiFt: hi, hour,
      aria: `typical for the day: ${how === 'best' ? 'the best-rated daylight hour' : 'the median-size daylight hour'}, ${w}`};
  };
  const est = heads.filter((h): h is Extract<HeadlineSurf, {kind: 'estimate'}> => h.kind === 'estimate');
  if (est.length) {
    const lo = Math.min(...est.map((h) => h.loFt)), hi = Math.max(...est.map((h) => h.hiFt));
    const text = formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: [lo, hi], rangeMethod: 'v2'}, p).text;
    return {kind: 'estimate', loFt: lo, hiFt: hi, hours: est.length, label: `Est. ${text}`, basis: `daylight hours (${est.length} of ${hours.length} with an estimate)`, typical: pickTypical('estimate')};
  }
  const off = heads.filter((h): h is Extract<HeadlineSurf, {kind: 'offshore'}> => h.kind === 'offshore').map((h) => h.ft);
  if (off.length) {
    const lo = Math.min(...off), hi = Math.max(...off);
    const a = formatWaveHeight({kind: 'offshore', valueFt: lo}, p, 'technical').text, b = formatWaveHeight({kind: 'offshore', valueFt: hi}, p, 'technical').text;
    return {kind: 'offshore', loFt: lo, hiFt: hi, hours: off.length, label: a === b ? `${b} offshore` : `${a.replace(` ${p.heightUnit}`, '')}–${b} offshore`, basis: `daylight hours, offshore height (not surf size)`, typical: pickTypical('offshore')};
  }
  return {kind: 'none', loFt: null, hiFt: null, hours: 0, label: null, basis: 'no daylight hours with a height', typical: null};
}

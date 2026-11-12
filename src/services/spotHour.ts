import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {dateIn, fmtIn} from '../ocean/time.ts';
import {timeZoneOf} from '../ocean/spotZone.ts';
import {solarTimes} from '../ocean/sun.ts';
import {rateForecast} from '../ratings/adapters.ts';
import type {SurfRating} from '../ratings/types.ts';
import {windRelationship} from '../recommendation/sqi.ts';
import {compass, wind as windText} from '../utils/units.ts';
import {formatWaveHeight} from '../utils/waveHeight.ts';
import {firstStale, staleText, TIDE_MAX_AGE_MS, type Stale} from './freshness.ts';
import {headlineSurf, headlineText, FLAT_LABEL, type HeadlineSurf} from './headlineSurf.ts';
import {officialRange} from './officialSurf.ts';

/** ONE source of truth for the numbers a spot shows at an hour (T-055): the forecast strip chip, the Surf card, Home, the map callout and the scale all read these,
 *  so the same spot and hour can never give two different surf ranges, winds, tides or ratings. Pure; nothing here invents a value. */
export interface HourContext {bundle?: Pick<OceanBundle, 'nearshore' | 'mop' | 'srf'> | null}
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

export const windAdjective = (mph: number) => (mph < 5 ? 'Light' : mph < 12 ? 'Gentle' : mph < 19 ? 'Moderate' : mph < 26 ? 'Fresh' : 'Strong');
export interface WindView {mph: number; dirDeg: number; word: string; label: string; relation: string; gustLabel: string | null; stale?: Stale}
/** The wind accessor: speed, direction and shore relation for one hour, in the user's units. Null when this hour has no usable wind. */
export function windOf(spot: SurfSpot, f: Forecast, p: UserProfile, nowMs: number = Date.now()): WindView | null {
  if (!finite(f.wind?.speed) || !finite(f.wind?.direction) || f.availability?.wind === false) return null;
  const st = firstStale([f.evidence?.windSpeed?.source, f.evidence?.windDirection?.source], nowMs), tag = st ? (st.reason === 'saved' ? ' · saved copy' : ' · stale') : '';
  return {mph: f.wind.speed, dirDeg: f.wind.direction, word: `${windAdjective(f.wind.speed)} ${compass(f.wind.direction)}`, label: `${windText(f.wind.speed, p)} ${compass(f.wind.direction)}${tag}`, ...(st ? {stale: st} : {}),
    relation: String(windRelationship(spot, f)).toLowerCase(), gustLabel: finite(f.wind.gusts) ? `gusts ${windText(f.wind.gusts as number, p)}` : null};
}
export interface TideView {state: 'rising' | 'falling' | 'unknown'; heightLabel: string | null; note: string; stale?: Stale}
/** The tide accessor: regional reference station level and trend for one hour. Null when this hour has neither. */
export function tideOf(f: Forecast, p: UserProfile, nowMs: number = Date.now()): TideView | null {
  const trend = f.tide?.trend ?? f.tide?.stage, st = firstStale([f.evidence?.tide?.source], nowMs, TIDE_MAX_AGE_MS);
  if (!finite(f.tide?.height) && trend !== 'Rising' && trend !== 'Falling') return null;
  return {state: trend === 'Rising' ? 'rising' : trend === 'Falling' ? 'falling' : 'unknown',
    heightLabel: finite(f.tide?.height) ? formatWaveHeight({kind: 'nearshore', valueFt: Math.abs(f.tide.height)}, p, 'technical').text.replace(/^/, f.tide.height < 0 ? '-' : '') + (st ? (st.reason === 'saved' ? ' · saved copy' : ' · stale') : '') : null,
    note: `Regional reference station (San Francisco), MLLW; not a local tide gauge.${st ? ` ${staleText(st)}.` : ''}`, ...(st ? {stale: st} : {})};
}

export interface SpotHour {
  spotId: string; validTime: string; demo: boolean; record: Forecast;
  surf: {headline: HeadlineSurf; value: string; label: string; words: string | null; tag: string; detail: string; confidenceText?: string; confidenceDetail?: string};
  rating: SurfRating; wind: WindView | null; tide: TideView | null;
}
/** T-130: the rating is NOT fed by the nearshore-only height (it keeps judging the offshore swell), so where the headline is MOP's own nearshore height the rating's explanation says which number it used. */
function ratingNote(h: HeadlineSurf, r: SurfRating): SurfRating {
  if (h.kind !== 'estimate' || !h.nearshoreOnly) return r;
  const blocked = ['outside-window', 'short-period', 'no-break'].includes(h.nearshoreOnly.code);
  return {...r, explanation: `${r.explanation} ${blocked ? 'The rating uses offshore swell; the nearshore model shows the swell mostly blocked here.' : 'The rating uses offshore swell; this spot has no breaking profile, so the headline height is the nearshore model\'s height at its point.'}`};
}
/** Everything one surface needs for a spot at an hour. Undefined when the spot has no record for that hour. `nowMs` is the clock the rating and headline are judged at. */
export function spotHourOf(spot: SurfSpot, f: Forecast, nowMs: number, p: UserProfile, ctx: HourContext = {}): SpotHour {
  const headline = headlineSurf(spot.id, f, {bundle: ctx.bundle, nowMs}), t = headlineText(headline, p);
  return {spotId: spot.id, validTime: f.timestamp, demo: !f.evidence, record: f, surf: {headline, value: t.value, label: t.label, words: t.words, tag: t.tag, detail: t.detail, confidenceText: t.confidenceText, confidenceDetail: t.confidenceDetail},
    rating: ratingNote(headline, rateForecast(spot, f, nowMs)), wind: windOf(spot, f, p, nowMs), tide: tideOf(f, p, nowMs)};
}
export function spotHour(spot: SurfSpot, records: Forecast[], atMs: number, p: UserProfile, ctx: HourContext = {}): SpotHour | undefined {
  const f = recordAt(records, spot.id, atMs);
  return f ? spotHourOf(spot, f, atMs, p, ctx) : undefined;
}

/** The one hour a day card stands for (T-068, user decision "Median daylight hour"): the middle daylight hour of the day by clock time (about midday). Its numbers ARE spotHourOf at that hour.
 *  The best window stays in the Call (call.ts); the full daylight envelope stays in the day's `loFt`/`hiFt`. (T-057 used the best-rated hour; that hid part of a day-to-day dip.) */
export interface DayTypical {atIso: string; how: 'midday'; hourLabel: string; short: string; loFt: number; hiFt: number; /** T-107: the midday hour's central surf height (estimate) or offshore height; the one value a week cell's wave glyph is drawn from. */ centralFt: number; hour: SpotHour; aria: string}
export interface OfficialHalf {half: 'AM' | 'PM' | null; loFt: number; hiFt: number; upTo: boolean; about: boolean}
export interface DayRange {kind: 'estimate' | 'official' | 'offshore' | 'none'; loFt: number | null; hiFt: number | null; hours: number; label: string | null; basis: string; /** official only: the NWS range of each distinct half-day (Honolulu publishes AM and PM); one entry, half null, for a whole-day range. Never one half presented as the day. */ officialHalves?: OfficialHalf[]; /** The day's representative hour; null when no daylight hour has a height of the day's kind. */ typical: DayTypical | null}
const hrFmt = (tz: string) => fmtIn(tz, {hour: 'numeric'});
const hourWord = (tz: string, iso: string) => hrFmt(tz).format(new Date(iso)).replace(' ', '').toUpperCase().replace(/AM$/, ' AM').replace(/PM$/, ' PM');
const hourShort = (tz: string, iso: string) => hrFmt(tz).format(new Date(iso)).replace(/ (A|P)M$/, (_, c) => c.toLowerCase());
/** The day card's size: the envelope of the hourly headline over that Pacific date's DAYLIGHT hours (civil twilight), from the same engine as every other surface.
 *  Estimates win; otherwise labelled offshore heights; otherwise none. The label names the basis so nobody reads it as a single-hour value. */
export function dayRange(spot: SurfSpot, records: Forecast[], dateKey: string, nowMs: number, p: UserProfile, ctx: HourContext = {}): DayRange {
  const tz = timeZoneOf(spot), ev = evidenceSpots.find((e) => e.id === spot.id), civil = solarTimes(dateKey, ev?.latitude ?? 37.76, ev?.longitude ?? -122.51, 96, tz);
  const hours = records.filter((f) => { const t = Date.parse(f.timestamp); return f.spotId === spot.id && dateIn(tz, f.timestamp) === dateKey && t >= civil.rise && t <= civil.set; });
  const heads = hours.map((f) => headlineSurf(spot.id, f, {bundle: ctx.bundle, nowMs}));
  const pickTypical = (kind: 'estimate' | 'official' | 'offshore'): DayTypical | null => {
    const idx = hours.map((_, i) => i).filter((i) => heads[i].kind === kind);
    if (!idx.length) return null;
    const by = [...idx].sort((x, y) => Date.parse(hours[x].timestamp) - Date.parse(hours[y].timestamp)), pick = by[(by.length - 1) >> 1], how = 'midday' as const;
    const hour = spotHourOf(spot, hours[pick], nowMs, p, ctx), h = hour.surf.headline;
    const lo = h.kind === 'estimate' || h.kind === 'official' ? h.loFt : h.kind === 'offshore' ? h.ft : 0, hi = h.kind === 'estimate' || h.kind === 'official' ? h.hiFt : h.kind === 'offshore' ? h.ft : 0;
    const w = hourWord(tz, hours[pick].timestamp), central = h.kind === 'estimate' ? (h.centralFt ?? (lo + hi) / 2) : lo;
    return {atIso: hours[pick].timestamp, how, hourLabel: w, short: kind === 'official' ? 'whole day' : `midday ${hourShort(tz, hours[pick].timestamp)}`, loFt: lo, hiFt: hi, centralFt: central, hour,
      aria: kind === 'official' ? 'the NWS range for the whole day' : `typical for the day, midday ${w}`};
  };
  const est = heads.filter((h): h is Extract<HeadlineSurf, {kind: 'estimate'}> => h.kind === 'estimate');
  if (est.length) {
    const lo = Math.min(...est.map((h) => h.loFt)), hi = Math.max(...est.map((h) => h.hiFt));
    const allFlat = est.every((h) => h.nearshoreOnly?.flat), text = allFlat ? FLAT_LABEL : formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: [lo, hi], rangeMethod: 'v2'}, p).text; // T-130: an all-flat day reads Flat, never "Est. 0–0 ft"
    return {kind: 'estimate', loFt: lo, hiFt: hi, hours: est.length, label: allFlat ? FLAT_LABEL : `Est. ${text}`, basis: `daylight hours (${est.length} of ${hours.length} with an estimate)`, typical: pickTypical('estimate')};
  }
  // offshore-surf step 3: where we have no estimate but the NWS surf zone forecast covers the day, the day's size IS the NWS range (one range for the zone and day, labelled as theirs)
  const offs = heads.filter((h): h is Extract<HeadlineSurf, {kind: 'official'}> => h.kind === 'official');
  if (offs.length) {
    const u = p.heightUnit === 'm' ? 'm' : 'ft', first = offs[0], halves: OfficialHalf[] = [];
    for (const h of [...offs].sort((x, y) => (x.half === 'AM' ? 0 : 1) - (y.half === 'AM' ? 0 : 1))) if (!halves.some((x) => x.half === h.half && x.loFt === h.loFt && x.hiFt === h.hiFt)) halves.push({half: h.half, loFt: h.loFt, hiFt: h.hiFt, upTo: h.upTo, about: h.about});
    const label = `NWS ${halves.map((x) => `${x.half ? `${x.half} ` : ''}${officialRange(x, u)}`).join(' · ')}`;
    return {kind: 'official', loFt: Math.min(...halves.map((x) => x.loFt)), hiFt: Math.max(...halves.map((x) => x.hiFt)), hours: offs.length, label, officialHalves: halves, basis: `the NWS surf zone forecast for ${first.zoneName}, ${halves.length > 1 ? 'a range for each half of the day' : 'one range for the day'}${offs.some((h) => h.stale) ? ' (older than its next scheduled issue)' : ''}`, typical: pickTypical('official')};
  }
  const off = heads.filter((h): h is Extract<HeadlineSurf, {kind: 'offshore'}> => h.kind === 'offshore').map((h) => h.ft);
  if (off.length) {
    const lo = Math.min(...off), hi = Math.max(...off);
    const a = formatWaveHeight({kind: 'offshore', valueFt: lo}, p, 'technical').text, b = formatWaveHeight({kind: 'offshore', valueFt: hi}, p, 'technical').text;
    return {kind: 'offshore', loFt: lo, hiFt: hi, hours: off.length, label: a === b ? `${b} offshore` : `${a.replace(` ${p.heightUnit}`, '')}–${b} offshore`, basis: `daylight hours, offshore height (not surf size)`, typical: pickTypical('offshore')};
  }
  return {kind: 'none', loFt: null, hiFt: null, hours: 0, label: null, basis: 'no daylight hours with a height', typical: null};
}

import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import type {OceanBundle, TidePrediction} from '../ocean/types.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {distanceKm} from '../ocean/mop.ts';
import {pacificDate, pacificHour} from '../ocean/time.ts';
import {solarTimes} from '../ocean/sun.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {headlineText, type HeadlineSurf} from './headlineSurf.ts';
import {currentRecord} from './spotStrip.ts';
import {spotHourOf} from './spotHour.ts';
import {windowRanges, WINDOW_MIN_SCORE} from './windows.ts';

/** Data for the Home dashboard (T-047). Pure; each card says only what the data supports, and the rating is the existing one (the surf estimate never feeds it). */
export interface DashCard {
  id: string; name: string; region: string; demo: boolean; validTime: string | null;
  surf: {headline: HeadlineSurf; value: string; label: string; words: string | null; tag: string; offshoreLabel: string | null; /** T-118: the confidence word and its reason (estimates only). */ confidenceText?: string; confidenceDetail?: string};
  rating: {category: string; score: number | null; bars: number};
  wind: {label: string; relation: string} | null;
  tide: {state: 'rising' | 'falling' | 'unknown'; label: string | null} | null;
  window: {label: string; category: string; start: string; end: string} | null;
}
export interface DashContext {bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null; extrema?: TidePrediction[]}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const hourFmt = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric'});
/** "7 AM" → "7"; the window label spells am/pm once at the end: "7–10 AM", "11 AM–2 PM". */
export function windowLabel(startMs: number, endMs: number): string {
  const a = hourFmt.format(new Date(startMs)), b = hourFmt.format(new Date(endMs)), [an, ap] = a.split(' '), [bn, bp] = b.split(' ');
  return ap === bp ? `${an}–${bn} ${bp}` : `${a}–${b}`;
}
/** Filled segments of a 5-segment bar for a 0–100 score; unrated is empty. */
export const ratingBars = (score: number | null | undefined) => (finite(score) && score > 0 ? Math.min(5, Math.max(1, Math.ceil(score / 20))) : 0);

/** The best remaining window today (Pacific) for one spot: hours rated at or above the window threshold, the highest-scoring run. Null when none qualifies. */
export function bestWindowToday(spot: SurfSpot, records: Forecast[], now: number): DashCard['window'] {
  const today = pacificDate(new Date(now).toISOString());
  // Daylight only (civil twilight, approximate): a window in the dark is not a surf window.
  const ev = evidenceSpots.find((e) => e.id === spot.id), civil = solarTimes(today, ev?.latitude ?? 37.76, ev?.longitude ?? -122.51, 96);
  const hours = records.filter((f) => { const t = Date.parse(f.timestamp); return f.spotId === spot.id && pacificDate(f.timestamp) === today && t + 3600000 > now && t >= civil.rise && t + 3600000 <= civil.set + 3600000; });
  const ranges = windowRanges(hours, (f) => ({timestamp: f.timestamp, score: rateForecast(spot, f, now).score}), WINDOW_MIN_SCORE, 10);
  const best = ranges.sort((a, b) => b.peakScore - a.peakScore || Date.parse(a.start.timestamp) - Date.parse(b.start.timestamp))[0];
  if (!best) return null;
  const s = Date.parse(best.start.timestamp), e = Date.parse(best.end.timestamp) + 3600000;
  return {label: windowLabel(s, e), category: String(rateForecast(spot, best.peak, now).category), start: best.start.timestamp, end: new Date(e).toISOString()};
}

/** `now` picks the hour the card stands for; `clockMs` is the REAL clock the freshness rule, the rating and the lead time are judged at (T-107: a ranking for 3 h ahead or tomorrow morning passed the ranked hour as "now",
 *  so a forecast retrieved a few minutes later than the top of the hour read as future-dated and every row said "stale estimate"). Defaults to `now` for the cards that are about the current hour. */
export function dashCard(spot: SurfSpot, records: Forecast[], now: number, profile: UserProfile, ctx: DashContext = {}, clockMs: number = now): DashCard {
  const mine = records.filter((f) => f.spotId === spot.id), cur = currentRecord(mine, spot.id, now);
  const base = {id: spot.id, name: spot.name, region: spot.region};
  if (!cur) return {...base, demo: false, validTime: null, surf: {headline: {kind: 'none', label: 'No forecast data'}, value: '—', label: 'No forecast data', words: null, tag: 'none', offshoreLabel: null}, rating: {category: 'UNRATED', score: null, bars: 0}, wind: null, tide: null, window: null};
  // One hour object (T-055): the same surf range, rating, wind and tide every other surface shows for this spot and hour.
  const hr = spotHourOf(spot, cur, clockMs, profile, ctx), headline = hr.surf.headline, text = hr.surf, rating = hr.rating;
  const offshore = headline.kind === 'estimate' && finite(cur.offshore) ? headlineText({kind: 'offshore', ft: cur.offshore, label: 'offshore · not surf size'}, profile).label : null;
  return {
    ...base, demo: hr.demo, validTime: hr.validTime,
    surf: {headline, value: text.value, label: text.label, words: text.words, tag: text.tag, offshoreLabel: offshore, confidenceText: text.confidenceText, confidenceDetail: text.confidenceDetail},
    rating: {category: String(rating.category), score: finite(rating.score) ? rating.score : null, bars: ratingBars(rating.score)},
    wind: hr.wind ? {label: hr.wind.label, relation: hr.wind.relation} : null,
    tide: hr.tide ? {state: hr.tide.state, label: hr.tide.heightLabel} : null,
    window: bestWindowToday(spot, mine, now),
  };
}

export interface NearbyItem {card: DashCard; km: number}
/** Best rated spots right now within `radiusKm` of a reference spot, highest rating first. Unrated, demonstration and excluded spots are left out; ties keep the nearer first. */
export function bestNearby(spots: SurfSpot[], records: Forecast[], now: number, profile: UserProfile, refId: string, opts: {exclude?: string[]; limit?: number; radiusKm?: number; ctx?: DashContext} = {}): NearbyItem[] {
  const ref = evidenceSpots.find((e) => e.id === refId); if (!ref) return [];
  const {exclude = [], limit = 5, radiusKm = 100, ctx} = opts, out: NearbyItem[] = [];
  for (const s of spots) {
    if (exclude.includes(s.id) || s.id === refId && exclude.includes(refId)) continue;
    const ev = evidenceSpots.find((e) => e.id === s.id); if (!ev) continue;
    const km = distanceKm(ref.latitude, ref.longitude, ev.latitude, ev.longitude); if (km > radiusKm) continue;
    const card = dashCard(s, records, now, profile, ctx);
    if (card.demo || card.rating.score === null || card.validTime === null) continue;
    out.push({card, km: Math.round(km)});
  }
  return out.sort((a, b) => (b.card.rating.score as number) - (a.card.rating.score as number) || a.km - b.km).slice(0, limit);
}

/** One hour of the mini rating ribbon: the existing rating at that exact hour, or null when there is no record for it (no interpolation). */
export interface RibbonHour {iso: string; score: number | null; category: string | null; bars: number}
export function ribbon12(spot: SurfSpot, records: Forecast[], now: number, hours = 12): RibbonHour[] {
  const start = Math.floor(now / 3600000) * 3600000, byTime = new Map<number, Forecast>();
  for (const f of records) if (f.spotId === spot.id) byTime.set(Date.parse(f.timestamp), f);
  return Array.from({length: hours}, (_, i) => {
    const t = start + i * 3600000, f = byTime.get(t), iso = new Date(t).toISOString();
    if (!f) return {iso, score: null, category: null, bars: 0};
    const r = rateForecast(spot, f, now);
    return {iso, score: finite(r.score) ? r.score : null, category: finite(r.score) ? String(r.category) : null, bars: ratingBars(r.score)};
  });
}

export type RankWhen = 'now' | '3h' | 'tomorrow-am';
export const RANK_LABEL: Record<RankWhen, {tab: string; title: string}> = {now: {tab: 'Right now', title: 'Best right now nearby'}, '3h': {tab: 'In 3 h', title: 'Best in 3 hours nearby'}, 'tomorrow-am': {tab: 'Tomorrow AM', title: 'Best tomorrow morning nearby'}};
/** T-099: the Pacific date of the next morning: today before 6 AM (after midnight the next daylight is this morning, not tomorrow's), else tomorrow.
 *  Home's "morning" ranking and Compare spots' night-time opening hour both use it. */
export function nextMorningKey(now: number): string {
  return pacificHour(new Date(now).toISOString()) < 6 ? pacificDate(new Date(now).toISOString()) : pacificDate(new Date(now + 86400000).toISOString());
}
/** The morning tab's words: "This morning" before 6 AM (the morning meant is today's), otherwise "Tomorrow AM". */
export const rankLabel = (w: RankWhen, now: number): {tab: string; title: string} =>
  w === 'tomorrow-am' && pacificHour(new Date(now).toISOString()) < 6 ? {tab: 'This morning', title: 'Best this morning nearby'} : RANK_LABEL[w];
/** Compare spots at night (T-099, T-100): the NEXT daylight hour (not dark at the reference spot), today's included, as long as it falls before noon Pacific; otherwise null.
 *  No fixed 6 AM cutoff: when first light is after 6 the hour is still found today instead of a day later. */
export function nextMorningHour(times: string[], now: number, dark: (iso: string) => boolean): string | null {
  const first = times.find((iso) => Date.parse(iso) > now && !dark(iso));
  return first && pacificHour(first) <= 11 ? first : null;
}
/** The hour a spot is judged at for a ranking: now, three hours on (both exact hours), or the best-rated hour between 6 and 11 AM Pacific on the next morning (nextMorningKey). Null when that spot has no such hour. */
export function rankHour(spot: SurfSpot, records: Forecast[], now: number, when: RankWhen): number | null {
  const top = Math.floor(now / 3600000) * 3600000;
  const mine = records.filter((f) => f.spotId === spot.id);
  if (when === 'now') return mine.some((f) => Date.parse(f.timestamp) === top) ? top : null;
  if (when === '3h') return mine.some((f) => Date.parse(f.timestamp) === top + 3 * 3600000) ? top + 3 * 3600000 : null;
  const key = nextMorningKey(now);
  let best: number | null = null, bs = -Infinity;
  for (const f of mine) { if (pacificDate(f.timestamp) !== key) continue; const h = pacificHour(f.timestamp); if (h < 6 || h > 11) continue; const s = rateForecast(spot, f, now).score; if (finite(s) && s > bs) { bs = s; best = Date.parse(f.timestamp); } }
  return best;
}
/** Like bestNearby, judged at `when`. Each item also says which hour it was judged at. */
export function bestNearbyAt(spots: SurfSpot[], records: Forecast[], now: number, profile: UserProfile, refId: string, when: RankWhen, opts: {exclude?: string[]; limit?: number; radiusKm?: number; ctx?: DashContext} = {}): (NearbyItem & {at: string})[] {
  const ref = evidenceSpots.find((e) => e.id === refId); if (!ref) return [];
  const {exclude = [], limit = 5, radiusKm = 100, ctx} = opts, out: (NearbyItem & {at: string})[] = [];
  for (const s of spots) {
    if (exclude.includes(s.id)) continue;
    const ev = evidenceSpots.find((e) => e.id === s.id); if (!ev) continue;
    const km = distanceKm(ref.latitude, ref.longitude, ev.latitude, ev.longitude); if (km > radiusKm) continue;
    const t = rankHour(s, records, now, when); if (t === null) continue;
    const card = dashCard(s, records, t, profile, ctx, now);
    if (card.demo || card.rating.score === null || card.validTime === null) continue;
    out.push({card, km: Math.round(km), at: card.validTime});
  }
  return out.sort((a, b) => (b.card.rating.score as number) - (a.card.rating.score as number) || a.km - b.km).slice(0, limit);
}

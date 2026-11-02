import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import type {OceanBundle, TidePrediction} from '../ocean/types.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {distanceKm} from '../ocean/mop.ts';
import {pacificDate} from '../ocean/time.ts';
import {solarTimes} from '../ocean/sun.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {headlineSurf, headlineText, type HeadlineSurf} from './headlineSurf.ts';
import {currentRecord} from './spotStrip.ts';
import {spotReport} from './spotReport.ts';
import {windowRanges, WINDOW_MIN_SCORE} from './windows.ts';

/** Data for the Home dashboard (T-047). Pure; each card says only what the data supports, and the rating is the existing one (the surf estimate never feeds it). */
export interface DashCard {
  id: string; name: string; region: string; demo: boolean; validTime: string | null;
  surf: {headline: HeadlineSurf; value: string; label: string; words: string | null; tag: string; offshoreLabel: string | null};
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

export function dashCard(spot: SurfSpot, records: Forecast[], now: number, profile: UserProfile, ctx: DashContext = {}): DashCard {
  const mine = records.filter((f) => f.spotId === spot.id), cur = currentRecord(mine, spot.id, now);
  const base = {id: spot.id, name: spot.name, region: spot.region};
  if (!cur) return {...base, demo: false, validTime: null, surf: {headline: {kind: 'none', label: 'No forecast data'}, value: '—', label: 'No forecast data', words: null, tag: 'none', offshoreLabel: null}, rating: {category: 'UNRATED', score: null, bars: 0}, wind: null, tide: null, window: null};
  const headline = headlineSurf(spot.id, cur, {bundle: ctx.bundle, nowMs: now}), text = headlineText(headline, profile);
  const rating = rateForecast(spot, cur, now), rep = spotReport(spot, mine, now, profile, ctx.extrema).headline;
  const offshore = headline.kind === 'estimate' && finite(cur.offshore) ? headlineText({kind: 'offshore', ft: cur.offshore, label: 'offshore · not surf size'}, profile).label : null;
  return {
    ...base, demo: !cur.evidence, validTime: cur.timestamp,
    surf: {headline, value: text.value, label: text.label, words: text.words, tag: text.tag, offshoreLabel: offshore},
    rating: {category: String(rating.category), score: finite(rating.score) ? rating.score : null, bars: ratingBars(rating.score)},
    wind: rep.wind ? {label: rep.wind.label, relation: rep.wind.relation} : null,
    tide: rep.tide ? {state: rep.tide.state, label: rep.tide.heightLabel} : null,
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

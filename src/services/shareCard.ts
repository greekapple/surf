import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {dateIn, fmtIn} from '../ocean/time.ts';
import {timeZoneOf} from '../ocean/spotZone.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {tideStationFor, SF_STATION, hourlyTideStationIds} from '../ocean/tideStations.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {compass, wind as windText} from '../utils/units.ts';
import {spotHourOf, recordAt, dayRange} from './spotHour.ts';
import {windowLabel} from './homeDash.ts';
import {windowHour, WINDOW_DAYS, type Call} from './call.ts';
import {isDark} from './daylight.ts';
import {hourFreshness, staleWord} from './freshness.ts';
import {shownPartitions} from './swellParts.ts';
import {hawaiianScaleNote} from './sharePlan.ts';
import {FLAT_LABEL} from './headlineSurf.ts';
import {dayCertainty} from './certainty.ts';

/** The condensed share card (user, 2026-11-11: "like sending a Wordle"): a few lines of plain text with emoji, and the same content drawn as a PNG (ui/shareImage.ts).
 *  Same rules as sharePlanFor (services/sharePlan.ts), which it extends:
 *  - every value is the spot page's own displayed value for ONE hour (the window's first hour, the current hour when the window is already running; with no window, the current hour, or after dark
 *    the next daylight day's best hour (Call.nextDay)), in the person's units, with the page's own wording: the surf headline and its estimate tag (shortened only: "model est.", "stale est.", "saved est.",
 *    the buoy-correction tag, "tuned to your N reports", "models differ"; the confidence word is left to the linked page), "not Hawaiian scale" on Hawaii spots, the wind's own shore relation
 *    (never "offshore" unless the app labels it so), and the tide from the one tide accessor (spotHour.ts tideOf) with its station named;
 *  - with no window the card says the call's own horizon and reason ("no window next 4 days: <the call's first reason>"), never "in this forecast";
 *  - a field the app has no value for is left out, never filled in; an offshore height is never shared (an offshore-only spot says it has no surf estimate);
 *  - nothing in demonstration mode (null).
 *  The day row: one square per local day at the spot (up to 7, never padded), coloured by that day's best DAYLIGHT rating from the hour on (the app's rating bands, features/forecast/model.ts bandOf;
 *  poor is the app's neutral grey, so ⬛), ⬜ for no rating. Days past the certainty horizon (the week grid's rule: certainty.ts dayCertainty 'too-far') are not coloured: they follow a separator as
 *  ⬜ "too far out". The rating is provisional and not a go call; the row says so. */
export type DayBand = 'good' | 'fair' | 'poor' | 'none';
export const DAY_EMOJI: Record<DayBand, string> = {good: '🟩', fair: '🟨', poor: '⬛', none: '⬜'};
export const TOO_FAR_EMOJI = '⬜';
/** The app's rating bands (features/forecast/model.ts bandOf; that module is not loadable outside the bundle). */
export function bandOfCategory(category: string): DayBand {
  if (['EPIC', 'FIRING', 'GOOD', 'SOLID'].includes(category)) return 'good';
  if (['NOT BAD', 'SURFABLE'].includes(category)) return 'fair';
  return category === 'UNRATED' ? 'none' : 'poor';
}
export interface ShareDay {dateKey: string; dow: string; band: DayBand; category: string | null; /** past the certainty horizon: not coloured */ tooFar: boolean}
export interface ShareCard {
  title: string; url: string; spot: string; /** "Sat 7–10 AM PST", "Now, Sat 2 PM PST", "Thu 8 AM PST (tomorrow's best hour)" */ when: string; /** "at 7 AM" inside a window */ at: string;
  /** the hour the numbers are for, "Wed 11 AM PST" */ numbersFor: string; noWindow: boolean; /** "No window next 4 days: <reason>" */ noWindowText: string | null;
  rating: string | null; /** the surf line: `main` is the number (or the no-estimate words), `tags` its estimate tags */ surf: {main: string; tags: string[]} | null; swell: string | null; wind: string | null;
  tide: {main: string; source: string; datum: string} | null;
  days: ShareDay[]; daysLabel: string | null; /** when the card was shared, in the spot's clock: `generated` long, `sharedShort` "11:20 AM" */ generated: string; sharedShort: string; text: string;
}
const HOUR = 3600000;
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const SHORT_TAG: Record<string, string> = {'model estimate': 'model est.', 'stale estimate': 'stale est.', 'saved estimate': 'saved est.'};
const latLon = (spot: SurfSpot): [number, number] => { const e = evidenceSpots.find((x) => x.id === spot.id); return e ? [e.latitude, e.longitude] : [37.76, -122.51]; };
const zoneOfAt = (tz: string, d: Date) => fmtIn(tz, {timeZoneName: 'short'}).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';
/** The call's reason, shortened without losing its meaning: the first sentence, "The estimated 10–13 ft" → "10–13 ft", no closing full stop. */
export const shortReason = (why: string | null | undefined): string | null => {
  if (!why) return null;
  const first = (why.match(/^.*?[.!?](\s|$)/)?.[0] ?? why).trim().replace(/[.]$/, '');
  return first.replace(/^The estimated /, '').replace(/^It is dark, so it is not a surf window$/, 'after dark');
};

/** The day row: best daylight rating per local day from the current hour on, up to `max` days, stopping where the forecast stops. */
export function bestEachDay(spot: SurfSpot, records: Forecast[], nowMs: number, max = 7, profile?: UserProfile, bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null): ShareDay[] {
  const tz = timeZoneOf(spot), from = Math.floor(nowMs / HOUR) * HOUR;
  const mine = records.filter((f) => f.spotId === spot.id && Date.parse(f.timestamp) >= from).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const byDay = new Map<string, {light: number; best: {score: number; category: string} | null}>();
  for (const f of mine) {
    const k = dateIn(tz, f.timestamp); if (!byDay.has(k)) byDay.set(k, {light: 0, best: null});
    if (isDark(spot.id, f.timestamp)) continue;
    const d = byDay.get(k)!, r = rateForecast(spot, f, nowMs); d.light++;
    if (r.score !== null && String(r.category) !== 'UNRATED' && (!d.best || r.score > d.best.score)) d.best = {score: r.score, category: String(r.category)};
  }
  // a day with no daylight hour left in the forecast (today after last light, the forecast's last night) is not a day of the row: never a padded white square
  const keys = [...byDay.keys()].filter((k) => byDay.get(k)!.light > 0).slice(0, max);
  const all = records.filter((f) => f.spotId === spot.id);
  return keys.map((k) => {
    const b = byDay.get(k)!.best;
    // the week grid's horizon rule: the day's typical (midday) hour past HORIZON_HOURS is "too far out"
    const tooFar = !!profile && dayCertainty(spot.id, dayRange(spot, all, k, nowMs, profile, {bundle}), nowMs)?.level === 'too-far';
    return {dateKey: k, dow: fmtIn('UTC', {weekday: 'short'}).format(new Date(`${k}T12:00:00Z`)), band: b ? bandOfCategory(b.category) : 'none', category: b ? b.category : null, tooFar};
  });
}
/** The text's day row: coloured squares, then the too-far days as ⬜ after a separator. */
export const dayRowText = (days: ShareDay[]) => {
  const near = days.filter((d) => !d.tooFar).map((d) => DAY_EMOJI[d.band]).join(''), far = days.filter((d) => d.tooFar).length;
  return [near || null, far ? `${TOO_FAR_EMOJI.repeat(far)} too far out` : null].filter(Boolean).join(' · ');
};

/** The card for a spot. `call` is the Call the Share sits beside; `fallbackNow` (the spot page header) shares the current hour when there is no window, saying so with the call's reason;
 *  without it, no window = nothing to share (as sharePlanFor). */
export function shareCardFor(spot: SurfSpot, call: Pick<Call, 'verdict' | 'window' | 'nextWindow' | 'why' | 'nextDay'>, records: Forecast[], profile: UserProfile, nowMs: number, slug: string, origin = '', bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null, opts: {fallbackNow?: boolean} = {}): ShareCard | null {
  const tz = timeZoneOf(spot), nowHour = Math.floor(nowMs / HOUR) * HOUR;
  const w = call.verdict !== 'Dark' && call.window ? call.window : call.nextWindow;
  let startMs: number, end: number | null = null, rec: Forecast | undefined, tomorrow = false;
  if (w && Math.max(Date.parse(w.start), nowHour) < Date.parse(w.end)) {
    end = Date.parse(w.end); startMs = Math.max(Date.parse(w.start), nowHour);
    rec = windowHour(records, spot.id, {start: new Date(startMs).toISOString()});
  } else {
    if (!opts.fallbackNow) return null;
    // after dark with no window: the next daylight day's best hour (the call's own nextDay), not the dark hour
    if (call.verdict === 'Dark' && call.nextDay) { rec = recordAt(records, spot.id, Date.parse(call.nextDay.at)); tomorrow = !!rec; }
    if (!rec) rec = recordAt(records, spot.id, nowMs);
    startMs = rec ? Date.parse(rec.timestamp) : nowHour;
  }
  if (!rec || !rec.evidence) return null;
  const hr = spotHourOf(spot, rec, nowMs, profile, {bundle}); if (hr.demo) return null;
  const at = new Date(startMs), zone = zoneOfAt(tz, at), z = zone ? ` ${zone}` : '';
  const day = fmtIn(tz, {weekday: 'short'}).format(at), hourWord = fmtIn(tz, {hour: 'numeric'}).format(at);
  const numbersFor = `${day} ${hourWord}${z}`;
  const noWindow = end === null;
  const when = !noWindow ? `${day} ${windowLabel(startMs, end!, tz)}${z}` : tomorrow ? `${numbersFor} (${call.nextDay!.when}'s best hour)` : `Now, ${numbersFor}`;
  const reason = noWindow ? shortReason(tomorrow ? call.nextDay!.reason : call.why?.[0]) : null;
  const noWindowText = noWindow ? `No window next ${WINDOW_DAYS} days${reason ? `: ${reason}` : ''}` : null;

  // rating: the Rating card's word, provisional (the card says so), and "after dark" where the card says it
  const r = hr.rating, dark = !!(r as {dark?: boolean}).dark;
  const rating = r.score !== null && String(r.category) !== 'UNRATED' ? `${titleCase(String(r.category))} (provisional${dark ? ', after dark' : ''})` : null;
  // surf: the headline value with its tags, shortened; an offshore height is never shared
  const h = hr.surf.headline;
  let surf: ShareCard['surf'] = null;
  if (h.kind === 'estimate' && hr.surf.value && hr.surf.value !== '—') {
    const n = h.calibration?.n;
    const tags = [SHORT_TAG[hr.surf.tag] ?? hr.surf.tag, h.transfer?.tag, h.calibration && !h.saved ? `tuned to your ${n ?? ''} report${n === 1 ? '' : 's'}`.replace('  ', ' ') : null, h.interval?.disagree ? 'models differ' : null].filter((x): x is string => !!x);
    surf = {main: hr.surf.value === FLAT_LABEL ? FLAT_LABEL : `${hr.surf.value} surf${hawaiianScaleNote(spot, profile)}`, tags};
  } else if (h.kind === 'offshore') surf = {main: 'no surf estimate here', tags: ['offshore model only']};
  // swell: the Swell card's first shown partition: period and direction (its height is an offshore height, so it is not shared)
  const part = shownPartitions([rec.primary, rec.secondary, rec.tertiary])[0];
  const swell = part && Number.isFinite(part.period) && Number.isFinite(part.direction) ? `${Math.round(part.period)} s ${compass(part.direction)} ${part.kind === 'chop' ? 'wind chop' : 'swell'}` : null;
  // wind: the Wind card's value, direction, stale mark and the app's own shore relation
  const fr = hourFreshness(rec, nowMs);
  const wind = hr.wind ? `${windText(hr.wind.mph, profile)} ${compass(hr.wind.dirDeg)}${fr.wind ? ` (${staleWord(fr.wind)})` : ''}${hr.wind.relation && hr.wind.relation !== 'unknown' ? `, ${hr.wind.relation}` : ''}` : null;
  // tide: the one tide accessor (spotHour.ts tideOf), only where the spot has a tide station (the spot page's Tide card shows the hourly value there), with the station named
  const [la, lo] = latLon(spot), station = tideStationFor({id: spot.id, latitude: la, longitude: lo});
  let tide: ShareCard['tide'] = null;
  if (station && hr.tide?.heightLabel && rec.availability?.tide !== false) {
    const t = hr.tide, value = t.heightLabel!.replace(/ · (stale|saved copy)$/, '').replace(/^-/, '−');
    // the spot page's own rule (SpotPage.tsx Tide card): SF and the hourly stations are NOAA's hourly prediction; the rest are a curve interpolated between NOAA's predicted highs and lows
    const sid = station.station.id, hourly = sid === SF_STATION || hourlyTideStationIds.includes(sid);
    const src = `${hourly ? 'NOAA pred.' : 'interp. from NOAA hi/lo'}, ${sid === SF_STATION ? 'SF' : station.station.name.split(',')[0]}`;
    tide = {main: `${value}${t.state !== 'unknown' ? ` ${t.state}` : ''}${t.stale ? ` (${staleWord(t.stale)})` : ''}`, source: src, datum: 'MLLW'};
  }

  const days = bestEachDay(spot, records, nowMs, 7, profile, bundle);
  const daysLabel = days.length ? `Best rating each day (provisional), ${days[0].dow}${days.length > 1 ? `–${days[days.length - 1].dow}` : ''}` : null;
  const shared = new Date(nowMs), generated = fmtIn(tz, {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}).format(shared);
  const sharedShort = fmtIn(tz, {hour: 'numeric', minute: '2-digit'}).format(shared);
  const hourIso = new Date(Math.floor(startMs / HOUR) * HOUR).toISOString().replace('.000Z', 'Z');
  const url = `${origin}/forecast?spot=${encodeURIComponent(slug)}&t=${hourIso}`;
  const surfText = surf ? `🌊 ${surf.main}${surf.tags.length ? ` (${surf.tags.join(', ')})` : ''}` : null;
  const lines = [
    `SWELLO · ${spot.name}`,
    [when, rating ? (noWindow ? rating : `at ${hourWord}: ${rating}`) : null, `shared ${sharedShort}`].filter(Boolean).join(' · '),
    noWindowText,
    [surfText, swell].filter(Boolean).join(' · ') || null,
    [wind ? `💨 ${wind}` : null, tide ? `tide ${tide.main} (${tide.source})` : null].filter(Boolean).join(' · ') || null,
    daysLabel ? `${daysLabel}: ${dayRowText(days)}` : null,
  ].filter((x): x is string => !!x);
  return {title: `${spot.name} · SWELLO`, url, spot: spot.name, when, at: noWindow ? '' : `at ${hourWord}`, numbersFor, noWindow, noWindowText, rating, surf, swell, wind, tide, days, daysLabel, generated, sharedShort, text: lines.join('\n')};
}
/** The text with the link on its own last line (clipboard, and a file share where some apps drop the separate url). */
export const shareTextWithLink = (c: ShareCard) => `${c.text}\n${c.url}`;

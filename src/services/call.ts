import type {Forecast, Skill, SurfSpot, UserProfile} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {pacificDate} from '../ocean/time.ts';
import {explainRating} from '../ratings/explain.ts';
import {daylightFor, isDark, clampToLight} from './daylight.ts';
import {spotHourOf, type SpotHour} from './spotHour.ts';
import {windowLabel} from './homeDash.ts';
import {formatWaveHeight} from '../utils/waveHeight.ts';
import {isFlat} from './flatSurf.ts';
import {breakerType, type BreakerEstimate} from './breaker.ts';

/** The Call (T-064): one verdict a surfer can act on, from OUR data only: the surf estimate, the rating, the wind, daylight and the user's skill.
 *  Nothing here is a measured fact or a validated accuracy; `basis` says what it is computed from. */
export type Verdict = 'Go' | 'Worth a look' | 'Skip' | 'Dark';
export interface CallWindow {start: string; end: string; label: string}
export interface Call {verdict: Verdict; window: CallWindow | null; nextWindow: CallWindow | null; why: string[]; basis: string; /** Estimated breaker type for this hour (label "est. breaker type"); type 'unknown' where the spot has no defensible slope. */ breaker: BreakerEstimate}
export interface CallContext {records: Forecast[]; bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null; nowMs: number}

/** Face-height range each skill is comfortable in, in feet. OUR OWN CHOICES (product rules, not a safety standard).
 *  Only the beginner ceiling has an outside anchor: Quiver's public example calls 5.2 ft "beyond the beginner safety range" and its beginner range starts at 0.5 ft;
 *  we use 4 ft as the ceiling, which is about "head high" in the body-word convention (OceanFit). The other bounds are our judgement, adjustable in one place. */
export const SKILL_RANGE_FT: Record<Skill, {min: number; max: number}> = {Beginner: {min: 1, max: 4}, Intermediate: {min: 1.5, max: 8}, Expert: {min: 2, max: 20}};
/** Wind that spoils the face regardless of size (mph). Onshore above ONSHORE_BAD or cross-shore above CROSS_BAD is a Skip; lighter onshore/cross is at most "Worth a look". Our own choices, in line with the rating's 3 and 8 mph rules. */
export const ONSHORE_BAD_MPH = 12, CROSS_BAD_MPH = 18;
export const GO_MIN_SCORE = 65, WORTH_MIN_SCORE = 50; // rating bands: SOLID starts at 65, NOT BAD at 55 (our own cut at 50 for "worth a look")

const fmt = (lo: number, hi: number, p: UserProfile) => formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: [lo, hi], rangeMethod: 'v2'}, p).text;

interface HourCall {verdict: Verdict; why: string[]; hour: SpotHour; breaker: BreakerEstimate}
/** Plain-language names and reasons for the rating factors (T-093). The engine's reason text stays available as a detail line. */
const PLAIN_FACTOR: Record<string, string> = {'Offshore wave potential': 'Swell energy', 'Wind influence': 'Wind', 'Swell alignment': 'Swell direction', 'Tide compatibility': 'Tide'};
const plainFactor = (name: string, _e: string) => PLAIN_FACTOR[name] ?? name;
const ENGINE_WORDS = /heuristic|combined hs|primary \d|\bhs\b|score|weight|using .*guide|wave potential/i;
export function plainReasonFor(i: {factor: string; effect: string; reason: string}): string {
  // The engine also subtracts points for combined Hs above 10 ft, so a low factor is not always a small swell (T-100): say "very large" when the reason's own Hs says so, else stay neutral.
  if (i.factor === 'Offshore wave potential') return i.effect === '-' ? (Number(/combined Hs (\d+(?:\.\d+)?) ft/i.exec(i.reason)?.[1]) > 10 ? 'The offshore swell is very large: the rating treats that much energy as unfavourable.' : 'The offshore swell energy rates low for this hour: small or short-period.') : i.effect === '~' ? 'The offshore swell is only moderate.' : 'The offshore swell looks good.';
  if (i.factor === 'Swell alignment') return i.effect === '-' ? 'The swell direction is a poor match for this beach.' : 'The swell direction is only a fair match for this beach.';
  if (i.factor === 'Tide compatibility') return 'The tide is not ideal for this spot.';
  return ENGINE_WORDS.test(i.reason) ? `${plainFactor(i.factor, i.effect)} is ${i.effect === '-' ? 'poor' : 'only fair'} for this hour.` : `${plainFactor(i.factor, i.effect)}: ${i.reason}`;
}
/** Verdict for ONE hour (no window). */
export function hourCall(spot: SurfSpot, f: Forecast, profile: UserProfile, ctx: CallContext): HourCall {
  const hr = spotHourOf(spot, f, ctx.nowMs, profile, {bundle: ctx.bundle}), h = hr.surf.headline, why: string[] = [];
  const breaker = breakerType(spot, f);
  if (isDark(spot.id, f.timestamp)) return {verdict: 'Dark', why: ['It is dark: before first light or after last light, so there is no rating.'], hour: hr, breaker};
  const r = SKILL_RANGE_FT[profile.skill] ?? SKILL_RANGE_FT.Intermediate, w = hr.wind, score = hr.rating.score;
  let verdict: Verdict = 'Go', sizeNote = '';
  // T-108: the person's OWN preferred range (Personal › Preferred conditions) is what the call names; the skill table stays the safety ceiling and floor (Skip) it never overrides.
  const lo0 = profile.minWave, hi0 = profile.maxWave, own = Number.isFinite(lo0) && Number.isFinite(hi0) && lo0 > 0 && hi0 > lo0 ? {min: lo0, max: hi0} : null;
  if (isFlat(h)) { verdict = 'Skip'; sizeNote = 'Flat (model estimate): the nearshore model has under half a foot here, so there is nothing to surf.'; } // T-130: never "the estimated 0–0 ft"
  else if (h.kind === 'estimate') {
    const range = fmt(h.loFt, h.hiFt, profile), who = profile.skill.toLowerCase();
    if (h.loFt > r.max) { verdict = 'Skip'; sizeNote = `The estimated ${range} is above the ${who} range (up to ${r.max} ft).`; }
    else if (h.hiFt < r.min) { verdict = 'Skip'; sizeNote = `The estimated ${range} is below the ${who} range (from ${r.min} ft): too small to surf well.`; }
    else if (h.hiFt > r.max * 1.15) { verdict = 'Worth a look'; sizeNote = `The estimated ${range} may be above the ${who} range (up to ${r.max} ft).`; }
    else if (h.loFt < r.min * 0.6 && h.hiFt < r.min * 1.6) { verdict = 'Worth a look'; sizeNote = `The estimated ${range} is small for the ${who} range.`; }
    else if (own && h.loFt > own.max) { verdict = 'Worth a look'; sizeNote = `The estimated ${range} is above the range you prefer (up to ${own.max} ft), though within the ${who} range.`; }
    else if (own && h.hiFt < own.min) { verdict = 'Worth a look'; sizeNote = `The estimated ${range} is below the range you prefer (from ${own.min} ft), though within the ${who} range.`; }
    else if (own && h.hiFt > own.max) sizeNote = `The estimated ${range} reaches above the range you prefer (up to ${own.max} ft).`;
    else if (own && h.loFt < own.min) sizeNote = `The estimated ${range} reaches below the range you prefer (from ${own.min} ft).`;
    else sizeNote = own ? `The estimated ${range} is within the range you prefer (${own.min}–${own.max} ft).` : `The estimated ${range} is within the ${who} range.`;
  } else sizeNote = 'No surf-size estimate for this spot, so size is not part of this call.';
  // Breaker type (T-064 addendum): a plunging break at size is for experienced surfers (our own rule; Surfing Online "Types of Waves" describes plunging waves as hollow, powerful and for experienced surfers). Spilling is forgiving.
  let breakerNote = '';
  if (breaker.type === 'plunging' && breaker.confidence === 'checked' && h.kind === 'estimate' && profile.skill !== 'Expert' && h.hiFt >= 4) { verdict = 'Skip'; breakerNote = `Plunging at ${fmt(h.loFt, h.hiFt, profile)}: experts only.`; }
  else if (breaker.type === 'plunging') breakerNote = 'Likely hollow, powerful.'; // an estimate: Call.breaker carries the label and the slope basis
  else if (breaker.type === 'spilling') breakerNote = 'Likely soft; check shorebreak.';
  let windNote = '';
  if (w) {
    const mph = w.mph;
    if (w.relation === 'onshore' && mph > ONSHORE_BAD_MPH) { verdict = 'Skip'; windNote = `Onshore wind at ${mph.toFixed(0)} mph will chop it up.`; }
    else if (w.relation === 'cross-shore' && mph > CROSS_BAD_MPH) { verdict = 'Skip'; windNote = `Cross-shore wind at ${mph.toFixed(0)} mph will chop it up.`; }
    else if ((w.relation === 'onshore' && mph > 3) || (w.relation === 'cross-shore' && mph > 8)) { if (verdict === 'Go') verdict = 'Worth a look'; windNote = `${w.relation === 'onshore' ? 'Onshore' : 'Cross-shore'} wind at ${mph.toFixed(0)} mph will roughen the face.`; }
    else if (w.relation === 'offshore' && mph <= 15) windNote = `${mph < 5 ? 'Light offshore' : 'Offshore'} wind: clean face.`;
    else if (w.relation === 'offshore') windNote = `Strong offshore wind at ${mph.toFixed(0)} mph: clean but gusty.`;
    else if (mph <= 3) windNote = 'Wind is nearly calm.';
  }
  if (score === null) { if (verdict === 'Go') verdict = 'Worth a look'; }
  else if (score < WORTH_MIN_SCORE) verdict = 'Skip';
  else if (score < GO_MIN_SCORE && verdict === 'Go') verdict = 'Worth a look';
  // the first sentence is the deciding reason in plain English
  const lead = verdict === 'Skip' ? (breakerNote && /experts only/.test(breakerNote) ? breakerNote : windNote && /chop/.test(windNote) ? windNote : sizeNote && !/within/.test(sizeNote) ? sizeNote : null)
    : verdict === 'Worth a look' ? (sizeNote && !/within/.test(sizeNote) ? sizeNote : windNote && /roughen/.test(windNote) ? windNote : null) : null;
  const ex = explainRating(hr.rating, {spotId: spot.id, wind: w ? {mph: w.mph, relation: w.relation} : null}), items = ex.items.filter((i) => i.inScore);
  const down = items.find((i) => i.effect === '-' || (i.effect === '~' && i.factor !== 'Rating ceiling')), ceiling = items.find((i) => i.factor === 'Rating ceiling'), up = items.find((i) => i.effect === '+');
  // T-093: the first plain reason is plain language; the rating engine's own wording (numbers, 'Heuristic', 'combined Hs') goes to the detail lines after it.
  const ratingSentence = ceiling ? ceiling.reason : verdict === 'Go' ? (up ? `${plainFactor(up.factor, '+')} is a plus.` : 'The rating is good for this hour.') : down ? plainReasonFor(down) : 'The rating is only middling for this hour.';
  const ratingDetail = !ceiling && verdict !== 'Go' && down ? `Rating detail, ${down.factor}: ${down.reason}` : '';
  if (lead) why.push(lead); else if (verdict === 'Go') why.push(`${windNote || 'Conditions line up'}${windNote ? '' : '.'} ${sizeNote}`.trim()); else why.push(ratingSentence);
  for (const s of [sizeNote, windNote, breakerNote, ratingSentence, ratingDetail]) if (s && !why.includes(s) && !/^$/.test(s)) why.push(s);
  return {verdict, why, hour: hr, breaker};
}

/** Best window on one Pacific day: the longest run of daylight hours with the same best verdict (Go, else Worth a look), highest peak first. */
export function windowOnDay(spot: SurfSpot, dateKey: string, profile: UserProfile, ctx: CallContext, fromMs = 0): CallWindow | null {
  const hours = ctx.records.filter((f) => f.spotId === spot.id && pacificDate(f.timestamp) === dateKey && Date.parse(f.timestamp) + 3600000 > fromMs).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const calls = hours.map((f) => ({f, c: hourCall(spot, f, profile, ctx)}));
  for (const want of ['Go', 'Worth a look'] as const) {
    const runs: {s: number; e: number; peak: number}[] = []; let cur: {s: number; e: number; peak: number} | null = null;
    for (const {f, c} of calls) {
      const t = Date.parse(f.timestamp), ok = c.verdict === want && (c.hour.rating.score ?? 0) >= 0;
      if (ok && cur && t === cur.e) { cur.e = t + 3600000; cur.peak = Math.max(cur.peak, c.hour.rating.score ?? 0); }
      else { if (ok) { cur = {s: t, e: t + 3600000, peak: c.hour.rating.score ?? 0}; runs.push(cur); } else cur = null; }
    }
    if (runs.length) { const b = runs.sort((x, y) => (y.e - y.s) - (x.e - x.s) || y.peak - x.peak || x.s - y.s)[0], [s, e] = clampToLight(spot.id, b.s, b.e); return {start: new Date(s).toISOString(), end: new Date(e).toISOString(), label: windowLabel(s, e)}; }
  }
  return null;
}

const dayName = (iso: string, nowMs: number) => {
  const d = pacificDate(iso), today = pacificDate(new Date(nowMs).toISOString());
  if (d === today) return 'today';
  if (d === pacificDate(new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString())) return 'tomorrow';
  return new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', weekday: 'long'}).format(new Date(iso));
};
/** The forecast hour that holds a window's start. A window may start at first light (e.g. 6:20), so never match the start time exactly. */
export function windowHour<T extends {spotId: string; timestamp: string}>(records: T[], spotId: string, w: {start: string}): T | undefined {
  const h0 = Math.floor(Date.parse(w.start) / 3600000) * 3600000;
  return records.find((f) => f.spotId === spotId && Date.parse(f.timestamp) === h0);
}
/** T-108: THE best-window function. The first window (same rule as the call's: longest run of daylight hours with the best verdict) that has not ended, looking `days` Pacific days ahead from `fromMs`.
 *  The spot page's call, Compare's "Best" column and Find spots use this one, so they cannot disagree. `when` is 'today' / 'tomorrow' / a weekday. */
export function bestWindowFrom(spot: SurfSpot, profile: UserProfile, ctx: CallContext, fromMs: number, days = 4): (CallWindow & {when: string}) | null {
  const day0 = pacificDate(new Date(fromMs).toISOString());
  for (let i = 0; i < days; i++) {
    const d = pacificDate(new Date(Date.parse(`${day0}T12:00:00Z`) + i * 86400000).toISOString()), w = windowOnDay(spot, d, profile, ctx, fromMs);
    if (w && Date.parse(w.end) > ctx.nowMs) return {...w, when: dayName(w.start, ctx.nowMs)}; // today's window still ahead (before first light) counts
  }
  return null;
}
/** The call for a spot-hour: its verdict, the best window on that Pacific day (if daylight remains), the next window when it is dark or today's has passed, and why. */
export function callFor(spot: SurfSpot, hour: Forecast, profile: UserProfile, ctx: CallContext): Call {
  const hc = hourCall(spot, hour, profile, ctx), day = pacificDate(hour.timestamp), from = Math.max(ctx.nowMs, Date.parse(hour.timestamp));
  const window = windowOnDay(spot, day, profile, ctx, Math.min(ctx.nowMs, Date.parse(hour.timestamp)));
  const passed = !window || Date.parse(window.end) <= ctx.nowMs;
  let nextWindow: CallWindow | null = null;
  if (hc.verdict === 'Dark' || passed) { const w = bestWindowFrom(spot, profile, ctx, Math.max(from, ctx.nowMs)); if (w) nextWindow = {start: w.start, end: w.end, label: w.label}; }
  const dayWord = nextWindow ? dayName(nextWindow.start, ctx.nowMs) : '';
  const why = hc.verdict === 'Dark' ? [nextWindow ? `It is dark. The next window is ${dayWord} ${nextWindow.label}.` : 'It is dark, and no good window is forecast in the next few days.'] : hc.why;
  const dl = daylightFor(spot.id, day), basis = `From the surf estimate, the rating (explainRating), wind, daylight (first light ${new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit'}).format(new Date(dl.firstLight))}, last light ${new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit'}).format(new Date(dl.lastLight))}) and your skill (${profile.skill}). Our own rules, not a measured or validated forecast.`;
  return {verdict: hc.verdict, window: hc.verdict === 'Dark' ? null : window, nextWindow, why, basis, breaker: hc.breaker};
}

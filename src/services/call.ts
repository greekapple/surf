import type {Forecast, Skill, SurfSpot, UserProfile} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {pacificDate} from '../ocean/time.ts';
import {explainRating} from '../ratings/explain.ts';
import {daylightFor, isDark} from './daylight.ts';
import {spotHourOf, type SpotHour} from './spotHour.ts';
import {windowLabel} from './homeDash.ts';
import {formatWaveHeight} from '../utils/waveHeight.ts';
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
/** Verdict for ONE hour (no window). */
export function hourCall(spot: SurfSpot, f: Forecast, profile: UserProfile, ctx: CallContext): HourCall {
  const hr = spotHourOf(spot, f, ctx.nowMs, profile, {bundle: ctx.bundle}), h = hr.surf.headline, why: string[] = [];
  const breaker = breakerType(spot, f);
  if (isDark(spot.id, f.timestamp)) return {verdict: 'Dark', why: ['It is dark: before first light or after last light, so there is no rating.'], hour: hr, breaker};
  const r = SKILL_RANGE_FT[profile.skill] ?? SKILL_RANGE_FT.Intermediate, w = hr.wind, score = hr.rating.score;
  let verdict: Verdict = 'Go', sizeNote = '';
  if (h.kind === 'estimate') {
    const range = fmt(h.loFt, h.hiFt, profile), who = profile.skill.toLowerCase();
    if (h.loFt > r.max) { verdict = 'Skip'; sizeNote = `The estimated ${range} is above the ${who} range (up to ${r.max} ft).`; }
    else if (h.hiFt < r.min) { verdict = 'Skip'; sizeNote = `The estimated ${range} is below the ${who} range (from ${r.min} ft): too small to surf well.`; }
    else if (h.hiFt > r.max * 1.15) { verdict = 'Worth a look'; sizeNote = `The estimated ${range} may be above the ${who} range (up to ${r.max} ft).`; }
    else if (h.loFt < r.min * 0.6 && h.hiFt < r.min * 1.6) { verdict = 'Worth a look'; sizeNote = `The estimated ${range} is small for the ${who} range.`; }
    else sizeNote = `The estimated ${range} is within the ${who} range.`;
  } else sizeNote = 'No surf-size estimate for this spot, so size is not part of this call.';
  // Breaker type (T-064 addendum): a plunging break at size is for experienced surfers (our own rule; Surfing Online "Types of Waves" describes plunging waves as hollow, powerful and for experienced surfers). Spilling is forgiving.
  let breakerNote = '';
  if (breaker.type === 'plunging' && breaker.confidence === 'checked' && h.kind === 'estimate' && profile.skill !== 'Expert' && h.hiFt >= 4) { verdict = 'Skip'; breakerNote = `Plunging (est.) and ${fmt(h.loFt, h.hiFt, profile)}: experienced surfers only.`; }
  else if (breaker.type === 'plunging') breakerNote = 'Plunging breaker (est. from a mean seabed slope, not the slope at the break): likely hollow and powerful.';
  else if (breaker.type === 'spilling') breakerNote = 'Spilling breaker (est. from a mean seabed slope, not the slope at the break): likely soft, but check the shorebreak.';
  let windNote = '';
  if (w) {
    const mph = w.mph;
    if (w.relation === 'onshore' && mph > ONSHORE_BAD_MPH) { verdict = 'Skip'; windNote = `Onshore wind at ${mph.toFixed(0)} mph will chop it up.`; }
    else if (w.relation === 'cross-shore' && mph > CROSS_BAD_MPH) { verdict = 'Skip'; windNote = `Cross-shore wind at ${mph.toFixed(0)} mph will chop it up.`; }
    else if ((w.relation === 'onshore' && mph > 3) || (w.relation === 'cross-shore' && mph > 8)) { if (verdict === 'Go') verdict = 'Worth a look'; windNote = `${w.relation === 'onshore' ? 'Onshore' : 'Cross-shore'} wind at ${mph.toFixed(0)} mph will roughen the face.`; }
    else if (w.relation === 'offshore' && mph <= 15) windNote = `${mph < 5 ? 'Light' : 'Offshore'} offshore wind: clean face.`;
    else if (w.relation === 'offshore') windNote = `Strong offshore wind at ${mph.toFixed(0)} mph: clean but gusty.`;
    else if (mph <= 3) windNote = 'Wind is nearly calm.';
  }
  if (score === null) { if (verdict === 'Go') verdict = 'Worth a look'; }
  else if (score < WORTH_MIN_SCORE) verdict = 'Skip';
  else if (score < GO_MIN_SCORE && verdict === 'Go') verdict = 'Worth a look';
  // the first sentence is the deciding reason in plain English
  const lead = verdict === 'Skip' ? (breakerNote && /experienced/.test(breakerNote) ? breakerNote : windNote && /chop/.test(windNote) ? windNote : sizeNote && !/within/.test(sizeNote) ? sizeNote : null)
    : verdict === 'Worth a look' ? (sizeNote && !/within/.test(sizeNote) ? sizeNote : windNote && /roughen/.test(windNote) ? windNote : null) : null;
  const ex = explainRating(hr.rating, {spotId: spot.id, wind: w ? {mph: w.mph, relation: w.relation} : null}), items = ex.items.filter((i) => i.inScore);
  const down = items.find((i) => i.effect === '-' || (i.effect === '~' && i.factor !== 'Rating ceiling')), ceiling = items.find((i) => i.factor === 'Rating ceiling'), up = items.find((i) => i.effect === '+');
  const ratingSentence = ceiling ? ceiling.reason : verdict === 'Go' ? (up ? `${up.factor} is a plus.` : 'The rating is good for this hour.') : down ? `${down.factor}: ${down.reason}` : 'The rating is only middling for this hour.';
  if (lead) why.push(lead); else if (verdict === 'Go') why.push(`${windNote || 'Conditions line up'}${windNote ? '' : '.'} ${sizeNote}`.trim()); else why.push(ratingSentence);
  for (const s of [sizeNote, windNote, breakerNote, ratingSentence]) if (s && !why.includes(s) && !/^$/.test(s)) why.push(s);
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
    if (runs.length) { const b = runs.sort((x, y) => (y.e - y.s) - (x.e - x.s) || y.peak - x.peak || x.s - y.s)[0]; return {start: new Date(b.s).toISOString(), end: new Date(b.e).toISOString(), label: windowLabel(b.s, b.e)}; }
  }
  return null;
}

const dayName = (iso: string, nowMs: number) => {
  const d = pacificDate(iso), today = pacificDate(new Date(nowMs).toISOString());
  if (d === today) return 'today';
  if (d === pacificDate(new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString())) return 'tomorrow';
  return new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', weekday: 'long'}).format(new Date(iso));
};
/** The call for a spot-hour: its verdict, the best window on that Pacific day (if daylight remains), the next window when it is dark or today's has passed, and why. */
export function callFor(spot: SurfSpot, hour: Forecast, profile: UserProfile, ctx: CallContext): Call {
  const hc = hourCall(spot, hour, profile, ctx), day = pacificDate(hour.timestamp), from = Math.max(ctx.nowMs, Date.parse(hour.timestamp));
  const window = windowOnDay(spot, day, profile, ctx, Math.min(ctx.nowMs, Date.parse(hour.timestamp)));
  const passed = !window || Date.parse(window.end) <= ctx.nowMs;
  let nextWindow: CallWindow | null = null;
  if (hc.verdict === 'Dark' || passed) {
    for (let i = 0; i < 4 && !nextWindow; i++) {
      const d = pacificDate(new Date(Date.parse(`${day}T12:00:00Z`) + i * 86400000).toISOString()), w = windowOnDay(spot, d, profile, ctx, Math.max(from, ctx.nowMs));
      if (w && Date.parse(w.end) > ctx.nowMs) nextWindow = w; // today's window still ahead (before first light) counts
    }
  }
  const dayWord = nextWindow ? dayName(nextWindow.start, ctx.nowMs) : '';
  const why = hc.verdict === 'Dark' ? [nextWindow ? `It is dark. The next window is ${dayWord} ${nextWindow.label}.` : 'It is dark, and no good window is forecast in the next few days.'] : hc.why;
  const dl = daylightFor(spot.id, day), basis = `From the surf estimate, the rating (explainRating), wind, daylight (first light ${new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit'}).format(new Date(dl.firstLight))}, last light ${new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit'}).format(new Date(dl.lastLight))}) and your skill (${profile.skill}). Our own rules, not a measured or validated forecast.`;
  return {verdict: hc.verdict, window: hc.verdict === 'Dark' ? null : window, nextWindow, why, basis, breaker: hc.breaker};
}

import type {Forecast, Skill, SurfSpot, UserProfile} from '../models/index.ts';
import {isLevel, levelInfo, PLUNGING_OK_FROM} from './skillLevels.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {dateIn, addDaysKey, fmtIn} from '../ocean/time.ts';
import {timeZoneOf} from '../ocean/spotZone.ts';
import {explainRating} from '../ratings/explain.ts';
import {ONSHORE_BAD_MPH} from '../ratings/windRules.ts';
import {wind as windText} from '../utils/units.ts';
import {daylightFor, isDark, clampToLight} from './daylight.ts';
import {spotHourOf, type SpotHour} from './spotHour.ts';
import {windowLabel} from './homeDash.ts';
import {formatWaveHeight} from '../utils/waveHeight.ts';
import {isFlat} from './flatSurf.ts';
import {breakerType, type BreakerEstimate} from './breaker.ts';

/** The Call (T-064): one verdict a surfer can act on, from OUR data only: the surf estimate, the rating, the wind, daylight and the user's skill.
 *  Nothing here is a measured fact or a validated accuracy; `basis` says what it is computed from. */
export type Verdict = 'Go' | 'Worth a look' | 'Skip' | 'Dark';
export interface CallWindow {start: string; end: string; label: string; /** the verdict the window's hours share (Go, else Worth a look): what the window IS, whatever hour is selected */ verdict?: 'Go' | 'Worth a look'}
export interface Call {/** After dark: what the conditions alone would say in daylight, and the rating word (user, 2026-11-08: dark hours keep their rating). */ lit?: {verdict: Exclude<Verdict, 'Dark'>; conditions: string};
  /** Audit F5 / B15: after dark with no window ahead, the next daylight day's own call (its best daylight hour), so the evening planner still gets an answer. */
  nextDay?: {when: string; at: string; verdict: Exclude<Verdict, 'Dark'>; reason: string | null};
  verdict: Verdict; window: CallWindow | null; nextWindow: CallWindow | null; why: string[]; basis: string; /** Estimated breaker type for this hour (label "est. breaker type"); type 'unknown' where the spot has no defensible slope. */ breaker: BreakerEstimate}
export interface CallContext {records: Forecast[]; bundle?: Pick<OceanBundle, 'nearshore' | 'mop' | 'srf'> | null; nowMs: number}

/** Surf-height range each skill is comfortable in, in feet. OUR OWN CHOICES (product rules, not a safety standard).
 *  Only the beginner ceiling has an outside anchor: Quiver's public example calls 5.2 ft "beyond the beginner safety range" and its beginner range starts at 0.5 ft;
 *  we use 4 ft as the ceiling, which is about "head high" in the body-word convention (OceanFit). The other bounds are our judgement, adjustable in one place. */
export const SKILL_RANGE_FT: Record<Skill, {min: number; max: number}> = {Beginner: {min: 1, max: 4}, Intermediate: {min: 1.5, max: 8}, Expert: {min: 2, max: 20}};
/** Wind that spoils the face regardless of size (mph). Onshore above ONSHORE_BAD or cross-shore above CROSS_BAD is a Skip; lighter onshore/cross is at most "Worth a look". Our own choices, in line with the rating's 3 and 8 mph rules. */
export {ONSHORE_BAD_MPH};   // lives in ratings/windRules.ts since 4B: the same line caps the rating at poor
export const CROSS_BAD_MPH = 18;
export const GO_MIN_SCORE = 65, WORTH_MIN_SCORE = 50; // rating bands: SOLID starts at 65, NOT BAD at 55 (our own cut at 50 for "worth a look")

const fmt = (lo: number, hi: number, p: UserProfile) => formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: [lo, hi], rangeMethod: 'v2'}, p).text;

interface HourCall {verdict: Verdict; why: string[]; hour: SpotHour; breaker: BreakerEstimate; lit?: Call['lit']}
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
export function hourCall(spot: SurfSpot, f: Forecast, profile: UserProfile, ctx: CallContext, ignoreDark = false): HourCall {
  const hr = spotHourOf(spot, f, ctx.nowMs, profile, {bundle: ctx.bundle}), h = hr.surf.headline, why: string[] = [];
  const breaker = breakerType(spot, f);
  if (!ignoreDark && isDark(spot.id, f.timestamp)) { // dark hours keep their rating: the conditions are judged as in daylight, but the hour is never a surf window
    const inner = hourCall(spot, f, profile, ctx, true), cat = hr.rating.score !== null ? String(hr.rating.category).toLowerCase() : null;
    const lit = inner.verdict !== 'Dark' && cat ? {verdict: inner.verdict, conditions: cat} : undefined;
    return {verdict: 'Dark', lit, why: [lit ? `It is dark (before first light or after last light), so it is not a surf window. The conditions themselves rate ${cat}.` : 'It is dark: before first light or after last light, so it is not a surf window.'], hour: hr, breaker};
  }
  // profile-setup: a picked level (1–7) uses its own range and name; an old profile (no level picked) keeps SKILL_RANGE_FT and the old word, byte for byte
  const lvl = isLevel(profile.skillLevel) ? levelInfo(profile.skillLevel) : null;
  const r = lvl ? lvl.callFt : SKILL_RANGE_FT[profile.skill] ?? SKILL_RANGE_FT.Intermediate, w = hr.wind, score = hr.rating.score;
  let verdict: Verdict = 'Go', sizeNote = '';
  // T-108: the person's OWN preferred range (Personal › Preferred conditions) is what the call names; the skill table stays the safety ceiling and floor (Skip) it never overrides.
  const lo0 = profile.minWave, hi0 = profile.maxWave, own = Number.isFinite(lo0) && Number.isFinite(hi0) && lo0 > 0 && hi0 > lo0 ? {min: lo0, max: hi0} : null;
  if (isFlat(h)) { verdict = 'Skip'; sizeNote = 'Flat (model estimate): the nearshore model has under half a foot here, so there is nothing to surf.'; } // T-130: never "the estimated 0–0 ft"
  else if (h.kind === 'estimate') {
    const range = fmt(h.loFt, h.hiFt, profile), who = lvl ? `level ${lvl.n} (${lvl.name.toLowerCase()})` : profile.skill.toLowerCase(), rw = lvl ? 'limits' : 'range';   // a picked level's Call floor and ceiling are its 'limits' (its cards show the comfortable size)
    if (h.loFt > r.max) { verdict = 'Skip'; sizeNote = `The estimated ${range} is above the ${who} ${rw} (up to ${r.max} ft).`; }
    else if (h.hiFt < r.min) { verdict = 'Skip'; sizeNote = `The estimated ${range} is below the ${who} ${rw} (from ${r.min} ft): too small to surf well.`; }
    else if (h.hiFt > r.max * 1.15) { verdict = 'Worth a look'; sizeNote = `The estimated ${range} may be above the ${who} ${rw} (up to ${r.max} ft).`; }
    else if (h.loFt < r.min * 0.6 && h.hiFt < r.min * 1.6) { verdict = 'Worth a look'; sizeNote = `The estimated ${range} is small for the ${who} ${rw}.`; }
    else if (own && h.loFt > own.max) { verdict = 'Worth a look'; sizeNote = `The estimated ${range} is above the range you prefer (up to ${own.max} ft), though within the ${who} ${rw}.`; }
    else if (own && h.hiFt < own.min) { verdict = 'Worth a look'; sizeNote = `The estimated ${range} is below the range you prefer (from ${own.min} ft), though within the ${who} ${rw}.`; }
    else if (own && h.hiFt > own.max) sizeNote = `The estimated ${range} reaches above the range you prefer (up to ${own.max} ft).`;
    else if (own && h.loFt < own.min) sizeNote = `The estimated ${range} reaches below the range you prefer (from ${own.min} ft).`;
    else sizeNote = own ? `The estimated ${range} is within the range you prefer (${own.min}–${own.max} ft).` : `The estimated ${range} is within the ${who} ${rw}.`;
  } else sizeNote = 'No surf-size estimate for this hour (offshore height only), so size is not part of this call.';   // lead triage 2026-11-12: about the HOUR judged, never "this spot" (other hours can have one)
  // Breaker type (T-064 addendum): a plunging break at size is for experienced surfers (our own rule; Surfing Online "Types of Waves" describes plunging waves as hollow, powerful and for experienced surfers). Spilling is forgiving.
  let breakerNote = '';
  if (breaker.type === 'plunging' && breaker.confidence === 'checked' && h.kind === 'estimate' && (lvl ? lvl.n < PLUNGING_OK_FROM : profile.skill !== 'Expert') && h.hiFt >= 4) { verdict = 'Skip'; breakerNote = `Plunging at ${fmt(h.loFt, h.hiFt, profile)}: ${lvl ? 'levels 6–7 only' : 'experts only'}.`; }
  else if (breaker.type === 'plunging') breakerNote = 'Likely hollow, powerful.'; // an estimate: Call.breaker carries the label and the slope basis
  else if (breaker.type === 'spilling') breakerNote = 'Likely soft; check shorebreak.';
  let windNote = '';
  if (w) {
    const mph = w.mph;
    if (w.relation === 'onshore' && mph > ONSHORE_BAD_MPH) { verdict = 'Skip'; windNote = `Onshore wind at ${windText(mph, profile)} will chop it up.`; /* one decimal: 12.3 mph is over the 12 mph line; "12 mph" would not read so */ }
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
  // A4: a plain "is within the range" note is not a reason; "though within" notes (above/below the range you prefer) ARE the deciding reason
  const plainWithin = (n: string) => /is within the (range you prefer|[^.]* range)\.$/.test(n) && !/though within/.test(n);
  const sizeReason = sizeNote && !plainWithin(sizeNote) ? sizeNote : null;
  const [lead, decider] = verdict === 'Skip' ? (breakerNote && /experts only|levels 6–7 only/.test(breakerNote) ? [breakerNote, 'the breaker rule'] : windNote && /chop/.test(windNote) ? [windNote, 'the wind rule'] : sizeReason ? [sizeReason, 'the size rule'] : [null, ''])
    : verdict === 'Worth a look' ? (sizeReason ? [sizeReason, 'the size rule'] : windNote && /roughen/.test(windNote) ? [windNote, 'the wind rule'] : [null, '']) : [null, ''];
  const ex = explainRating(hr.rating, {spotId: spot.id, wind: w ? {mph: w.mph, relation: w.relation} : null, fmtWind: (n) => windText(n, profile)}), items = ex.items.filter((i) => i.inScore);
  const down = items.find((i) => i.effect === '-' || (i.effect === '~' && i.factor !== 'Rating ceiling')), ceiling = items.find((i) => i.factor === 'Rating ceiling'), up = items.find((i) => i.effect === '+');
  // T-093: the first plain reason is plain language; the rating engine's own wording (numbers, 'Heuristic', 'combined Hs') goes to the detail lines after it.
  const cat = score === null ? null : String(hr.rating.category).toLowerCase();
  // A4: the sentence about the rating states the rating itself. When the rating is good but the verdict is not Go, the call comes from the size, wind or break rule above, and it says so: never "only middling" for a Solid hour.
  const ratingSentence = ceiling ? ceiling.reason : verdict === 'Go' ? (up ? `${plainFactor(up.factor, '+')} is a plus.` : 'The rating is good for this hour.') : down ? plainReasonFor(down)
    : cat === null ? 'There is no rating for this hour.' : score! >= GO_MIN_SCORE ? `The conditions themselves rate ${cat}; the call comes from ${decider || 'the size, wind or break rule'} above, not from the rating.` : `The rating is ${cat} for this hour.`;
  const ratingDetail = !ceiling && verdict !== 'Go' && down ? `Rating detail, ${down.factor}: ${down.reason}` : '';
  if (lead) why.push(lead); else if (verdict === 'Go') why.push(`${windNote || 'Conditions line up'}${windNote ? '' : '.'} ${sizeNote}`.trim()); else why.push(ratingSentence);
  for (const s of [sizeNote, windNote, breakerNote, ratingSentence, ratingDetail]) if (s && !why.includes(s) && !/^$/.test(s)) why.push(s);
  return {verdict, why, hour: hr, breaker};
}

/** Best window on one Pacific day: the longest run of daylight hours with the same best verdict (Go, else Worth a look), highest peak first, ties keep the EARLIER run (deterministic).
 *  The choice is made on the whole day's daylight hours with the REAL clock (the same hourCall as the hour cards, so a window can never contradict them), so a passing hour no longer trims or moves it. It depends on `fromMs`
 *  only through "has it ended": when the day's best window is over, the best of the hours still ahead is chosen instead. */
export function windowOnDay(spot: SurfSpot, dateKey: string, profile: UserProfile, ctx: CallContext, fromMs = 0): CallWindow | null {
  const tz = timeZoneOf(spot);
  const day = ctx.records.filter((f) => f.spotId === spot.id && dateIn(tz, f.timestamp) === dateKey).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const calls = day.map((f) => ({f, c: hourCall(spot, f, profile, ctx)}));
  const pick = (from: number): CallWindow | null => {
    const mine = calls.filter(({f}) => Date.parse(f.timestamp) + 3600000 > from);
    for (const want of ['Go', 'Worth a look'] as const) {
      const runs: {s: number; e: number; peak: number}[] = []; let cur: {s: number; e: number; peak: number} | null = null;
      for (const {f, c} of mine) {
        const t = Date.parse(f.timestamp), ok = c.verdict === want && (c.hour.rating.score ?? 0) >= 0;
        if (ok && cur && t === cur.e) { cur.e = t + 3600000; cur.peak = Math.max(cur.peak, c.hour.rating.score ?? 0); }
        else { if (ok) { cur = {s: t, e: t + 3600000, peak: c.hour.rating.score ?? 0}; runs.push(cur); } else cur = null; }
      }
      if (runs.length) { const b = runs.sort((x, y) => (y.e - y.s) - (x.e - x.s) || y.peak - x.peak || x.s - y.s)[0], [s, e] = clampToLight(spot.id, b.s, b.e); return {start: new Date(s).toISOString(), end: new Date(e).toISOString(), label: windowLabel(s, e, tz), verdict: want}; }
    }
    return null;
  };
  const whole = pick(0);
  return whole && Date.parse(whole.end) > fromMs ? whole : pick(fromMs);
}

const dayName = (iso: string, nowMs: number, tz: string) => {
  const d = dateIn(tz, iso), today = dateIn(tz, new Date(nowMs).toISOString());
  if (d === today) return 'today';
  if (d === addDaysKey(today, 1)) return 'tomorrow';
  return fmtIn(tz, {weekday: 'long'}).format(new Date(iso));
};
/** The forecast hour that holds a window's start. A window may start at first light (e.g. 6:20), so never match the start time exactly. */
export function windowHour<T extends {spotId: string; timestamp: string}>(records: T[], spotId: string, w: {start: string}): T | undefined {
  const h0 = Math.floor(Date.parse(w.start) / 3600000) * 3600000;
  return records.find((f) => f.spotId === spotId && Date.parse(f.timestamp) === h0);
}
/** T-108: THE best-window function. The first window (same rule as the call's: longest run of daylight hours with the best verdict) that has not ended, looking `days` Pacific days ahead from `fromMs`.
 *  The spot page's call, Compare's "Best" column and Find spots use this one, so they cannot disagree. `when` is 'today' / 'tomorrow' / a weekday. */
/** How many days ahead (today included) the call names a window. The best-day star is limited to the same horizon. */
export const CALL_WINDOW_DAYS = 4;
export function bestWindowFrom(spot: SurfSpot, profile: UserProfile, ctx: CallContext, fromMs: number, days = CALL_WINDOW_DAYS): (CallWindow & {when: string}) | null {
  const tz = timeZoneOf(spot), day0 = dateIn(tz, new Date(fromMs).toISOString());
  for (let i = 0; i < days; i++) {
    const d = addDaysKey(day0, i), w = windowOnDay(spot, d, profile, ctx, fromMs);
    if (w && Date.parse(w.end) > ctx.nowMs) return {...w, when: dayName(w.start, ctx.nowMs, tz)}; // today's window still ahead (before first light) counts
  }
  return null;
}
/** How many days ahead the next window is looked for (bestWindowFrom's default), named in the copy so it never overclaims "in this forecast". */
export const WINDOW_DAYS = CALL_WINDOW_DAYS;
const cap = (w: string) => w.replace(/^\w/, (c) => c.toUpperCase());
const VRANK: Record<Verdict, number> = {Go: 3, 'Worth a look': 2, Skip: 1, Dark: 0};
/** Audit F5 / B15: the next daylight day's call at its best daylight hour (best verdict, then rating), with the deciding reason. Null without daylight records. */
export function nextDayCall(spot: SurfSpot, profile: UserProfile, ctx: CallContext, fromMs: number): Call['nextDay'] | null {
  const tz = timeZoneOf(spot), mine = ctx.records.filter((f) => f.spotId === spot.id && Date.parse(f.timestamp) > fromMs).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const first = mine.find((f) => !isDark(spot.id, f.timestamp)); if (!first) return null;
  const key = dateIn(tz, first.timestamp);
  let best: {f: Forecast; c: HourCall} | null = null;
  for (const f of mine) {
    if (dateIn(tz, f.timestamp) !== key || isDark(spot.id, f.timestamp)) continue;
    const c = hourCall(spot, f, profile, ctx, true);
    if (!best || VRANK[c.verdict] > VRANK[best.c.verdict] || (VRANK[c.verdict] === VRANK[best.c.verdict] && (c.hour.rating.score ?? -1) > (best.c.hour.rating.score ?? -1))) best = {f, c};
  }
  if (!best || best.c.verdict === 'Dark') return null;
  return {when: dayName(best.f.timestamp, ctx.nowMs, tz), at: best.f.timestamp, verdict: best.c.verdict, reason: best.c.why[0] ?? null};
}
/** The call for a spot-hour: its verdict, the best window on that Pacific day (if daylight remains), the next window when it is dark or today's has passed, and why. */
export function callFor(spot: SurfSpot, hour: Forecast, profile: UserProfile, ctx: CallContext): Call {
  const hc = hourCall(spot, hour, profile, ctx), tz = timeZoneOf(spot), day = dateIn(tz, hour.timestamp), from = Math.max(ctx.nowMs, Date.parse(hour.timestamp));
  const window = windowOnDay(spot, day, profile, ctx, Math.min(ctx.nowMs, Date.parse(hour.timestamp)));
  const passed = !window || Date.parse(window.end) <= ctx.nowMs;
  let nextWindow: CallWindow | null = null;
  // review fix B15: after today's last light, today has no daylight left, so one more day is searched and the copy's "next 4 days" stays true
  const fromMs = Math.max(from, ctx.nowMs), todayDone = Date.parse(daylightFor(spot.id, dateIn(tz, new Date(fromMs).toISOString())).lastLight) <= fromMs;
  if (hc.verdict === 'Dark' || passed) { const w = bestWindowFrom(spot, profile, ctx, fromMs, todayDone ? WINDOW_DAYS + 1 : WINDOW_DAYS); if (w) nextWindow = {start: w.start, end: w.end, label: w.label, ...(w.verdict ? {verdict: w.verdict} : {})}; }
  const dayWord = nextWindow ? dayName(nextWindow.start, ctx.nowMs, tz) : '';
  const litWords = hc.lit ? ` The conditions themselves rate ${hc.lit.conditions}.` : '';
  const nextDay = hc.verdict === 'Dark' && !nextWindow ? nextDayCall(spot, profile, ctx, from) : null;
  // with no window ahead, tomorrow's own answer leads (the evening planner's question), then why tonight is not a window
  // lead triage 2026-11-12: the next day's answer names the HOUR it judged, so its range never reads as the hour on screen ("Today at 12 PM: Skip. The estimated 13–16 ft…" over a 12 AM "11–14 ft")
  const nextDayWords = nextDay ? `${cap(nextDay.when)} at ${fmtIn(tz, {hour: 'numeric', minute: '2-digit'}).format(new Date(nextDay.at)).replace(':00', '')}: ${nextDay.verdict}.${nextDay.reason ? ` ${nextDay.reason}` : ''}` : '';
  const why = hc.verdict === 'Dark' ? (nextWindow ? [`It is dark, so it is not a surf window.${litWords} The next window is ${dayWord} ${nextWindow.label}.`]
    : [...(nextDayWords ? [nextDayWords] : []), `It is dark, so it is not a surf window.${litWords} No surf window in the next ${WINDOW_DAYS} days.`]) : hc.why;
  const dl = daylightFor(spot.id, day), basis = `From the surf estimate, the rating, wind, daylight (first light ${fmtIn(tz, {hour: 'numeric', minute: '2-digit'}).format(new Date(dl.firstLight))}, last light ${fmtIn(tz, {hour: 'numeric', minute: '2-digit'}).format(new Date(dl.lastLight))}) and your ${isLevel(profile.skillLevel) ? `level (level ${profile.skillLevel}, ${levelInfo(profile.skillLevel).name.toLowerCase()})` : `skill (${profile.skill})`}. Our own rules, not a measured or validated forecast.`;
  return {verdict: hc.verdict, ...(hc.lit ? {lit: hc.lit} : {}), ...(nextDay ? {nextDay} : {}), window: hc.verdict === 'Dark' ? null : window, nextWindow, why, basis, breaker: hc.breaker};
}

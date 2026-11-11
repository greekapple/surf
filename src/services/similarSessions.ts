import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {fmtIn} from '../ocean/time.ts';
import {timeZoneOf} from '../ocean/spotZone.ts';
import {compass} from '../utils/units.ts';
import {formatWaveHeight} from '../utils/waveHeight.ts';
import {BREAKING_V2_VERSION} from '../ocean/breakingEstimate.ts';
import {headlineSurf} from './headlineSurf.ts';
import {windAdjective} from './spotHour.ts';
import {forecastInputs, type ExtraInputs} from './sessionInputs.ts';
import type {SessionObservation} from './sessionLog.ts';

/** "Looks like your sessions" (quiver item 3): a COMPARISON OF FORECASTS, never a prediction. Today's forecast inputs for a spot-hour are compared with the forecast stored for each of the person's own past sessions at that
 *  spot (the model pair captured when the session was logged: what the app had forecast for that hour). Local only: nothing is fetched or sent. Pure.
 *
 *  Distance (documented; fixed weights; each dimension scaled to 0 = same, 1 = far):
 *    height    0.35  |Δ surf height| / 2 ft, capped at 1            (the uncalibrated surf-height estimate's centre, both sides)
 *    period    0.25  |Δ period| / 4 s, capped at 1
 *    direction 0.15  circular |Δ swell direction| / 45°, capped at 1
 *    wind      0.15  half |Δ wind speed| / 10 mph (capped), half 0/1 for a different relation to the beach (offshore / cross / onshore)
 *    tide      0.10  0 for the same stage (rising / falling), 1 for the other
 *  HARD GATES first (any one = no match, whatever the distance): a different wind relation when both are known; a different tide stage when both are known; a height gap over 30% (|Δ| ÷ the larger); a different kind of number
 *  (MOP nearshore-only point vs the breaking rule) or a different method family (mop-v2 vs v1). Saved or stale estimates and flat hours are never compared, on either side.
 *  distance = Σ weight × dimension ÷ Σ weight, over the dimensions present on BOTH sides (a stored session that predates a dimension is compared on what it has). Height AND period must be present on both sides,
 *  else there is no comparison. A match is "close" only at distance ≤ MAX_DISTANCE (0.25: for example height within 0.8 ft and period within 1.6 s with nothing else known); otherwise nothing is said. Ties keep the more recent session. */
export const WEIGHTS = {height: 0.35, period: 0.25, direction: 0.15, wind: 0.15, tide: 0.10} as const;
export const SCALES = {heightFt: 2, periodS: 4, directionDeg: 45, windMph: 10} as const;
export const MAX_DISTANCE = 0.25, MIN_SESSIONS = 3, MAX_HEIGHT_GAP = 0.30;
/** `nearshoreOnly` null = a stored pair from before it was kept: it is compared only with a breaking-rule estimate (today's nearshore-only point never matches it). */
export interface Inputs extends ExtraInputs {heightFt: number; periodS: number; method: 'mop-v2' | 'v1'; nearshoreOnly: boolean | null}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const cap = (x: number) => Math.min(1, Math.max(0, x));
const arc = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** A past session's stored forecast inputs, or null when it has no comparable surf-height forecast (a pair on another basis is not mixed in). */
export function storedInputs(o: SessionObservation): Inputs | null {
  const pr = o.pair; if (!pr || pr.basis !== 'surf-height' || pr.stale || pr.flat || !finite(pr.centralFt) || !finite(pr.primaryTpS)) return null;
  return {heightFt: pr.centralFt, periodS: pr.primaryTpS, method: pr.method, nearshoreOnly: pr.nearshoreOnly === undefined ? null : pr.nearshoreOnly, dirDeg: finite(pr.dirDeg) ? pr.dirDeg : null, windMph: finite(pr.windMph) ? pr.windMph : null, windRel: pr.windRel ?? null, tide: pr.tide ?? null};
}
/** Today's inputs for a spot-hour: the same uncalibrated surf-height estimate the pairs store, from the record the app shows. Null with no sized estimate or no period. */
export function todayInputs(spot: SurfSpot, f: Forecast, bundle: Pick<OceanBundle, 'nearshore' | 'mop'> | null | undefined, nowMs: number): Inputs | null {
  const h = headlineSurf(spot.id, f, {bundle, nowMs, observations: []}); if (h.kind !== 'estimate' || h.method === 'swan-v2' || (h as {saved?: unknown}).saved || h.nearshoreOnly?.flat) return null;   // a saved or stale copy and a flat hour are never compared
  const c = h.centralFt ?? (h.loFt + h.hiFt) / 2, tp = f.primary?.period; if (!finite(c) || !finite(tp)) return null;
  return {heightFt: c, periodS: tp, method: h.method, nearshoreOnly: !!h.nearshoreOnly, ...forecastInputs(spot, f, nowMs)};
}
export function distance(a: Inputs, b: Inputs): {d: number; dims: (keyof typeof WEIGHTS)[]} | null {
  if (![a.heightFt, a.periodS, b.heightFt, b.periodS].every(finite)) return null;
  if (a.method !== b.method || (b.nearshoreOnly === null ? a.nearshoreOnly : a.nearshoreOnly !== b.nearshoreOnly)) return null;   // like with like
  if (Math.abs(a.heightFt - b.heightFt) / Math.max(a.heightFt, b.heightFt, 0.1) > MAX_HEIGHT_GAP) return null;
  if (a.windRel && b.windRel && a.windRel !== b.windRel) return null;
  if (a.tide && b.tide && a.tide !== b.tide) return null;
  const parts: [keyof typeof WEIGHTS, number][] = [['height', cap(Math.abs(a.heightFt - b.heightFt) / SCALES.heightFt)], ['period', cap(Math.abs(a.periodS - b.periodS) / SCALES.periodS)]];
  if (finite(a.dirDeg) && finite(b.dirDeg)) parts.push(['direction', cap(arc(a.dirDeg, b.dirDeg) / SCALES.directionDeg)]);
  if (finite(a.windMph) && finite(b.windMph) && a.windRel && b.windRel) parts.push(['wind', 0.5 * cap(Math.abs(a.windMph - b.windMph) / SCALES.windMph) + 0.5 * (a.windRel === b.windRel ? 0 : 1)]);
  if (a.tide && b.tide) parts.push(['tide', a.tide === b.tide ? 0 : 1]);
  const w = parts.reduce((s, [k]) => s + WEIGHTS[k], 0);
  return {d: parts.reduce((s, [k, v]) => s + WEIGHTS[k] * v, 0) / w, dims: parts.map(([k]) => k)};
}
export interface SessionMatch {obs: SessionObservation; distance: number; dims: (keyof typeof WEIGHTS)[]; stored: Inputs}
/** The closest past session at the spot to today's inputs, or null: fewer than MIN_SESSIONS logged sessions at the spot, no comparable session, or the closest is farther than MAX_DISTANCE. */
export function closestSession(log: SessionObservation[], spotId: string, today: Inputs | null): SessionMatch | null {
  const mine = log.filter((o) => o.spotId === spotId); if (mine.length < MIN_SESSIONS || !today) return null;
  let best: SessionMatch | null = null;
  for (const o of mine) {
    const st = storedInputs(o); if (!st) continue; const r = distance(today, st); if (!r) continue;
    if (!best || r.d < best.distance - 1e-9 || (Math.abs(r.d - best.distance) <= 1e-9 && o.observedAt > best.obs.observedAt)) best = {obs: o, distance: r.d, dims: r.dims, stored: st};
  }
  return best && best.distance <= MAX_DISTANCE ? best : null;
}
/** "Sat Oct 18, 7 AM": the day and hour of a logged session in the spot's zone. An entry whose time was not known when it was entered (`timeKnown: false`, or a date-only string) shows the DATE ONLY: a "12 AM" is never invented, and a real session at midnight keeps its hour. */
export function reportWhen(observedAt: string, tz: string, timeKnown?: boolean): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(observedAt.trim())) return fmtIn('UTC', {weekday: 'short', month: 'short', day: 'numeric'}).format(new Date(`${observedAt.trim()}T12:00:00Z`)).replace(',', '');   // a date, not an instant: no zone shifts it
  const at = new Date(observedAt), day = fmtIn(tz, {weekday: 'short', month: 'short', day: 'numeric'}).format(at).replace(',', '');
  return timeKnown === false ? day : `${day}, ${fmtIn(tz, {hour: 'numeric'}).format(at)}`;
}
const QWORDS = ['Poor', 'Poor to fair', 'Fair', 'Good', 'Epic'];
/** The one line, built from that session's OWN stored forecast values, naming only the dimensions actually compared. `todayIso` is the hour being compared (shown, in the spot's clock). Says it is a comparison of forecasts. */
export function similarLine(m: SessionMatch, spot: SurfSpot, p: UserProfile, todayIso?: string): string {
  const tz = timeZoneOf(spot), pr = m.obs.pair!, at = new Date(m.obs.observedAt);
  const when = reportWhen(m.obs.observedAt, tz, m.obs.timeKnown);
  const size = formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: [pr.loFt, pr.hiFt], rangeMethod: pr.method === 'mop-v2' ? 'v2' : 'v1'}, p).text;   // the method family only: the stored pair has no version
  const s = m.stored, has = (d: keyof typeof WEIGHTS) => m.dims.includes(d);   // only the dimensions actually compared are named AND shown
  const bits = [`est. ${size} surf height (untuned)`, `${Math.round(s.periodS)} s${has('direction') && finite(s.dirDeg) ? ` ${compass(s.dirDeg)}` : ''}`, has('wind') && finite(s.windMph) && s.windRel ? `${windAdjective(s.windMph).toLowerCase()} ${s.windRel}` : null, has('tide') && s.tide ? `${s.tide} tide` : null].filter(Boolean).join(', ');
  const names = ['size', 'period', ...(has('direction') ? ['swell direction'] : []), ...(has('wind') ? ['wind'] : []), ...(has('tide') ? ['tide'] : [])], said = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  const hour = todayIso ? ` at ${fmtIn(tz, {weekday: 'short', hour: 'numeric'}).format(new Date(todayIso))}` : '', rated = m.obs.quality ? ` (you rated the waves ${QWORDS[m.obs.quality - 1]})` : '';
  return `Similar ${said}${hour} to your report on ${when}${rated}. Forecast then: ${bits}. A comparison of forecasts, not a prediction.`;
}

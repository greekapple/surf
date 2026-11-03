import type {SpotProfile, Source, Sourced} from './spotProfile.ts';
import {emptyProfile} from './spotProfile.ts';
import type {BreakingCalibration} from './localCalibration.ts';


/** How published spot-guide facts become spot profiles, breaking-estimate profiles and MOP assignments (T-071). Pure rules, no data.
 *  User decision (2026-11-02): "literally just look at public sources and apply that". Every value carries its source URL, retrieval date and provenance 'published guide'.
 *  The guides state FACING (the way the beach looks), the swell EXPOSURE or workable range, wind, tide, bottom, size and hazards. They do not state a minimum swell period or a shelter factor, so:
 *  - the minimum period is the GENERIC published threshold below (not spot-specific, labelled as such);
 *  - shelter is 1 (no sheltering assumed) only for a beach break that no source calls sheltered; a point, reef or jetty needs a source that says it is exposed; a spot any source calls sheltered gets no estimate.
 *  Where two sources disagree the narrower swell window and the more cautious exposure word are used and the disagreement is kept in `notes`. */
export interface GuideSource {url: string; title: string; site: string; retrievedOn: string}
export interface GuideFacts {
  spotId: string; sources: GuideSource[];
  facing: {text: string; deg: number} | null;
  swellWindow: {text: string; fromDeg: number; toDeg: number; basis: 'exposure' | 'workable'} | null;
  idealSwell: string | null; windOffshore: string | null; tide: string | null; bottom: string | null; waveType: 'beach' | 'point' | 'reef' | 'jetty' | null;
  sizeFt: {min: number; max: number} | null; exposure: 'exposed' | 'somewhat protected' | 'sheltered' | 'not stated'; hazards: string[]; notes: string;
}
export const GENERIC_MIN_PERIOD_S = 8;
export const GENERIC_PERIOD_SOURCES: Source[] = [
  {url: 'https://www.rapturecamps.com/learn-to-surf/wave-knowledge/swell-basics', title: 'Rapture Camps, Swell basics: swell under about 8 seconds is typically choppy and less organized', retrievedOn: '2026-11-02'},
  {url: 'https://www.surfertoday.com/surfing/what-is-a-wind-swell', title: 'Surfertoday: what is a wind swell', retrievedOn: '2026-11-02'},
];
export const MOP_NORMAL_TOLERANCE_DEG = 25;
const diff = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };

export interface Enablement {estimate: boolean; shelter: 1 | null; reasons: string[]}
/** Whether an estimate may be shown for these guide facts, and why not. */
export function enablement(f: GuideFacts): Enablement {
  const reasons: string[] = [];
  if (!f.facing) reasons.push('no source states which way the beach faces');
  if (!f.swellWindow) reasons.push('no source gives the swell directions that work');
  if (f.exposure === 'sheltered') reasons.push('a source calls the spot sheltered, and no shelter factor is sourced');
  else if (f.waveType && f.waveType !== 'beach' && f.exposure !== 'exposed') reasons.push(`a ${f.waveType} break needs a source that says it is exposed`);
  return {estimate: reasons.length === 0, shelter: reasons.length === 0 ? 1 : null, reasons};
}
const src = (f: GuideFacts): Source[] => f.sources.map((s) => ({url: s.url, title: s.title, retrievedOn: s.retrievedOn}));
const guide = <T>(value: T, f: GuideFacts, note?: string): Sourced<T> => ({value, status: 'sourced', sources: src(f), provenance: 'published guide', ...(note ? {note} : {})});

/** The spot profile registry entry for one spot's guide facts. Anything the guides do not state stays unknown. */
export function profileFromGuide(f: GuideFacts, base: SpotProfile = emptyProfile(f.spotId)): SpotProfile {
  const p: SpotProfile = {...base};
  if (f.facing && p.orientation.value === null) p.orientation = guide({beachNormalDeg: f.facing.deg}, f, `Published guides say the beach faces ${f.facing.text}; the compass word is rounded to a 22.5° point, so treat it as approximate.`);
  if (f.swellWindow && p.swellWindow.value === null) p.swellWindow = guide({reference: 'offshore' as const, fromDeg: f.swellWindow.fromDeg, toDeg: f.swellWindow.toDeg}, f, `Guide: swell ${f.swellWindow.basis === 'exposure' ? 'exposure' : 'workable range'} "${f.swellWindow.text}"${f.idealSwell ? `; best ${f.idealSwell}` : ''}.${f.notes ? ' ' + f.notes : ''}`);
  if (f.facing && f.swellWindow && enablement(f).estimate && p.periodResponse.value === null) p.periodResponse = {value: {minUsefulS: GENERIC_MIN_PERIOD_S}, status: 'sourced', sources: GENERIC_PERIOD_SOURCES, provenance: 'published guide (generic)', note: 'Generic published threshold (swell under about 8 s is choppy wind swell), not specific to this spot. The guides give no spot minimum.'};
  if (f.sizeFt && p.sizeBand.value === null) p.sizeBand = guide({kind: 'breaking-face' as const, minFt: f.sizeFt.min, idealLowFt: f.sizeFt.min, idealHighFt: f.sizeFt.max, maxFt: f.sizeFt.max}, f, 'Guide size range; the guide does not separate ideal from workable, so ideal equals the range.');
  if (f.bottom && f.waveType && p.bottom.value === null) {
    const t = f.waveType === 'point' ? 'point' : f.waveType === 'reef' ? 'reef' : f.waveType === 'jetty' ? 'jetty-influenced' : /rock|boulder/i.test(f.bottom) ? (/sand/i.test(f.bottom) ? 'mixed' : 'rock') : 'sand-bar';
    p.bottom = guide({type: t as 'sand-bar' | 'reef' | 'point' | 'rock' | 'jetty-influenced' | 'mixed', stability: 'mobile' as const}, f, `Guide: bottom "${f.bottom}", ${f.waveType} break. Stability is not stated; mobile is assumed for sand only.`);
    if (t === 'point' || t === 'reef' || t === 'rock') p.bottom.value!.stability = 'fixed';
  }
  if (f.hazards.length && p.hazards.value === null) p.hazards = guide([...f.hazards], f, 'From the guides; not a complete hazard list.');
  return p;
}
const norm = (d: number) => ((d % 360) + 360) % 360, rel = (x: number, c: number) => ((norm(x - c) + 180) % 360) - 180;
export const WINDOW_HALF_WIDTH_DEG = 60;
/** The guide's swell range limited to ±60° of the facing (the same rule as Ocean Beach), so a wide published range such as "S to N" cannot let a swell that grazes the beach produce a height. Null when nothing is left. */
export function clampWindow(fromDeg: number, toDeg: number, facingDeg: number, half = WINDOW_HALF_WIDTH_DEG): [number, number] | null {
  const a = rel(fromDeg, facingDeg), b = rel(toDeg, facingDeg); let lo: number, hi: number;
  if (a <= b) { lo = Math.max(a, -half); hi = Math.min(b, half); if (lo > hi) return null; }
  else { const left = a <= half, right = b >= -half; if (left && right) { lo = -half; hi = half; } else if (left) { lo = Math.max(a, -half); hi = half; } else if (right) { lo = -half; hi = Math.min(b, half); } else return null; }
  return [norm(facingDeg + lo), norm(facingDeg + hi)];
}
/** The v1 breaking profile for guide facts, or null when estimates are not allowed. window = the guide's swell range; minPeriod generic; shelter 1; face factors the shared unvalidated 0.7–1.4 band. */
export function breakingProfileFromGuide(f: GuideFacts): BreakingCalibration | null {
  const e = enablement(f); if (!e.estimate || !f.swellWindow || !f.facing) return null;
  const window = clampWindow(f.swellWindow.fromDeg, f.swellWindow.toDeg, f.facing.deg); if (!window) return null;
  return {spotId: f.spotId, faceFactors: [0.7, 1.4], window, minPeriod: GENERIC_MIN_PERIOD_S, shelter: 1,
    note: `Spot facts from published guides (${f.sources.map((s) => s.site).join(', ')}): window "${f.swellWindow.text}" limited to ±60° of the facing, facing ${f.facing!.text}. Minimum period is the generic 8 s. Shelter 1 (${f.exposure === 'exposed' ? 'a source says exposed' : 'no source says sheltered'}). Unvalidated.`};
}
/** A MOP candidate qualifies when its shore normal is within the tolerance of the guide's facing; the closest one wins. */
export function pickMop(f: GuideFacts, candidates: {id: string; shoreNormalDeg: number}[]): {id: string; offsetDeg: number} | null {
  if (!f.facing || !enablement(f).estimate) return null;
  const ok = candidates.map((c) => ({id: c.id, offsetDeg: diff(c.shoreNormalDeg, f.facing!.deg)})).filter((c) => c.offsetDeg <= MOP_NORMAL_TOLERANCE_DEG).sort((a, b) => a.offsetDeg - b.offsetDeg);
  return ok[0] ?? null;
}

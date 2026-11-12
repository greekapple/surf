import type {SpotProfile, Source, Sourced} from './spotProfile.ts';
import {emptyProfile} from './spotProfile.ts';
import type {BreakingCalibration} from './localCalibration.ts';


/** How published spot-guide facts become spot profiles, breaking-estimate profiles and MOP assignments (T-071). Pure rules, no data.
 *  User decision (2026-11-02): "literally just look at public sources and apply that". Every value carries its source URL, retrieval date and provenance 'published guide'.
 *  The guides state FACING (the way the beach looks), the swell EXPOSURE or workable range, wind, tide, bottom, size and hazards. They do not state a minimum swell period or a shelter factor, so:
 *  - the minimum period is the GENERIC published threshold below (not spot-specific, labelled as such);
 *  - shelter is 1 (no sheltering assumed) only for a beach break that no source calls sheltered; a point, reef or jetty needs a source that says it is exposed;
 *  - T-073: a spot a source calls sheltered still estimates when a guide lists the swell directions it IS open to (its "swell exposure"): the window is that open sector, and shelter 1 applies inside it only. A sheltered spot whose guides give only a generic workable range, or say "land in every direction", gets no estimate.
 *  - T-073: when no guide states a single facing, the facing may be DERIVED FROM COASTLINE GEOMETRY (CDIP MOP shore normals, agency data; build-guide-facts.ts), labelled with that provenance, never as a guide statement.
 *  Where two sources disagree the narrower swell window and the more cautious exposure word are used and the disagreement is kept in `notes`. */
export interface GuideSource {url: string; title: string; site: string; retrievedOn: string}
/** A sources entry whose site names "CDIP coastline geometry" is the coastline-geometry source of a derived facing, not a spot guide. */
export const isGeometrySource = (s: {site: string}) => /CDIP coastline geometry/.test(s.site);
export interface GuideFacts {
  spotId: string; sources: GuideSource[];
  facing: {text: string; deg: number; basis?: 'guide' | 'coastline geometry'; sources?: GuideSource[]} | null;
  swellWindow: {text: string; fromDeg: number; toDeg: number; basis: 'exposure' | 'workable'; /** the guide page the range was read from (for the method label) */ source?: 'surfnerd' | 'wannasurf' | 'surf-forecast'} | null;
  /** T-073: the guide's workable range (the swell that makes surf), kept even when the exposure range is the window. */
  workable?: {text: string; fromDeg: number; toDeg: number} | null;
  idealSwell: string | null; /** surfnerd's "workable wind" text (wind directions the guide says work, with its own offshore note): a guide quote, never rendered as the spot's offshore direction */ surfnerdWorkableWind: string | null; tide: string | null; bottom: string | null; waveType: 'beach' | 'point' | 'reef' | 'jetty' | null;
  sizeFt: {min: number; max: number} | null; exposure: 'exposed' | 'somewhat protected' | 'sheltered' | 'not stated'; hazards: string[]; notes: string;
}
export const GENERIC_MIN_PERIOD_S = 8;
export const GENERIC_PERIOD_SOURCES: Source[] = [
  {url: 'https://www.rapturecamps.com/learn-to-surf/wave-knowledge/swell-basics', title: 'Rapture Camps, Swell basics: swell under about 8 seconds is typically choppy and less organized', retrievedOn: '2026-11-02'},
  {url: 'https://www.surfertoday.com/surfing/what-is-a-wind-swell', title: 'Surfertoday: what is a wind swell', retrievedOn: '2026-11-02'},
];
export const MOP_NORMAL_TOLERANCE_DEG = 25;
const diff = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };

export interface Enablement {estimate: boolean; shelter: 1 | 0 | null; reasons: string[]}
/** Whether an estimate may be shown for these guide facts, and why not. */
export function enablement(f: GuideFacts): Enablement {
  const reasons: string[] = [];
  if (!f.facing) reasons.push('no source states which way the beach faces');
  if (!f.swellWindow) reasons.push('no source gives the swell directions that work');
  if (f.exposure === 'sheltered' && !openSector(f)) reasons.push('a source calls the spot sheltered, and no source lists the swell directions it is open to');
  else if (f.exposure !== 'sheltered' && f.waveType && f.waveType !== 'beach' && f.exposure !== 'exposed') reasons.push(`a ${f.waveType} break needs a source that says it is exposed`);
  if (/isn.t much detailed break information/i.test(f.notes)) reasons.push('its only source page says it has no detailed break information on record');
  if (f.facing && wraps(f)) reasons.push(`the guides' working swell (${f.workable!.text}) lies entirely outside 60° of the ${f.facing.text} facing: it wraps around the point or reef, which the straight-shore estimate cannot represent`);
  return {estimate: reasons.length === 0, shelter: reasons.length === 0 ? (openSector(f) ? 0 : 1) : null, reasons};
}
/** T-073: a sheltered spot has a published open sector when its window comes from a guide's swell-exposure list (the directions it is open to), not from a generic workable range. */
export const openSector = (f: GuideFacts) => f.exposure === 'sheltered' && f.swellWindow?.basis === 'exposure';
export const derivedFacing = (f: GuideFacts) => f.facing?.basis === 'coastline geometry';
/** T-073: the published workable swell range has nothing within ±60° of the facing (Mavericks, Rincon: swell wraps onto the break). */
export const wraps = (f: GuideFacts) => !!(f.facing && f.workable && clampWindow(f.workable.fromDeg, f.workable.toDeg, f.facing.deg) === null);
const src = (f: GuideFacts): Source[] => f.sources.filter((s) => !isGeometrySource(s)).map((s) => ({url: s.url, title: s.title, retrievedOn: s.retrievedOn}));
const guide = <T>(value: T, f: GuideFacts, note?: string): Sourced<T> => ({value, status: 'sourced', sources: src(f), provenance: 'published guide', ...(note ? {note} : {})});

/** The spot profile registry entry for one spot's guide facts. Anything the guides do not state stays unknown. */
export function profileFromGuide(f: GuideFacts, base: SpotProfile = emptyProfile(f.spotId)): SpotProfile {
  const p: SpotProfile = {...base};
  if (f.facing && p.orientation.value === null) p.orientation = derivedFacing(f)
    ? {value: {beachNormalDeg: f.facing.deg}, status: 'sourced', sources: (f.facing.sources ?? []).map((s) => ({url: s.url, title: s.title, retrievedOn: s.retrievedOn})), provenance: 'derived from coastline geometry', note: `No guide states a single facing (${f.notes.match(/Sources give different facings \(([^)]*)\)/)?.[1] ?? 'none stated'}); derived from coastline geometry: the circular mean of the nearest CDIP MOP shore normals, ${f.facing.deg}° (about ${f.facing.text}). Approximate; not a survey of the break.`}
    : guide({beachNormalDeg: f.facing.deg}, f, `Published guides say the beach faces ${f.facing.text}; the compass word is rounded to a 22.5° point, so treat it as approximate.`);
  if (f.swellWindow && p.swellWindow.value === null) p.swellWindow = guide({reference: 'offshore' as const, fromDeg: f.swellWindow.fromDeg, toDeg: f.swellWindow.toDeg}, f, `Guide: swell ${f.swellWindow.basis === 'exposure' ? 'exposure' : 'workable range'} "${f.swellWindow.text}"${f.idealSwell ? `; best ${f.idealSwell}` : ''}.${f.notes ? ' ' + f.notes : ''}`);
  if (f.facing && f.swellWindow && enablement(f).estimate && p.periodResponse.value === null) p.periodResponse = {value: {minUsefulS: GENERIC_MIN_PERIOD_S}, status: 'sourced', sources: GENERIC_PERIOD_SOURCES, provenance: 'published guide (generic)', note: 'Generic published threshold (swell under about 8 s is choppy wind swell), not specific to this spot. The guides give no spot minimum.'};
  if (f.sizeFt && p.sizeBand.value === null) p.sizeBand = guide({kind: 'guide-swell-size' as const, minFt: f.sizeFt.min, idealLowFt: f.sizeFt.min, idealHighFt: f.sizeFt.max, maxFt: f.sizeFt.max}, f, 'Guide size range, as the guide words it: the swell size the break works with (surfnerd: "works with swell around ..."), NOT a breaking face height. Shown for reference only: it is not compared with the surf estimate and no rating, call or board match reads it. The guide does not separate ideal from workable, so ideal equals the range.');
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
/** The directions the guides call ideal, per guide, as degrees on the 16-point rose. The text is "<directions> (<guide>); <directions> (<guide>)", with full names ("South-southwest", "SouthWest") or the 16 abbreviations ("NW", "S"), "(both)" for the two main guides, or "<guide>: <text>"; text with no compass word gives none. */
const FULL_WORDS: Record<string, number> = {north: 0, northnortheast: 22.5, northeast: 45, eastnortheast: 67.5, east: 90, eastsoutheast: 112.5, southeast: 135, southsoutheast: 157.5, south: 180, southsouthwest: 202.5, southwest: 225, westsouthwest: 247.5, west: 270, westnorthwest: 292.5, northwest: 315, northnorthwest: 337.5};
const ROSE = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const ABBR: Record<string, number> = Object.fromEntries(ROSE.map((r, i) => [r, i * 22.5]));
const GUIDE_NAME: Record<string, string> = {surfnerd: 'Surfnerd', 'surf-forecast': 'Surf-Forecast', wannasurf: 'Wannasurf'};
export interface IdealByGuide {guides: string[]; dirs: number[]}
export function idealByGuide(t: string | null | undefined): IdealByGuide[] {
  const out: IdealByGuide[] = [], named = (x: string): string[] => { const m = (x.toLowerCase().match(/surfnerd|surf-forecast|wannasurf/g) ?? []), both = /\b(both|agree)/i.test(x); return [...new Set([...m, ...(both ? ['surfnerd', 'surf-forecast'] : [])])]; };
  const dirsIn = (body: string) => [...new Set((body.match(/[A-Za-z]+(?:-[A-Za-z]+)?/g) ?? []).map((w) => ABBR[w] ?? FULL_WORDS[w.toLowerCase().replace(/-/g, '')]).filter((x): x is number => typeof x === 'number'))];
  for (const raw of String(t ?? '').split(';')) {
    const pre = /^\s*(surfnerd|surf-forecast|wannasurf)\s*:/i.exec(raw); let rest = raw.replace(pre?.[0] ?? '', '');
    // "(surf-forecast: southwest)" inside a segment is that guide's own list
    for (const m of [...rest.matchAll(/\(\s*(surfnerd|surf-forecast|wannasurf)\s*:\s*([^)]*)\)/gi)]) { const dirs = dirsIn(m[2]); if (dirs.length) out.push({guides: [m[1].toLowerCase()], dirs}); }
    rest = rest.replace(/\(\s*(surfnerd|surf-forecast|wannasurf)\s*:[^)]*\)/gi, ' ');
    const tag = [...rest.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(' '), guides = pre ? [pre[1].toLowerCase()] : named(tag), dirs = dirsIn(rest.replace(/\([^)]*\)/g, ' '));
    if (dirs.length) out.push({guides, dirs});
  }
  return out;
}
const inWindow = (d: number, [a, b]: [number, number]) => norm(d - a) <= norm(b - a);
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** The guides' best swell directions that lie outside the ±60° window (Dumps: Surf-Forecast's best is SSW, the window starts at SW and W; Surfnerd's exposure is W): said on the spot, never widened by estimate. Only Surfnerd and Surf-Forecast give a "best"; Wannasurf's lists are directions that work, not a best, so they are not used. `dirs` are the outside directions in degrees; `partly` is true when some best direction is inside. Null when none is outside. */
export function outsideFacing(f: GuideFacts, window: [number, number]): {text: string; dirs: number[]; partly: boolean} | null {
  const best = idealByGuide(f.idealSwell).map((x) => ({...x, guides: x.guides.filter((g) => g !== 'wannasurf'), wannaOnly: x.guides.length > 0 && x.guides.every((g) => g === 'wannasurf')})).filter((x) => !x.wannaOnly);
  const named = [...new Set(best.flatMap((x) => x.guides))], all = [...new Set(best.flatMap((x) => x.dirs))].sort((a, b) => a - b), outside = all.filter((d) => !inWindow(d, window));
  if (!outside.length) return null;
  const dirsOf = (g: string) => [...new Set(best.filter((x) => x.guides.includes(g)).flatMap((x) => x.dirs))];
  const items = outside.map((d) => {
    const by = named.filter((g) => dirsOf(g).includes(d)), others = named.filter((g) => !by.includes(g));
    const who = !by.length ? "a guide's best" : named.length >= 2 && by.length === named.length ? "both guides' best" : `${by.map((g) => GUIDE_NAME[g]).join(' and ')}'s best`;
    return `${ROSE[Math.round(d / 22.5) % 16]} (${[who, ...others.map((g) => `${GUIDE_NAME[g]} says ${list(dirsOf(g).map((x) => ROSE[Math.round(x / 22.5) % 16]))}`)].join('; ')})`;
  });
  const partly = all.some((d) => inWindow(d, window));
  return {text: `published best swell is ${partly ? 'partly ' : ''}outside ±60° of the sourced facing: swells from ${list(items)} give no surf-height estimate (never widened by estimate)`, dirs: outside, partly};
}
/** The v1 breaking profile for guide facts, or null when estimates are not allowed. window = the guide's swell range; minPeriod generic; shelter 1; face factors the shared unvalidated 0.7–1.4 band. */
export function breakingProfileFromGuide(f: GuideFacts): BreakingCalibration | null {
  const e = enablement(f); if (!e.estimate || !f.swellWindow || !f.facing) return null;
  const window = clampWindow(f.swellWindow.fromDeg, f.swellWindow.toDeg, f.facing.deg); if (!window) return null;
  return {spotId: f.spotId, faceFactors: [0.7, 1.4], window, minPeriod: GENERIC_MIN_PERIOD_S, shelter: e.shelter!,
    note: `Spot facts from published guides (${src(f).length ? [...new Set(f.sources.filter((s) => !isGeometrySource(s)).map((s) => s.site))].join(', ') : 'none'}): window "${f.swellWindow.text}" limited to ±60° of the facing, facing ${derivedFacing(f) ? `${f.facing.deg}° derived from coastline geometry (CDIP MOP shore normals)` : f.facing.text}. ${outsideFacing(f, window) ? `${outsideFacing(f, window)!.text.replace(/^./, (c) => c.toUpperCase())}. ` : ''}Minimum period is the generic 8 s. ${openSector(f) ? 'Shelter 0 for the offshore-swell estimate (v1 refuses): a source calls it sheltered, and only the CDIP nearshore model (v2), which includes the sheltering, may estimate inside the open sector the guide lists' : `Shelter 1 (${ f.exposure === 'exposed' ? 'a source says exposed' : 'no source says sheltered'}${f.waveType && f.waveType !== 'beach' && !openSector(f) ? `; for this ${f.waveType} that rests on one guide's "exposed" statement` : ''}). Unvalidated.`}${openSector(f) ? '. Unvalidated.' : ''}`};
}
/** A MOP candidate qualifies when its shore normal is within the tolerance of the guide's facing; the closest one wins. */
export function pickMop(f: GuideFacts, candidates: {id: string; shoreNormalDeg: number}[]): {id: string; offsetDeg: number} | null {
  if (!f.facing || !enablement(f).estimate) return null;
  const ok = candidates.map((c) => ({id: c.id, offsetDeg: diff(c.shoreNormalDeg, f.facing!.deg)})).filter((c) => c.offsetDeg <= MOP_NORMAL_TOLERANCE_DEG).sort((a, b) => a.offsetDeg - b.offsetDeg);
  return ok[0] ?? null;
}

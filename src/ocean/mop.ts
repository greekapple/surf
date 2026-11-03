import {guideFactsFor} from './spotFactsSourced.ts';
import {pickMop} from './spotFactsRules.ts';
import {scannedMopPoints, scannedMopCandidates} from './mopCandidatesSourced.ts';
/** CDIP MOP registry (T-041). Which MOP transect a spot may use is a REVIEWED fact, never "nearest wins".
 *  Only `assignments` feed the app. `candidates` are measured metadata awaiting the owner's review (docs/forecast/data/mop-candidates.json).
 *  Metadata (position, depth, shore normal) was read from each point's CDIP file; see scripts/mop-lookup.mjs. */
export interface MopPoint {id: string; lat: number; lon: number; depthM: number; shoreNormalDeg: number; retrievedOn: string}
export interface MopAssignment {spotId: string; mopId: string; status: 'sourced' | 'owner-reviewed'; reviewedBy?: string; reviewedOn?: string; sourceUrl: string; note: string}
export interface MopCandidate {spotId: string; mopIds: string[]; note: string}

export const MOP_ACK = 'CDIP is primarily supported by the U.S. Army Corps of Engineers (USACE). MOP data: Coastal Data Information Program, Scripps Institution of Oceanography, UC San Diego.';
export const mopBase = 'https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore/';
export const mopDodsBase = 'https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/';

const ON = '2026-11-01';
const handPoints: MopPoint[] = [
  {id: 'SF023', lat: 37.74811, lon: -122.51886, depthM: 10, shoreNormalDeg: 263.49, retrievedOn: ON},
  {id: 'SM375', lat: 37.59973, lon: -122.51654, depthM: 15, shoreNormalDeg: 319.97, retrievedOn: ON},
  {id: 'SM376', lat: 37.60069, lon: -122.51473, depthM: 15, shoreNormalDeg: 339.46, retrievedOn: ON},
  {id: 'MA140', lat: 37.88387, lon: -122.67383, depthM: 15, shoreNormalDeg: 173.55, retrievedOn: ON},
];
/** T-073: plus the points near every other spot found by scripts/mop-scan.mjs (src/ocean/mopCandidatesSourced.ts). */
export const mopPoints: MopPoint[] = [...handPoints, ...scannedMopPoints.filter((p) => !handPoints.some((h) => h.id === p.id))];

/** Reviewed assignments. Ocean Beach to SF023 is the one transect CDIP itself documents for the beach (sourced). */
export const mopAssignments: MopAssignment[] = [
  {spotId: 'spot-2', mopId: 'SF023', status: 'sourced', sourceUrl: 'https://cdip.ucsd.edu/mops/?mop=SF023&xitem=info', note: 'CDIP MOP page: representative nearby shore normal 263.49°, 37.74811, −122.51886, 10 m depth. A modelled point at depth, not the surf zone.'},
];

/** Candidates for the owner's review. Not used by the app until moved to `mopAssignments`. */
export const mopCandidates: MopCandidate[] = [
  {spotId: 'spot-3', mopIds: ['SM375', 'SM376'], note: 'Linda Mar: nearest points are 15 m deep (not 10 m) with shore normals 320°–350° that differ strongly between neighbours; whether either represents the beach break is unknown.'},
  {spotId: 'spot-0', mopIds: ['MA140'], note: 'Bolinas: nearest points are 2.8 km away at 15 m with a south-facing normal (~170°); the break’s own transect is unknown.'},
  // T-073: every other spot's nearest points (Ocean Beach keeps its reviewed SF023; Linda Mar and Bolinas keep the lists above)
  ...scannedMopCandidates.filter((c) => !['spot-2', 'spot-3', 'spot-0'].includes(c.spotId)),
];

export const assignmentFor = (spotId: string) => mopAssignments.find((a) => a.spotId === spotId) ?? null;
export const mopPoint = (id: string) => mopPoints.find((p) => p.id === id) ?? null;
/** Ids the server ingests: assigned points only. */
export const assignedMopIds = () => [...new Set(mopAssignments.map((a) => a.mopId))];

export type MopProduct = 'nowcast' | 'forecast';
const VARS = 'waveHs,waveTp,waveDp,waveFlagPrimary';
/** NCSS point CSV for the nowcast (hourly, past) or forecast (3-hourly, about 10 days). */
export function mopURL(id: string, product: MopProduct, now = Date.now()) {
  const day = 86400000, start = new Date(now - day).toISOString(), end = new Date(now + (product === 'forecast' ? 11 * day : day)).toISOString();
  return `${mopBase}${id}_${product}.nc?` + new URLSearchParams({var: VARS, time_start: start, time_end: end, accept: 'csv'});
}
/** Global attributes (issue time and coverage) of the forecast file, as OPeNDAP DAS text. */
export const mopDasURL = (id: string) => `${mopDodsBase}${id}_forecast.nc.das`;

export interface MopIssue {issuedAt: string | null; coverageStart: string | null; coverageEnd: string | null; runStart: string | null; resolution: string | null}
/** Reads only what the file states about itself. Missing or malformed values stay null (no guessing). */
export function parseMopDas(text: string): MopIssue {
  const attr = (name: string) => text.match(new RegExp(`String ${name} "([^"]*)"`))?.[1] ?? null;
  const iso = (v: string | null) => (v && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);
  const run = attr('history')?.match(/-s (\d{12})/)?.[1];
  const runStart = run ? iso(`${run.slice(0, 4)}-${run.slice(4, 6)}-${run.slice(6, 8)}T${run.slice(8, 10)}:${run.slice(10, 12)}:00Z`) : null;
  return {issuedAt: iso(attr('date_issued')), coverageStart: iso(attr('time_coverage_start')), coverageEnd: iso(attr('time_coverage_end')), runStart, resolution: attr('time_coverage_resolution')};
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** T-071: a candidate whose CDIP shore normal is within 25° of the facing the published guides give becomes an assignment (the closest wins); the rest stay candidates and the spot uses v1. */
for (const c of mopCandidates) {
  const f = guideFactsFor(c.spotId); if (!f || assignmentFor(c.spotId)) continue;
  const pick = pickMop(f, c.mopIds.map((id) => mopPoint(id)).filter((p): p is MopPoint => !!p).map((p) => ({id: p.id, shoreNormalDeg: p.shoreNormalDeg})));
  if (pick) mopAssignments.push({spotId: c.spotId, mopId: pick.id, status: 'sourced', sourceUrl: `https://cdip.ucsd.edu/mops/?mop=${pick.id}&xitem=info`,
    note: `${f.facing!.basis === 'coastline geometry' ? `The facing derived from coastline geometry is ${f.facing!.deg}°` : `Published guides say the beach faces ${f.facing!.text} (${f.facing!.deg}°)`}; ${pick.id}'s CDIP shore normal is ${mopPoint(pick.id)!.shoreNormalDeg}°, ${Math.round(pick.offsetDeg)}° away (tolerance 25°), ${mopPoint(pick.id)!.depthM} m depth. Assigned by the facing-match rule, not owner-reviewed.`});
}

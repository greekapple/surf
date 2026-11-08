import {guideFactsFor} from './spotFactsSourced.ts';
import {pickMop} from './spotFactsRules.ts';
import {scannedMopPoints, scannedMopCandidates} from './mopCandidatesSourced.ts';
/** CDIP MOP registry (T-041). Which MOP transect a spot may use is a REVIEWED fact, never "nearest wins".
 *  Only `assignments` feed the app. `candidates` are measured metadata awaiting the owner's review (docs/forecast/data/mop-candidates.json).
 *  Metadata (position, depth, shore normal) was read from each point's CDIP file; see scripts/mop-lookup.mjs. */
export interface MopPoint {id: string; lat: number; lon: number; depthM: number; shoreNormalDeg: number; retrievedOn: string}
export interface MopAssignment {spotId: string; mopId: string; status: 'sourced' | 'owner-reviewed'; reviewedBy?: string; reviewedOn?: string; sourceUrl: string; note: string; /** T-130: who chose the point and how (shown wherever the point's number is shown). */ provenance?: string; /** T-130: what the point's number cannot say about THIS spot (shown beside the number and in the Nearshore panel). */ caveat?: string; /** T-131: our own stated caveat says the spot is usually smaller or more sheltered than the point (so the headline may say so). */ smallerThanPoint?: boolean; /** T-131 phase 2: the buoy figures behind an observation-based caveat (shown in the Nearshore panel, not beside the number). */ buoyEvidence?: string}
export interface MopCandidate {spotId: string; mopIds: string[]; note: string}

export const MOP_ACK = 'CDIP is primarily supported by the U.S. Army Corps of Engineers (USACE). MOP data: Coastal Data Information Program, Scripps Institution of Oceanography, UC San Diego.';
export const mopBase = 'https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore/';
export const mopDodsBase = 'https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/';

const ON = '2026-11-01';
const handPoints: MopPoint[] = [
  {id: 'SF023', lat: 37.74811, lon: -122.51886, depthM: 10, shoreNormalDeg: 263.49, retrievedOn: ON},
  {id: 'SM375', lat: 37.59973, lon: -122.51654, depthM: 15, shoreNormalDeg: 319.97, retrievedOn: ON},
  {id: 'SM376', lat: 37.60069, lon: -122.51473, depthM: 15, shoreNormalDeg: 339.46, retrievedOn: ON},
  // Linda Mar's own transects (2026-11-07): CDIP's MOP pages put their back-beach ends on Pacifica State Beach (OSM way 39970023); all six share one 15 m output point.
  {id: 'SM380', lat: 37.60757, lon: -122.51381, depthM: 15, shoreNormalDeg: 328.19, retrievedOn: '2026-11-07'},
  {id: 'SM381', lat: 37.60757, lon: -122.51381, depthM: 15, shoreNormalDeg: 320.12, retrievedOn: '2026-11-07'},
  {id: 'SM382', lat: 37.60757, lon: -122.51381, depthM: 15, shoreNormalDeg: 312.1, retrievedOn: '2026-11-07'},
  {id: 'SM383', lat: 37.60757, lon: -122.51381, depthM: 15, shoreNormalDeg: 304.19, retrievedOn: '2026-11-07'},
  {id: 'SM384', lat: 37.60757, lon: -122.51381, depthM: 15, shoreNormalDeg: 296.41, retrievedOn: '2026-11-07'},
  {id: 'SM385', lat: 37.60757, lon: -122.51381, depthM: 15, shoreNormalDeg: 288.85, retrievedOn: '2026-11-07'},
  {id: 'MA140', lat: 37.88387, lon: -122.67383, depthM: 15, shoreNormalDeg: 173.55, retrievedOn: ON},
  {id: 'MA137', lat: 37.88436, lon: -122.67226, depthM: 15, shoreNormalDeg: 184, retrievedOn: '2026-11-03'}, // T-130: Bolinas (docs/forecast/data/mop-candidates-all.json)
];
/** T-073: plus the points near every other spot found by scripts/mop-scan.mjs (src/ocean/mopCandidatesSourced.ts). */
export const mopPoints: MopPoint[] = [...handPoints, ...scannedMopPoints.filter((p) => !handPoints.some((h) => h.id === p.id))];

/** Reviewed assignments. Ocean Beach to SF023 is the one transect CDIP itself documents for the beach (sourced). */
export const mopAssignments: MopAssignment[] = [
  {spotId: 'spot-2', mopId: 'SF023', status: 'sourced', sourceUrl: 'https://cdip.ucsd.edu/mops/?mop=SF023&xitem=info', note: 'CDIP MOP page: representative nearby shore normal 263.49°, 37.74811, −122.51886, 10 m depth. A modelled point at depth, not the surf zone.'},
];

/** Candidates for the owner's review. Not used by the app until moved to `mopAssignments`. */
export const mopCandidates: MopCandidate[] = [
  {spotId: 'spot-3', mopIds: ['SM380', 'SM381', 'SM382', 'SM383', 'SM384', 'SM385'], note: 'Linda Mar: CDIP\'s MOP pages (retrieved 2026-11-07) put the back-beach ends of transects SM380–SM385 on Pacifica State Beach (OpenStreetMap way 39970023, 37.5960–37.6049 N); all six share one output point 15 m deep, about 1.3 km off the beach (1.48 km from the spot pin), so their heights are identical and only the shore normal differs (289°–328° around the crescent). SM375 and SM376, offered before, start about 800 m west on the rocky north side of San Pedro Point; SM375 reads about 17–20% lower than SM382 in both windows of docs/forecast/ACCURACY-VS-BUOYS.md.'},
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

/** T-131: a guide-stated shelter shown with the point's number (the guide gives no size factor, so none is claimed). */
const carmel = mopAssignments.find((x) => x.spotId === 'cs-carmel'); if (carmel) { carmel.caveat = 'a guide says the kelp and cove give real shelter, but not by how much'; carmel.note += ' Shelter: surfnerd (https://www.surfnerd.com/surf-forecast/carmel-beach, retrieved 2026-11-04): "The kelp and cove give the beach real shelter"; the point is in 15 m of water, about 1 km out; the guide does not say whether this shelter reduces wave size, or by how much.'; }   // one short line beside the number; the source and quote in the Nearshore panel's note

const T130_PROVENANCE = 'Chosen by us from CDIP shore normals (T-130), not owner-reviewed';
mopAssignments.push(
  // T-130: spots the facing-match rule refused (wrap or sheltered breaks) or found no point for. The four refused spots have NO breaking profile (the straight-in v1 rule refuses wrap), so they show MOP's own nearshore height at the point as the surf estimate (headlineSurf: nearshoreOnly), never an invented breaking profile.
  {spotId: 'spot-5', mopId: 'SM306', status: 'sourced', sourceUrl: 'https://cdip.ucsd.edu/mops/?mop=SM306&xitem=info', provenance: T130_PROVENANCE, caveat: 'a 15 m point off the reef; the reef’s focusing is not modelled, so waves at the peak can be much larger',
    note: 'Mavericks: SM306 (37.49657, −122.50756, 15 m, shore normal 262.5°, 0.69 km). The W-facing point off Pillar Point’s outer reef: the reef works on W–NW swell, which the SSW-facing points (SM302–SM304) inside the harbour lee would miss. A 15 m modelled point, not the reef peak. ' + T130_PROVENANCE + '.'},
  {spotId: 'spot-7', mopId: 'SC149', status: 'sourced', sourceUrl: 'https://cdip.ucsd.edu/mops/?mop=SC149&xitem=info', provenance: T130_PROVENANCE, smallerThanPoint: true, caveat: 'the point is at the bay mouth and shared with Steamer Lane; the sheltered cove is usually smaller',
    note: 'Cowell’s: SC149 (36.94873, −122.02122, 15 m, shore normal 127.5°, 1.48 km). The nearest point in Santa Cruz’s bay with the beach’s SE-ish normal (guide: ESE 112.5°). Cowell’s is a sheltered wrap point, so this point at the bay mouth will read high. ' + T130_PROVENANCE + '.'},
  {spotId: 'cs-shelter-cove', mopId: 'HU029', status: 'sourced', sourceUrl: 'https://cdip.ucsd.edu/mops/?mop=HU029&xitem=info', provenance: T130_PROVENANCE,
    note: 'Shelter Cove: HU029 (40.01895, −124.0775, 15 m, shore normal 225°, 0.85 km). No guide states a facing; HU029’s 225° normal lies inside the guide’s exposure (SSE–SW) and workable (SSW–W) sectors. ' + T130_PROVENANCE + '.'},
  {spotId: 'cs-rincon', mopId: 'B0001', status: 'sourced', sourceUrl: 'https://cdip.ucsd.edu/mops/?mop=B0001&xitem=info', provenance: T130_PROVENANCE,
    note: 'Rincon: B0001 (34.3688, −119.47874, 10 m, shore normal 190°, 0.47 km). The closest normal to the point’s SSW facing (VE677/VE678 face SSE, 159–161°). ' + T130_PROVENANCE + '.'},
  {spotId: 'spot-0', mopId: 'MA137', status: 'sourced', sourceUrl: 'https://cdip.ucsd.edu/mops/?mop=MA137&xitem=info', provenance: T130_PROVENANCE, smallerThanPoint: true, caveat: 'the point is 2.8 km out at the mouth of Bolinas Bay; the beach is more sheltered and usually smaller',
    note: 'Bolinas: MA137 (37.88436, −122.67226, 15 m, shore normal 184°, 2.8 km). The guide says Bolinas works on S swell (window S, exposure SSE–SW) and faces SE; MA137’s southerly normal is the best match among the bay-mouth points (MA129–MA141, 169–208°, all 2.7–2.8 km out). ' + T130_PROVENANCE + '.'},
);

/** T-131 phase 2: caveats from REAL buoy observations (docs/forecast/ACCURACY-VS-BUOYS.md, generated by docs/forecast/data/accuracy-vs-buoys.ts; archive window
 *  2025-11-01 to 2026-05-01, later window 2026-10-07 to 2026-11-06). Where the nearest buoys show CDIP's model is off, or no buoy can check the point, the spot
 *  says so in ONE sentence beside the number (`caveat`); the figures go to the Nearshore panel (`buoyEvidence`). No number is changed by these.
 *  (A first draft also flagged Ocean Beach in big swell; binned by the OBSERVED height the San Francisco Bar buoy matches the model at every size, so it was dropped.) */
const BAY = {caveat: 'measured waves near Pacific Grove do not confirm CDIP’s model, and this point has no buoy check',
  evidence: 'at the Cabrillo Point buoy (CDIP 158, 17 m, Pacific Grove) the measured waves were about 30% larger than CDIP’s model at the buoy’s own site (median measured ÷ model 1.30, 4,343 hours, Nov 2025–Apr 2026); at the outer Monterey Canyon buoy (CDIP 156, 133 m) the model read 0.5 ft high (Nov 2025–Apr 2026) and 0.8 ft high (Oct–Nov 2026)'};
export const BUOY_CAVEATS: Record<string, {caveat: string; evidence: string}> = {
  'cs-moss-landing': BAY, 'cs-asilomar': BAY, 'cs-carmel': BAY,
  'cs-morro-rock': {caveat: 'the two nearest measuring buoys disagree about CDIP’s model, and this point has no buoy check',
    evidence: 'at Diablo Canyon (CDIP 076, 27 m, 19 km south) the measured waves were about 20% larger than the model at the buoy’s own site (median ratio 1.21, Nov 2025–Jan 2026 and Oct–Nov 2026, 2,345 hours); at Avila Beach (CDIP 285, 15 m, 26 km) the model matched (bias +0.1 ft, 721 hours, Oct–Nov 2026)'},
  'cs-jalama': {caveat: 'no measuring buoy can check CDIP’s model at this point',
    evidence: 'the nearest buoy (Harvest, CDIP 071, 550 m deep, 26 km west of Point Conception) has no quality-good model value at its own site (CDIP flags it), Nov 2025–Apr 2026 and Oct–Nov 2026'},
};
for (const [spotId, x] of Object.entries(BUOY_CAVEATS)) { const a = mopAssignments.find((y) => y.spotId === spotId); if (a) { a.caveat = a.caveat ? `${a.caveat}; also, ${x.caveat}` : x.caveat; a.buoyEvidence = x.evidence; } }

/** Per-spot profile schema (T-041, RATING-V2-PLAN §3). Every value is `null` (unknown) until a source and, for local knowledge, a reviewer are recorded.
 *  A drafted value waiting for the owner lives in `proposal`, never in `value`. Nothing here changes a rating. */
export type Status = 'unknown' | 'sourced' | 'owner-reviewed' | 'measured' | 'validated';
export interface Source {url: string; title: string; retrievedOn: string; quote?: string}
export interface Proposal<T> {value: T; sources: Source[]; note: string}
/** Where a sourced value comes from: a published spot guide (T-071, user decision "look at public sources and apply"), a generic published rule that is not specific to the spot, or an agency dataset. */
export type Provenance = 'published guide' | 'published guide (generic)' | 'agency data' | 'derived from coastline geometry' | 'our own evidence';   // 'our own evidence': SWELLO's own measured check (e.g. the US Atlantic 7 s minimum, docs/forecast/ATLANTIC-8S.md); never labelled a published value
export interface Sourced<T> {value: T | null; status: Status; sources: Source[]; provenance?: Provenance; reviewedBy?: string; reviewedOn?: string; note?: string; proposal?: Proposal<T>}

export interface SpotProfile {
  spotId: string; schemaVersion: 1;
  mop: Sourced<{id: string; lat: number; lon: number; depthM: number; shoreNormalDeg: number}>;
  orientation: Sourced<{beachNormalDeg: number}>;
  swellWindow: Sourced<{reference: 'mop10m' | 'offshore'; fromDeg: number; toDeg: number; idealDeg?: number}>;
  periodResponse: Sourced<{minUsefulS: number; idealLowS?: number; idealHighS?: number; maxUsefulS?: number}>;
  /** What a guide's size range IS: the swell size the break works with (surfnerd "works with swell around..."), not a breaking face height. Reference only: no rating, call, board match or estimate reads it. */
  sizeBand: Sourced<{kind: 'guide-swell-size'; minFt: number; idealLowFt: number; idealHighFt: number; maxFt: number}>;
  tideWindow: Sourced<{stationId: string; datum: 'MLLW'; lowFt?: number; highFt?: number; stage?: ('rising' | 'falling' | 'any')[]}>;
  windTolerance: Sourced<{normalDeg: number; offshoreGoodMph: number; offshorePoorMph: number; crossPoorMph: number; onshorePoorMph: number}>;
  bottom: Sourced<{type: 'sand-bar' | 'reef' | 'point' | 'rock' | 'jetty-influenced' | 'mixed'; stability: 'mobile' | 'fixed'}>;
  hazards: Sourced<string[]>;
  calibration: {status: 'uncalibrated' | 'reviewed' | 'validated'; coefficients: Record<string, number> | null; sampleCount: number; validationRef: string | null};
}
export type ProfileField = Exclude<keyof SpotProfile, 'spotId' | 'schemaVersion' | 'calibration'>;
export const PROFILE_FIELDS: ProfileField[] = ['mop', 'orientation', 'swellWindow', 'periodResponse', 'sizeBand', 'tideWindow', 'windTolerance', 'bottom', 'hazards'];
export const FIELD_LABEL: Record<ProfileField, string> = {mop: 'Nearshore model point (MOP)', orientation: 'Beach orientation', swellWindow: 'Swell window', periodResponse: 'Useful swell period', sizeBand: 'Guide swell size range (reference)', tideWindow: 'Tide window', windTolerance: 'Wind tolerance', bottom: 'Bottom and bar type', hazards: 'Hazards'};

export const unknown = <T>(note?: string, proposal?: Proposal<T>): Sourced<T> => ({value: null, status: 'unknown', sources: [], ...(note ? {note} : {}), ...(proposal ? {proposal} : {})});
export const emptyProfile = (spotId: string): SpotProfile => ({spotId, schemaVersion: 1, mop: unknown(), orientation: unknown(), swellWindow: unknown(), periodResponse: unknown(), sizeBand: unknown(), tideWindow: unknown(), windTolerance: unknown(), bottom: unknown(), hazards: unknown(), calibration: {status: 'uncalibrated', coefficients: null, sampleCount: 0, validationRef: null}});

const RANK: Status[] = ['unknown', 'sourced', 'owner-reviewed', 'measured', 'validated'];
/** A rating factor may rely only on the lowest status among the fields it needs; any unknown field means no score for that factor. */
export function lowestStatus(p: SpotProfile, fields: ProfileField[]): Status {
  return fields.reduce<Status>((low, f) => (RANK.indexOf(p[f].status) < RANK.indexOf(low) ? p[f].status : low), 'validated');
}
/** Rules the registry must satisfy. Returns the list of violations (empty = valid). */
export function profileProblems(p: SpotProfile): string[] {
  const out: string[] = [];
  for (const f of PROFILE_FIELDS) {
    const s = p[f] as Sourced<unknown>, at = `${p.spotId}.${f}`;
    if (s.value === null && s.status !== 'unknown') out.push(`${at}: null value must have status unknown`);
    if (s.value !== null && s.status === 'unknown') out.push(`${at}: a value needs a status above unknown`);
    if (s.value !== null && !s.sources.length) out.push(`${at}: a value needs at least one source`);
    for (const x of [...s.sources, ...(s.proposal?.sources ?? [])]) if (!/^https:\/\//.test(x.url) || !x.title || !/^\d{4}-\d\d-\d\d$/.test(x.retrievedOn)) out.push(`${at}: source needs https url, title and retrievedOn`);
    if (s.status === 'owner-reviewed' && (!s.reviewedBy || !s.reviewedOn)) out.push(`${at}: owner-reviewed needs reviewedBy and reviewedOn`);
    if (s.proposal && s.value !== null && JSON.stringify(s.proposal.value) === JSON.stringify(s.value)) out.push(`${at}: proposal equals the accepted value; remove it`);
    if (['measured', 'validated'].includes(s.status)) out.push(`${at}: ${s.status} needs a validation record that does not exist yet`);
  }
  if (p.calibration.status !== 'uncalibrated' || p.calibration.coefficients !== null || p.calibration.sampleCount !== 0) out.push(`${p.spotId}.calibration: nothing may be calibrated before validation exists`);
  return out;
}

/** In-app session log (T-041, decision D-3): the only ground truth for the rating. Local to this browser, never uploaded.
 *  Heights are stored in FEET of face height (trough to crest), the height you would quote, which is what the "Est. X–Y ft surf height" labels estimate (the surf-report convention); the calibration ratio absorbs any difference between the two.
 *  No data is scraped or imported from anywhere else. */
export const SESSION_LOG_KEY = 'swello-session-log';
export const SESSION_LOG_SCHEMA = 1;
export const FT_PER_M = 1 / 0.3048;

export interface ObservationContext {
  /** What the app showed or knew when the surfer logged it; used later to compare, never to correct the observation. */
  mop?: {mopId: string; product: 'nowcast' | 'forecast'; validAt: string; hsFt: number | null; tpS: number | null; dpDeg: number | null};
  heightLabel?: string;       // the headline height text shown for that hour, if any
  estimateRangeFt?: [number, number] | null; // the surf-height range the app showed for that hour (T-081: the headline's convention range), if one existed
}
/** The model's breaking estimate for the observed spot-hour, captured when the observation was logged (past forecasts are not kept). `centralFt` is the midpoint of the uncalibrated range. */
export interface ModelPair {/** T-131 phase 2: the buoy-transfer factor already applied to centralFt (v1 only; 1 = none; absent = recorded before the factor existed). */ transfer?: number; centralFt: number; loFt: number; hiFt: number; method: 'mop-v2' | 'v1'; validAt: string; offshoreHsFt: number | null; primaryTpS: number | null; /** quiver item 3: the forecast's other inputs for that hour (absent on pairs recorded before they were kept) */ dirDeg?: number | null; windMph?: number | null; windRel?: string | null; tide?: 'rising' | 'falling' | null; /** the estimate was a saved or stale copy (never compared); MOP nearshore-only point (never compared with a breaking-rule estimate); flat */ stale?: boolean; nearshoreOnly?: boolean; flat?: boolean; /** 'archived' = what this device had shown before the session (T-064); 'current' = the run at logging time. */ source?: 'archived' | 'current'; leadH?: number; /** 'surf-height' = centralFt is the surf height by the common convention (T-077). Pairs without it (the old fixed-band midpoint, or T-073's breaking-height center) are not mixed into a fit. */ basis?: 'surf-height'}
export interface SessionObservation {
  id: string; schema: 1; spotId: string;
  observedAt: string;          // ISO UTC, when the surf was observed (start of session)
  loggedAt: string;            // ISO UTC, when this record was written
  rangeFt: [number, number];   // observed face height range
  quality?: 1 | 2 | 3 | 4 | 5; // quality of the waves (not of the session); optional for a two-tap quick log (T-059)
  /** T-059 quick log: the body word the surfer picked and the face height we map it to, plus the model estimate the app had for that hour at the time (the pairing the calibration fits on). */
  word?: string; faceFt?: number; pair?: ModelPair;
  /** false = the surfer gave a DATE only (the stored instant is not a time of day); the app then shows the date and never an hour. Absent = a real time. Set at entry, never inferred from a midnight. */
  timeKnown?: false;
  barNote?: string;            // free text about the sandbar / bottom that day
  context?: ObservationContext;
}
export interface ObservationInput {spotId: string; observedAt: string; /** false: only the date is known (a date-only string also means this) */ timeKnown?: boolean; lo: number; hi: number; unit: 'ft' | 'm'; quality: number; barNote?: string}
export type Checked = {ok: true; value: Omit<SessionObservation, 'id' | 'loggedAt' | 'schema'>} | {ok: false; error: string};

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Validates one entry. Rejects instead of repairing: a ground-truth record is either what the surfer said or absent. */
export function checkObservation(i: ObservationInput, now = Date.now()): Checked {
  if (!i.spotId) return {ok: false, error: 'Choose a spot.'};
  const t = Date.parse(i.observedAt);
  if (!Number.isFinite(t)) return {ok: false, error: 'Enter when you surfed.'};
  if (t > now + 5 * 60000) return {ok: false, error: 'The session time is in the future.'};
  if (t < now - 366 * 86400000) return {ok: false, error: 'The session time is more than a year ago.'};
  if (!Number.isFinite(i.lo) || !Number.isFinite(i.hi)) return {ok: false, error: 'Enter the lowest and highest face height you saw.'};
  const k = i.unit === 'm' ? FT_PER_M : 1, lo = round1(i.lo * k), hi = round1(i.hi * k);
  if (lo < 0 || hi > 60) return {ok: false, error: 'Face height must be between 0 and 60 ft.'};
  if (hi < lo) return {ok: false, error: 'The highest height is below the lowest.'};
  if (!Number.isInteger(i.quality) || i.quality < 1 || i.quality > 5) return {ok: false, error: 'Rate the waves from 1 to 5.'};
  const barNote = (i.barNote ?? '').trim().slice(0, 200);
  return {ok: true, value: {spotId: i.spotId, observedAt: new Date(t).toISOString(), ...(i.timeKnown === false || /^\d{4}-\d{2}-\d{2}$/.test(i.observedAt.trim()) ? {timeKnown: false as const} : {}), rangeFt: [lo, hi], quality: i.quality as 1 | 2 | 3 | 4 | 5, ...(barNote ? {barNote} : {})}};
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStore = (): Store | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };
const isObs = (o: any): o is SessionObservation => o && typeof o.id === 'string' && o.schema === 1 && typeof o.spotId === 'string' && Number.isFinite(Date.parse(o.observedAt)) && Array.isArray(o.rangeFt) && o.rangeFt.length === 2 && o.rangeFt.every(Number.isFinite) && o.rangeFt[0] <= o.rangeFt[1] && (o.quality === undefined || [1, 2, 3, 4, 5].includes(o.quality));

/** Reads the log; anything malformed is dropped, never repaired. */
export function loadLog(store: Store | null = defaultStore()): SessionObservation[] {
  try { const v = JSON.parse(store?.getItem(SESSION_LOG_KEY) ?? '[]'); return Array.isArray(v) ? v.filter(isObs).sort((a, b) => b.observedAt.localeCompare(a.observedAt)) : []; } catch { return []; }
}
/** Returns false when the browser refused the write (full or blocked storage), so the caller can say so. */
export function saveLog(log: SessionObservation[], store: Store | null = defaultStore()): boolean {
  try { if (!store) return false; store.setItem(SESSION_LOG_KEY, JSON.stringify(log)); return true; } catch { return false; }
}
export function addObservation(log: SessionObservation[], v: Checked & {ok: true}, context: ObservationContext | undefined, now = Date.now(), id: string = crypto.randomUUID()): SessionObservation[] {
  const rec: SessionObservation = {id, schema: 1, loggedAt: new Date(now).toISOString(), ...v.value, ...(context && Object.keys(context).length ? {context} : {})};
  return [rec, ...log].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}
export const removeObservation = (log: SessionObservation[], id: string) => log.filter((o) => o.id !== id);

export function logToJson(log: SessionObservation[], exportedAt = new Date().toISOString()): string {
  return JSON.stringify({kind: 'swello-session-log', schema: SESSION_LOG_SCHEMA, exportedAt, heightQuantity: 'face height, trough to crest, feet', count: log.length, observations: log}, null, 1) + '\n';
}
const csvCell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function logToCsv(log: SessionObservation[]): string {
  const head = ['id', 'spotId', 'observedAt', 'loggedAt', 'faceMinFt', 'faceMaxFt', 'waveQuality1to5', 'barNote', 'mopId', 'mopProduct', 'mopValidAt', 'mopHsFt', 'mopTpS', 'mopDpDeg', 'headlineHeightShown', 'appEstimateMinFt', 'appEstimateMaxFt'];
  const rows = log.map((o) => [o.id, o.spotId, o.observedAt, o.loggedAt, o.rangeFt[0], o.rangeFt[1], o.quality, o.barNote, o.context?.mop?.mopId, o.context?.mop?.product, o.context?.mop?.validAt, o.context?.mop?.hsFt === null || o.context?.mop?.hsFt === undefined ? '' : round1(o.context.mop.hsFt), o.context?.mop?.tpS, o.context?.mop?.dpDeg, o.context?.heightLabel, o.context?.estimateRangeFt?.[0], o.context?.estimateRangeFt?.[1]].map(csvCell).join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}
/** Browser download of text. Returns false when there is no DOM. */
export function downloadText(name: string, text: string, type: string): boolean {
  if (typeof document === 'undefined') return false;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); return true;
}

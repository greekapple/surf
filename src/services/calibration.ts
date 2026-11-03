import type {Forecast, UserProfile} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {assignmentFor} from '../ocean/mop.ts';
import {pacificDate} from '../ocean/time.ts';
import {headlineSurf} from './headlineSurf.ts';
import {recordAt} from './spotHour.ts';
import {predictedFor} from './forecastArchive.ts';
import {BODY_TICKS, bodyWord} from './bodyWords.ts';
import {fitFor, NEEDED, observedFt, type Method} from './calibrationMath.ts';
import {getObservations, getFelt, setObservations, subscribeObservations, resetObservationCache} from './observationStore.ts';
import type {ModelPair, SessionObservation} from './sessionLog.ts';

/** The quick observation API (T-059). An observation is what the SURFER saw, never shown as a measurement; it is stored in the session log (local to this browser).
 *  Each one is paired with the model's breaking estimate for the same spot and hour at the moment it is logged (v2 where a reviewed MOP point has data, else v1, from the
 *  UNCALIBRATED path so the fit never feeds on itself), with the offshore Hs and primary period of that hour. The fit lives in calibrationMath.ts. */
export type BodyWord = 'ankle' | 'knee' | 'thigh' | 'waist' | 'chest' | 'shoulder' | 'head' | 'overhead' | 'double overhead';
export const BODY_WORD_LIST: BodyWord[] = BODY_TICKS.map(([w]) => w as BodyWord);
/** Our mapping from a picked word to a face height in feet: the anchors where the source gives one; overhead and double overhead are bands, so we take a mid-band value (8 ft, 14 ft). Approximate by nature. */
export const WORD_FACE_FT: Record<BodyWord, number> = {ankle: 1, knee: 2, thigh: 2.5, waist: 3, chest: 4, shoulder: 4.5, head: 5, overhead: 8, 'double overhead': 14};
export interface Observation {id: string; spotId: string; observedAt: string; loggedAt: string; word: BodyWord; faceFt: number; quality: 1 | 2 | 3 | 4 | 5 | null; note?: string; paired: boolean}
export interface LogEnv {records?: Forecast[]; bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null; profile?: UserProfile; nowMs?: number}
export interface LogInput {spotId: string; observedAt: string; word: BodyWord; quality?: 1 | 2 | 3 | 4 | 5 | null; note?: string}

const view = (o: SessionObservation): Observation => {
  const ft = observedFt(o), w = (o.word && (BODY_WORD_LIST as string[]).includes(o.word) ? o.word : bodyWord(ft) ?? 'ankle') as BodyWord;
  return {id: o.id, spotId: o.spotId, observedAt: o.observedAt, loggedAt: o.loggedAt, word: w, faceFt: ft, quality: o.quality ?? null, ...(o.barNote ? {note: o.barNote} : {}), paired: !!o.pair};
};

/** The model estimate for one spot-hour, uncalibrated, as a pair; null when the hour has no record or no presentable estimate. */
export function pairFor(spotId: string, records: Forecast[] | undefined, observedAtMs: number, bundle: LogEnv['bundle'], nowMs: number): ModelPair | null {
  // Prefer what was PREDICTED before the session (the archive); it needs no current record, so an observation logged days later still pairs.
  const hourIso = new Date(Math.floor(observedAtMs / 3600000) * 3600000).toISOString(), was = predictedFor(spotId, hourIso, observedAtMs);
  if (was && was.k === 'estimate' && was.m && was.lo !== null && was.hi !== null) return {centralFt: (was.lo + was.hi) / 2, loFt: was.lo, hiFt: was.hi, method: was.m, validAt: hourIso, offshoreHsFt: was.off, primaryTpS: was.tp, source: 'archived', leadH: was.lead};
  // Fallback: the run at logging time, which needs a current record for the SAME hour (never a neighbouring one).
  const f = records && recordAt(records, spotId, observedAtMs);
  if (!f || Math.floor(Date.parse(f.timestamp) / 3600000) !== Math.floor(observedAtMs / 3600000)) return null;
  const h = headlineSurf(spotId, f, {bundle, nowMs, observations: []});
  if (h.kind !== 'estimate') return null;
  const hs = f.evidence?.offshore?.value ?? (Number.isFinite(f.offshore) ? f.offshore : null), tp = f.primary?.period;
  return {centralFt: h.centralFt ?? (h.loFt + h.hiFt) / 2, loFt: h.loFt, hiFt: h.hiFt, method: h.method, validAt: f.timestamp, offshoreHsFt: Number.isFinite(hs as number) ? (hs as number) : null, primaryTpS: Number.isFinite(tp) ? tp : null, source: 'current'};
}

export function logObservation(i: LogInput, env: LogEnv = {}): {ok: true; obs: Observation} | {ok: false; error: string} {
  const now = env.nowMs ?? Date.now(), t = Date.parse(i.observedAt);
  if (!evidenceSpots.some((s) => s.id === i.spotId)) return {ok: false, error: 'Unknown spot.'};
  if (!(BODY_WORD_LIST as string[]).includes(i.word)) return {ok: false, error: 'Pick how big it looked.'};
  if (!Number.isFinite(t)) return {ok: false, error: 'Enter when you surfed.'};
  if (t > now + 5 * 60000) return {ok: false, error: 'That time is in the future.'};
  if (t < now - 366 * 86400000) return {ok: false, error: 'That time is more than a year ago.'};
  if (i.quality !== undefined && i.quality !== null && ![1, 2, 3, 4, 5].includes(i.quality)) return {ok: false, error: 'Rate the waves from 1 to 5.'};
  const ft = WORD_FACE_FT[i.word], pair = pairFor(i.spotId, env.records, t, env.bundle, now), note = (i.note ?? '').trim().slice(0, 200);
  const rec: SessionObservation = {id: crypto.randomUUID(), schema: 1, spotId: i.spotId, observedAt: new Date(t).toISOString(), loggedAt: new Date(now).toISOString(), rangeFt: [ft, ft],
    ...(i.quality ? {quality: i.quality} : {}), word: i.word, faceFt: ft, ...(note ? {barNote: note} : {}), ...(pair ? {pair} : {})};
  setObservations([rec, ...getObservations()].sort((a, b) => b.observedAt.localeCompare(a.observedAt)));
  return {ok: true, obs: view(rec)};
}
/** Newest first; no spotId = every spot (the journal). */
export const observationsFor = (spotId?: string): Observation[] => getObservations().filter((o) => !spotId || o.spotId === spotId).map(view);
/** The newest observation made on the same Pacific day as `nowMs`, else null (what the Surf card shows: "You saw ~head high"). */
export function latestObservation(spotId: string, nowMs: number): Observation | null {
  const day = pacificDate(new Date(nowMs).toISOString()), o = getObservations().find((x) => x.spotId === spotId && pacificDate(x.observedAt) === day);
  return o ? view(o) : null;
}
export function deleteObservation(id: string): boolean {
  const log = getObservations();
  if (!log.some((o) => o.id === id)) return false;
  setObservations(log.filter((o) => o.id !== id)); return true;
}
export type CalibrationState = {state: 'collecting'; count: number; needed: number; felt: FeltSummary} | {state: 'active'; count: number; needed: number; ratio: number; iqr: [number, number]; felt: FeltSummary};
export interface FeltSummary {low: number; right: number; high: number; factor: number}
/** Calibration status for a spot, for the method its headline normally uses (v2 where the spot has a reviewed MOP point, else v1). `count` is paired observations only. */
export function calibrationFor(spotId: string, method?: Method): CalibrationState {
  const m: Method = method ?? (assignmentFor(spotId) ? 'mop-v2' : 'v1');
  const fl = getFelt().filter((e) => e.spotId === spotId && e.predicted?.method === m), counts = {low: fl.filter((e) => e.felt === 'low').length, right: fl.filter((e) => e.felt === 'right').length, high: fl.filter((e) => e.felt === 'high').length};
  const f = fitFor(getObservations(), spotId, m, counts), felt = {...counts, factor: f.felt?.factor ?? 1};
  return f.status === 'active' ? {state: 'active', count: f.n, needed: NEEDED, ratio: f.ratio!, iqr: f.iqr!, felt} : {state: 'collecting', count: f.n, needed: NEEDED, felt};
}
export const getObservationsSnapshot = getObservations;
export {subscribeObservations, resetObservationCache, NEEDED};

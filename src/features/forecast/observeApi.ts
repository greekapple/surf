/** T-060: the observation API the UI uses. Engineering owns it (T-059, src/services/calibration.ts); this file is the seam.
 *  STUB until T-059 lands: same signatures, stored locally under its own key. It never claims calibration is active (only engineering's
 *  calibration can make that true), so the UI shows "Calibrating: n of 8" at most. Replace the body with
 *  `export * from '../../services/calibration';` when it is merged. */
import type {UserProfile} from '../../models/index';
import type {OceanBundle} from '../../ocean/types';
import {BODY_TICKS} from '../../services/bodyWords';

export type BodyWord = 'ankle' | 'knee' | 'thigh' | 'waist' | 'chest' | 'shoulder' | 'head' | 'overhead' | 'double overhead';
export type Quality = 1 | 2 | 3 | 4 | 5;
export interface Observation {id: string; spotId: string; observedAt: string; loggedAt: string; word: BodyWord; faceFt: number; quality: Quality | null; paired?: boolean; note?: string}
export interface ObserveEnv {records: unknown[]; bundle: OceanBundle | null | undefined; profile: UserProfile; nowMs: number}
export type Calibration = {state: 'collecting'; count: number; needed: number} | {state: 'active'; count: number; needed: number; ratio: number; iqr: [number, number]};

const KEY = 'swello-t060-observation-stub', DAY = 864e5;
const WORDS = BODY_TICKS.map(([w]) => w) as BodyWord[];
const subs = new Set<() => void>();
const read = (): Observation[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
let snap = read();
const write = (v: Observation[]) => { snap = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage full or blocked: kept for this visit */ } subs.forEach((f) => f()); };
const pt = (ms: number) => new Date(ms).toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});

export function logObservation(i: {spotId: string; observedAt: string; word: BodyWord; quality?: Quality | null; note?: string}, env?: ObserveEnv): {ok: true; obs: Observation} | {ok: false; error: string} {
  const t = Date.parse(i.observedAt), now = env?.nowMs ?? Date.now();
  if (!Number.isFinite(t)) return {ok: false, error: 'That time could not be read.'};
  if (t > now + 5 * 60e3) return {ok: false, error: 'That time is in the future.'};
  if (t < now - 366 * DAY) return {ok: false, error: 'That is more than a year ago.'};
  if (!WORDS.includes(i.word)) return {ok: false, error: 'Pick a size.'};
  const obs: Observation = {id: crypto.randomUUID(), spotId: i.spotId, observedAt: new Date(t).toISOString(), loggedAt: new Date(now).toISOString(), word: i.word,
    faceFt: BODY_TICKS.find(([w]) => w === i.word)![1], quality: i.quality ?? null, paired: !!env, ...(i.note ? {note: i.note} : {})};
  write([obs, ...snap]);
  return {ok: true, obs};
}
export const getObservationsSnapshot = () => snap;
export const observationsFor = (spotId?: string) => [...snap].filter((o) => !spotId || o.spotId === spotId).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
export const latestObservation = (spotId: string, nowMs: number) => observationsFor(spotId).find((o) => pt(Date.parse(o.observedAt)) === pt(nowMs)) ?? null;
export const calibrationFor = (spotId: string): Calibration => ({state: 'collecting', count: observationsFor(spotId).filter((o) => o.paired).length, needed: 8});
export function deleteObservation(id: string) { const n = snap.filter((o) => o.id !== id); if (n.length === snap.length) return false; write(n); return true; }
export function subscribeObservations(cb: () => void) {
  subs.add(cb);
  const st = (e: StorageEvent) => { if (e.key === KEY) { snap = read(); cb(); } };
  addEventListener('storage', st);
  return () => { subs.delete(cb); removeEventListener('storage', st); };
}

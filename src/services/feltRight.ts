import {pacificDate} from '../ocean/time.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {getFelt, setFelt, type FeltEntry, type FeltSignal} from './observationStore.ts';
import {predictedFor} from './forecastArchive.ts';
import {headlineSurf} from './headlineSurf.ts';
import {recordAt} from './spotHour.ts';
import type {LogEnv} from './calibration.ts';

/** "Felt right?" (T-064): one tap, too low / right / too high, about one spot-hour, paired with what was PREDICTED (the archive) or, failing that, the run now.
 *  Direction only, stored separately from the body-word observations, and used as a weaker nudge on an active calibration (see calibrationMath.FELT_STEP). Never shown as a measurement. */
export type Felt = FeltSignal;
export function logFeltRight(i: {spotId: string; at: string; felt: Felt}, env: LogEnv = {}): {ok: true} | {ok: false; error: string} {
  const now = env.nowMs ?? Date.now(), t = Date.parse(i.at);
  if (!evidenceSpots.some((s) => s.id === i.spotId)) return {ok: false, error: 'Unknown spot.'};
  if (!['low', 'right', 'high'].includes(i.felt)) return {ok: false, error: 'Choose too low, right or too high.'};
  if (!Number.isFinite(t)) return {ok: false, error: 'Missing the hour.'};
  if (t > now + 5 * 60000) return {ok: false, error: 'That time is in the future.'};
  if (t < now - 366 * 86400000) return {ok: false, error: 'That time is more than a year ago.'};
  let predicted: FeltEntry['predicted'] = null;
  const was = predictedFor(i.spotId, i.at, now);
  if (was && was.k === 'estimate' && was.m && was.lo !== null && was.hi !== null) predicted = {conv: was.cs !== undefined ? true : undefined, loFt: was.lo, hiFt: was.hi, method: was.m, source: 'archived'};
  else { const f = env.records && recordAt(env.records, i.spotId, t); if (f && Math.floor(Date.parse(f.timestamp) / 3600000) === Math.floor(t / 3600000)) { const h = headlineSurf(i.spotId, f, {bundle: env.bundle, nowMs: now, observations: [], felt: []}); if (h.kind === 'estimate') predicted = {conv: true, loFt: h.loFt, hiFt: h.hiFt, method: h.method, source: 'current'}; } }
  // one signal per spot-hour: the latest replaces the earlier
  const hour = new Date(Math.floor(t / 3600000) * 3600000).toISOString();
  const rest = getFelt().filter((e) => !(e.spotId === i.spotId && e.hour === hour));
  setFelt([{id: crypto.randomUUID(), spotId: i.spotId, hour, felt: i.felt, loggedAt: new Date(now).toISOString(), predicted}, ...rest].slice(0, 2000));
  return {ok: true};
}
/** Today's (Pacific) latest signal for a spot, to show "You said: too low". */
export function feltRightFor(spotId: string, nowMs: number): {felt: Felt; at: string} | null {
  const day = pacificDate(new Date(nowMs).toISOString()), list = getFelt().filter((e) => e.spotId === spotId && pacificDate(e.hour) === day).sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  return list[0] ? {felt: list[0].felt, at: list[0].hour} : null;
}

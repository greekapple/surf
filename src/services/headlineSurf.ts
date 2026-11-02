import type {Forecast, UserProfile} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {assignmentFor} from '../ocean/mop.ts';
import {BREAKING_V2_VERSION} from '../ocean/breakingEstimate.ts';
import {mopBreaking} from './breakingV2.ts';
import {pickMop} from './nearshoreSelect.ts';
import {bodyWords, BODY_WORDS_NOTE} from './bodyWords.ts';
import {getObservations} from './observationStore.ts';
import {applyFit, fitFor, type CalibrationFit} from './calibrationMath.ts';
import type {SessionObservation} from './sessionLog.ts';
import {canPresentBreakingEstimate, formatWaveHeight} from '../utils/waveHeight.ts';

/** The headline surf number for a spot-hour (T-046, user decision: an estimated surf range, not offshore height).
 *  Pure and read-only: it NEVER feeds a rating, and a range is only ever an estimate with its method named. */
export type HeadlineSurf =
  | {kind: 'estimate'; loFt: number; hiFt: number; words: string | null; wordsNote: string; method: 'mop-v2' | 'v1'; methodLabel: string; label: string; /** Present only when the range is calibrated with the surfer's own observations (T-059). */ calibration?: {n: number; ratio: number; label: string; uncalibratedFt: [number, number]}; mop?: {id: string; product: 'nowcast' | 'forecast'; validAt: string}}
  | {kind: 'demonstration'; ft: number; label: string}
  | {kind: 'offshore'; ft: number; label: 'offshore · not surf size'}
  | {kind: 'none'; label: string};
export interface HeadlineContext {bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null; nowMs?: number; /** Defaults to the shared observation store; pass [] to force the uncalibrated path. */ observations?: SessionObservation[]}

/** Calibrates an estimate when this spot has enough paired observations for this method; otherwise returns it untouched (identical to before T-059). */
function calibrated<T extends Extract<HeadlineSurf, {kind: 'estimate'}>>(spotId: string, h: T, ctx: HeadlineContext): T {
  const fit: CalibrationFit = fitFor(ctx.observations ?? getObservations(), spotId, h.method), r = applyFit(fit, h.loFt, h.hiFt);
  if (!r) return h;
  const label = `calibrated with your ${fit.n} observations`;
  return {...h, loFt: r.loFt, hiFt: r.hiFt, words: bodyWords(r.loFt, r.hiFt), methodLabel: `Model estimate, ${label} (${h.method === 'mop-v2' ? 'CDIP nearshore' : 'offshore swell'} model, unvalidated)`, calibration: {n: fit.n, ratio: fit.ratio!, label, uncalibratedFt: [h.loFt, h.hiFt]}};
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const ESTIMATE_LABEL = 'Est. at the break · model estimate';
const METHOD_LABEL = {'mop-v2': `Model estimate from the CDIP nearshore point (${BREAKING_V2_VERSION}, unvalidated)`, v1: 'Model estimate from offshore swell (v1, unvalidated)'} as const;

/** Order: v2 where a reviewed MOP point has data for this hour → v1 where presentable → offshore (labelled) → none. */
export function headlineSurf(spotId: string, hour: Forecast, ctx: HeadlineContext = {}): HeadlineSurf {
  const nowMs = ctx.nowMs ?? Date.now(), a = assignmentFor(spotId), t = Date.parse(hour?.timestamp);
  if (a && ctx.bundle && Number.isFinite(t)) {
    const pick = pickMop(t, nowMs, ctx.bundle.nearshore, ctx.bundle.mop?.[a.mopId]?.records);
    if (pick.state === 'ok') {
      const r = mopBreaking(spotId, pick.record);
      if (r.ok && canPresentBreakingEstimate(r.input)) {
        const [lo, hi] = r.input.rangeFt!;
        return calibrated(spotId, {kind: 'estimate', loFt: lo, hiFt: hi, words: bodyWords(lo, hi), wordsNote: BODY_WORDS_NOTE, method: 'mop-v2', methodLabel: METHOD_LABEL['mop-v2'], label: ESTIMATE_LABEL, mop: {id: a.mopId, product: pick.product, validAt: pick.record.timestamp}}, ctx);
      }
    }
  }
  const v1 = hour?.evidence?.faceEstimate?.input;
  if (v1 && canPresentBreakingEstimate(v1)) {
    const [lo, hi] = v1.rangeFt!;
    return calibrated(spotId, {kind: 'estimate', loFt: lo, hiFt: hi, words: bodyWords(lo, hi), wordsNote: BODY_WORDS_NOTE, method: 'v1', methodLabel: METHOD_LABEL.v1, label: ESTIMATE_LABEL}, ctx);
  }
  if (!hour?.evidence && hour?.availability?.face && finite(hour.face)) return {kind: 'demonstration', ft: hour.face, label: 'demonstration face · not a forecast'};
  if (finite(hour?.offshore) && hour.offshore >= 0) return {kind: 'offshore', ft: hour.offshore, label: 'offshore · not surf size'};
  return {kind: 'none', label: 'No wave height for this hour'};
}

/** Display strings in the user's units and height scale, ready for a card: value "4–6 ft", label "Est. 4–6 ft at the break". */
export function headlineText(h: HeadlineSurf, p: UserProfile) {
  if (h.kind === 'estimate') {
    const f = formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: [h.loFt, h.hiFt], rangeMethod: h.method === 'mop-v2' ? `v2 ${BREAKING_V2_VERSION}` : 'v1'}, p);
    return {value: f.text, label: `Est. ${f.text} at the break`, words: h.words, tag: 'model estimate', detail: h.methodLabel};
  }
  if (h.kind === 'demonstration') { const f = formatWaveHeight({kind: 'demonstration', valueFt: h.ft}, p); return {value: f.text, label: `${f.text} · ${h.label}`, words: null, tag: 'demonstration', detail: h.label}; }
  if (h.kind === 'offshore') { const f = formatWaveHeight({kind: 'offshore', valueFt: h.ft}, p); return {value: f.text.replace(/^≈ /, ''), label: `${f.text} ${h.label}`, words: null, tag: 'offshore', detail: h.label}; }
  return {value: '—', label: h.label, words: null, tag: 'none', detail: h.label};
}

import type {Forecast, UserProfile} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {assignmentFor} from '../ocean/mop.ts';
import {BREAKING_V2_VERSION} from '../ocean/breakingEstimate.ts';
import {mopBreaking} from './breakingV2.ts';
import {pickMop, nowcastFor} from './nearshoreSelect.ts';
import {intervalFor} from './uncertainty.ts';
import {spreadAt} from './modelSpread.ts';
import {isGuideProfile} from '../ocean/localCalibration.ts';
import {guideFactsFor} from '../ocean/spotFactsSourced.ts';
import {bodyWords, BODY_WORDS_NOTE} from './bodyWords.ts';
import {getObservations, getFelt, type FeltEntry} from './observationStore.ts';
import {applyFit, fitFor, type CalibrationFit} from './calibrationMath.ts';
import type {SessionObservation} from './sessionLog.ts';
import {canPresentBreakingEstimate, formatWaveHeight} from '../utils/waveHeight.ts';

/** The headline surf number for a spot-hour (T-046, user decision: an estimated surf range, not offshore height).
 *  Pure and read-only: it NEVER feeds a rating, and a range is only ever an estimate with its method named. */
export type HeadlineSurf =
  | {kind: 'estimate'; loFt: number; hiFt: number; words: string | null; wordsNote: string; method: 'mop-v2' | 'v1'; methodLabel: string; label: string; /** The method's central height before the range is built (T-073). */ centralFt?: number; /** How the range was built from its uncertainty components (T-073); absent for calibrated ranges. */ interval?: {halfWidth: number; components: {id: string; label: string; halfWidth: number}[]; disagree: boolean; note: string}; /** Present only when the range is calibrated with the surfer's own observations (T-059). */ calibration?: {n: number; ratio: number; label: string; uncalibratedFt: [number, number]}; mop?: {id: string; product: 'nowcast' | 'forecast'; validAt: string}}
  | {kind: 'demonstration'; ft: number; label: string}
  | {kind: 'offshore'; ft: number; label: 'offshore · not surf size'}
  | {kind: 'none'; label: string};
export interface HeadlineContext {/** Wave-model spread for the hour, or null; defaults to the loaded spread (services/modelSpread.ts). Pass null to force the spread-free range. */ spread?: {ratio: number; models: number} | null; bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null; nowMs?: number; /** Defaults to the shared observation store; pass [] to force the uncalibrated path. */ observations?: SessionObservation[]; /** Defaults to the shared felt-right store. */ felt?: FeltEntry[]}

/** Calibrates an estimate when this spot has enough paired observations for this method; otherwise returns it untouched (identical to before T-059). */
function calibrated<T extends Extract<HeadlineSurf, {kind: 'estimate'}>>(spotId: string, h: T, ctx: HeadlineContext): T {
  const fl = (ctx.felt ?? (ctx.observations ? [] : getFelt())).filter((e) => e.spotId === spotId && e.predicted?.method === h.method), counts = {low: fl.filter((e) => e.felt === 'low').length, right: fl.filter((e) => e.felt === 'right').length, high: fl.filter((e) => e.felt === 'high').length};
  const fit: CalibrationFit = fitFor(ctx.observations ?? getObservations(), spotId, h.method, counts), r = applyFit(fit, h.centralFt ?? h.loFt, h.centralFt ?? h.hiFt);
  if (!r) return h;
  const label = `calibrated with your ${fit.n} observations`;
  return {...h, loFt: r.loFt, hiFt: r.hiFt, words: bodyWords(r.loFt, r.hiFt), methodLabel: `Model estimate, ${label} (${h.method === 'mop-v2' ? 'CDIP nearshore' : 'offshore swell'} model, unvalidated)${guideBasis(spotId) ? `; ${guideBasis(spotId)}` : ''}`, calibration: {n: fit.n, ratio: fit.ratio!, label, uncalibratedFt: [h.loFt, h.hiFt]}, interval: undefined};
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const ESTIMATE_LABEL = 'Est. at the break · model estimate';
/** One source line for a guide-derived estimate (T-071b), said once in the method label: where the inputs came from and that they are unreviewed. */
export function guideBasis(spotId: string): string | null {
  if (!isGuideProfile(spotId)) return null;
  const f = guideFactsFor(spotId), sites = [...new Set((f?.sources ?? []).map((x) => (x.site === 'surf-forecast' ? 'Surf-Forecast' : x.site === 'surfnerd' ? 'Surfnerd' : x.site)))];
  return `facing and swell window from published guides${sites.length ? ` (${sites.join(', ')})` : ''}, not reviewed; 8 s generic minimum period`;
}
const METHOD_LABEL = {'mop-v2': `Model estimate from the CDIP nearshore point (${BREAKING_V2_VERSION}, unvalidated)`, v1: 'Model estimate from offshore swell (v1, unvalidated)'} as const;

/** The range for one hour (T-073): built from the central height and its documented uncertainty; the legacy fixed band only when the central height is unavailable (a record cached before this existed). */
function withInterval(spotId: string, hour: Forecast, ctx: HeadlineContext, method: 'mop-v2' | 'v1', central: number | undefined, legacy: [number, number], mopOverOffshore: number | null) {
  const spread = ctx.spread !== undefined ? ctx.spread : spreadAt(spotId, hour.timestamp);
  const iv = finite(central) ? intervalFor({method, centralFt: central, modelSpread: spread, mopOverOffshore}) : null;
  return iv ? {lo: iv.loFt, hi: iv.hiFt, interval: {halfWidth: iv.halfWidth, components: iv.components, disagree: iv.disagree, note: iv.note}} : {lo: legacy[0], hi: legacy[1], interval: {halfWidth: Math.log(1.4 / 0.7) / 2, components: [], disagree: false, note: 'Fixed 0.7–1.4 band (record cached before the range was built from its uncertainty); no uncertainty breakdown available.'}};
}
const methodLabelFor = (spotId: string, m: 'mop-v2' | 'v1', mopId?: string, interval?: {disagree: boolean; components: unknown[]}) => {
  const basis = guideBasis(spotId), assigned = m === 'mop-v2' && mopId && isGuideProfile(spotId) ? `; point ${mopId} assigned by the facing-match rule` : '';
  return `${METHOD_LABEL[m]}${assigned}${basis ? `; ${basis}` : ''}${interval?.disagree ? '; wave models disagree, so the range is wider' : ''}${interval && interval.components.length === 0 ? '; fixed 0.7–1.4 band (older cached data)' : ''}`;
};

/** Order: v2 where a reviewed MOP point has data for this hour → v1 where presentable → offshore (labelled) → none. */
export function headlineSurf(spotId: string, hour: Forecast, ctx: HeadlineContext = {}): HeadlineSurf {
  const nowMs = ctx.nowMs ?? Date.now(), a = assignmentFor(spotId), t = Date.parse(hour?.timestamp);
  if (a && ctx.bundle && Number.isFinite(t)) {
    const pick = pickMop(t, nowMs, nowcastFor(a.mopId, ctx.bundle.nearshore), ctx.bundle.mop?.[a.mopId]?.records);
    if (pick.state === 'ok') {
      const r = mopBreaking(spotId, pick.record);
      if (r.ok && canPresentBreakingEstimate(r.input)) {
        const off = hour?.evidence?.faceEstimate?.centralFt,  w = withInterval(spotId, hour, ctx, 'mop-v2', r.centralFt, r.input.rangeFt!, finite(off) && off > 0 ? r.centralFt / off : null);
        return calibrated(spotId, {kind: 'estimate', loFt: w.lo, hiFt: w.hi, words: bodyWords(w.lo, w.hi), wordsNote: BODY_WORDS_NOTE, method: 'mop-v2', methodLabel: methodLabelFor(spotId, 'mop-v2', a.mopId, w.interval), label: ESTIMATE_LABEL, centralFt: r.centralFt, ...(w.interval ? {interval: w.interval} : {}), mop: {id: a.mopId, product: pick.product, validAt: pick.record.timestamp}}, ctx);
      }
    }
  }
  const v1 = hour?.evidence?.faceEstimate?.input;
  if (v1 && canPresentBreakingEstimate(v1)) {
    const c = hour.evidence?.faceEstimate?.centralFt, w = withInterval(spotId, hour, ctx, 'v1', c, v1.rangeFt!, null);
    return calibrated(spotId, {kind: 'estimate', loFt: w.lo, hiFt: w.hi, words: bodyWords(w.lo, w.hi), wordsNote: BODY_WORDS_NOTE, method: 'v1', methodLabel: methodLabelFor(spotId, 'v1', undefined, w.interval), label: ESTIMATE_LABEL, ...(finite(c) ? {centralFt: c} : {}), ...(w.interval ? {interval: w.interval} : {})}, ctx);
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

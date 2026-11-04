import type {Forecast, UserProfile} from '../models/index.ts';
import {getMopIssue} from '../ocean/mopIssue.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {assignmentFor} from '../ocean/mop.ts';
import {BREAKING_V2_VERSION} from '../ocean/breakingEstimate.ts';
import {mopBreaking} from './breakingV2.ts';
import {pickMop, nowcastFor} from './nearshoreSelect.ts';
import {firstStale, staleText} from './freshness.ts';
import {intervalFor} from './uncertainty.ts';
import {spreadAt, spreadStale} from './modelSpread.ts';
import {isGuideProfile} from '../ocean/localCalibration.ts';
import {guideFactsFor} from '../ocean/spotFactsSourced.ts';
import {isGeometrySource, derivedFacing} from '../ocean/spotFactsRules.ts';
import {bodyWords, BODY_WORDS_NOTE} from './bodyWords.ts';
import {surfBandFor, setsFactor, confidenceText, type SurfBand, type Confidence} from './surfBand.ts';
import {allSpots} from '../data/catalog.ts';
import {breakerType} from './breaker.ts';
import {getObservations, getFelt, type FeltEntry} from './observationStore.ts';
import {applyFit, fitFor, type CalibrationFit} from './calibrationMath.ts';
import type {SessionObservation} from './sessionLog.ts';
import {canPresentBreakingEstimate, formatWaveHeight} from '../utils/waveHeight.ts';

/** The headline surf number for a spot-hour (T-046, user decision: an estimated surf range, not offshore height).
 *  Pure and read-only: it NEVER feeds a rating, and a range is only ever an estimate with its method named. */
export type HeadlineSurf =
  | {kind: 'estimate'; loFt: number; hiFt: number; /** T-118: the range is the surf BAND (typical wave to the sets), not an interval; the forecast uncertainty is this word and `interval`. */ confidence?: Confidence; band?: SurfBand; words: string | null; wordsNote: string; method: 'mop-v2' | 'v1'; /** Set when the source was a saved copy, older than 2 h, or undated (T-083/T-084): the label says so. */ saved?: {retrievedAt: string; reason?: 'saved' | 'old' | 'future' | 'unknown'}; methodLabel: string; label: string; /** The central SURF HEIGHT by the common convention (T-077: about the nearshore significant wave height) from which the range is built. */ centralFt?: number; /** The breaking height behind it (the nearshore height carried to where the waves break), shown in the detail only. */ breakingFt?: number; /** How the range was built from its uncertainty components (T-073); absent for calibrated ranges. */ interval?: {/** The uncertainty interval this headline no longer shows (T-118), whole feet rounded outward. */ loFt?: number; hiFt?: number; halfWidth: number; components: {id: string; label: string; halfWidth: number}[]; disagree: boolean; note: string}; /** Present only when the range is calibrated with the surfer's own observations (T-059). */ calibration?: {n: number; ratio: number; label: string; uncalibratedFt: [number, number]}; mop?: {id: string; product: 'nowcast' | 'forecast'; validAt: string}}
  | {kind: 'demonstration'; ft: number; label: string}
  | {kind: 'offshore'; ft: number; label: 'offshore · not surf size' | 'offshore · not surf size · saved copy'; saved?: {retrievedAt: string; reason?: 'saved' | 'old' | 'future' | 'unknown'}}
  | {kind: 'none'; label: string};
export interface HeadlineContext {/** Wave-model spread for the hour, or null; defaults to the loaded spread (services/modelSpread.ts). Pass null to force the spread-free range. */ spread?: {ratio: number; models: number} | null; bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null; nowMs?: number; /** Defaults to the shared observation store; pass [] to force the uncalibrated path. */ observations?: SessionObservation[]; /** Defaults to the shared felt-right store. */ felt?: FeltEntry[]}

/** Calibrates an estimate when this spot has enough paired observations for this method; otherwise returns it untouched (identical to before T-059). */
function calibrated<T extends Extract<HeadlineSurf, {kind: 'estimate'}>>(spotId: string, h: T, ctx: HeadlineContext): T {
  const fl = (ctx.felt ?? (ctx.observations ? [] : getFelt())).filter((e) => e.spotId === spotId && e.predicted?.conv && e.predicted?.method === h.method), counts = {low: fl.filter((e) => e.felt === 'low').length, right: fl.filter((e) => e.felt === 'right').length, high: fl.filter((e) => e.felt === 'high').length};
  const fit: CalibrationFit = fitFor(ctx.observations ?? getObservations(), spotId, h.method, counts), r = applyFit(fit, h.centralFt ?? h.loFt, h.centralFt ?? h.hiFt);
  if (!r) return h;
  const label = `calibrated with your ${fit.n} observations`;
  return {...h, loFt: r.loFt, hiFt: r.hiFt, words: bodyWords(r.loFt, r.hiFt), methodLabel: `Model estimate, ${label} (${h.method === 'mop-v2' ? 'CDIP nearshore' : 'offshore swell'} model, unvalidated)${guideBasis(spotId) ? `; ${guideBasis(spotId)}` : ''}`, calibration: {n: fit.n, ratio: fit.ratio!, label, uncalibratedFt: [h.loFt, h.hiFt]}, interval: undefined, band: undefined}; // calibrated: the person's own measured spread replaces the band; the confidence word stays
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const ESTIMATE_LABEL = 'Est. surf height · model estimate';
/** One source line for a guide-derived estimate (T-071b), said once in the method label: where the inputs came from and that they are unreviewed. */
export function guideBasis(spotId: string): string | null {
  if (!isGuideProfile(spotId)) return null;
  const f = guideFactsFor(spotId), sites = [...new Set((f?.sources ?? []).filter((x) => !isGeometrySource(x)).map((x) => (x.site === 'surf-forecast' ? 'Surf-Forecast' : x.site === 'surfnerd' ? 'Surfnerd' : x.site)))];
  // A facing derived from CDIP coastline geometry is not a guide fact: say so, and keep the guide list for the swell window only.
  const guides = `${sites.length ? ` (${sites.join(', ')})` : ''}`;
  return f && derivedFacing(f) ? `facing derived from coastline geometry (CDIP); swell window from published guides${guides}, not reviewed; 8 s generic minimum period` : `facing and swell window from published guides${guides}, not reviewed; 8 s generic minimum period`;
}
/** T-077 (user decision "Surfer convention"): the headline is the height surfers and surf reports quote, about the nearshore significant wave height (a CDIP MOP value at 10–15 m depth), NOT the larger breaking height (about 1.3 times that for Ocean Beach swells, docs/forecast/OB-BIAS-T076.md). The breaking height stays in the detail. */
const METHOD_LABEL = {'mop-v2': `Surf height (common convention: about the CDIP nearshore wave height) from the nearshore point (${BREAKING_V2_VERSION}, unvalidated)`, v1: 'Surf height (common convention: about the nearshore wave height) estimated from offshore swell carried to 10 m (v1, unvalidated)'} as const;

/** The range for one hour (T-073): built from the central height and its documented uncertainty; the legacy fixed band only when the central height is unavailable (a record cached before this existed). */
function withInterval(spotId: string, hour: Forecast, ctx: HeadlineContext, method: 'mop-v2' | 'v1', central: number | undefined, legacy: [number, number], mopOverOffshore: number | null) {
  const spread = ctx.spread !== undefined ? ctx.spread : spreadAt(spotId, hour.timestamp, ctx.nowMs ?? Date.now());
  const lead = Math.max(0, (Date.parse(hour.timestamp) - (ctx.nowMs ?? Date.now())) / 3600000), iv = finite(central) ? intervalFor({method, centralFt: central, modelSpread: spread, mopOverOffshore, leadHours: lead}) : null;
  return iv ? {lo: iv.loFt, hi: iv.hiFt, interval: {loFt: iv.loFt, hiFt: iv.hiFt, halfWidth: iv.halfWidth, components: iv.components, disagree: iv.disagree, note: iv.note}} : {lo: legacy[0], hi: legacy[1], interval: {loFt: legacy[0], hiFt: legacy[1], halfWidth: Math.log(1.4 / 0.7) / 2, components: [], disagree: false, note: 'Fixed 0.7–1.4 band (record cached before the range was built from its uncertainty); no uncertainty breakdown available.'}};
}
/** T-118: turns the uncertainty interval of `withInterval` into the surf band + confidence word for one hour (one function for every surface: they all read headlineSurf). A record with no central height (cached before the convention) keeps its legacy range, with low confidence. */
function bandOf(spotId: string, hour: Forecast, central: number | undefined, w: {lo: number; hi: number; interval: {halfWidth: number; disagree: boolean}}): {lo: number; hi: number; confidence: Confidence; band?: SurfBand} {
  if (!finite(central) || central <= 0) return {lo: w.lo, hi: w.hi, confidence: 'low'};
  const spot = allSpots.find((x) => x.id === spotId), breaker = hour?.primary ? breakerType({id: spotId}, hour) : null;
  const band = surfBandFor({centralFt: central, setsFactor: setsFactor(spot?.type, breaker), halfWidth: w.interval.halfWidth, disagree: w.interval.disagree, interval: {loFt: w.lo, hiFt: w.hi}});
  return {lo: band.loFt, hi: band.hiFt, confidence: band.confidence, band};
}
const methodLabelFor = (spotId: string, m: 'mop-v2' | 'v1', mopId?: string, interval?: {disagree: boolean; components: unknown[]}, breakingFt?: number) => {
  const basis = guideBasis(spotId), assigned = m === 'mop-v2' && mopId && isGuideProfile(spotId) ? `; point ${mopId} assigned by the facing-match rule` : '';
  return `${METHOD_LABEL[m]}${assigned}${basis ? `; ${basis}` : ''}${interval?.disagree ? '; wave models disagree, so confidence is low' : ''}${interval && interval.components.length === 0 ? '; fixed 0.7–1.4 band (older cached data)' : '; range = the typical wave to the sets (about 1.27 times the significant height, a little by beach: our own judgement, not fitted to local data), not a confidence interval or a guarantee; in a 14-day check about half of the observed heights fell inside the band, about nine in ten within a foot of it; the forecast uncertainty (wave-model error vs deep-water buoys, 14 days) is the confidence word and the interval shown in Why'}`;
};

const offshoreOrNone = (hour: Forecast): HeadlineSurf => (!hour?.evidence && hour?.availability?.face && finite(hour.face) ? {kind: 'demonstration', ft: hour.face, label: 'demonstration face · not a forecast'} : finite(hour?.offshore) && hour.offshore >= 0 ? {kind: 'offshore', ft: hour.offshore, label: 'offshore · not surf size'} : {kind: 'none', label: 'No wave height for this hour'});

/** Order: v2 where a reviewed MOP point has data for this hour → v1 where presentable → offshore (labelled) → none. */
export function headlineSurf(spotId: string, hour: Forecast, ctx: HeadlineContext = {}): HeadlineSurf {
  const h = headlineCore(spotId, hour, ctx), nowMs = ctx.nowMs ?? Date.now();
  /* T-083/T-084: ONE freshness rule (services/freshness.ts, the rating's 2 h rule): a source that is a saved copy, older than 2 h, dated in the future or undated is labelled, never shown as current. */
  if (h.kind === 'offshore') { const st = firstStale([hour?.evidence?.offshore?.source], nowMs); return st ? {...h, saved: {retrievedAt: st.retrievedAt, reason: st.reason}, label: 'offshore · not surf size · saved or stale' as any} : h; }
  if (h.kind !== 'estimate') return h;
  const mopId = assignmentFor(spotId)?.mopId ?? '', mop: any = (ctx.bundle as any)?.mop?.[mopId];
  /* T-097/Codex P2: only the source the headline actually used counts (selected product AND this spot's MOP point). A fresh forecast next to an old nowcast at the same timestamp, or another point's nowcast,
   * must not change the label; the forecast-file and issue-file flags apply to forecast estimates only. */
  const product = h.method === 'mop-v2' ? h.mop?.product : undefined, at = h.method === 'mop-v2' ? h.mop?.validAt : undefined;
  const picked = product === 'nowcast' ? nowcastFor(mopId, (ctx.bundle as any)?.nearshore)?.find((r: any) => r.timestamp === at) : product === 'forecast' ? mop?.records?.find((r: any) => r.timestamp === at) : undefined;
  const srcs: any[] = h.method === 'mop-v2'
    ? [picked?.height?.source, ...(product === 'forecast' ? [mop?.delivery ? {delivery: mop.delivery, retrievedAt: mop.retrievedAt} : null, (() => { const iss = getMopIssue(mopId); return iss?.delivery ? {delivery: iss.delivery, retrievedAt: iss.retrievedAt ?? mop?.retrievedAt} : null; })()] : [])]
    : [hour?.evidence?.offshore?.source, hour?.evidence?.primary?.height?.source];
  const st = firstStale(srcs, nowMs), sp = spreadStale(spotId, nowMs);
  if (!st && !sp) return h;
  const label = `${h.methodLabel}${st ? `; ${staleText(st)}` : ''}${sp ? `; model-spread term not used (${staleText(sp)})` : ''}`;
  return {...h, ...(st ? {saved: {retrievedAt: st.retrievedAt, reason: st.reason}} : {}), methodLabel: label};
}
function headlineCore(spotId: string, hour: Forecast, ctx: HeadlineContext): HeadlineSurf {
  const nowMs = ctx.nowMs ?? Date.now(), a = assignmentFor(spotId), t = Date.parse(hour?.timestamp);
  if (a && ctx.bundle && Number.isFinite(t)) {
    const pick = pickMop(t, nowMs, nowcastFor(a.mopId, ctx.bundle.nearshore), ctx.bundle.mop?.[a.mopId]?.records);
    if (pick.state === 'ok') {
      const r = mopBreaking(spotId, pick.record), surf = pick.record.height.value;
      if (r.ok && canPresentBreakingEstimate(r.input) && finite(surf) && surf > 0) {
        const off = finite(hour?.evidence?.faceEstimate?.breakingFt) ? hour?.evidence?.faceEstimate?.centralFt : undefined, w = withInterval(spotId, hour, ctx, 'mop-v2', surf, r.input.rangeFt!, finite(off) && off > 0 ? surf / off : null), bd = bandOf(spotId, hour, surf, w);
        return calibrated(spotId, {kind: 'estimate', loFt: bd.lo, hiFt: bd.hi, confidence: bd.confidence, ...(bd.band ? {band: bd.band} : {}), words: bodyWords(bd.lo, bd.hi), wordsNote: BODY_WORDS_NOTE, method: 'mop-v2', methodLabel: methodLabelFor(spotId, 'mop-v2', a.mopId, w.interval, r.centralFt), label: ESTIMATE_LABEL, centralFt: surf, breakingFt: r.centralFt, ...(w.interval ? {interval: w.interval} : {}), mop: {id: a.mopId, product: pick.product, validAt: pick.record.timestamp}}, ctx);
      }
      // Fallback order (T-077): when the nearshore model HAS the hour and says the swell cannot make surf here (outside the swell window, below the minimum period, or no breaking), the offshore-swell estimate must not
      // contradict it, so the spot shows the labelled offshore height. v1 is only the fallback when there is no usable nearshore record for the hour (no data, missing values).
      if (!r.ok && ['outside-window', 'short-period', 'no-break'].includes(r.code)) return offshoreOrNone(hour);
    }
  }
  const v1 = hour?.evidence?.faceEstimate?.input;
  /* A record cached before the surf-height convention carries only the breaking-height range; that is a different quantity, so it is never relabelled as surf height (T-083): the labelled offshore height shows instead. */
  if (v1 && canPresentBreakingEstimate(v1) && !finite(hour.evidence?.faceEstimate?.breakingFt)) return offshoreOrNone(hour);
  if (v1 && canPresentBreakingEstimate(v1)) {
    const bk = hour.evidence?.faceEstimate?.breakingFt, c = finite(bk) ? hour.evidence?.faceEstimate?.centralFt : undefined, w =  withInterval(spotId, hour, ctx, 'v1', c, v1.rangeFt!, null), bd = bandOf(spotId, hour, c, w);
    return calibrated(spotId, {kind: 'estimate', loFt: bd.lo, hiFt: bd.hi, confidence: bd.confidence, ...(bd.band ? {band: bd.band} : {}), words: bodyWords(bd.lo, bd.hi), wordsNote: BODY_WORDS_NOTE, method: 'v1', methodLabel: methodLabelFor(spotId, 'v1', undefined, w.interval, bk), label: ESTIMATE_LABEL, ...(finite(c) ? {centralFt: c} : {}), ...(finite(bk) ? {breakingFt: bk} : {}), ...(w.interval ? {interval: w.interval} : {})}, ctx);
  }
  if (!hour?.evidence && hour?.availability?.face && finite(hour.face)) return {kind: 'demonstration', ft: hour.face, label: 'demonstration face · not a forecast'};
  if (finite(hour?.offshore) && hour.offshore >= 0) return {kind: 'offshore', ft: hour.offshore, label: 'offshore · not surf size'};
  return {kind: 'none', label: 'No wave height for this hour'};
}

/** T-118 API (for the smooth graph lines, labels and any surface): the surf band of a headline, or null when the hour has no surf estimate. `loFt`/`hiFt` are the typical wave to the sets (whole feet, Surfline widths), `centralFt` the typical wave
 *  (lo <= centralFt <= hi), `setsFt` the sets height before snapping, `confidence` the word from the forecast uncertainty, `interval` the full uncertainty interval (for Why and tooltips). Calibrated estimates (the person's own observations) keep their own range and no setsFt. */
export interface SurfBandView {loFt: number; hiFt: number; centralFt: number; setsFt: number | null; /** Null for a saved/stale or calibrated estimate (no word is shown beside those). */ confidence: Confidence | null; interval: {loFt: number; hiFt: number; halfWidth: number; disagree: boolean} | null; calibrated: boolean}
export function surfBandOf(h: HeadlineSurf): SurfBandView | null {
  if (h.kind !== 'estimate') return null;
  const c = h.centralFt ?? (h.loFt + h.hiFt) / 2, iv = h.band?.interval ?? (h.interval && h.interval.loFt !== undefined && h.interval.hiFt !== undefined ? {loFt: h.interval.loFt, hiFt: h.interval.hiFt, halfWidth: h.interval.halfWidth, disagree: h.interval.disagree} : null);
  return {loFt: h.loFt, hiFt: h.hiFt, centralFt: c, setsFt: h.band?.setsFt ?? null, confidence: shownConfidence(h), interval: iv, calibrated: !!h.calibration};
}
export const surfBand = (spotId: string, hour: Forecast, ctx: HeadlineContext = {}): SurfBandView | null => surfBandOf(headlineSurf(spotId, hour, ctx));

/** The confidence word a surface may show: none beside a saved, stale or calibrated number (the word describes the live model's uncertainty, not that number). */
export const shownConfidence = (h: Extract<HeadlineSurf, {kind: 'estimate'}>): Confidence | null => (h.saved || h.calibration ? null : h.confidence ?? null);
/** The confidence word with its reason and the full uncertainty interval, for the "Why" text and tooltips: "medium confidence: forecast uncertainty about ±28% (the model forecast may land anywhere from 4 to 8 ft)". */
function confidenceDetail(h: Extract<HeadlineSurf, {kind: 'estimate'}>, p: UserProfile): string {
  if (!shownConfidence(h)) return '';
  const iv = h.band?.interval ?? (h.interval?.loFt !== undefined && h.interval?.hiFt !== undefined ? {loFt: h.interval.loFt, hiFt: h.interval.hiFt} : null), why = h.band?.confidenceWhy;
  const range = iv ? formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: [iv.loFt, iv.hiFt], rangeMethod: h.method === 'mop-v2' ? `v2 ${BREAKING_V2_VERSION}` : 'v1'}, p).text : null;
  return `${confidenceText(h.confidence)}${why ? `: ${why}` : ''}${range ? ` (the model forecast may land anywhere from ${range}${h.band ? '; the band above is the typical wave to the sets, not this interval' : ''})` : ''}. The word is our own judgement from the forecast spread, not validated: in the 14-day check it did not separate how often observed heights fell inside the band (docs/forecast/VALIDATION.md 1c)`;
}

/** Display strings in the user's units and height scale, ready for a card: value "4–6 ft", label "Est. 4–6 ft surf height". */
export interface HeadlineText {value: string; label: string; words: string | null; tag: string; detail: string; /** T-118: the confidence word, its text and reason. Empty for saved/stale data and for calibrated estimates (the word describes the model's uncertainty, not that number). */ confidence?: Confidence | null; confidenceText?: string; confidenceDetail?: string}
export function headlineText(h: HeadlineSurf, p: UserProfile): HeadlineText {
  if (h.kind === 'estimate') {
    const f = formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: [h.loFt, h.hiFt], rangeMethod: h.method === 'mop-v2' ? `v2 ${BREAKING_V2_VERSION}` : 'v1'}, p);
    const bk = finite(h.breakingFt) ? `; breaking height about ${formatWaveHeight({kind: 'nearshore', valueFt: h.breakingFt}, p, 'technical').text}` : '';
    return {value: f.text, label: `Est. ${f.text} surf height`, confidence: shownConfidence(h), confidenceText: confidenceText(shownConfidence(h)), confidenceDetail: confidenceDetail(h, p), words: h.words, tag: h.saved ? (h.saved.reason === 'saved' ? 'saved estimate' : 'stale estimate') : 'model estimate', detail: `${h.methodLabel}${bk}`};
  }
  if (h.kind === 'demonstration') { const f = formatWaveHeight({kind: 'demonstration', valueFt: h.ft}, p); return {value: f.text, label: `${f.text} · ${h.label}`, words: null, tag: 'demonstration', detail: h.label}; }
  if (h.kind === 'offshore') { const f = formatWaveHeight({kind: 'offshore', valueFt: h.ft}, p); return {value: f.text.replace(/^≈ /, ''), label: `${f.text} ${h.label}`, words: null, tag: 'offshore', detail: h.label}; }
  return {value: '—', label: h.label, words: null, tag: 'none', detail: h.label};
}

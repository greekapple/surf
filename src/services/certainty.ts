import type {UserProfile} from '../models/index.ts';
import type {HeadlineSurf} from './headlineSurf.ts';
import {shownConfidence} from './headlineSurf.ts';
import {spreadAt} from './modelSpread.ts';
import {skillW, LEAD_SKILL} from './uncertainty.ts';
import {snapBand, BASE_SETS_FACTOR} from './surfBand.ts';
import {formatWaveHeight} from '../utils/waveHeight.ts';
import type {DayRange} from './spotHour.ts';

/** "How sure are we" per spot and hour (certainty, 2026-11-06): one of four levels, from real inputs only:
 *   - the lead time (hours from now to the hour), through the MEASURED wave-model forecast error by lead (`LEAD_SKILL` in uncertainty.ts: three models vs deep-water buoys NDBC 46026/46214, 14 days to 2026-11-03);
 *   - the spread between the wave models at the spot (services/modelSpread.ts, T-073: bias-corrected, skill-pruned Open-Meteo models), which flags "models differ".
 *  ONE vocabulary (lead decision, data-honesty review cycle 1): the first three levels ARE the headline's existing confidence word, "high / medium / low confidence" (surfBand.ts thresholds: forecast half-width
 *  up to 0.20 / 0.30 / beyond, or the models disagree), so the day surfaces, the Surf block and Explore say the same words. The fourth, "too far out", is new: past the useful horizon a day surface
 *  shows no number (the model's number stays in the detail: tooltip, aria, the note under the day strip, the timeline).
 *  NOT accuracy: nobody has validated how often a "high confidence" day turned out right (docs/forecast/VALIDATION.md 1c found the word did not separate band coverage). Every threshold here is OUR OWN CHOICE.
 *  The forecast archive (forecastArchive.ts) is not used: it lives in one browser, holds at most 72 h ahead, and the shared forward archive had 36 matured lead-scored entries on 2026-11-06, too few to tune anything. */
export type Certainty = 'high' | 'medium' | 'low' | 'too-far';
export const CERTAINTY_WORD: Record<Certainty, string> = {high: 'high confidence', medium: 'medium confidence', low: 'low confidence', 'too-far': 'too far out'};

/** OUR CHOICE: the useful horizon is where the measured forecast error ALONE spans more than a factor of two between its low and high ends (the p10 to p90 ratio of the model error,
 *  exp(2w) >= 2, i.e. half-width w >= ln 2 / 2 = 0.347). Past it a 6 ft forecast could as easily be 4 ft as 8: we stop calling a number. With today's LEAD_SKILL table that is about 5.7 days. */
export const TOO_FAR_W = Math.log(2) / 2;
/** The horizon in hours, read from the measured table (not typed in), so a new skill table moves it. Beyond the table (7 days) the error is held at day 7, which is past the horizon anyway. */
export const HORIZON_HOURS = (() => { for (let h = 0; h <= 24 * (LEAD_SKILL.length - 1); h++) if (skillW(h) >= TOO_FAR_W) return h; return Infinity; })();
/** The horizon as every surface says it: days, one decimal ("about 5.7 days"). */
export const HORIZON_DAYS_TEXT = `about ${Math.round((HORIZON_HOURS / 24) * 10) / 10} days`;

export interface CertaintyView {
  level: Certainty; word: string;
  /** One plain sentence on why (without the word itself), for tooltips and the day detail. */ why: string;
  leadHours: number;
  /** The wave models disagree at this hour (a factor of 1.35 or more between them, bias-corrected: uncertainty.ts DISAGREE_HALF). */ disagree: boolean;
  /** How many wave models were compared for this hour; null when no spread was loaded (the level then rests on lead time alone). */ models: number | null;
  /** When the models disagree: what the hour could be (detail and tooltip only; the main number stays the typical-to-sets band, CONTRACTS T-118); null otherwise. */ wide: {loFt: number; hiFt: number} | null;
  /** How `wide` was made, in words. */ wideHow: string | null;
}

const days = (h: number) => (h < 36 ? `${Math.max(0, Math.round(h))} h` : `${Math.round((h / 24) * 10) / 10} days`);
const WIDE_HOW = 'widened by how far apart the wave models are (their max/min ratio, centered on our estimate)';

/** The certainty of one headline at an hour, or null when no level is honest to show: no surf estimate (offshore heights are already muted and labelled; demonstration; none), a Flat hour,
 *  a saved or stale source (its own tag is shown), or a calibrated number (the person's own range: the contract shows no confidence word beside it). "Too far out" applies to every estimate
 *  (Flat included: it overrides Flat) or offshore height past the horizon, whatever its source, because it is about the lead time alone. `spread` defaults to the loaded model spread (the one the headline used). */
export function certaintyOf(spotId: string, h: HeadlineSurf | null | undefined, iso: string, nowMs: number, spread?: {ratio: number; models: number} | null): CertaintyView | null {
  if (!h || (h.kind !== 'estimate' && h.kind !== 'offshore')) return null;
  const t = Date.parse(iso); if (!Number.isFinite(t)) return null;
  const lead = Math.max(0, (t - nowMs) / 3600000);
  const sp = spread !== undefined ? spread : spreadAt(spotId, iso, nowMs);
  const models = sp && sp.models >= 2 ? sp.models : null;
  if (lead >= HORIZON_HOURS) return {level: 'too-far', word: CERTAINTY_WORD['too-far'], leadHours: lead, disagree: false, models, wide: null, wideHow: null,
    why: `${days(lead)} ahead; past ${HORIZON_DAYS_TEXT} the wave models' measured error spans more than a factor of two, so we don't call a size (our own cut-off, not a validated limit)`};
  if (h.kind !== 'estimate' || h.nearshoreOnly?.flat) return null;
  const level = shownConfidence(h); if (!level) return null;
  const disagree = !!(h.band?.interval?.disagree ?? h.interval?.disagree);
  const wide = disagree && sp && sp.ratio > 1 && Number.isFinite(h.centralFt) ? widen(h, sp.ratio) : null;
  // The spread is computed from the OFFSHORE wave models carried to the break (modelSpread.ts); a nearshore (MOP) number is not one of them, so the widening says so.
  const wideHow = wide ? `${WIDE_HOW}${h.method === 'mop-v2' ? '; the spread comes from the offshore wave models, not the nearshore model this number is from' : ''}` : null;
  const basis = h.nearshoreOnly ? 'a model point, not a breaking estimate' : disagree ? `the ${models ?? 'wave'} models differ` : models ? `${models} wave models agree` : 'model spread not loaded, lead time only';
  const iv = h.interval && h.interval.components.length > 0 ? h.interval.halfWidth : null;
  const why = `${days(lead)} ahead, ${basis}${iv !== null ? `; forecast uncertainty (our interval) about ±${Math.round((Math.exp(iv) - 1) * 100)}%` : ''}. Our own levels, not a measured hit rate`;
  return {level, word: CERTAINTY_WORD[level], why, leadHours: lead, disagree, models, wide, wideHow};
}

/** What the hour could be where the models disagree: half-width d = ln(max/min)/2 around our central height, low end = the typical wave at central·e^−d, high end = the sets at central·e^+d (same
 *  sets factor and Surfline-style snapping as the band). Never narrower than the band itself. */
export function widen(h: Extract<HeadlineSurf, {kind: 'estimate'}>, ratio: number): {loFt: number; hiFt: number} | null {
  const c = h.centralFt; if (!Number.isFinite(c) || !(c! > 0) || !(ratio > 1)) return null;
  const d = Math.log(ratio) / 2, k = h.band?.setsFactor ?? BASE_SETS_FACTOR, cLo = c! * Math.exp(-d), cHi = c! * Math.exp(d);
  const lo = Math.min(h.loFt, snapBand(cLo, cLo * k).loFt), hi = Math.max(h.hiFt, snapBand(cHi, cHi * k).hiFt);
  return lo === h.loFt && hi === h.hiFt ? null : {loFt: lo, hiFt: hi};
}

/** The day's certainty: that of its typical (midday) hour, the same hour the week cell and the day card show. */
export function dayCertainty(spotId: string, dr: DayRange, nowMs: number): CertaintyView | null {
  const ty = dr.typical; return ty ? certaintyOf(spotId, ty.hour?.surf?.headline, ty.atIso, nowMs) : null;
}

/** The widened range as text in the person's unit and scale (the same formatter as the headline): `numbers` "4–7", `full` "4–7 ft". */
export function wideText(w: {loFt: number; hiFt: number}, p: UserProfile): {numbers: string; full: string} {
  const full = formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: [w.loFt, w.hiFt], rangeMethod: 'v2 widened'}, p).text;
  return {full, numbers: full.replace(/\s*(ft|m)( ≈ Hawaiian)?$/, '')};
}

/** What a day surface shows: past the horizon "too far out" in place of the number (the model's number goes to `detail`, e.g. "the model says 4–6 ft", or "the model says Flat"); where the models
 *  disagree the band itself stays the main number, with the short note "models differ" and "could be 4–9 ft" in `detail`; otherwise the range unchanged. `numbers` is the surface's own text. */
export function certainLabel(numbers: string, unit: string, cv: CertaintyView | null, p: UserProfile): {text: string; note: string | null; detail: string | null} {
  if (!cv) return {text: numbers, note: null, detail: null};
  const withUnit = /\d/.test(numbers) ? `${numbers} ${unit}`.trim() : numbers; // "Flat" never gets a unit
  if (cv.level === 'too-far') return {text: CERTAINTY_WORD['too-far'], note: null, detail: `the model says ${withUnit}`};
  if (cv.disagree) return {text: numbers, note: 'models differ', detail: cv.wide ? `could be ${wideText(cv.wide, p).full}: ${cv.wideHow}` : null};
  return {text: numbers, note: null, detail: null};
}

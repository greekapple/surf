/** T-118: the surf BAND (user decision 2026-11-04: "use surfline for reference ... a little differentiated ... beach oriented").
 *  The headline range stops being an uncertainty interval and becomes what a surf report shows: a "what you'll see" band from the TYPICAL wave to the SETS.
 *   low  = the typical wave = the convention surf height (about the nearshore significant wave height, T-077), whole feet, rounded down;
 *   high = the sets: about H1/10 = 1.27 × Hs for a Rayleigh sea (Longuet-Higgins 1952), nudged a little by beach (below), then snapped to Surfline's reporting widths.
 *  It is NOT a confidence interval. The forecast uncertainty (measured model skill, model spread, lead time: uncertainty.ts, unchanged) is kept whole in `interval` and shown as ONE confidence word beside the number;
 *  the full interval is in "Why" and the tooltip. Pure, no Leaflet or React: every surface reads the same band through headlineSurf. */
export type Confidence = 'high' | 'medium' | 'low';
export interface SurfBand {loFt: number; hiFt: number; /** The typical wave (the convention surf height, not rounded): lo <= centralFt <= hi always. */ centralFt: number; /** The sets height before snapping. */ setsFt: number; setsFactor: number; widthFt: number;
  confidence: Confidence; confidenceWhy: string; /** The forecast uncertainty interval this band no longer shows: whole feet rounded outward, with its half-width (log) and whether the wave models disagree. */ interval: {loFt: number; hiFt: number; halfWidth: number; disagree: boolean} | null}

/** Surfline-STYLE reporting widths by typical surf height: our approximation of the convention the user named as the reference (the table in docs/specs/2026-11-03-next-ranges-graph-quiver-cams.md §1; no public Surfline specification is cited and none was checked). `min`/`max` are whole feet. */
export const WIDTH_TABLE: readonly {below: number; min: number; max: number}[] = [{below: 2, min: 1, max: 1}, {below: 6, min: 1, max: 2}, {below: 10, min: 2, max: 3}, {below: 15, min: 3, max: 3}, {below: Infinity, min: 5, max: 5}];
export const widthRowFor = (typicalFt: number) => WIDTH_TABLE.find((r) => typicalFt < r.below)!;

/** Sets height over the significant height: 1.27 (Rayleigh H1/10) as the base, a little differentiated by beach: point and reef breaks let sets stand out (+0.04); a plunging break (from the seabed slope, T-085) is a bit more peaky
 *  (+0.05 when the slope is checked, +0.025 for a mean slope), a spilling one more even (−0.04). Our own judgement inside the range sea-state theory allows (it is NOT fitted to local data: the validation says how it performs), clamped to 1.18 to 1.36. */
export const BASE_SETS_FACTOR = 1.27;
export function setsFactor(spotType: 'Beach' | 'Point' | 'Reef' | string | undefined, breaker?: {type: string; confidence?: string} | null): number {
  let k = BASE_SETS_FACTOR; if (spotType === 'Point' || spotType === 'Reef') k += 0.04;
  if (breaker?.type === 'plunging') k += breaker.confidence === 'checked' ? 0.05 : 0.025; else if (breaker?.type === 'spilling') k -= 0.04;
  return Math.max(1.18, Math.min(1.36, k));
}

/** The confidence word from the forecast uncertainty (the half-width of the old interval): high up to ±22% (the first days of the measured lead table, one model agreeing, no offshore step), medium up to ±35%, low beyond, when the wave models disagree, or for a record with no uncertainty breakdown.
 *  Judgement thresholds, not fitted; they are in one place and tested. */
export const CONFIDENCE_HIGH_W = 0.2, CONFIDENCE_MEDIUM_W = 0.3;
export function confidenceFor(halfWidth: number | null | undefined, disagree: boolean): {word: Confidence; why: string} {
  if (halfWidth === null || halfWidth === undefined || !Number.isFinite(halfWidth)) return {word: 'low', why: 'no uncertainty breakdown for this hour'};
  const pct = Math.round((Math.exp(halfWidth) - 1) * 100);
  if (disagree) return {word: 'low', why: `the wave models disagree (forecast uncertainty about ±${pct}%)`};
  return halfWidth <= CONFIDENCE_HIGH_W ? {word: 'high', why: `forecast uncertainty about ±${pct}%`} : halfWidth <= CONFIDENCE_MEDIUM_W ? {word: 'medium', why: `forecast uncertainty about ±${pct}%`} : {word: 'low', why: `forecast uncertainty about ±${pct}%`};
}

/** Snaps typical wave and sets to whole feet inside Surfline's width for that height: low = typical rounded down (so low <= typical), width = the sets spread rounded, kept inside the table's min..max for the typical height. */
export function snapBand(typicalFt: number, setsFt: number): {loFt: number; hiFt: number; widthFt: number} {
  const lo = Math.max(0, Math.floor(typicalFt + 1e-9)), row = widthRowFor(typicalFt), width = Math.max(row.min, Math.min(row.max, Math.round(setsFt - lo)));
  return {loFt: lo, hiFt: lo + width, widthFt: width};
}

export function surfBandFor(i: {centralFt: number; setsFactor?: number; halfWidth?: number | null; disagree?: boolean; interval?: {loFt: number; hiFt: number} | null}): SurfBand {
  const k = i.setsFactor ?? BASE_SETS_FACTOR, setsFt = i.centralFt * k, snap = snapBand(i.centralFt, setsFt), c = confidenceFor(i.halfWidth, !!i.disagree);
  return {...snap, centralFt: i.centralFt, setsFt, setsFactor: k, confidence: c.word, confidenceWhy: c.why,
    interval: i.interval && i.halfWidth !== null && i.halfWidth !== undefined ? {loFt: i.interval.loFt, hiFt: i.interval.hiFt, halfWidth: i.halfWidth, disagree: !!i.disagree} : null};
}
export const confidenceText = (c: Confidence | null | undefined) => (c ? `${c} confidence` : '');

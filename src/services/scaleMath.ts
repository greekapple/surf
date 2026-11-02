import type {HeadlineSurf} from './headlineSurf.ts';
import type {ScaleBand} from './waveScale.ts';
import {BODY_TICKS} from './bodyWords.ts';

/** Geometry and numbers for the drawn, to-scale Wave scale (T-052). Pure; the SVG only places what this returns. Feet throughout; the unit preference only changes labels. */
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const FT_PER_M = 1 / 0.3048;

/** The face range to draw for an hour, or null (no estimate: the page draws surfer and board only and says so). */
export function faceRange(h: HeadlineSurf | null | undefined): [number, number] | null {
  return h && h.kind === 'estimate' && finite(h.loFt) && finite(h.hiFt) && h.hiFt >= h.loFt && h.hiFt > 0 ? [h.loFt, h.hiFt] : null;
}
/** The range a size band stands for when browsing: the first band's floor is drawn from 1 ft, the open-ended last band to 20 ft. Illustration of the band, not a forecast. */
export function bandRange(b: Pick<ScaleBand, 'lo' | 'hi'>): [number, number] { return [Math.max(b.lo, 1), Number.isFinite(b.hi) ? b.hi : 20]; }
/** Top of the drawn axis (feet): room for the tallest of wave, surfer and board, never below 7 ft so small days look small. */
export function axisTop(valuesFt: (number | null | undefined)[]): number { return Math.max(7, ...valuesFt.filter(finite).map((v) => v * 1.12)); }
/** Axis step in the displayed unit: feet 2 (4 above 14 ft), metres 1 (2 above 5 m). */
export function axisStep(topFt: number, unit: 'ft' | 'm'): number { return unit === 'm' ? (topFt * 0.3048 > 5 ? 2 : 1) : topFt > 14 ? 4 : 2; }
/** Axis tick values in the displayed unit, up to the top. */
export function axisTicks(topFt: number, unit: 'ft' | 'm'): number[] {
  const step = axisStep(topFt, unit), out: number[] = [], k = unit === 'm' ? FT_PER_M : 1;
  for (let v = step; v * k <= topFt; v += step) out.push(v);
  return out;
}
/** Body-word ticks that fit under the axis top: [word, feet]. */
export const bodyTicks = (topFt: number) => BODY_TICKS.filter(([, ft]) => ft <= topFt);
/** Screen y for a height in feet. */
export const yFor = (ft: number, topFt: number, base: number, height: number) => base - (Math.max(0, ft) / topFt) * height;
/** The drawn wave face (same cubic outline as the spot page's scale panel): its crest reaches `crestY`, standing on `base`, spanning x0 to x1. */
export function wavePath(x0: number, x1: number, base: number, crestY: number): string {
  const t = crestY, h = base - t;
  return `M${x0} ${base} C ${x0 + 30} ${base - h * 0.08} ${x0 + 44} ${t + h * 0.18} ${x0 + 58} ${t + h * 0.02} C ${x0 + 66} ${t - h * 0.04} ${x1 - 2} ${t + h * 0.08} ${x1 - 6} ${t + h * 0.3} C ${x1 - 14} ${t + h * 0.18} ${x0 + 66} ${t + h * 0.2} ${x0 + 62} ${t + h * 0.45} C ${x0 + 60} ${t + h * 0.7} ${x1 - 6} ${base - 6} ${x1 + 8} ${base} Z`;
}
/** How many "you" heights tall the wave range is: used for the plain-words line ("about 1.5 to 3 times your height"). */
export function timesYourHeight(rangeFt: [number, number], personFt: number): [number, number] | null {
  if (!(personFt > 0)) return null;
  const r = (n: number) => Math.round((n / personFt) * 10) / 10; return [r(rangeFt[0]), r(rangeFt[1])];
}
/** Linear blend for the hour-to-hour animation. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

import type {UserProfile} from '../models/index.ts';
/** The surfer's own height (T-052), stored in inches on the profile and shown in feet and inches or centimetres by the unit preference. */
export const DEFAULT_HEIGHT_IN = 70; // 5'10", used (and labelled "default") only until the user sets theirs
export const HEIGHT_MIN_IN = 40, HEIGHT_MAX_IN = 90; // 3'4" to 7'6"
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const CM_PER_IN = 2.54;

export const inchesFromFtIn = (ft: number, inch: number) => (finite(ft) && finite(inch) && ft >= 0 && inch >= 0 ? ft * 12 + inch : NaN);
export const inchesFromCm = (cm: number) => (finite(cm) ? cm / CM_PER_IN : NaN);
export const cmFromInches = (inches: number) => inches * CM_PER_IN;
export const validHeightIn = (n: unknown): n is number => finite(n) && n >= HEIGHT_MIN_IN && n <= HEIGHT_MAX_IN;
/** Whole feet and inches (nearest inch, carrying 12 into the next foot). */
export function splitFtIn(inches: number): {ft: number; in: number} { const r = Math.round(inches); return {ft: Math.floor(r / 12), in: r % 12}; }
/** "5'10\"" or "178 cm". */
export function formatHeight(inches: number, unit: 'ft' | 'm'): string {
  if (!finite(inches)) return '—';
  if (unit === 'm') return `${Math.round(cmFromInches(inches))} cm`;
  const s = splitFtIn(inches); return `${s.ft}'${s.in}"`;
}
/** The height to draw: the saved one when valid, else the labelled default. Invalid or out-of-range saved values fall back to the default rather than draw a nonsense surfer. */
export function userHeight(p: Pick<UserProfile, 'heightIn'> | null | undefined): {inches: number; feet: number; isDefault: boolean} {
  const saved = p?.heightIn;
  return validHeightIn(saved) ? {inches: saved, feet: saved / 12, isDefault: false} : {inches: DEFAULT_HEIGHT_IN, feet: DEFAULT_HEIGHT_IN / 12, isDefault: true};
}
/** Parses what a person types: ft/in "5'10", "5 10", "5ft 10in", "5-10", or a bare number of feet "5.8" (decimal feet); cm "178" or "178 cm" when unit is metric. Null if it does not parse to a valid height. */
export function parseHeight(text: string, unit: 'ft' | 'm'): number | null {
  const t = text.trim().toLowerCase().replace(/[“”″"]/g, '"').replace(/[’′]/g, "'");
  if (!t) return null;
  let inches = NaN;
  if (unit === 'm') { const m = t.match(/^(\d{2,3}(?:\.\d+)?)\s*(?:cm)?$/); if (m) inches = inchesFromCm(Number(m[1])); }
  else {
    const a = t.match(/^(\d)\s*(?:'|ft|feet|-|\s)\s*(\d{1,2}(?:\.\d+)?)\s*(?:"|in|inches)?$/), b = t.match(/^(\d)\s*(?:'|ft|feet)$/), c = t.match(/^(\d(?:\.\d+)?)$/);
    if (a) inches = Number(a[2]) < 12 ? inchesFromFtIn(Number(a[1]), Number(a[2])) : NaN; else if (b) inches = Number(b[1]) * 12; else if (c) inches = Number(c[1]) * 12;
  }
  return validHeightIn(inches) ? Math.round(inches * 10) / 10 : null;
}

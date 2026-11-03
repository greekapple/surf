import {AI_SCALE_CAPTION} from '../ui/mediaModel.ts';
/** Wave-scale bands for the AI illustrations (T-033). Pure: heights and their already-formatted labels come in, a band and an honest label go out. */
export interface ScaleBand {id: string; /** Media id in public/media/manifest.json. */ media: string; lo: number; hi: number; label: string; short: string}
const band = (id: string, lo: number, hi: number, label: string, short: string): ScaleBand => ({id, media: `ai-scale-${id}`, lo, hi, label, short});
/** Lower edge inclusive, upper edge exclusive: exactly 2 ft is the 2–3 ft band. The first band also holds anything smaller; the last is open-ended. */
export const SCALE_BANDS: readonly ScaleBand[] = [
  band('1-2ft', 0, 2, '1–2 ft', '1–2'), band('2-3ft', 2, 3, '2–3 ft', '2–3'), band('3-4ft', 3, 4, '3–4 ft', '3–4'), band('4-6ft', 4, 6, '4–6 ft', '4–6'),
  band('6-8ft', 6, 8, '6–8 ft', '6–8'), band('8-10ft', 8, 10, '8–10 ft', '8–10'), band('10-15ft', 10, 15, '10–15 ft', '10–15'), band('15-plusft', 15, Infinity, '15+ ft', '15+'),
];
/** Shown on every wave-scale image. */
export const SCALE_CAPTION = AI_SCALE_CAPTION;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** Index of the band containing a height in feet, or null for a missing, negative or non-finite height. */
export function bandIndexFor(ft: number | null | undefined): number | null {
  if (!finite(ft) || ft < 0) return null;
  const i = SCALE_BANDS.findIndex((b) => ft >= b.lo && ft < b.hi);
  return i < 0 ? SCALE_BANDS.length - 1 : i;
}
/** Band of the top of a range: a range that ends exactly on a band's lower edge ("4–6 ft") belongs to the band below it. */
function bandIndexForTop(hi: number, lo: number): number | null {
  const i = bandIndexFor(hi);
  return i !== null && i > 0 && hi === SCALE_BANDS[i].lo && hi > lo ? i - 1 : i;
}

export type ScaleSource = 'estimate' | 'demo' | 'offshore' | 'none';
export interface ScaleInput {
  /** Presentable breaking-wave estimate range, feet. */
  estimateRangeFt: [number, number] | null; estimateText: string | null;
  /** Demonstration-week face height, feet (demonstration data only). */
  demoFaceFt: number | null; demoText: string | null;
  /** Offshore significant wave height, feet. */
  offshoreFt: number | null; offshoreText: string | null;
}
export interface ScaleSelection {
  /** Index into SCALE_BANDS, or null when the hour has no usable height. */
  band: number | null; source: ScaleSource;
  /** What the height is, always naming its source: "Est. 4–6 ft surf height", "4.1 ft offshore, not surf size". */
  label: string;
  /** Extra honesty line: a range that spans two bands, a height below the smallest band, or no height at all. */
  note: string | null;
}
/** Which band to show for an hour: the breaking estimate when presentable, else the demonstration face, else offshore Hs; nothing is invented. */
export function selectScaleBand(i: ScaleInput): ScaleSelection {
  const r = i.estimateRangeFt;
  if (r && finite(r[0]) && finite(r[1]) && r[1] >= r[0] && r[0] >= 0) {
    const lo = bandIndexFor(r[0]), top = bandIndexForTop(r[1], r[0]), label = `Est. ${i.estimateText ?? `${r[0]}–${r[1]} ft`} surf height`;
    if (lo !== null && top !== null && lo !== top) {
      const mid = (r[0] + r[1]) / 2, m = bandIndexFor(mid)!;
      return {band: m, source: 'estimate', label, note: `The estimate spans the ${SCALE_BANDS[lo].label} and ${SCALE_BANDS[top].label} bands. Showing the band of its midpoint (${Number.isInteger(mid) ? mid : mid.toFixed(1)} ft).`};
    }
    if (lo !== null) return {band: lo, source: 'estimate', label, note: r[1] < 1 ? 'Smaller than the smallest illustration; showing the 1–2 ft band.' : null};
  }
  if (finite(i.demoFaceFt) && i.demoFaceFt >= 0) return {band: bandIndexFor(i.demoFaceFt), source: 'demo', label: `${i.demoText ?? `${i.demoFaceFt} ft`} demonstration face, not live data`, note: null};
  if (finite(i.offshoreFt) && i.offshoreFt >= 0) {
    return {band: bandIndexFor(i.offshoreFt), source: 'offshore', label: `${i.offshoreText ?? `${i.offshoreFt} ft`} offshore, not surf size`,
      note: i.offshoreFt < 1 ? 'Smaller than the smallest illustration; showing the 1–2 ft band.' : 'Offshore wave height is not the size of the breaking wave; the picture is the band that contains this number.'};
  }
  return {band: null, source: 'none', label: 'No wave height for this hour', note: 'Not tied to the forecast. Browse the bands to see what each size looks like.'};
}

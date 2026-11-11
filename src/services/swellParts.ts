/** Audit F12 / A13: which model swell partitions are shown as swell. A partition with a period under 2 s, or a non-primary one under 0.5 ft, is
 *  model noise (Cocoa Beach's "0.1 ft · 1 s") and is not shown. A period under 5 s is local wind chop, not swell, and is labelled so
 *  (Manasquan's 3–4 s "periods"). OUR thresholds (round figures in the audit's range), not a published standard. Pure, for tests. */
export const NOISE_PERIOD_S = 2, NOISE_HEIGHT_FT = 0.5, CHOP_PERIOD_S = 5;
/** The 0.5 ft floor applies only under this period: a small long-period groundswell (e.g. 0.4 ft at 16 s) is real energy and stays shown (review fix). */
export const SMALL_FLOOR_BELOW_S = 10;
export type PartitionKind = 'noise' | 'chop' | 'swell';
export function partitionKind(part: {height: number; period: number} | null | undefined, primary = false): PartitionKind {
  if (!part || !Number.isFinite(part.height) || part.height <= 0.05) return 'noise';
  if (Number.isFinite(part.period) && part.period < NOISE_PERIOD_S) return 'noise';
  if (!primary && part.height < NOISE_HEIGHT_FT && !(Number.isFinite(part.period) && part.period >= SMALL_FLOOR_BELOW_S)) return 'noise';
  return Number.isFinite(part.period) && Math.round(part.period) < CHOP_PERIOD_S ? 'chop' : 'swell';   // on the whole seconds shown, so a label never reads '5 s chop' beside a plain '5 s'
}
/** The partitions of a record worth showing, primary first, each with its kind. */
export function shownPartitions<T extends {height: number; period: number}>(parts: (T | null | undefined)[]): (T & {kind: Exclude<PartitionKind, 'noise'>})[] {
  return parts.flatMap((s, i) => { const k = partitionKind(s, i === 0); return s && k !== 'noise' ? [{...s, kind: k}] : []; });
}
/** What the Swell card's footer says about what was left out: small partitions hidden by the 0.5 ft floor, or nothing but model noise in the record. */
export function partitionNotes(parts: ({height: number; period: number} | null | undefined)[]): {smallHidden: boolean; onlyNoise: boolean} {
  const real = parts.map((x, i) => ({x, i})).filter(({x}) => x && Number.isFinite(x.height) && x.height > 0.05);
  const dropped = real.filter(({x, i}) => partitionKind(x, i === 0) === 'noise');
  const smallHidden = dropped.some(({x}) => Number.isFinite(x!.period) && x!.period >= NOISE_PERIOD_S);
  return {smallHidden, onlyNoise: real.length > 0 && dropped.length === real.length && !smallHidden};
}

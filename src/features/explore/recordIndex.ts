/** list-index (lead, 2026-11-13; B8 profile): the spot list's offshore range and next-hours bars used to filter ALL map records for EVERY listed spot on every
 *  scrub step (O(spots × records): about 2 s of a 24-step scrub at z6). The records are indexed by spot once (whenever they change), each spot's list in the
 *  records' own order, so every lookup returns exactly what the old filter returned (src/tests/record-index.test.ts compares them). Pure. */
export interface Timed<T> {r: T; t: number}
export function indexBySpot<T extends {spotId: string; timestamp: string}>(records: readonly T[]): Map<string, Timed<T>[]> {
  const m = new Map<string, Timed<T>[]>();
  for (const r of records) { let l = m.get(r.spotId); if (!l) { l = []; m.set(r.spotId, l); } l.push({r, t: Date.parse(r.timestamp)}); }
  return m;
}
/** The spot's records within ±hours of t0 (inclusive), in the records' order: what `records.filter(spot && |t − t0| ≤ h)` returned. */
export const near = <T>(list: readonly Timed<T>[] | undefined, t0: number, hours: number): T[] => (list ?? []).filter((x) => Math.abs(x.t - t0) <= hours * 36e5).map((x) => x.r);
/** The spot's records in [t0, t0 + hours), in the records' order: what `records.filter(spot && t ≥ t0 && t < t0 + h)` returned. */
export const ahead = <T>(list: readonly Timed<T>[] | undefined, t0: number, hours: number): Timed<T>[] => (list ?? []).filter((x) => x.t >= t0 && x.t < t0 + hours * 36e5);

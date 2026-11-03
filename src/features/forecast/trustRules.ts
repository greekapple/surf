import type {SurfBandPoint} from '../../services/surfSeries.ts';
import type {NwsAlert} from '../../services/nwsAlerts.ts';
import type {FeltEntry, FeltSignal} from '../../services/observationStore.ts';
/** The graph's surf band for one hour, or undefined. Only a surf ESTIMATE is a band: offshore Hs and demonstration values carry lo/hi too, but they are
 *  not surf estimates (CONTRACTS.md), so they are never drawn or announced as surf; offshore stays on the thin secondary line with its own label. */
export const estimateBand = (b: SurfBandPoint | undefined): (SurfBandPoint & {lo: number; hi: number}) | undefined =>
  b && b.kind === 'estimate' && b.lo !== null && b.hi !== null ? (b as SurfBandPoint & {lo: number; hi: number}) : undefined;
export const hasEstimateBand = (pts: Iterable<SurfBandPoint>) => { for (const b of pts) if (estimateBand(b)) return true; return false; };

/** NWS alerts still in force at nowMs (not past their end, else their expiry). */
export const activeAlerts = (alerts: NwsAlert[], nowMs: number) => alerts.filter((a) => { const until = a.ends ?? a.expires; return !until || Date.parse(until) > nowMs; });
/** The "Felt right?" answer for one spot and one hour (the displayed hour), newest first; null when that hour has none. */
export const feltForHour = (entries: FeltEntry[], spotId: string, hourIso: string): FeltSignal | null =>
  entries.filter((x) => x.spotId === spotId && x.hour === hourIso).sort((a, b) => Date.parse(b.loggedAt) - Date.parse(a.loggedAt))[0]?.felt ?? null;
/** T-069: does a "why" sentence only restate the call's headline (its verdict and window)? True when, after dropping filler words, every word of
 *  the sentence is already in the headline ("It is dark. The next window is tomorrow 6 AM–2 PM." under "Dark · next window 6 AM–2 PM tomorrow"). */
const FILLER = new Set(['it', 'is', 'its', 'the', 'a', 'an', 'and', 'of', 'to', 'at', 'in', 'on', 'for', 'this', 'that', 'there', 'be', 'will', 'today']); // T-088: the headline drops "today" for a same-day window
const words = (s: string) => s.toLowerCase().replace(/[–—-]/g, ' ').match(/[a-z0-9]+/g) ?? [];
export function restatesHeadline(why: string, headline: string): boolean {
  const have = new Set(words(headline));
  return words(why).filter((w) => !FILLER.has(w)).every((w) => have.has(w));
}
/** The first reason that adds something to the headline, or null. */
export const firstNewReason = (why: string[], headline: string) => why.find((w) => !restatesHeadline(w, headline)) ?? null;
/** T-088: the tap-open reason list without repeats: a reason already contained in an earlier one (the first reason often combines the next two) is dropped. */
export const uniqueReasons = (why: string[]) => why.filter((r, i) => !why.slice(0, i).some((e) => e.includes(r.trim())) && why.indexOf(r) === i);

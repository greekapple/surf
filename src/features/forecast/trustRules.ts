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

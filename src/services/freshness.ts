/** ONE freshness rule (T-084), the same one the rating uses (ratings/provisional.ts): a source is stale when the proxy served its saved copy, when it was retrieved more than 2 h ago, when its retrieval time is more than 5 min in the future, or when the time cannot be read.
 *  Anything stale is shown with a label that says so; it is never presented as current. */
export const MAX_AGE_MS = 7200000, FUTURE_TOL_MS = 300000;
export type Stale = {reason: 'saved' | 'old' | 'future' | 'unknown'; retrievedAt: string};
/** Tide predictions are an 8-day series the Worker refreshes every 6 h, so a retrieval age up to ~7 h is normal and not a staleness signal. */
export const TIDE_MAX_AGE_MS = 7 * 3600000;
/** Wave-model (Open-Meteo marine) values are refreshed every 3 h (spot-expansion spec 2026-11-08: the wave models run every 6-12 h), so a retrieval age up to ~3 h is normal; 4 h = the 3 h TTL plus
 *  the 5-minute cron step and the browser's 10-minute cache. Wind (hourly weather target, 1 h TTL) and the model-spread (90 min) keep the 2 h rule. */
export const MARINE_MAX_AGE_MS = 4 * 3600000;
/** The retrieval-age limit for a source: the Open-Meteo wave-model (marine) forecast is refreshed every 3 h and gets MARINE_MAX_AGE_MS; everything else (wind, spread, MOP, observations) keeps the 2 h rule.
 *  Chosen by the source's own provider, never by its position in a list, so every screen reads the same marine value the same way. */
export const maxAgeFor = (src: {provider?: string; kind?: string} | null | undefined): number => (src?.provider === 'Open-Meteo Marine' ? MARINE_MAX_AGE_MS : MAX_AGE_MS);
export function staleness(src: {delivery?: string; retrievedAt?: string; provider?: string; kind?: string} | null | undefined, nowMs: number, maxAgeMs?: number): Stale | null {
  if (!src) return null;
  if (maxAgeMs === undefined) maxAgeMs = maxAgeFor(src);
  const at = String(src.retrievedAt ?? ''), t = Date.parse(at);
  if (src.delivery === 'saved') return {reason: 'saved', retrievedAt: at};
  if (!Number.isFinite(t)) return {reason: 'unknown', retrievedAt: at};
  if (nowMs - t > maxAgeMs) return {reason: 'old', retrievedAt: at};
  if (t > nowMs + FUTURE_TOL_MS) return {reason: 'future', retrievedAt: at};
  return null;
}
/** First stale source of a list, saved before old. */
export const firstStale = (srcs: ({delivery?: string; retrievedAt?: string; provider?: string; kind?: string} | null | undefined)[], nowMs: number, maxAgeMs?: number): Stale | null => {
  const all = srcs.map((s) => staleness(s, nowMs, maxAgeMs)).filter((s): s is Stale => !!s);
  return all.find((s) => s.reason === 'saved') ?? all[0] ?? null;
};
const when = (iso: string) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t).toISOString().replace('T', ' ').replace(/:\d\d(\.\d+)?Z$/, ' UTC') : 'at an unknown time'; };
/** Short text for a label: "saved copy retrieved … " / "stale: retrieved … (over 2 h ago)". */
export const staleText = (s: Stale) => s.reason === 'saved' ? `SAVED copy retrieved ${when(s.retrievedAt)}: the latest refresh did not succeed, so this is not live` : s.reason === 'old' ? `STALE: retrieved ${when(s.retrievedAt)}, older than the refresh interval` : `UNVERIFIED: retrieval time ${s.retrievedAt ? when(s.retrievedAt) + ' is in the future' : 'unknown'}`;

/** Per-hour freshness of the wind and tide behind a legacy Forecast (T-086): read from the evidence sources, with the tide's own refresh limit. Null = fresh or no evidence (demonstration data). */
export function hourFreshness(f: {evidence?: any} | null | undefined, nowMs: number): {wind: Stale | null; tide: Stale | null} {
  const e = f?.evidence; if (!e) return {wind: null, tide: null};
  return {wind: firstStale([e.windSpeed?.source, e.windDirection?.source], nowMs), tide: firstStale([e.tide?.source], nowMs, TIDE_MAX_AGE_MS)};
}
/** The short mark shown beside a stale value: "saved" for a saved copy, "stale" otherwise. */
export const staleWord = (s: Stale | null | undefined) => (s ? (s.reason === 'saved' ? 'saved' : 'stale') : '');

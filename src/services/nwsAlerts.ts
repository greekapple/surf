import {evidenceSpots} from '../ocean/spots.ts';
import {zoneFor} from './nwsZones.ts';

/** NWS alerts for a spot (T-064): `https://api.weather.gov/alerts/active?zone=<zone>` (public, keyless, National Weather Service). Surf-relevant events only, quoted with their own wording,
 *  dated (`fetchedAt`), cached 15 minutes per zone, and silent on failure (status 'unavailable', never an exception). The zone table is in nwsZones.ts. */
export interface NwsAlert {event: string; headline: string; onset: string | null; ends: string | null; expires: string | null; url: string; sender: string; severity: string | null; approxZone: boolean}
export type AlertsResult = {status: 'ok'; alerts: NwsAlert[]; fetchedAt: string} | {status: 'unavailable'};
/** Generic client name as NWS asks (no personal contact details). Browsers set their own User-Agent and ignore this; the Worker proxy sends it. */
export const NWS_USER_AGENT = 'SWELLO surf app';
export const NWS_ALERTS_TTL_MS = 15 * 60000;
export const alertsURL = (zone: string) => `https://api.weather.gov/alerts/active?zone=${encodeURIComponent(zone)}`;
/** Events that matter to someone going surfing. Everything else the feed carries (heat, fire weather, ...) is left out. */
export const SURF_EVENTS = /^(Beach Hazards Statement|High Surf (Advisory|Warning)|Rip Current Statement|Coastal Flood (Advisory|Warning|Watch|Statement)|Tsunami (Advisory|Warning|Watch)|Hazardous Seas Warning|Storm Warning|Hurricane Force Wind Warning|Gale Warning|Small Craft Advisory)$/i;
const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
/** Maps the alerts feed (GeoJSON) to our alerts: active only (not expired, not ended), surf-relevant only, most severe first. */
export function mapAlerts(feed: any, spotId: string, nowMs: number): NwsAlert[] {
  const z = zoneFor(spotId), ev = evidenceSpots.find((e) => e.id === spotId), out: NwsAlert[] = [];
  for (const f of Array.isArray(feed?.features) ? feed.features : []) {
    const p = f?.properties; if (!p || typeof p.event !== 'string' || !SURF_EVENTS.test(p.event)) continue;
    const ends = s(p.ends) ?? s(p.expires), until = ends ? Date.parse(ends) : NaN;
    if (Number.isFinite(until) && until <= nowMs) continue;
    if (p.status && p.status !== 'Actual') continue;
    out.push({event: p.event, headline: s(p.headline) ?? p.event, onset: s(p.onset) ?? s(p.effective), ends: s(p.ends), expires: s(p.expires),
      url: ev ? `https://forecast.weather.gov/MapClick.php?lat=${ev.latitude.toFixed(4)}&lon=${ev.longitude.toFixed(4)}` : 'https://www.weather.gov/', sender: s(p.senderName) ?? 'National Weather Service', severity: s(p.severity), approxZone: !!z?.approx});
  }
  const rank: Record<string, number> = {Extreme: 0, Severe: 1, Moderate: 2, Minor: 3};
  // lead review (phone pass): a Warning must never sit behind '+N more' under a Statement. CAP severity first, then the event's own tier (ties and a missing
  // severity no longer keep feed order), then the feed order.
  return out.map((x, i) => ({x, i})).sort((a, b) => (rank[a.x.severity ?? ''] ?? 4) - (rank[b.x.severity ?? ''] ?? 4) || eventTier(a.x.event) - eventTier(b.x.event) || a.i - b.i).map(({x}) => x);
}
/** The event's tier from its name: any Warning first; then the other Tsunami and High Surf events (a High Surf Advisory, a Tsunami Watch); then Watch,
 *  Advisory, Statement, anything else. */
export function eventTier(event: string): number {
  return /warning/i.test(event) ? 0 : /tsunami|high surf/i.test(event) ? 0.5 : /watch/i.test(event) ? 1 : /advisory/i.test(event) ? 2 : /statement/i.test(event) ? 3 : 4;
}
const cache = new Map<string, {at: number; feed: unknown; fetchedAt: string}>();
export const clearAlertsCache = () => cache.clear();
/** Never throws. A spot without a zone returns ok with no alerts (nothing to say). `fetcher` is injectable for tests. */
export async function alertsFor(spotId: string, signal?: AbortSignal, fetcher: typeof fetch = fetch, nowMs = Date.now()): Promise<AlertsResult> {
  const z = zoneFor(spotId);
  if (!z) return {status: 'ok', alerts: [], fetchedAt: new Date(nowMs).toISOString()};
  const hit = cache.get(z.zone); if (hit && nowMs - hit.at < NWS_ALERTS_TTL_MS) return {status: 'ok', alerts: mapAlerts(hit.feed, spotId, nowMs), fetchedAt: hit.fetchedAt};
  try {
    const r = await fetcher(alertsURL(z.zone), {signal, headers: {Accept: 'application/geo+json'}});
    if (!r.ok) return {status: 'unavailable'};
    const feed = await r.json(), fetchedAt = new Date(nowMs).toISOString();
    cache.set(z.zone, {at: nowMs, feed, fetchedAt}); return {status: 'ok', alerts: mapAlerts(feed, spotId, nowMs), fetchedAt};
  } catch { return {status: 'unavailable'}; }
}

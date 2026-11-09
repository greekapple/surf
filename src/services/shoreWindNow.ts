import {request} from '../ocean/request.ts';
import {shoreAssignmentFor, ndbcWindURL, nwsObservationURL, normalizeNdbcWind, normalizeNwsWind, type ShoreWindNow, type ShoreStation} from '../ocean/shoreWind.ts';

/** Wind now (spec 2026-11-08): the measured shore wind for a spot, or null.
 *  null means "show nothing": the spot has no station within 4 km, the feed failed, the reading is older than 2 hours, or it carries no wind speed.
 *  Goes through ocean/request.ts, so in production it is the Worker's /api/provider?key=shore-<kind>-<id> (10 min TTL, stale-while-error) and in dev the
 *  provider directly; a request is cached 10 minutes per URL. Never throws, never invents a reading. `fetcher` and `now` are for tests. */
export async function loadShoreWindNow(spotId: string, now: number = Date.now(), fetcher: typeof fetch = fetch): Promise<ShoreWindNow | null> {
  const a = shoreAssignmentFor(spotId); if (!a) return null;
  const st: ShoreStation = {id: a.stationId, name: a.stationName, kind: a.kind, lat: a.lat, lon: a.lon, distanceKm: a.distanceKm};
  try {
    if (a.kind === 'ndbc') return normalizeNdbcWind(await request(ndbcWindURL(a.stationId), 'text', 600000, fetcher), st, now);
    return normalizeNwsWind(await request(nwsObservationURL(a.stationId), 'json', 600000, fetcher), st, now);
  } catch { return null; }
}

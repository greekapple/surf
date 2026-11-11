// `/api/cam-meta?id=<still id>` (bayarea-cams-wire): WHEN the owner's still was last posted, for the "Live cam" panel. The USGS image bucket sends no CORS headers, so a browser cannot read the frame's
// Last-Modified itself. This endpoint makes ONE HEAD request to the owner's own URL (fixed list: the stills of src/data/liveCamsSourced.ts, never an arbitrary URL), returns the header and when this Worker first saw that content (ETag), and nothing else:
// no image is fetched, proxied or stored. The picture itself is always loaded by the visitor's browser from the owner's host. Kept 5 minutes in memory (60 s when the owner did not answer).
import {LIVE_CAMS} from '../src/data/liveCamsSourced.ts';

export const CAM_UA = 'SWELLO surf forecast prototype', META_TTL_MS = 300000, META_MISS_MS = 60000;
const STILLS = new Map(LIVE_CAMS.filter((c) => c.kind === 'still' && c.metaId && c.stillUrl).map((c) => [c.metaId, c.stillUrl]));
export function createCamMeta({fetcher = fetch, now = Date.now, timeoutMs = 8000} = {}) {
  const held = new Map(), jobs = new Map(), seen = new Map();   // seen: id -> {etag, firstSeen}: when THIS Worker first saw the current content (a rewrite of the same frame keeps its ETag, so its first sighting stays)
  async function lookup(id) {
    const url = STILLS.get(id), hit = held.get(id); if (hit && now() < hit.until) return hit.value;
    if (!jobs.has(id)) jobs.set(id, (async () => {
      let value;
      try { const r = await fetcher(url, {method: 'HEAD', headers: {'User-Agent': CAM_UA}, signal: AbortSignal.timeout(timeoutMs)}), lm = r.ok ? Date.parse(r.headers.get('last-modified') ?? '') : NaN; const etag = r.ok ? (r.headers.get('etag') ?? '').replace(/^W\//, '') || null : null, prev = seen.get(id);
        if (etag && (!prev || prev.etag !== etag)) seen.set(id, {etag, firstSeen: now()});
        value = {id, lastModified: Number.isFinite(lm) ? new Date(lm).toISOString() : null, ...(etag && seen.get(id)?.etag === etag ? {firstSeenAt: new Date(seen.get(id).firstSeen).toISOString()} : {}), checkedAt: new Date(now()).toISOString(), ...(r.ok ? {} : {status: r.status})}; }
      catch { value = {id, lastModified: null, checkedAt: new Date(now()).toISOString(), status: 0}; }
      held.set(id, {value, until: now() + (value.lastModified ? META_TTL_MS : META_MISS_MS)}); return value;
    })().finally(() => jobs.delete(id)));
    return jobs.get(id);
  }
  async function respond(url) {
    const id = url.searchParams.get('id') ?? '', json = (b, s = 200, age = 300) => new Response(JSON.stringify(b), {status: s, headers: {'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${age}`}});
    if (!STILLS.has(id)) return json({error: 'Unknown camera'}, 404, 60);
    const v = await lookup(id); return json(v, 200, v.lastModified ? 300 : 30);
  }
  return {respond, lookup};
}

// `/api/embed-allowed?id=<HDOnTap player id>` (hdontap-auto): may OUR site frame this HDOnTap player yet? One HEAD request to the camera's own player page (https://portal.hdontap.com/s/embed/?stream=<id>), from the fixed map of the
// generated camera data (an unknown id is a 404, never an arbitrary URL). The answer is read from HDOnTap's OWN headers: Content-Security-Policy `frame-ancestors` (every such header must allow us) and, when there is no frame-ancestors,
// X-Frame-Options. allowed=true only when our origin matches; any doubt (a non-2xx answer, a timeout, a header we cannot read) is allowed=false, so the page shows the camera's link instead of a frame that would break.
// Cached 10 minutes when allowed; 60 seconds when not (or when HDOnTap did not answer), so the cameras appear soon after HDOnTap adds our domain. No body is fetched, nothing is proxied or stored.
import {LIVE_CAMS} from '../src/data/liveCamsSourced.ts';

export const EMBED_UA = 'SWELLO surf forecast prototype', OUR_ORIGIN = 'https://swello.surf-prototype.workers.dev', ALLOWED_TTL_MS = 600000, MISS_TTL_MS = 60000;
const PLAYERS = new Map(LIVE_CAMS.filter((c) => c.kind === 'hdontap' && c.embedId && c.embedUrl).map((c) => [c.embedId, c.embedUrl]));

/** Does one frame-ancestors source expression allow `origin`? ('self' is HDOnTap's own origin, never ours; 'none' allows nobody.) */
export function sourceAllows(src, origin = OUR_ORIGIN) {
  const s = String(src).trim().toLowerCase(), o = new URL(origin); if (!s || s === "'none'" || s === "'self'") return false;
  if (s === '*') return true; if (s === 'https:' || s === 'http:') return s === o.protocol;
  const m = /^(?:(https?):\/\/)?(\*\.)?([a-z0-9.-]+)(?::(\*|\d+))?(\/.*)?$/.exec(s); if (!m) return false;
  const [, scheme, wild, host, port] = m; if (scheme && `${scheme}:` !== o.protocol) return false; if (!scheme && o.protocol !== 'https:') return false;
  if (port && port !== '*' && port !== (o.port || '443')) return false; if (!port && o.port && o.port !== '443') return false;
  return wild ? o.hostname.endsWith(`.${host}`) : o.hostname === host;
}
/** From the response's headers: allowed iff every CSP that has a frame-ancestors lists our origin; with none, X-Frame-Options (DENY / SAMEORIGIN forbid us; ALLOW-FROM only an exact match); with neither header, nothing forbids framing. */
export function framingAllowed(csps, xfo, origin = OUR_ORIGIN) {
  const fa = [];
  for (const csp of csps) for (const d of String(csp).split(';')) { const t = d.trim().split(/\s+/); if (t[0]?.toLowerCase() === 'frame-ancestors') fa.push(t.slice(1)); }
  if (fa.length) return fa.every((srcs) => srcs.some((x) => sourceAllows(x, origin)));
  const x = String(xfo ?? '').trim().toLowerCase(); if (!x) return true;
  if (x === 'deny' || x === 'sameorigin') return false;
  const af = /^allow-from\s+(\S+)/.exec(x); return !!af && af[1].replace(/\/$/, '') === origin.toLowerCase();
}
export function createEmbedAllowed({fetcher = fetch, now = Date.now, timeoutMs = 8000, origin = OUR_ORIGIN} = {}) {
  const held = new Map(), jobs = new Map();
  async function lookup(id) {
    const hit = held.get(id); if (hit && now() < hit.until) return hit.value;
    if (!jobs.has(id)) jobs.set(id, (async () => {
      let value;
      try {
        const r = await fetcher(PLAYERS.get(id), {method: 'HEAD', headers: {'User-Agent': EMBED_UA}, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs)});
        const csps = r.headers.getSetCookie ? [r.headers.get('content-security-policy')].filter(Boolean) : [r.headers.get('content-security-policy')].filter(Boolean);
        value = {id, allowed: r.ok && framingAllowed(csps, r.headers.get('x-frame-options'), origin), status: r.status, checkedAt: new Date(now()).toISOString()};
      } catch { value = {id, allowed: false, status: 0, checkedAt: new Date(now()).toISOString()}; }
      held.set(id, {value, until: now() + (value.allowed ? ALLOWED_TTL_MS : MISS_TTL_MS)}); return value;
    })().finally(() => jobs.delete(id)));
    return jobs.get(id);
  }
  async function respond(url) {
    const id = url.searchParams.get('id') ?? '', json = (b, s = 200, age = 60) => new Response(JSON.stringify(b), {status: s, headers: {'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${age}`}});
    if (!PLAYERS.has(id)) return json({error: 'Unknown camera'}, 404, 60);
    const v = await lookup(id); return json(v, 200, v.allowed ? 300 : 30);
  }
  return {respond, lookup};
}

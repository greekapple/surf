// offshore-surf step 3: the latest NWS Surf Zone Forecast (SRF) per office, parsed and slimmed, served from R2 at /api/srf?office=MTR.
// The hourly capture (services/surf-capture.mjs, job srf) stores each new product as the NWS issued it and ALSO writes the newest one per office here, parsed by services/srf-parse.mjs.
// Public-domain NWS data, served as the NWS wrote it: the numbers are never edited, converted or mixed with ours. A product that could not be parsed is not served.
import {parseSrf} from './srf-parse.mjs';

export const SERVE_PREFIX = 'serve/srf/';
export const serveKey = (office) => `${SERVE_PREFIX}${office}.json`;
export const OFFICES = ['BOX', 'BRO', 'CAR', 'CRP', 'EKA', 'GUM', 'HFO', 'JAX', 'LOX', 'MFL', 'MFR', 'MLB', 'MOB', 'MTR', 'PQR', 'SGX', 'SJU', 'TAE', 'TBW'];

/** One product as the API serves it: what a spot's headline needs and nothing else (no rip-current or weather lines). Null when the product has no zone with a readable surf period. */
export function slimProduct(prod, office) {
  let p; try { p = parseSrf(prod); } catch { return null; }
  if (!p?.id || !p.issuedAt) return null;
  const zones = p.zones.map((z) => ({ugc: z.ugc, name: z.name, expires: z.expires, issued: z.issued, periods: z.periods.filter((x) => x.surf?.length).map((x) => ({label: x.label, date: x.date, part: x.part, surf: x.surf.map((s) => ({label: s.label, facing: s.facing, lo: s.lo, hi: s.hi, kind: s.kind, raw: s.raw, then: s.then, sets: s.sets}))}))})).filter((z) => z.periods.length);
  return zones.length ? {schema: 1, office, id: p.id, issuedAt: p.issuedAt, zones} : null;
}

/** GET /api/srf?office=XXX -> {office, product: slim | null}. Reads one R2 key; an R2 failure is a 503, never "no product". */
export function createSrfServe({now = Date.now} = {}) {
  const json = (v, status = 200, ttl = 300) => new Response(JSON.stringify(v), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=1800`}});
  return {
    async respond(env, url) {
      const office = (url.searchParams.get('office') ?? '').toUpperCase();
      if (!OFFICES.includes(office)) return json({error: 'Unknown SRF office'}, 400, 0);
      if (!env?.BUCKET) return json({office, product: null, reason: 'no storage'});
      try { const o = await env.BUCKET.get(serveKey(office)); return json({office, product: o ? await o.json() : null, servedAt: new Date(now()).toISOString()}); }
      catch { return json({error: 'storage read failed'}, 503, 0); }
    },
  };
}

// `/api/coast-ratings?t=<ISO whole hour>` (pills-snapshot): the coast pills' values for spots the map has not loaded, from the newest COMPLETE daily capture
// (howright/v2/shown/<UTC date>.json, services/how-right-all.mjs). Every spot is RE-RATED at the hour with the current engine from the stored marine and wind inputs (src/services/coastSnapshot.ts);
// the score stored in the capture is never read. No Open-Meteo call and no write: R2 reads only (the status file, then the capture of today, yesterday or the day before).
// Compact answer: {ok, date, capturedAt, t, from, to, retrievedFrom, retrievedTo, spots: {id: [score, category, dark, retrievedMin]}}: each spot is judged at the retrieval time of its model run (the older of its marine and wind copy),
// and says when that was. The capture is kept in memory (10 minutes, then the status is read again so a new capture is picked up), concurrent requests share one load, "no complete capture" is remembered for 60 seconds,
// each (capture, hour) answer is kept as its own string; the answer carries Cache-Control for 5 minutes and is also put in the Workers edge cache (caches.default) where the zone has one (it is a no-op on workers.dev). Outside the capture's 48 hours, or with no complete capture: {ok: false, reason} and the page says "Not loaded yet".
import {evidenceSpots} from '../src/ocean/spots.ts';
import {snapshotAt} from '../src/services/coastSnapshot.ts';

export const COAST_KEYS = {status: 'howright/v2/_status.json', shown: (day) => `howright/v2/shown/${day}.json`};
export const CAPTURE_TTL_MS = 600000, MISS_TTL_MS = 60000, ANSWER_MAX = 120, HOUR = 3600000, DAY = 86400000;
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
class R2ReadError extends Error {}
const getJson = async (bucket, key) => { try { const o = await bucket.get(key); return o ? await o.json() : null; } catch (e) { throw new R2ReadError(`R2 read failed: ${key}`); } };

export function createCoastRatings({now = Date.now, ids = evidenceSpots.map((s) => s.id)} = {}) {
  let held = null, missUntil = 0, loading = null;   // held = {key, cap, at}: the capture in use; missUntil: no complete capture was found, do not look again before this; loading: the load in flight
  const answers = new Map();       // `${key}|${tMs}` -> response body (string)
  /** The newest complete capture: today's, yesterday's or the day before's (UTC dates). Complete = the status file says so for that day, or every catalogue spot is in it. */
  function newestComplete(bucket) {
    const t = now(); if (held && t - held.at < CAPTURE_TTL_MS) return Promise.resolve(held); if (!held && t < missUntil) return Promise.resolve(null);
    return (loading ||= load(bucket, t).finally(() => { loading = null; }));   // concurrent requests share one load (a read that throws is thrown to each of them and not remembered)
  }
  async function load(bucket, t) {
    const st = await getJson(bucket, COAST_KEYS.status);
    for (let d = 0; d < 3; d++) {
      const day = utcDay(t - d * DAY), cap = await getJson(bucket, COAST_KEYS.shown(day));
      if (!cap?.spots) continue;
      const complete = (st?.captureDate === day && st.captureComplete === true) || (ids.every((id) => cap.spots[id]) && Object.keys(cap.spots).length > 0);
      if (!complete) continue;
      const key = `${day}|${cap.updatedAt ?? cap.capturedAt}`;
      if (held?.key === key) { held.at = t; return held; }
      answers.clear(); missUntil = 0; return (held = {key, cap, at: t});
    }
    held = null; missUntil = t + MISS_TTL_MS; return null;
  }
  async function respond(bucket, request, ctx) {
    const url = new URL(request.url ?? request), edge = typeof globalThis.caches !== 'undefined' ? globalThis.caches.default : null;
    const json = (body, status = 200, maxAge = 300) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAge}`}});
    const tRaw = url.searchParams.get('t'), tMs = Date.parse(tRaw ?? '');
    if (!tRaw || !Number.isFinite(tMs) || tMs % HOUR !== 0) return json({ok: false, reason: 'bad-hour'}, 400, 60);
    if (!bucket) return json({ok: false, reason: 'no-capture'}, 200, 60);
    if (edge) { try { const hit = await edge.match(url.toString()); if (hit) return hit; } catch { /* no edge cache here */ } }
    let cur; try { cur = await newestComplete(bucket); } catch (e) { return json({ok: false, reason: 'read-failed'}, 503, 0); }
    if (!cur) return json({ok: false, reason: 'no-capture'}, 200, 60);
    const k = `${cur.key}|${tMs}`; let body = answers.get(k), res;
    if (!body) {
      const snap = snapshotAt(cur.cap, tMs); body = JSON.stringify(snap);
      if (!snap.ok) return json(body, 200, 300);
      answers.set(k, body); while (answers.size > ANSWER_MAX) answers.delete(answers.keys().next().value);
    }
    res = json(body);
    if (edge && ctx?.waitUntil) { try { ctx.waitUntil(edge.put(url.toString(), res.clone())); } catch { /* no edge cache here */ } }
    return res;
  }
  return {respond, newestComplete};
}

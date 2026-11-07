// "How right we've been" (beyond-Surfline step 2), the server side. Rules and words: src/services/howRight.ts; method and budget: docs/forecast/HOW-RIGHT.md.
// ONE daily job (worker/cloudflare.mjs runs it on one 5-minute cron tick a day, instead of that tick's forecast refresh):
//   1. capture what we are showing: the cached CDIP MOP forecast at every assigned point (R2 reads of the T-129 cache, no upstream call), the next 48 h,
//      stored as howright/v1/shown/<UTC date>.json;
//   2. score: the measured buoy series (CDIP realtime / NDBC), CDIP's model at each buoy and at the spots' points, against the stored captures;
//   3. store the result as howright/v1/scorecard.json.
// The page reads that one object (/api/how-right; one R2 read per Worker isolate per 30 minutes). No Open-Meteo call anywhere in this path.
// Without a persistent bucket (the Vite preview, tests) /api/how-right computes on demand and keeps the result in memory for 6 hours; nothing is stored.
import {runHowRight, captureShown, HOW_RIGHT_RULE} from '../src/services/howRight.ts';
import {howRightSpots} from '../src/services/howRightSpots.ts';

export const HOW_RIGHT_KEYS = {card: 'howright/v1/scorecard.json', shown: (day) => `howright/v1/shown/${day}.json`};
/** Subrequests (upstream fetches + R2 operations) one daily run may use. A run needs about 140 (44 cached forecasts, 33 capture reads, about 58 CDIP/NDBC fetches, 2 writes). */
export const HOW_RIGHT_BUDGET = 400;
const DAY = 86400000, utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

export function createHowRight({fetcher = fetch, now = Date.now, timeoutMs = 18000, readLatest, persistent}) {
  let memo = null, job = null;
  const spots = howRightSpots(), mopIds = [...new Set(spots.map((s) => s.mopId).filter(Boolean))];
  async function compute(env, store) {
    const run = {used: 0, limit: HOW_RIGHT_BUDGET, skipped: 0}, bucket = env?.BUCKET, t = now();
    const spend = () => (run.used < run.limit ? (run.used++, true) : (run.skipped++, false));
    const get = async (url) => { if (!spend()) return null; try { const r = await fetcher(url, {signal: AbortSignal.timeout(Math.max(timeoutMs, 30000))}); if (!r.ok) return null; const x = await r.text(); return x.length > 3000000 ? null : x; } catch { return null; } };
    const r2get = async (key) => { if (!bucket || !spend()) return null; try { const o = await bucket.get(key); return o ? await o.json() : null; } catch { return null; } };
    let capture = null;
    if (store && bucket) {
      const cached = [];
      for (const id of mopIds) { if (!spend()) break; cached.push({mopId: id, value: await readLatest(env, 'nearshore-' + id + '-forecast').catch(() => null)}); }
      capture = captureShown(cached, t);
      if (Object.keys(capture.points).length && spend()) await bucket.put(HOW_RIGHT_KEYS.shown(utcDay(t)), JSON.stringify(capture), {httpMetadata: {contentType: 'application/json'}});
    }
    const captures = capture && Object.keys(capture.points).length ? [capture] : [];
    for (let i = capture ? 1 : 0; i <= HOW_RIGHT_RULE.windowDays + 2; i++) { const c = await r2get(HOW_RIGHT_KEYS.shown(utcDay(t - i * DAY))); if (c?.points) captures.push(c); }
    const card = await runHowRight({get, nowMs: t, spots, captures});
    return {...card, budget: {limit: run.limit, used: run.used, skipped: run.skipped}, stored: !!(store && bucket)};
  }
  return {
    /** The cron path: capture, score, store. Returns a short report. */
    async daily(env) {
      if (!env?.BUCKET) return {ok: false, reason: 'no bucket'};
      const card = await compute(env, true);
      await env.BUCKET.put(HOW_RIGHT_KEYS.card, JSON.stringify(card), {httpMetadata: {contentType: 'application/json'}});
      memo = {value: card, at: now()};
      return {ok: true, computedAt: card.computedAt, budget: card.budget, spots: Object.keys(card.spots).length};
    },
    async respond(env) {
      const out = (v) => Response.json(v, {headers: {'Cache-Control': 'public, max-age=900'}});
      if (persistent(env)) {
        if (memo && now() - memo.at < 1800000) return out(memo.value);
        const o = await env.BUCKET.get(HOW_RIGHT_KEYS.card), v = o ? await o.json() : null;
        if (v) { memo = {value: v, at: now()}; return out(v); }
        return Response.json({schema: 1, pending: true, note: 'Not computed yet: the daily job runs once a day at 00:30 UTC.'}, {headers: {'Cache-Control': 'no-store'}});
      }
      if (memo && now() - memo.at < 6 * 3600000) return out(memo.value);
      if (!job) job = compute(env, false).then((v) => { memo = {value: v, at: now()}; return v; }).finally(() => { job = null; });
      return out(await job);
    },
  };
}

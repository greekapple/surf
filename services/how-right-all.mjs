// "How right we've been" for every spot (round 4C), the server side. Rules and words: src/services/howRightAll.ts, src/ocean/scoringBuoys.ts; method and budget: docs/forecast/HOW-RIGHT-ALL.md.
// Own cron trigger (worker/cloudflare.mjs HRA_CRON, hourly 00:20-06:20 UTC), own subrequest budget; each tick does ONE thing, resumably:
//   1. CAPTURE what we show, once a day: for all 492 spots the Open-Meteo marine + wind hours (the next 48 h) and the app's rating of each; for each buoy a spot is scored against, the marine forecast at the buoy's position.
//      A spot with a fresh cached copy (the hot ones) costs 2 R2 reads; a spot without gets one marine and one wind fetch (10 locations per request, so 1 call each of Open-Meteo's weighted quota).
//      Stored as howright/v2/shown/<UTC date>.json; the object itself is the cursor (a tick fills the spots still missing).
//   2. once the capture is complete, SCORE: the last 30 captures against the buoys' realtime2 `.spec` and the shore stations' wind -> howright/v2/scorecard.json.
// An R2 read that throws aborts the tick before any write (never taken for "nothing there").
import {evidenceSpots} from '../src/ocean/spots.ts';
import {marineFields} from '../src/ocean/openMeteo.ts';
import {chooseBuoy, windowOf, scoringBuoy, SCORING_RULE} from '../src/ocean/scoringBuoys.ts';
import {shoreAssignmentFor} from '../src/ocean/shoreWind.ts';
import {HRA_RULE, captureSpot, captureBuoy, parseSpec, parseNdbcWind, parseAsosWind, iemAsosURL, offshoreRows, ratingRows, spotResult, kmBetween} from '../src/services/howRightAll.ts';

export const HRA_KEYS = {shown: (day) => `howright/v2/shown/${day}.json`, card: 'howright/v2/scorecard.json', status: 'howright/v2/_status.json', partial: 'howright/v2/_score-partial.json'};
/** Subrequests (fetches + R2 operations) one tick may use. */
export const HRA_BUDGET = 800;
export const HRA_BATCH = 10;          // locations per Open-Meteo request (weighted quota counts each location, so batching saves HTTP requests, not quota)
export const HRA_MAX_FAILS = 3;       // ticks a spot or buoy may fail in one day before it is set aside (listed in _status.json, left out of the "complete" test) so one bad point cannot block scoring
export const HRA_SCORE_STAGE = 70;    // spots per scoring stage (about 5 s of CPU: the whole day's score in one invocation was 14 s of the 30 s cron limit)
export const HRA_CHUNK = 100;         // spots per capture chunk: one R2 write per chunk keeps a killed tick from losing the whole day
const DAY = 86400000, utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
class R2ReadError extends Error {}

/** The buoy each spot is scored against (or why none): static, computed once. */
export function spotPicks() {
  return evidenceSpots.map((s) => { const c = chooseBuoy({lat: s.latitude, lon: s.longitude}, windowOf(s.id)); return {id: s.id, lat: s.latitude, lon: s.longitude, choice: c}; });
}
const marineQuery = (pts, days = 3) => new URLSearchParams({latitude: pts.map((p) => p.lat).join(','), longitude: pts.map((p) => p.lon).join(','), hourly: marineFields.join(','), timezone: 'GMT', timeformat: 'unixtime', forecast_days: String(days)});
const windQuery = (pts, days = 3) => new URLSearchParams({latitude: pts.map((p) => p.lat).join(','), longitude: pts.map((p) => p.lon).join(','), hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m', wind_speed_unit: 'mph', timezone: 'GMT', timeformat: 'unixtime', forecast_days: String(days)});
export const marineBatchURL = (pts) => 'https://marine-api.open-meteo.com/v1/marine?' + marineQuery(pts);
export const windBatchURL = (pts) => 'https://api.open-meteo.com/v1/forecast?' + windQuery(pts);

export function createHowRightAll({fetcher = fetch, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), politeMs = 600, timeoutMs = 30000, readLatest, hotIds, budget = HRA_BUDGET, picks = spotPicks(), onCapture = null, stageSize = HRA_SCORE_STAGE}) {
  let memo = null;
  const eligible = picks.filter((p) => p.choice.ok);
  const buoyPoints = () => { const m = new Map(); for (const p of eligible) { const b = p.choice.pick.buoy; m.set(b.id, {id: b.id, lat: b.lat, lon: b.lon}); } return [...m.values()]; };

  async function r2json(bucket, run, key) {
    run.used++; try { const o = await bucket.get(key); return o ? await o.json() : null; } catch (e) { throw new R2ReadError(`R2 read of ${key} failed: ${String(e?.message ?? e).slice(0, 80)}`); }
  }
  const put = (bucket, key, v) => bucket.put(key, JSON.stringify(v), {httpMetadata: {contentType: 'application/json'}});

  /** One Open-Meteo request: the payloads in order, or null on any failure. */
  async function openMeteo(url, n, run, first) {
    if (run.used >= run.limit) return null; run.used++; if (!first.v) await sleep(politeMs); first.v = false;
    try {
      const r = await fetcher(url, {signal: AbortSignal.timeout(timeoutMs)}); if (!r.ok) return null;
      const j = await r.json(); const arr = Array.isArray(j) ? j : [j]; return arr.length === n ? arr : null;
    } catch { return null; }
  }
  /** Payloads for `pts` (batched); when the batch fails its members are retried ONE BY ONE, so a single bad point costs only itself. null entries = failed. */
  async function payloads(urlOf, pts, run, first) {
    const all = await openMeteo(urlOf(pts), pts.length, run, first); if (all) return all;
    if (pts.length === 1) return [null];
    const out = []; for (const p of pts) { const one = await openMeteo(urlOf([p]), 1, run, first); out.push(one ? one[0] : null); }
    return out;
  }

  /** Capture: fill the spots and buoys still missing from today's object. Returns a short report. */
  async function capture(env) {
    const bucket = env?.BUCKET; if (!bucket) return {ok: false, reason: 'no bucket'};
    const t = now(), day = utcDay(t), run = {used: 0, limit: budget}, first = {v: true};
    let cap, st;
    try { st = (await r2json(bucket, run, HRA_KEYS.status)) ?? {}; cap = await r2json(bucket, run, HRA_KEYS.shown(day)); } catch (e) { return {ok: false, reason: e.message}; }
    const fails = st.captureDate === day ? {...(st.fails ?? {})} : {};
    if (!cap) cap = {schema: 2, date: day, capturedAt: new Date(t).toISOString(), spots: {}, buoys: {}};
    let hot = new Set(); try { hot = (await hotIds(env)) ?? new Set(); run.used += 2; } catch { /* no hot list: every spot is fetched */ }
    const setAside = (key) => (fails[key] ?? 0) >= HRA_MAX_FAILS;
    const todo = picks.filter((p) => !cap.spots[p.id] && !setAside(p.id));
    let cached = 0, fetched = 0, failed = 0, stopped = null; const tried = new Set();
    for (let i = 0; i < todo.length; i += HRA_CHUNK) {
      const chunk = todo.slice(i, i + HRA_CHUNK);
      if (run.used + chunk.length * 2 + Math.ceil(chunk.length / HRA_BATCH) * 2 + 4 > run.limit) { stopped = 'budget'; break; }
      const need = [];
      for (const p of chunk) {
        if (hot.has(p.id)) {
          run.used += 2;
          const [m, w] = await Promise.all([readLatest(env, 'marine-' + p.id).catch(() => null), readLatest(env, 'weather-' + p.id).catch(() => null)]);
          const okAge = (v, h) => v?.payload && Date.parse(v.retrievedAt ?? '') > t - h * 3600000;
          if (okAge(m, HRA_RULE.cacheMaxAgeH.marine) && okAge(w, HRA_RULE.cacheMaxAgeH.weather)) { const e = captureSpot(p.id, m.payload, w.payload, m.retrievedAt, w.retrievedAt, 'cache', t); if (e) { cap.spots[p.id] = e; cached++; continue; } }
        }
        need.push(p);
      }
      for (let j = 0; j < need.length; j += HRA_BATCH) {
        const b = need.slice(j, j + HRA_BATCH), pts = b.map((p) => evidenceSpotPoints(p.id));
        const mar = await payloads((q) => marineBatchURL(q), pts.map((x) => ({lat: x.mlat, lon: x.mlon})), run, first);
        const wnd = await payloads((q) => windBatchURL(q), pts.map((x) => ({lat: x.lat, lon: x.lon})), run, first);
        const at = new Date(now()).toISOString();
        b.forEach((p, k) => { tried.add(p.id); const e = mar[k] && wnd[k] ? captureSpot(p.id, mar[k], wnd[k], at, at, 'fetched', t) : null; if (e) { cap.spots[p.id] = e; fetched++; } else failed++; });
      }
      cap.updatedAt = new Date(now()).toISOString(); run.used++; await put(bucket, HRA_KEYS.shown(day), cap);
    }
    // the buoys: the forecast at each buoy's position (a batch, then singly if the batch failed)
    const wantBuoys = buoyPoints().filter((b) => !cap.buoys[b.id] && !setAside('buoy:' + b.id));
    if (wantBuoys.length && !stopped) {
      for (let j = 0; j < wantBuoys.length; j += HRA_BATCH) {
        const b = wantBuoys.slice(j, j + HRA_BATCH), mar = await payloads((q) => marineBatchURL(q), b, run, first), at = new Date(now()).toISOString();
        b.forEach((x, k) => { tried.add('buoy:' + x.id); const e = mar[k] ? captureBuoy(x.lat, x.lon, mar[k], at, t) : null; if (e) cap.buoys[x.id] = e; });
      }
      cap.updatedAt = new Date(now()).toISOString(); run.used++; await put(bucket, HRA_KEYS.shown(day), cap);
    }
    // a point that was tried and is still missing has failed this tick; after HRA_MAX_FAILS ticks it is set aside
    for (const k of tried) { const miss = k.startsWith('buoy:') ? !cap.buoys[k.slice(5)] : !cap.spots[k]; if (miss) fails[k] = (fails[k] ?? 0) + 1; else delete fails[k]; }
    const missSpots = picks.filter((p) => !cap.spots[p.id]).map((p) => p.id), missBuoys = buoyPoints().filter((b) => !cap.buoys[b.id]).map((b) => b.id);
    const excluded = [...missSpots.filter(setAside), ...missBuoys.filter((b) => setAside('buoy:' + b)).map((b) => 'buoy:' + b)];
    const missingSpots = missSpots.filter((id) => !setAside(id)).length, missingBuoys = missBuoys.filter((b) => !setAside('buoy:' + b)).length, complete = missingSpots === 0 && missingBuoys === 0;
    run.used++; await put(bucket, HRA_KEYS.status, {...st, schema: 1, captureDate: day, captureComplete: complete, captureSpots: Object.keys(cap.spots).length, captureBuoys: Object.keys(cap.buoys).length, missingSpots, missingBuoys, fails, excluded, updatedAt: new Date(now()).toISOString()});
    return {ok: true, step: 'capture', date: day, complete, spots: Object.keys(cap.spots).length, of: picks.length, buoys: Object.keys(cap.buoys).length, cached, fetched, failed, excluded, used: run.used, stopped};
  }

  /** Score, in STAGES: a stage takes HRA_SCORE_STAGE of the spots that have a buoy, reads the last 31 captures one at a time (newest first, never more than one parsed capture in memory) and keeps only their pairs;
   *  the partial results wait in howright/v2/_score-partial.json, and the stage that finishes the list writes the card. One stage is a few seconds of CPU instead of the whole day's score in one invocation. */
  async function score(env) {
    const bucket = env?.BUCKET; if (!bucket) return {ok: false, reason: 'no bucket'};
    const t = now(), day = utcDay(t), run = {used: 0, limit: budget};
    let st, prev, part; try { st = (await r2json(bucket, run, HRA_KEYS.status)) ?? {}; prev = await r2json(bucket, run, HRA_KEYS.card); part = await r2json(bucket, run, HRA_KEYS.partial); } catch (e) { return {ok: false, reason: e.message}; }
    if (!part || part.date !== day || part.done) { const to0 = Math.floor(t / 3600000) * 3600000; part = {date: day, to: to0, from: to0 - 30 * DAY, next: 0, spots: {}, buoys: {}, captureDays: 0, firstCapture: null, failedBuoys: []}; }
    const to = part.to, from = part.from, slice = eligible.slice(part.next, part.next + stageSize);
    const first = {v: true};
    const get = async (url) => { if (run.used >= run.limit) return null; run.used++; if (!first.v) await sleep(politeMs); first.v = false; try { const r = await fetcher(url, {headers: {'User-Agent': 'SWELLO-howright (public NDBC/IEM data)'}, signal: AbortSignal.timeout(timeoutMs)}); return r.ok ? await r.text() : null; } catch { return null; } };
    const wantBuoys = new Set(slice.map((p) => p.choice.pick.buoy.id)), obsByBuoy = new Map();
    for (const id of wantBuoys) { const text = await get(`https://www.ndbc.noaa.gov/data/realtime2/${id}.spec`); if (text) obsByBuoy.set(id, parseSpec(text)); else if (!part.failedBuoys.includes(id)) part.failedBuoys.push(id); }
    const stations = new Map(); for (const p of slice) { const a = shoreAssignmentFor(p.id); if (a) stations.set(a.kind + a.stationId, a); }
    const windByStation = new Map();
    for (const [k, a] of stations) { const text = await get(a.kind === 'ndbc' ? `https://www.ndbc.noaa.gov/data/realtime2/${a.stationId}.txt` : iemAsosURL(a.stationId, from, to)); if (text) windByStation.set(k, a.kind === 'ndbc' ? parseNdbcWind(text) : parseAsosWind(text)); }
    // stream the captures, newest first: each one contributes only its pairs (compact rows), then is dropped
    const scoredSpots = slice.filter((p) => obsByBuoy.has(p.choice.pick.buoy.id));
    const offshoreBy = new Map(), offClaimed = new Map(), ratingBy = new Map(), ratClaimed = new Map(), gridKm = new Map(); let captureDays = 0, firstCapture = null;
    for (const id of obsByBuoy.keys()) { offshoreBy.set(id, []); offClaimed.set(id, new Set()); }
    for (const p of scoredSpots) { ratingBy.set(p.id, []); ratClaimed.set(p.id, new Set()); }
    try {
      for (let d = 0; d <= 31 && (obsByBuoy.size || part.next === 0); d++) {
        const c = await r2json(bucket, run, HRA_KEYS.shown(utcDay(Date.parse(part.date + 'T12:00:00Z') - d * DAY))); if (!c?.spots) continue;
        captureDays++; if (!firstCapture || c.capturedAt < firstCapture) firstCapture = c.capturedAt;
        for (const [id, obs] of obsByBuoy) { for (const r of offshoreRows(c, id, obs, offClaimed.get(id), from, to)) offshoreBy.get(id).push(r); const b = c.buoys[id]; if (b?.grid && !gridKm.has(id)) gridKm.set(id, Math.round(kmBetween(b.lat, b.lon, b.grid.lat, b.grid.lon) * 10) / 10); }
        for (const p of scoredSpots) {
          const a = shoreAssignmentFor(p.id), wm = a ? windByStation.get(a.kind + a.stationId) : null;
          if (!c.spots[p.id]) continue;
          for (const r of ratingRows(p.id, c, obsByBuoy.get(p.choice.pick.buoy.id), (hr) => wm?.get(hr) ?? null, ratClaimed.get(p.id), from, to)) ratingBy.get(p.id).push(r);
        }
        onCapture?.(d);
      }
    } catch (e) { return {ok: false, reason: e.message}; }
    part.captureDays = Math.max(part.captureDays, captureDays); if (firstCapture && (!part.firstCapture || firstCapture < part.firstCapture)) part.firstCapture = firstCapture;
    const prevSpots = prev?.spots ?? {};
    for (const p of slice) {
      const pick = p.choice.pick, obs = obsByBuoy.get(pick.buoy.id);
      part.buoys[pick.buoy.id] = {name: scoringBuoy(pick.buoy.id)?.name ?? pick.buoy.id, ok: !!obs, why: obs ? null : 'its realtime data could not be fetched today'};
      if (!obs) {
        // the buoy's data could not be fetched: skip today, keep the history as the last check
        const was = prevSpots[p.id], last = was?.status === 'skipped' ? was.last : was?.status === 'ok' || was?.status === 'collecting' ? was : null, lastAt = was?.status === 'skipped' ? was.lastAt : last ? prev.computedAt : null;
        part.spots[p.id] = {status: 'skipped', spotId: p.id, buoy: {id: pick.buoy.id, name: pick.buoy.name, km: pick.km, bearing: pick.bearing, window: [pick.window.fromDeg, pick.window.toDeg], split: true, note: pick.buoy.why ?? null, gridKm: null}, reason: `buoy ${pick.buoy.id}'s data could not be fetched`, last, lastAt};
        continue;
      }
      const a = shoreAssignmentFor(p.id), wm = a ? windByStation.get(a.kind + a.stationId) : null, split = [...obs.values()].some((h) => h.swH !== null);
      const pairs = offshoreBy.get(pick.buoy.id).slice().sort((x, y) => x.t - y.t), rp = ratingBy.get(p.id).sort((x, y) => x.t - y.t), rating = split ? {pairs: rp, windHours: rp.filter((x) => x.station).length} : {pairs: [], windHours: 0};
      part.spots[p.id] = spotResult(p.id, pick, split, pairs, rating, a ? {id: a.stationId, name: a.stationName, km: a.distanceKm} : null, to, {stationFailed: !!a && !wm, gridKm: gridKm.get(pick.buoy.id) ?? null});
    }
    part.next += slice.length;
    if (part.next < eligible.length) { run.used++; await put(bucket, HRA_KEYS.partial, part); return {ok: true, step: 'score-stage', next: part.next, of: eligible.length, used: run.used}; }
    // the last stage: the card
    const spots = {};
    for (const p of picks) spots[p.id] = p.choice.ok ? part.spots[p.id] : {status: 'no-buoy', spotId: p.id, reason: p.choice.reason, nearest: p.choice.nearest};
    const card = {schema: 2, computedAt: new Date(t).toISOString(), from: new Date(from).toISOString(), to: new Date(to).toISOString(), captureDays: part.captureDays, firstCapture: part.firstCapture,
      rule: {minDays7: HRA_RULE.minDays7, minDays30: HRA_RULE.minDays30, shownMinLeadH: HRA_RULE.shownMinLeadH, maxKm: SCORING_RULE.maxKm, windows: HRA_RULE.windows}, buoys: part.buoys, spots, budget: {limit: run.limit, used: run.used + 3}};
    run.used += 3; await put(bucket, HRA_KEYS.card, card); await put(bucket, HRA_KEYS.partial, {date: day, done: true, to, from, next: part.next, spots: {}, buoys: {}, captureDays: 0, firstCapture: null, failedBuoys: []});
    await put(bucket, HRA_KEYS.status, {...st, schema: 1, cardDate: day, cardAt: card.computedAt, failedBuoys: part.failedBuoys});
    memo = {value: card, at: now()};
    const all = Object.values(spots);
    return {ok: true, step: 'score', used: run.used, captures: part.captureDays, spots: all.length, scored: all.filter((x) => x.status === 'ok').length, collecting: all.filter((x) => x.status === 'collecting').length, skipped: all.filter((x) => x.status === 'skipped').length, noBuoy: all.filter((x) => x.status === 'no-buoy').length};
  }

  return {
    capture, score,
    /** One cron tick: capture until today's capture is complete, then score once. Cheap no-op (one small read) otherwise. */
    async daily(env) {
      const bucket = env?.BUCKET; if (!bucket) return {ok: false, reason: 'no bucket'};
      const run = {used: 0, limit: budget}, day = utcDay(now());
      let st; try { st = await r2json(bucket, run, HRA_KEYS.status); } catch (e) { return {ok: false, reason: e.message}; }
      if (!st || st.captureDate !== day || !st.captureComplete) return capture(env);
      if (st.cardDate !== day) return score(env);
      return {ok: true, step: 'idle', date: day};
    },
    async respond(env, persistent) {
      const out = (v) => Response.json(v, {headers: {'Cache-Control': 'public, max-age=900'}});
      if (!persistent) return Response.json({schema: 2, pending: true, note: 'Not available in the preview: the daily job runs on the Worker.'}, {headers: {'Cache-Control': 'no-store'}});
      if (memo && now() - memo.at < 1800000) return out(memo.value);
      const o = await env.BUCKET.get(HRA_KEYS.card), v = o ? await o.json() : null;
      if (v) { memo = {value: v, at: now()}; return out(v); }
      return Response.json({schema: 2, pending: true, note: 'Not computed yet: the daily job starts at 00:20 UTC.'}, {headers: {'Cache-Control': 'no-store'}});
    },
  };
}
/** The app's two points for a spot: the marine grid point and the wind point (src/ocean/spots.ts). */
const byId = new Map(evidenceSpots.map((s) => [s.id, s]));
function evidenceSpotPoints(id) { const s = byId.get(id); return {mlat: s.marineLatitude, mlon: s.marineLongitude, lat: s.latitude, lon: s.longitude}; }

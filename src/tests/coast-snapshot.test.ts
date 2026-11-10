import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {allSpots} from '../data/catalog.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {ratingAt, snapshotAt, captureWindow} from '../services/coastSnapshot.ts';
import {createCoastRatings, COAST_KEYS} from '../../services/coast-ratings.mjs';
import {loadSnapshot, parseSnapshot, snapshotHour, clearSnapshotCache, SNAPSHOT_TTL_MS} from '../features/explore/coastSnapshot.ts';

const CAP = JSON.parse(readFileSync(new URL('./fixtures/coast-capture-2026-11-10.json', import.meta.url), 'utf8'));   // the real 2026-11-10 capture, 9 spots (it predates the onshore cap)
const T = (iso: string) => Date.parse(iso) / 1000, IDS = Object.keys(CAP.spots) as string[];
const asResponse = (h: any, u: any) => ({hourly: h, hourly_units: {time: 'unixtime', ...u}});
/** The independent path: the FULL 48 captured hours through normalizeOpenMeteo, then rateForecast at the hour, judged at the spot's own `ratedAt`. */
const direct = (id: string, tSec: number) => {
  const c = CAP.spots[id], recs = normalizeOpenMeteo(evidenceSpot(id)!, asResponse(c.marine, c.marineUnits), asResponse(c.wind, c.windUnits), c.retrievedAt), r = recs.find((x: any) => Date.parse(x.timestamp) === tSec * 1000)!;
  const got = Math.min(Date.parse(c.retrievedAt), Date.parse(c.windRetrievedAt)), rt = rateForecast(allSpots.find((s) => s.id === id)!, toLegacy(r), got);   // judged as of the model run: the older of its two retrievals
  return [rt.score, rt.category, rt.dark ? 1 : 0, Math.floor(got / 60000)];
};

test('the endpoint re-rates every captured spot at every hour exactly as rateForecast does on the same inputs (dark mark included), judged as of the model run, and says when that run was retrieved', () => {
  let checked = 0;
  for (const id of IDS) for (const i of [0, 7, 19, 33, 47]) { const t = CAP.spots[id].marine.time[i], got = ratingAt(id, CAP.spots[id], t)!; assert.deepEqual(got, direct(id, t), `${id} hour ${i}`); checked++; }
  assert.equal(checked, IDS.length * 5);
  const s = snapshotAt(CAP, T('2026-11-10T20:00:00Z') * 1000); assert.ok(s.ok); if (s.ok) { assert.equal(Object.keys(s.spots).length, IDS.length); assert.deepEqual(s.spots['spot-2'], direct('spot-2', T('2026-11-10T20:00:00Z'))); assert.equal(s.capturedAt, '2026-11-10T07:40:44.464Z'); assert.ok(Date.parse(s.retrievedFrom) <= Date.parse(s.retrievedTo) && Date.parse(s.retrievedTo) <= Date.parse(s.capturedAt) + 60000, 'the model runs were retrieved at or before the capture: ' + s.retrievedFrom + ' .. ' + s.retrievedTo); assert.equal(Math.floor(Date.parse(CAP.spots['spot-2'].retrievedAt) / 60000), s.spots['spot-2'][3]); assert.equal(s.from, '2026-11-10T08:00:00.000Z'); assert.equal(s.to, '2026-11-12T07:00:00.000Z'); }
});
test('the stored rating is never read: a capture whose stored ratings are garbage gives the same answer, and where the day predates the onshore cap the re-rating differs from the stored score', () => {
  const junk = JSON.parse(JSON.stringify(CAP)); for (const s of Object.values(junk.spots) as any[]) s.rating = s.rating.map(() => 99);
  const a = snapshotAt(CAP, T('2026-11-10T20:00:00Z') * 1000), b = snapshotAt(junk, T('2026-11-10T20:00:00Z') * 1000); assert.deepEqual(a, b);
  const c = CAP.spots['cs-crescent-city'], i = c.marine.time.indexOf(T('2026-11-10T08:00:00Z')), e = ratingAt('cs-crescent-city', c, c.marine.time[i])!;
  assert.equal(c.rating[i], 55, 'the capture stored 55'); assert.deepEqual([e[0], e[1]], [39, 'WEAK'], 're-rated now: the onshore wind caps it at 39');
});
test('the 48 h edge: the first and last captured hour answer, an hour before or after is "outside-capture", a half hour is refused, no capture is "no-capture"', () => {
  const first = T('2026-11-10T08:00:00Z') * 1000, last = T('2026-11-12T07:00:00Z') * 1000, w = captureWindow(CAP)!; assert.deepEqual([w.from, w.to], [first, last]); assert.equal((last - first) / 3600000 + 1, 48);
  assert.ok(snapshotAt(CAP, first).ok); assert.ok(snapshotAt(CAP, last).ok);
  const before = snapshotAt(CAP, first - 3600000), after = snapshotAt(CAP, last + 3600000); assert.deepEqual([before.ok, (before as any).reason], [false, 'outside-capture']); assert.deepEqual([after.ok, (after as any).reason], [false, 'outside-capture']); assert.equal((after as any).capturedAt, CAP.capturedAt);
  assert.deepEqual(snapshotAt(CAP, first + 1800000), {ok: false, reason: 'bad-hour'}); assert.deepEqual(snapshotAt(null, first), {ok: false, reason: 'no-capture'}); assert.deepEqual(snapshotAt({...CAP, spots: {}}, first), {ok: false, reason: 'no-capture'});
});
test('a spot with no wind or marine value at the hour, or not in the catalogue, is left out (never a made-up rating)', () => {
  const t = CAP.spots['spot-2'].marine.time[5], broken = JSON.parse(JSON.stringify(CAP.spots['spot-2'])); broken.wind.time = broken.wind.time.filter((x: number) => x !== t);
  assert.equal(ratingAt('spot-2', broken, t), null); assert.equal(ratingAt('not-a-spot', CAP.spots['spot-2'], t), null);
});

/* ---------- the Worker module: which capture, what it reads, no Open-Meteo ---------- */
const bucketOf = (objs: Record<string, unknown>) => { const calls: string[] = []; return {calls, get: async (k: string) => { calls.push(k); return k in objs ? {json: async () => JSON.parse(JSON.stringify(objs[k]))} : null; }}; };
const NOW = Date.parse('2026-11-10T16:00:00Z'), q = (t: string) => new Request('http://x/api/coast-ratings?t=' + t);
test('the Worker answers from the newest COMPLETE capture, reads only R2 (no fetch at all), and caches per capture and hour', async () => {
  const realFetch = globalThis.fetch; let fetched = 0; globalThis.fetch = (async () => { fetched++; throw new Error('no network in this module'); }) as typeof fetch;
  try {
    const b = bucketOf({[COAST_KEYS.status]: {captureDate: '2026-11-10', captureComplete: true}, [COAST_KEYS.shown('2026-11-10')]: CAP}), svc = createCoastRatings({now: () => NOW, ids: IDS});
    const r1 = await svc.respond(b, q('2026-11-10T20:00:00Z')), body1 = await r1.text(); assert.equal(r1.status, 200); assert.match(r1.headers.get('Cache-Control')!, /max-age=300/); const j = JSON.parse(body1); assert.equal(j.ok, true); assert.equal(Object.keys(j.spots).length, IDS.length);
    const reads = b.calls.length, r2 = await svc.respond(b, q('2026-11-10T20:00:00Z')); assert.equal(await r2.text(), body1); assert.equal(b.calls.length, reads, 'the capture and the hour are cached: no more reads');
    const r3 = await svc.respond(b, q('2026-11-10T21:00:00Z')); assert.equal(b.calls.length, reads, 'another hour re-rates from the held capture without reading again'); assert.equal(JSON.parse(await r3.text()).t, '2026-11-10T21:00:00.000Z');
    assert.equal(fetched, 0);
  } finally { globalThis.fetch = realFetch; }
});
test('an incomplete capture is skipped for the previous complete one; with none, "no-capture"; a bad hour is a 400; a failed R2 read is a 503, never "nothing there"', async () => {
  const partial = {...CAP, date: '2026-11-10', spots: {'spot-2': CAP.spots['spot-2']}}, yesterday = {...CAP, date: '2026-11-09'};
  const b = bucketOf({[COAST_KEYS.status]: {captureDate: '2026-11-10', captureComplete: false}, [COAST_KEYS.shown('2026-11-10')]: partial, [COAST_KEYS.shown('2026-11-09')]: yesterday});
  const j = JSON.parse(await (await createCoastRatings({now: () => NOW, ids: IDS}).respond(b, q('2026-11-10T20:00:00Z'))).text()); assert.equal(j.date, '2026-11-09', 'today is partial and not flagged complete: yesterday is served');
  const none = await createCoastRatings({now: () => NOW, ids: IDS}).respond(bucketOf({}), q('2026-11-10T20:00:00Z')); assert.deepEqual(JSON.parse(await none.text()), {ok: false, reason: 'no-capture'});
  const old = bucketOf({[COAST_KEYS.shown('2026-11-07')]: CAP}); assert.equal(JSON.parse(await (await createCoastRatings({now: () => NOW, ids: IDS}).respond(old, q('2026-11-10T20:00:00Z'))).text()).ok, false, 'a capture three days old is not served');
  assert.equal((await createCoastRatings({now: () => NOW}).respond(bucketOf({}), q('2026-11-10T20:30:00Z'))).status, 400);
  const boom = {get: async () => { throw new Error('r2 down'); }}; assert.equal((await createCoastRatings({now: () => NOW, ids: IDS}).respond(boom, q('2026-11-10T20:00:00Z'))).status, 503);
  const out = JSON.parse(await (await createCoastRatings({now: () => NOW, ids: IDS}).respond(bucketOf({[COAST_KEYS.status]: {captureDate: '2026-11-10', captureComplete: true}, [COAST_KEYS.shown('2026-11-10')]: CAP}), q('2026-11-12T08:00:00Z'))).text()); assert.deepEqual([out.ok, out.reason], [false, 'outside-capture']);
});

/* ---------- the page's side ---------- */
test('the client: only a whole hour is asked for, one request per hour (shared while in flight), kept 10 minutes then asked again, a mismatched answer is refused', async () => {
  clearSnapshotCache(); assert.equal(snapshotHour('2026-11-10T20:30:00Z'), null); assert.equal(snapshotHour('2026-11-10T20:00:00Z'), '2026-11-10T20:00:00.000Z'); assert.equal(snapshotHour(null), null);
  const ok = snapshotAt(CAP, T('2026-11-10T20:00:00Z') * 1000); let n = 0, clock = 1000;
  const f = (async (u: string) => { n++; assert.match(String(u), /^\/api\/coast-ratings\?t=2026-11-10T20%3A00%3A00.000Z$/); return new Response(JSON.stringify(ok)); }) as unknown as typeof fetch, opts = {now: () => clock, retryMs: 1};
  const [a, b] = await Promise.all([loadSnapshot('2026-11-10T20:00:00Z', f, opts), loadSnapshot('2026-11-10T20:00:00Z', f, opts)]); assert.equal(n, 1); assert.ok(a && a === b); assert.equal(a!.capturedAt, CAP.capturedAt); assert.deepEqual(a!.byId.get('spot-2'), (ok as any).spots['spot-2']); assert.ok(a!.retrievedFrom && a!.retrievedTo);
  clock += SNAPSHOT_TTL_MS - 1; await loadSnapshot('2026-11-10T20:00:00Z', f, opts); assert.equal(n, 1, 'still held at 9 min 59 s');
  clock += 2; await loadSnapshot('2026-11-10T20:00:00Z', f, opts); assert.equal(n, 2, 'asked again after 10 minutes (a new capture is picked up)');
  assert.equal(parseSnapshot({ok: true, capturedAt: 'x', t: '2026-11-10T19:00:00.000Z', spots: {}}, '2026-11-10T20:00:00.000Z'), null, 'an answer for another hour is refused'); assert.equal(parseSnapshot({ok: false, reason: 'outside-capture'}, '2026-11-10T20:00:00.000Z'), null);
  clearSnapshotCache();
});
test('the client retries once after a few seconds when the request fails (HTTP error or network), never on a well-formed "not available", and does not remember a failure', async () => {
  clearSnapshotCache(); const ok = snapshotAt(CAP, T('2026-11-10T20:00:00Z') * 1000); let n = 0;
  const flaky = (async () => { n++; if (n === 1) return new Response('{}', {status: 503}); return new Response(JSON.stringify(ok)); }) as unknown as typeof fetch;
  const r = await loadSnapshot('2026-11-10T20:00:00Z', flaky, {retryMs: 5}); assert.ok(r); assert.equal(n, 2, 'one retry, and it worked');
  clearSnapshotCache(); n = 0; const net = (async () => { n++; if (n === 1) throw new Error('offline'); return new Response(JSON.stringify(ok)); }) as unknown as typeof fetch; assert.ok(await loadSnapshot('2026-11-10T20:00:00Z', net, {retryMs: 5})); assert.equal(n, 2);
  clearSnapshotCache(); n = 0; const down = (async () => { n++; return new Response('{}', {status: 503}); }) as unknown as typeof fetch; assert.equal(await loadSnapshot('2026-11-10T20:00:00Z', down, {retryMs: 5}), null); assert.equal(n, 2, 'tried twice, then null'); assert.equal(await loadSnapshot('2026-11-10T20:00:00Z', down, {retryMs: 5}), null); assert.equal(n, 4, 'a failure is not remembered: asked again next time');
  clearSnapshotCache(); n = 0; const outside = (async () => { n++; return new Response(JSON.stringify({ok: false, reason: 'outside-capture'})); }) as unknown as typeof fetch; assert.equal(await loadSnapshot('2026-11-10T20:00:00Z', outside, {retryMs: 5}), null); assert.equal(n, 1, 'a well-formed "not available" is final: no retry');
  clearSnapshotCache();
});
test('Worker: concurrent requests share one load; "no complete capture" is remembered for 60 s; the edge cache (caches.default) is used when there is one', async () => {
  const objs = {[COAST_KEYS.status]: {captureDate: '2026-11-10', captureComplete: true}, [COAST_KEYS.shown('2026-11-10')]: CAP};
  const b = bucketOf(objs), svc = createCoastRatings({now: () => NOW, ids: IDS}), req = (t: string) => new Request('http://x/api/coast-ratings?t=' + t);
  const rs = await Promise.all([svc.respond(b, req('2026-11-10T20:00:00Z')), svc.respond(b, req('2026-11-10T21:00:00Z')), svc.respond(b, req('2026-11-10T22:00:00Z'))]); assert.ok(rs.every((r) => r.status === 200)); assert.equal(b.calls.filter((k) => k === COAST_KEYS.status).length, 1, 'one status read for three concurrent requests'); assert.equal(b.calls.filter((k) => k === COAST_KEYS.shown('2026-11-10')).length, 1);
  let clock = NOW; const none = bucketOf({}), svc2 = createCoastRatings({now: () => clock, ids: IDS});
  await svc2.respond(none, req('2026-11-10T20:00:00Z')); const reads = none.calls.length; assert.ok(reads >= 4, 'status plus three days'); clock += 59000; await svc2.respond(none, req('2026-11-10T20:00:00Z')); assert.equal(none.calls.length, reads, 'no new reads within 60 s'); clock += 2000; await svc2.respond(none, req('2026-11-10T20:00:00Z')); assert.ok(none.calls.length > reads, 'looked again after 60 s');
  const store = new Map<string, Response>(), puts: string[] = []; (globalThis as any).caches = {default: {match: async (u: string) => store.get(u)?.clone(), put: async (u: string, r: Response) => { puts.push(u); store.set(u, r); }}};
  try {
    const b2 = bucketOf(objs), svc3 = createCoastRatings({now: () => NOW, ids: IDS}), waits: Promise<unknown>[] = [], ctx = {waitUntil: (p: Promise<unknown>) => { waits.push(p); }};
    const r1 = await svc3.respond(b2, req('2026-11-10T20:00:00Z'), ctx); await Promise.all(waits); assert.equal(puts.length, 1); const reads2 = b2.calls.length;
    const r2 = await createCoastRatings({now: () => NOW, ids: IDS}).respond(b2, req('2026-11-10T20:00:00Z'), ctx); assert.equal(await r2.text(), await r1.text()); assert.equal(b2.calls.length, reads2, 'the edge cache answered: no R2 read at all');
    const bad = await svc3.respond(b2, req('2026-11-14T20:00:00Z'), ctx); await Promise.all(waits); assert.equal(puts.length, 1, 'a "not available" answer is not put in the edge cache');
  } finally { delete (globalThis as any).caches; }
});

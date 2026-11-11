import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceAllows, framingAllowed, createEmbedAllowed, OUR_ORIGIN, ALLOWED_TTL_MS, MISS_TTL_MS} from '../../services/embed-allowed.mjs';
import {LIVE_CAMS} from '../data/liveCamsSourced.ts';

const CURRENT = "frame-ancestors 'self' https://hdontap.com https://*.hdontap.com";
const ID = LIVE_CAMS.find((c) => c.kind === 'hdontap' && c.embedId)!.embedId!;
test('today\'s HDOnTap header does NOT allow our origin; adding our origin (or a pattern that matches it) does', () => {
  assert.equal(OUR_ORIGIN, 'https://swello.surf-prototype.workers.dev');
  assert.equal(framingAllowed([CURRENT], null), false);
  assert.equal(framingAllowed([`${CURRENT} https://swello.surf-prototype.workers.dev`], null), true);
  assert.equal(framingAllowed([`${CURRENT} https://*.surf-prototype.workers.dev`], null), true, 'our host is a subdomain of that pattern'); assert.equal(framingAllowed([`${CURRENT} https://*.other-proto.workers.dev`], null), false);
  assert.equal(framingAllowed([`${CURRENT} https://*.workers.dev`], null), true); assert.equal(framingAllowed([`${CURRENT} *`], null), true); assert.equal(framingAllowed([`${CURRENT} https:`], null), true);
});
test('source expressions: self and none never allow us; scheme, port and host must match; look-alike hosts do not', () => {
  for (const s of ["'self'", "'none'", 'https://hdontap.com', 'https://swello.surf-prototype.workers.dev.evil.com', 'http://swello.surf-prototype.workers.dev', 'https://swello.surf-prototype.workers.dev:8443', 'https://notswello.surf-prototype.workers.dev', '', 'garbage ((']) assert.equal(sourceAllows(s), false, s);
  for (const s of ['https://swello.surf-prototype.workers.dev', 'HTTPS://SWELLO.SURF-PROTOTYPE.WORKERS.DEV', 'https://swello.surf-prototype.workers.dev:443', 'swello.surf-prototype.workers.dev', 'https://*.workers.dev', '*']) assert.equal(sourceAllows(s), true, s);
});
test('every Content-Security-Policy header must allow us; frame-ancestors beats X-Frame-Options; X-Frame-Options alone: DENY / SAMEORIGIN forbid, ALLOW-FROM only an exact match; no header at all forbids nothing', () => {
  assert.equal(framingAllowed(['frame-ancestors https://swello.surf-prototype.workers.dev', CURRENT], null), false, 'a second policy that does not list us');
  assert.equal(framingAllowed(["default-src 'self'; frame-ancestors https://swello.surf-prototype.workers.dev; img-src *"], 'DENY'), true, 'CSP frame-ancestors is what browsers obey');
  assert.equal(framingAllowed([], 'DENY'), false); assert.equal(framingAllowed([], 'SAMEORIGIN'), false); assert.equal(framingAllowed([], 'ALLOW-FROM https://swello.surf-prototype.workers.dev'), true); assert.equal(framingAllowed([], 'ALLOW-FROM https://other.example'), false);
  assert.equal(framingAllowed(["default-src 'self'"], null), true, 'a CSP without frame-ancestors, and no X-Frame-Options'); assert.equal(framingAllowed([], null), true);
});
const hdr = (csp: string | null, xfo: string | null = null) => new Headers({...(csp ? {'content-security-policy': csp} : {}), ...(xfo ? {'x-frame-options': xfo} : {})});
test('/api/embed-allowed: one HEAD to the camera\'s own player page with the project User-Agent; allowed only on a match; unknown id = 404; no arbitrary URL', async () => {
  const calls: {url: string; method: string; ua: string}[] = []; let t = 1_000_000, csp: string | null = CURRENT, status = 200;
  const fetcher = async (url: string, o: {method: string; headers: Record<string, string>}) => { calls.push({url, method: o.method, ua: o.headers['User-Agent']}); return new Response(null, {status, headers: hdr(csp)}); };
  const svc = createEmbedAllowed({fetcher: fetcher as never, now: () => t});
  assert.equal((await svc.respond(new URL('http://x/api/embed-allowed?id=https://evil.example'))).status, 404); assert.equal((await svc.respond(new URL('http://x/api/embed-allowed'))).status, 404); assert.equal(calls.length, 0, 'nothing is fetched for an unknown id');
  const a = await (await svc.respond(new URL(`http://x/api/embed-allowed?id=${ID}`))).json(); assert.equal(a.allowed, false); assert.equal(calls.length, 1);
  assert.deepEqual([calls[0].method, calls[0].ua], ['HEAD', 'SWELLO surf forecast prototype']); assert.match(calls[0].url, /^https:\/\/portal\.hdontap\.com\/s\/embed\/\?stream=/); assert.ok(calls[0].url.includes(ID));
  await svc.respond(new URL(`http://x/api/embed-allowed?id=${ID}`)); assert.equal(calls.length, 1, 'cached');
  t += MISS_TTL_MS + 1; csp = `${CURRENT} ${OUR_ORIGIN}`; const b = await (await svc.respond(new URL(`http://x/api/embed-allowed?id=${ID}`))).json(); assert.equal(b.allowed, true, 'switches on within a minute of HDOnTap\'s change'); assert.equal(calls.length, 2);
  t += ALLOWED_TTL_MS - 1; await svc.respond(new URL(`http://x/api/embed-allowed?id=${ID}`)); assert.equal(calls.length, 2, 'an allowed answer is kept 10 minutes');
  t += 2; csp = CURRENT; assert.equal((await (await svc.respond(new URL(`http://x/api/embed-allowed?id=${ID}`))).json()).allowed, false, 'and withdrawn again after expiry'); assert.equal(calls.length, 3);
});
test('any doubt is "not allowed": a non-2xx answer, a thrown request, and a missing header on an error page', async () => {
  let t = 5_000_000, mode: 'ok403' | 'throw' | 'redirect' = 'ok403';
  const fetcher = async () => { if (mode === 'throw') throw new Error('timeout'); return new Response(null, {status: mode === 'redirect' ? 302 : 403, headers: hdr(null)}); };
  const svc = createEmbedAllowed({fetcher: fetcher as never, now: () => t});
  for (const m of ['ok403', 'throw', 'redirect'] as const) { mode = m; t += MISS_TTL_MS + 1; assert.equal((await svc.lookup(ID)).allowed, false, m); }
});
